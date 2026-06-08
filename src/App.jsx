import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

// ── World Gym brand colours ───────────────────────────────────
const WG = {
  red: '#B92339', redDark: '#96192d', redLight: '#f5e6e9',
  black: '#111111', darkGrey: '#1e1e1e', midGrey: '#2e2e2e',
  border: '#e5e5e5', borderDark: '#333333', bg: '#f8f8f8',
  white: '#ffffff', textMuted: '#888888', textLight: '#aaaaaa',
  green: '#1e7e34', greenLight: '#eaf5ec', greenBorder: '#b3d9bb',
}

const DEFAULT_CLASSES = ['Mat Pilates', 'Reformer', 'Barre', 'Core & Stretch', 'Beginners Pilates']
const TODAY = new Date().toISOString().split('T')[0]
const ROLES = { admin: 'Admin', management: 'Management', instructor: 'Instructor' }

// ── Date helpers ─────────────────────────────────────────────
function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function getInitials(name) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

// Returns { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', label: 'Mon DD Mon – Sun DD Mon' }
function getPreviousWeek() {
  const now = new Date()
  const day = now.getDay() // 0=Sun,1=Mon,...,6=Sat
  // Days since last Monday
  const daysSinceMon = day === 0 ? 6 : day - 1
  // End of previous week = last Sunday
  const lastSun = new Date(now); lastSun.setDate(now.getDate() - daysSinceMon - 1)
  // Start of previous week = 6 days before that Sunday
  const lastMon = new Date(lastSun); lastMon.setDate(lastSun.getDate() - 6)
  const fmt = d => d.toISOString().split('T')[0]
  const fmtLabel = d => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  return {
    start: fmt(lastMon),
    end: fmt(lastSun),
    label: `${fmtLabel(lastMon)} – ${fmtLabel(lastSun)}`
  }
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  a.click(); URL.revokeObjectURL(url)
}

function exportAttendanceCSV(sessions, studioName, suffix = '') {
  const rows = [['Date', 'Class', 'Client']]
  sessions.forEach(s => (s.attended || []).forEach(a => rows.push([s.date, s.class_type, a])))
  downloadCSV(rows, `${studioName.replace(/\s+/g, '-').toLowerCase()}-attendance${suffix}.csv`)
}

// ── Shared styles ─────────────────────────────────────────────
const S = {
  lbl: { display: 'block', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: WG.textMuted, marginBottom: 5, fontFamily: 'Georgia, serif' },
  sel: { width: '100%', padding: '10px 14px', borderRadius: 6, border: `1px solid ${WG.border}`, background: WG.white, fontSize: 14, fontFamily: 'Georgia, serif', color: WG.black, outline: 'none', boxSizing: 'border-box' },
  inp: { width: '100%', padding: '10px 14px', borderRadius: 6, border: `1px solid ${WG.border}`, background: WG.white, fontSize: 14, fontFamily: 'Georgia, serif', color: WG.black, outline: 'none', boxSizing: 'border-box' },
  bigBtn: { width: '100%', padding: '14px', background: WG.red, color: WG.white, border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'Georgia, serif', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700 },
  ghostBtn: { width: '100%', padding: '13px', background: 'transparent', color: WG.textMuted, border: `1.5px solid ${WG.border}`, borderRadius: 8, fontSize: 12, fontFamily: 'Georgia, serif', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' },
  dangerBtn: { width: '100%', padding: '13px', background: 'transparent', color: '#c0392b', border: '1.5px solid #f5c6bc', borderRadius: 8, fontSize: 12, fontFamily: 'Georgia, serif', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' },
  card: { background: WG.white, borderRadius: 10, border: `1px solid ${WG.border}`, overflow: 'hidden', marginBottom: 16 },
  cardHead: { padding: '11px 16px', background: '#f2f2f2', borderBottom: `1px solid ${WG.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `1px solid #f5f5f5` },
  empty: { padding: '36px 20px', textAlign: 'center', color: WG.textLight, fontSize: 14, fontFamily: 'Georgia, serif' },
  ok: { padding: '11px 14px', background: WG.greenLight, border: `1px solid ${WG.greenBorder}`, borderRadius: 8, fontSize: 13, color: WG.green, marginBottom: 14, fontFamily: 'Georgia, serif' },
  warn: { padding: '11px 14px', background: '#fff8f0', border: '1px solid #f5d8b0', borderRadius: 8, fontSize: 13, color: '#9a6020', marginBottom: 14, fontFamily: 'Georgia, serif' },
  err: { padding: '11px 14px', background: '#fff0f2', border: `1px solid #f5b8c0`, borderRadius: 8, fontSize: 13, color: WG.red, marginBottom: 14, fontFamily: 'Georgia, serif' },
  sectionTitle: { fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: WG.textLight, fontFamily: 'Georgia, serif', marginBottom: 10, marginTop: 24 },
  roleBadge: (role) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: role === 'admin' ? WG.red : role === 'management' ? '#e8f0fb' : '#f2f2f2', color: role === 'admin' ? WG.white : role === 'management' ? '#1a5fa8' : '#666' }),
}

// ═══════════════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════════════
function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const handle = async () => {
    setLoading(true); setErr(''); setMsg('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErr(error.message)
    } else if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setErr(error.message)
      else setMsg('Check your email to confirm your account, then log in.')
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) setErr(error.message)
      else setMsg('Password reset email sent.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: WG.black, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ marginBottom: 36, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ width: 44, height: 44, background: WG.red, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: WG.white, fontWeight: 900, fontSize: 22, fontFamily: 'Arial Black, sans-serif' }}>W</span>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: WG.white, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Arial Black, sans-serif', lineHeight: 1 }}>WORLD GYM</div>
            <div style={{ fontSize: 11, color: WG.red, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'Georgia, serif', marginTop: 2 }}>Studio Roll</div>
          </div>
        </div>
      </div>
      <div style={{ background: WG.white, borderRadius: 12, padding: 28, width: '100%', maxWidth: 380 }}>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 20, color: WG.black }}>
          {mode === 'login' ? 'Instructor Login' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
        </div>
        {err && <div style={S.err}>{err}</div>}
        {msg && <div style={S.ok}>{msg}</div>}
        <div style={{ marginBottom: 14 }}>
          <label style={S.lbl}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@worldgym.com.au" style={S.inp} onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>
        {mode !== 'forgot' && (
          <div style={{ marginBottom: 20 }}>
            <label style={S.lbl}>Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" style={S.inp} onKeyDown={e => e.key === 'Enter' && handle()} />
          </div>
        )}
        <button onClick={handle} disabled={loading} style={{ ...S.bigBtn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
        </button>
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {mode === 'login' && <>
            <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: WG.textMuted, fontSize: 13, fontFamily: 'Georgia, serif', cursor: 'pointer' }}>No account? Sign up</button>
            <button onClick={() => setMode('forgot')} style={{ background: 'none', border: 'none', color: WG.textLight, fontSize: 12, fontFamily: 'Georgia, serif', cursor: 'pointer' }}>Forgot password?</button>
          </>}
          {mode !== 'login' && <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: WG.textMuted, fontSize: 13, fontFamily: 'Georgia, serif', cursor: 'pointer' }}>Back to login</button>}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: WG.black, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontFamily: 'Georgia, serif', fontSize: 14 }}>Loading...</div>
    </div>
  )
  if (!session) return <AuthScreen />
  return <Dashboard user={session.user} />
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({ user }) {
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('roll')
  const [studios, setStudios] = useState([])
  const [studioId, setStudioId] = useState(null)
  const [studioName, setStudioName] = useState('')
  const [classes, setClasses] = useState(DEFAULT_CLASSES)
  const [clients, setClients] = useState([])
  const [sessions, setSessions] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [newStudioName, setNewStudioName] = useState('')
  const [showAddStudio, setShowAddStudio] = useState(false)

  // Roll
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [checkedIn, setCheckedIn] = useState({})
  const [guestName, setGuestName] = useState('')
  const [guests, setGuests] = useState([]) // names added by instructor for this session only
  const [rollMsg, setRollMsg] = useState('')
  const [showGuestInput, setShowGuestInput] = useState(false)

  // Clients (instructor add)
  const [newClientName, setNewClientName] = useState('')

  // History
  const [filterClass, setFilterClass] = useState('All')

  const flash = (setter, msg, ms = 3000) => { setter(msg); setTimeout(() => setter(''), ms) }

  const role = profile?.role || 'admin'
  const isAdmin = role === 'admin'
  const isManagement = role === 'management'
  const canSeeHistory = isAdmin || isManagement
  const canSeeSettings = isAdmin || isManagement

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
    setProfile(data)
    await loadStudios(data?.role || 'instructor')
  }

  const loadStudios = async (userRole) => {
    let query = supabase.from('studios').select('*').order('name')
    if (userRole !== 'admin') {
      const { data: memberships } = await supabase.from('studio_members').select('studio_id').eq('user_id', user.id)
      const ids = memberships?.map(m => m.studio_id) || []
      if (!ids.length) { setStudios([]); setLoadingData(false); return }
      query = query.in('id', ids)
    }
    const { data } = await query
    if (data?.length) {
      setStudios(data); setStudioId(data[0].id); setStudioName(data[0].name)
      const cls = data[0].classes || DEFAULT_CLASSES
      setClasses(cls); setSelectedClass(cls[0] || '')
    } else { setStudios([]) }
    setLoadingData(false)
  }

  useEffect(() => {
    if (!studioId) return
    loadClients(); loadSessions(); setCheckedIn({}); setGuests([])
  }, [studioId])

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('name').eq('studio_id', studioId).order('name')
    setClients(data?.map(c => c.name) || [])
  }

  const loadSessions = async () => {
    const { data } = await supabase.from('sessions').select('*').eq('studio_id', studioId).order('date', { ascending: false })
    setSessions(data || [])
  }

  const switchStudio = (id) => {
    const s = studios.find(x => x.id === id)
    setStudioId(id); setStudioName(s?.name || '')
    const cls = s?.classes || DEFAULT_CLASSES
    setClasses(cls); setSelectedClass(cls[0] || '')
    setGuests([]); setCheckedIn({})
    setTab('roll')
  }

  const addStudio = async () => {
    const name = newStudioName.trim(); if (!name) return
    const { data, error } = await supabase.from('studios').insert({ name, owner_id: user.id, classes: DEFAULT_CLASSES }).select().single()
    if (!error && data) {
      const updated = [...studios, data].sort((a, b) => a.name.localeCompare(b.name))
      setStudios(updated); switchStudio(data.id)
      setNewStudioName(''); setShowAddStudio(false)
    }
  }

  // ── Roll ──
  const addGuest = () => {
    const name = guestName.trim()
    if (!name || guests.includes(name) || clients.includes(name)) return
    setGuests(prev => [...prev, name])
    setCheckedIn(prev => ({ ...prev, [name]: true }))
    setGuestName(''); setShowGuestInput(false)
  }

  const removeGuest = (name) => {
    setGuests(prev => prev.filter(g => g !== name))
    setCheckedIn(prev => { const n = { ...prev }; delete n[name]; return n })
  }

  const allRollNames = [...clients, ...guests]

  const saveRoll = async () => {
    const attended = allRollNames.filter(c => checkedIn[c])
    if (!attended.length) { flash(setRollMsg, 'Tick at least one client first'); return }
    const { error } = await supabase.from('sessions').insert({ studio_id: studioId, date: selectedDate, class_type: selectedClass, attended })
    if (error) { flash(setRollMsg, 'Error saving — try again'); return }
    await loadSessions(); setCheckedIn({}); setGuests([]); setShowGuestInput(false)
    flash(setRollMsg, `✓ Saved — ${attended.length} client${attended.length !== 1 ? 's' : ''} attended`)
  }

  // ── Clients (instructor manual add to permanent list) ──
  const addClient = async () => {
    const name = newClientName.trim()
    if (!name || clients.includes(name)) return
    const { error } = await supabase.from('clients').insert({ studio_id: studioId, name })
    if (!error) { await loadClients(); setNewClientName('') }
  }

  const removeClient = async (name) => {
    await supabase.from('clients').delete().eq('studio_id', studioId).eq('name', name)
    await loadClients()
  }

  const deleteSession = async (id) => {
    await supabase.from('sessions').delete().eq('id', id)
    await loadSessions()
  }

  const saveClasses = async (updated) => {
    setClasses(updated)
    if (updated.length && !updated.includes(selectedClass)) setSelectedClass(updated[0])
    await supabase.from('studios').update({ classes: updated }).eq('id', studioId)
    setStudios(prev => prev.map(s => s.id === studioId ? { ...s, classes: updated } : s))
  }

  const renameStudio = async (newName) => {
    if (!newName.trim()) return
    await supabase.from('studios').update({ name: newName.trim() }).eq('id', studioId)
    setStudioName(newName.trim())
    setStudios(prev => prev.map(s => s.id === studioId ? { ...s, name: newName.trim() } : s).sort((a, b) => a.name.localeCompare(b.name)))
  }

  const deleteStudio = async () => {
    await supabase.from('studios').delete().eq('id', studioId)
    const remaining = studios.filter(s => s.id !== studioId)
    setStudios(remaining)
    if (remaining.length) switchStudio(remaining[0].id)
    else { setStudioId(null); setStudioName(''); setClients([]); setSessions([]) }
  }

  // ── Stats ──
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthSessions = sessions.filter(s => s.date.startsWith(thisMonth))
  const monthClients = new Set(monthSessions.flatMap(s => s.attended || [])).size
  const filteredSessions = filterClass === 'All' ? sessions : sessions.filter(s => s.class_type === filterClass)

  // ── Tabs ──
  const tabs = [
    ['roll', 'Roll'],
    ['clients', 'Clients'],
    ...(canSeeHistory ? [['history', 'History']] : []),
    ...(canSeeSettings ? [['settings', 'Settings']] : []),
  ]

  if (!loadingData && studios.length === 0) return (
    <div style={{ minHeight: '100vh', background: WG.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Georgia, serif' }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: WG.black }}>{isAdmin ? 'No studios yet' : 'No studios assigned'}</div>
      <div style={{ fontSize: 14, color: WG.textMuted, marginBottom: 28, textAlign: 'center', maxWidth: 300 }}>{isAdmin ? 'Create your first studio to get started.' : 'Contact your admin to get assigned to a studio.'}</div>
      {isAdmin && (
        <div style={{ width: '100%', maxWidth: 360 }}>
          <input value={newStudioName} onChange={e => setNewStudioName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStudio()} placeholder="Studio name (e.g. World Gym Mandurah)" style={{ ...S.inp, marginBottom: 12 }} />
          <button onClick={addStudio} style={S.bigBtn}>Add Studio</button>
        </div>
      )}
      <button onClick={() => supabase.auth.signOut()} style={{ ...S.ghostBtn, maxWidth: 360, marginTop: 12 }}>Log Out</button>
    </div>
  )

  if (loadingData) return (
    <div style={{ minHeight: '100vh', background: WG.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: WG.textLight, fontFamily: 'Georgia, serif' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: WG.bg, fontFamily: 'Georgia, serif', color: WG.black }}>

      {/* ── HEADER ── */}
      <div style={{ background: WG.black, padding: '0 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, background: WG.red, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: WG.white, fontWeight: 900, fontSize: 16, fontFamily: 'Arial Black, sans-serif' }}>W</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: WG.white, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Arial Black, sans-serif', lineHeight: 1 }}>WORLD GYM</div>
                <div style={{ fontSize: 9, color: WG.red, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Georgia, serif' }}>Studio Roll</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {studios.length > 1 && (
                <select value={studioId || ''} onChange={e => switchStudio(e.target.value)} style={{ background: WG.midGrey, border: `1px solid ${WG.borderDark}`, color: '#ccc', borderRadius: 5, padding: '5px 8px', fontSize: 12, fontFamily: 'Georgia, serif', outline: 'none' }}>
                  {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {studios.length === 1 && <span style={{ fontSize: 12, color: '#666' }}>{studioName}</span>}
              {isAdmin && (
                <button onClick={() => setShowAddStudio(v => !v)} style={{ background: WG.midGrey, border: `1px solid ${WG.borderDark}`, color: '#888', borderRadius: 5, padding: '5px 9px', fontSize: 14, cursor: 'pointer' }}>+</button>
              )}
              <span style={S.roleBadge(role)}>{ROLES[role]}</span>
              <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, fontFamily: 'Georgia, serif', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Out</button>
            </div>
          </div>
          {showAddStudio && isAdmin && (
            <div style={{ display: 'flex', gap: 8, paddingBottom: 10 }}>
              <input value={newStudioName} onChange={e => setNewStudioName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStudio()} placeholder="New studio name..." style={{ ...S.inp, flex: 1, fontSize: 13, padding: '7px 12px', background: WG.midGrey, border: `1px solid ${WG.borderDark}`, color: '#ddd' }} />
              <button onClick={addStudio} style={{ background: WG.red, border: 'none', borderRadius: 6, padding: '7px 16px', fontFamily: 'Georgia, serif', fontSize: 13, color: WG.white, fontWeight: 700, cursor: 'pointer' }}>Add</button>
            </div>
          )}
          <div style={{ display: 'flex' }}>
            {tabs.map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '9px 16px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit', color: tab === key ? WG.white : '#555', borderBottom: tab === key ? `2px solid ${WG.red}` : '2px solid transparent', transition: 'color 0.2s' }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>

        {/* ════ ROLL ════ */}
        {tab === 'roll' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
              <div><label style={S.lbl}>Class</label>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={S.sel}>
                  {classes.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Date</label>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={S.sel} />
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardHead}>
                <span style={S.lbl}>Client List — {studioName}</span>
                <span style={{ fontSize: 13, color: WG.textMuted }}>{allRollNames.filter(n => checkedIn[n]).length} / {allRollNames.length}</span>
              </div>

              {clients.length === 0 && guests.length === 0
                ? <div style={S.empty}>No clients yet — add them in the Clients tab</div>
                : <>
                  {/* Regular clients */}
                  {clients.map(name => {
                    const on = !!checkedIn[name]
                    return (
                      <div key={name} onClick={() => setCheckedIn(p => ({ ...p, [name]: !p[name] }))} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: `1px solid #f5f5f5`, background: on ? '#fef5f6' : WG.white, cursor: 'pointer', transition: 'background 0.15s' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 5, border: on ? 'none' : `2px solid #d5d5d5`, background: on ? WG.red : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {on && <span style={{ color: WG.white, fontSize: 12, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 15, fontWeight: on ? 600 : 400, color: on ? WG.red : '#333' }}>{name}</span>
                      </div>
                    )
                  })}

                  {/* Guests added for this session */}
                  {guests.map(name => {
                    const on = !!checkedIn[name]
                    return (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: `1px solid #f5f5f5`, background: on ? '#fef5f6' : '#fffdf8' }}>
                        <div onClick={() => setCheckedIn(p => ({ ...p, [name]: !p[name] }))} style={{ width: 22, height: 22, borderRadius: 5, border: on ? 'none' : `2px solid #d5d5d5`, background: on ? WG.red : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s' }}>
                          {on && <span style={{ color: WG.white, fontSize: 12, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 15, flex: 1, color: on ? WG.red : '#333', fontWeight: on ? 600 : 400 }}>{name}</span>
                        <span style={{ fontSize: 10, background: '#fff3cd', color: '#856404', padding: '2px 7px', borderRadius: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 4 }}>Guest</span>
                        <button onClick={() => removeGuest(name)} style={{ background: 'none', border: 'none', color: '#ddd', fontSize: 18, cursor: 'pointer', padding: 2 }}>×</button>
                      </div>
                    )
                  })}
                </>}

              {/* Add guest to roll */}
              <div style={{ padding: '10px 16px', background: '#fafafa', borderTop: `1px solid #f0f0f0` }}>
                {!showGuestInput ? (
                  <button onClick={() => setShowGuestInput(true)} style={{ background: 'none', border: 'none', color: WG.textMuted, fontSize: 13, fontFamily: 'Georgia, serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                    <span style={{ fontSize: 18, color: WG.textLight, lineHeight: 1 }}>+</span> Add unlisted client to this roll
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={guestName} onChange={e => setGuestName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addGuest(); if (e.key === 'Escape') { setShowGuestInput(false); setGuestName('') } }} placeholder="Client name..." autoFocus style={{ ...S.inp, flex: 1, padding: '8px 12px', fontSize: 13 }} />
                    <button onClick={addGuest} style={{ background: WG.red, border: 'none', borderRadius: 6, padding: '0 14px', color: WG.white, fontSize: 18, cursor: 'pointer' }}>+</button>
                    <button onClick={() => { setShowGuestInput(false); setGuestName('') }} style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 18, cursor: 'pointer' }}>✕</button>
                  </div>
                )}
              </div>
            </div>

            {rollMsg && <div style={rollMsg.startsWith('✓') ? S.ok : S.warn}>{rollMsg}</div>}
            <button onClick={saveRoll} style={S.bigBtn}>Save Roll</button>
          </div>
        )}

        {/* ════ CLIENTS ════ */}
        {tab === 'clients' && (
          <div>
            <div style={{ ...S.card, marginBottom: 8 }}>
              <div style={S.cardHead}><span style={S.lbl}>Add Client to {studioName}</span></div>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={newClientName} onChange={e => setNewClientName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addClient()} placeholder="Client name..." style={{ ...S.inp, flex: 1 }} />
                  <button onClick={addClient} style={{ padding: '0 20px', background: WG.red, color: WG.white, border: 'none', borderRadius: 6, fontSize: 22, cursor: 'pointer' }}>+</button>
                </div>
                {!canSeeSettings && (
                  <div style={{ fontSize: 12, color: WG.textLight, marginTop: 8, fontStyle: 'italic' }}>
                    To import from Clubware CSV or manage the full client list, see your manager.
                  </div>
                )}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardHead}><span style={S.lbl}>{clients.length} client{clients.length !== 1 ? 's' : ''} — {studioName}</span></div>
              {clients.length === 0
                ? <div style={S.empty}>No clients yet</div>
                : clients.map(name => {
                  const count = sessions.filter(s => (s.attended || []).includes(name)).length
                  return (
                    <div key={name} style={S.row}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f2f2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: WG.textMuted, flexShrink: 0 }}>{getInitials(name)}</div>
                        <div>
                          <div style={{ fontSize: 15 }}>{name}</div>
                          <div style={{ fontSize: 12, color: WG.textLight, marginTop: 2 }}>{count} session{count !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <button onClick={() => removeClient(name)} style={{ background: 'none', border: 'none', color: '#ddd', fontSize: 20, padding: 4, cursor: 'pointer' }}>×</button>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* ════ HISTORY ════ */}
        {tab === 'history' && canSeeHistory && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[[monthSessions.length, 'Classes this month'], [monthClients, 'Active clients']].map(([n, label]) => (
                <div key={label} style={{ background: WG.white, borderRadius: 10, padding: '16px 18px', border: `1px solid ${WG.border}` }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: WG.red }}>{n}</div>
                  <div style={{ fontSize: 11, color: WG.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ ...S.sel, flex: 1 }}>
                <option>All</option>{classes.map(c => <option key={c}>{c}</option>)}
              </select>
              <button onClick={() => exportAttendanceCSV(filteredSessions, studioName)} style={{ padding: '10px 14px', background: WG.white, border: `1px solid ${WG.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'Georgia, serif', color: '#666', letterSpacing: '0.06em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                ↓ Export CSV
              </button>
            </div>
            {filteredSessions.length === 0
              ? <div style={{ ...S.empty, background: 'transparent' }}>No sessions recorded yet</div>
              : filteredSessions.map(s => (
                <div key={s.id} style={S.card}>
                  <div style={S.cardHead}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{s.class_type}</span>
                      <span style={{ fontSize: 12, color: WG.textMuted, marginLeft: 10 }}>{formatDate(s.date)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: WG.textMuted }}>{(s.attended || []).length} attended</span>
                      {isAdmin && <button onClick={() => deleteSession(s.id)} style={{ background: 'none', border: 'none', color: '#ddd', fontSize: 16, cursor: 'pointer' }}>×</button>}
                    </div>
                  </div>
                  <div style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(s.attended || []).map(n => <span key={n} style={{ background: '#fef5f6', color: WG.red, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1px solid #f5c6cd` }}>{n}</span>)}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ════ SETTINGS ════ */}
        {tab === 'settings' && canSeeSettings && (
          <SettingsTab
            studioId={studioId}
            studioName={studioName}
            studios={studios}
            classes={classes}
            sessions={sessions}
            clients={clients}
            userEmail={user.email}
            role={role}
            isAdmin={isAdmin}
            isManagement={isManagement}
            onRenameStudio={renameStudio}
            onDeleteStudio={deleteStudio}
            onSaveClasses={saveClasses}
            onClientsUpdated={loadClients}
          />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════════════════
function SettingsTab({ studioId, studioName, studios, classes, sessions, clients, userEmail, role, isAdmin, isManagement, onRenameStudio, onDeleteStudio, onSaveClasses, onClientsUpdated }) {
  const [editName, setEditName] = useState(studioName)
  const [nameMsg, setNameMsg] = useState('')
  const [newClass, setNewClass] = useState('')
  const [classMsg, setClassMsg] = useState('')
  const [editingClass, setEditingClass] = useState(null)
  const [editingClassVal, setEditingClassVal] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [csvMsg, setCsvMsg] = useState('')
  const csvRef = useRef()

  // Admin user management
  const [allUsers, setAllUsers] = useState([])
  const [allStudios, setAllStudios] = useState([])
  const [userMsg, setUserMsg] = useState('')
  const [userStudioMap, setUserStudioMap] = useState({})

  useEffect(() => { setEditName(studioName); setConfirmDelete(false) }, [studioId, studioName])
  useEffect(() => { if (isAdmin) { loadAllUsers(); loadAllStudios(); loadUserStudioMap() } }, [isAdmin])

  const flash = (setter, msg, ms = 3000) => { setter(msg); setTimeout(() => setter(''), ms) }

  const loadAllUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('*').order('email')
    setAllUsers(data || [])
  }
  const loadAllStudios = async () => {
    const { data } = await supabase.from('studios').select('*').order('name')
    setAllStudios(data || [])
  }
  const loadUserStudioMap = async () => {
    const { data } = await supabase.from('studio_members').select('user_id, studio_id')
    const map = {}
    data?.forEach(m => { if (!map[m.user_id]) map[m.user_id] = []; map[m.user_id].push(m.studio_id) })
    setUserStudioMap(map)
  }

  const updateUserRole = async (userId, newRole) => {
    await supabase.from('user_profiles').update({ role: newRole }).eq('id', userId)
    await loadAllUsers(); flash(setUserMsg, '✓ Role updated')
  }

  const toggleUserStudio = async (userId, sid, assigned) => {
    if (assigned) await supabase.from('studio_members').delete().eq('user_id', userId).eq('studio_id', sid)
    else await supabase.from('studio_members').insert({ user_id: userId, studio_id: sid })
    await loadUserStudioMap()
    flash(setUserMsg, assigned ? 'Studio removed' : '✓ Studio assigned')
  }

  // ── CSV Import ──
  const handleCSVImport = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const rows = evt.target.result.split(/\r?\n/).map(r => r.split(','))
      const firstCell = rows[0]?.[0]?.trim().toLowerCase() || ''
      const start = ['name','member','client','first name','full name'].includes(firstCell) ? 1 : 0
      const parsed = rows.slice(start).map(r => r[0]?.trim()).filter(n => n?.length > 1)
      const existing = new Set(clients)
      const newOnes = [...new Set(parsed)].filter(n => !existing.has(n))
      // Replace mode: remove old ones not in new list, add new ones
      const toRemove = clients.filter(c => !parsed.includes(c))
      if (toRemove.length) {
        await supabase.from('clients').delete().eq('studio_id', studioId).in('name', toRemove)
      }
      if (newOnes.length) {
        await supabase.from('clients').insert(newOnes.map(name => ({ studio_id: studioId, name })))
      }
      await onClientsUpdated()
      flash(setCsvMsg, `✓ Client list updated — ${newOnes.length} added, ${toRemove.length} removed`, 5000)
      csvRef.current.value = ''
    }
    reader.readAsText(file)
  }

  // ── Weekly report ──
  const prevWeek = getPreviousWeek()
  const weekSessions = sessions.filter(s => s.date >= prevWeek.start && s.date <= prevWeek.end)

  const downloadWeeklyReport = () => {
    if (!weekSessions.length) { flash(setCsvMsg, 'No sessions recorded for that week'); return }
    exportAttendanceCSV(weekSessions, studioName, `-week-${prevWeek.start}`)
  }

  const handleRename = async () => {
    if (editName.trim() === studioName) return
    await onRenameStudio(editName); flash(setNameMsg, '✓ Studio name updated')
  }

  const addClass = async () => {
    const name = newClass.trim(); if (!name || classes.includes(name)) return
    await onSaveClasses([...classes, name]); setNewClass(''); flash(setClassMsg, `✓ "${name}" added`)
  }

  const removeClass = async (cls) => {
    await onSaveClasses(classes.filter(c => c !== cls)); flash(setClassMsg, `Removed "${cls}"`)
  }

  const saveEditClass = async (i) => {
    const val = editingClassVal.trim()
    if (!val || val === classes[i]) { setEditingClass(null); return }
    await onSaveClasses(classes.map((c, idx) => idx === i ? val : c))
    setEditingClass(null); flash(setClassMsg, '✓ Class updated')
  }

  const moveClass = async (i, dir) => {
    const updated = [...classes]; const swap = i + dir
    if (swap < 0 || swap >= updated.length) return
    ;[updated[i], updated[swap]] = [updated[swap], updated[i]]
    await onSaveClasses(updated)
  }

  const handleChangePassword = async () => {
    if (!newPw || newPw.length < 6) { flash(setPwMsg, 'Password must be at least 6 characters'); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) flash(setPwMsg, error.message)
    else { setNewPw(''); flash(setPwMsg, '✓ Password updated') }
  }

  return (
    <div>

      {/* ── STUDIO NAME ── */}
      <div style={S.sectionTitle}>Studio Settings</div>
      <div style={S.card}>
        <div style={S.cardHead}><span style={S.lbl}>Studio Name</span></div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename()} style={{ ...S.inp, flex: 1 }} />
            <button onClick={handleRename} style={{ padding: '0 18px', background: WG.red, color: WG.white, border: 'none', borderRadius: 6, fontSize: 13, fontFamily: 'Georgia, serif', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 700 }}>Save</button>
          </div>
          {nameMsg && <div style={{ ...S.ok, marginTop: 10, marginBottom: 0 }}>{nameMsg}</div>}
        </div>
      </div>

      {/* ── CLASS TYPES ── */}
      <div style={S.sectionTitle}>Class Types</div>
      <div style={S.card}>
        <div style={S.cardHead}>
          <span style={S.lbl}>{classes.length} class type{classes.length !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 11, color: '#bbb' }}>tap name to rename</span>
        </div>
        {classes.length === 0 ? <div style={S.empty}>No classes — add one below</div>
          : classes.map((cls, i) => (
            <div key={cls} style={{ ...S.row, background: editingClass === i ? '#fffdf8' : WG.white }}>
              {editingClass === i ? (
                <input value={editingClassVal} onChange={e => setEditingClassVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEditClass(i); if (e.key === 'Escape') setEditingClass(null) }} autoFocus style={{ ...S.inp, flex: 1, padding: '7px 10px', fontSize: 14 }} />
              ) : (
                <span onClick={() => { setEditingClass(i); setEditingClassVal(cls) }} style={{ fontSize: 14, flex: 1, cursor: 'text' }}>{cls}</span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 10 }}>
                {editingClass === i ? (
                  <>
                    <button onClick={() => saveEditClass(i)} style={{ background: WG.red, border: 'none', borderRadius: 5, color: WG.white, fontSize: 12, padding: '4px 10px', fontFamily: 'Georgia, serif', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingClass(null)} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 18, cursor: 'pointer' }}>✕</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => moveClass(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', color: i === 0 ? '#e5e5e5' : '#aaa', fontSize: 14, cursor: i === 0 ? 'default' : 'pointer', padding: '2px 4px' }}>↑</button>
                    <button onClick={() => moveClass(i, 1)} disabled={i === classes.length - 1} style={{ background: 'none', border: 'none', color: i === classes.length - 1 ? '#e5e5e5' : '#aaa', fontSize: 14, cursor: i === classes.length - 1 ? 'default' : 'pointer', padding: '2px 4px' }}>↓</button>
                    <button onClick={() => removeClass(cls)} style={{ background: 'none', border: 'none', color: '#ddd', fontSize: 20, padding: '2px 4px', cursor: 'pointer' }}>×</button>
                  </>
                )}
              </div>
            </div>
          ))}
        <div style={{ padding: '12px 16px', borderTop: classes.length ? `1px solid #f5f5f5` : 'none', background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={newClass} onChange={e => setNewClass(e.target.value)} onKeyDown={e => e.key === 'Enter' && addClass()} placeholder="New class name..." style={{ ...S.inp, flex: 1, padding: '9px 12px', fontSize: 13 }} />
            <button onClick={addClass} style={{ padding: '0 18px', background: WG.red, color: WG.white, border: 'none', borderRadius: 6, fontSize: 20, cursor: 'pointer' }}>+</button>
          </div>
          {classMsg && <div style={{ ...(classMsg.startsWith('✓') ? S.ok : S.warn), marginTop: 10, marginBottom: 0 }}>{classMsg}</div>}
        </div>
      </div>

      {/* ── CLIENT LIST MANAGEMENT ── */}
      <div style={S.sectionTitle}>Client List — {studioName}</div>
      <div style={S.card}>
        <div style={S.cardHead}>
          <span style={S.lbl}>Clubware Sync</span>
          <span style={{ fontSize: 12, color: WG.textLight }}>{clients.length} clients loaded</span>
        </div>
        <div style={{ padding: '16px 16px 6px' }}>
          <div style={{ fontSize: 13, color: WG.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
            Upload your Clubware member export every Monday to keep the client list current. The list will be updated — new members added, removed members deleted.
          </div>

          {/* Monday reminder badge */}
          {new Date().getDay() === 1 && (
            <div style={{ background: '#fffbea', border: '1px solid #ffe58a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#7d5a00', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📅</span> It's Monday — time to upload this week's Clubware export!
            </div>
          )}

          <input ref={csvRef} type="file" accept=".csv,.txt" onChange={handleCSVImport} style={{ display: 'none' }} />
          <button onClick={() => csvRef.current.click()} style={{ ...S.bigBtn, marginBottom: 8 }}>
            ⬆ Upload Clubware Client CSV
          </button>
          {csvMsg && <div style={{ ...(csvMsg.startsWith('✓') ? S.ok : S.warn), marginBottom: 0 }}>{csvMsg}</div>}
        </div>
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ fontSize: 11, color: WG.textLight, marginTop: 4 }}>Accepts .csv or .txt — first column should be client names</div>
        </div>
      </div>

      {/* ── WEEKLY REPORT ── */}
      <div style={S.sectionTitle}>Weekly Attendance Report</div>
      <div style={S.card}>
        <div style={S.cardHead}>
          <span style={S.lbl}>Previous Week</span>
          <span style={{ fontSize: 12, color: WG.textMuted }}>{prevWeek.label}</span>
        </div>
        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: 13, color: WG.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
            Downloads a CSV of every class and who attended during the previous Mon–Sun period.
            {weekSessions.length > 0
              ? <span style={{ color: WG.green, fontWeight: 600 }}> {weekSessions.length} session{weekSessions.length !== 1 ? 's' : ''} recorded that week.</span>
              : <span style={{ color: WG.textLight }}> No sessions recorded for that week yet.</span>}
          </div>

          {/* Monday reminder */}
          {new Date().getDay() === 1 && weekSessions.length > 0 && (
            <div style={{ background: '#fffbea', border: '1px solid #ffe58a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#7d5a00', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📊</span> It's Monday — your weekly report is ready to download!
            </div>
          )}

          <button onClick={downloadWeeklyReport} disabled={weekSessions.length === 0} style={{ ...S.bigBtn, opacity: weekSessions.length === 0 ? 0.4 : 1, background: weekSessions.length > 0 ? WG.black : WG.textLight }}>
            ↓ Download Weekly Report ({prevWeek.label})
          </button>
        </div>
      </div>

      {/* ── USER MANAGEMENT (admin only) ── */}
      {isAdmin && (
        <>
          <div style={S.sectionTitle}>User Management</div>
          {userMsg && <div style={S.ok}>{userMsg}</div>}
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.lbl}>{allUsers.length} user{allUsers.length !== 1 ? 's' : ''}</span></div>
            {allUsers.length === 0
              ? <div style={S.empty}>No users yet</div>
              : allUsers.map(u => {
                const assignedStudios = userStudioMap[u.id] || []
                return (
                  <div key={u.id} style={{ padding: '14px 16px', borderBottom: `1px solid #f5f5f5` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: u.role !== 'admin' ? 10 : 0 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{u.full_name || u.email}</div>
                        {u.full_name && <div style={{ fontSize: 12, color: WG.textMuted, marginTop: 1 }}>{u.email}</div>}
                      </div>
                      <select value={u.role} onChange={e => updateUserRole(u.id, e.target.value)} style={{ ...S.sel, width: 'auto', padding: '5px 8px', fontSize: 12 }}>
                        <option value="admin">Admin</option>
                        <option value="management">Management</option>
                        <option value="instructor">Instructor</option>
                      </select>
                    </div>
                    {u.role !== 'admin' && (
                      <div>
                        <div style={{ fontSize: 11, color: WG.textLight, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Studio Access</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {allStudios.map(s => {
                            const assigned = assignedStudios.includes(s.id)
                            return (
                              <button key={s.id} onClick={() => toggleUserStudio(u.id, s.id, assigned)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: assigned ? 600 : 400, border: assigned ? `1.5px solid ${WG.red}` : `1px solid #ddd`, background: assigned ? '#fef5f6' : WG.white, color: assigned ? WG.red : '#888', cursor: 'pointer', transition: 'all 0.15s' }}>
                                {assigned ? '✓ ' : ''}{s.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          <div style={S.sectionTitle}>All Studios</div>
          <div style={S.card}>
            <div style={S.cardHead}><span style={S.lbl}>{allStudios.length} studio{allStudios.length !== 1 ? 's' : ''}</span></div>
            {allStudios.map(s => (
              <div key={s.id} style={S.row}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.id === studioId ? WG.red : '#ddd', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: s.id === studioId ? 600 : 400 }}>{s.name}</span>
                  {s.id === studioId && <span style={{ fontSize: 11, color: WG.red, letterSpacing: '0.06em' }}>current</span>}
                </div>
                <span style={{ fontSize: 12, color: '#bbb' }}>{(s.classes || []).length} classes</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── ACCOUNT ── */}
      <div style={S.sectionTitle}>My Account</div>
      <div style={S.card}>
        <div style={S.cardHead}><span style={S.lbl}>Account Details</span></div>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid #f5f5f5` }}>
          <div style={{ fontSize: 11, color: WG.textLight, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Logged in as</div>
          <div style={{ fontSize: 14, color: '#555', marginBottom: 6 }}>{userEmail}</div>
          <span style={S.roleBadge(role)}>{ROLES[role]}</span>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: WG.textLight, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Change Password</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={newPw} onChange={e => setNewPw(e.target.value)} type="password" placeholder="New password..." style={{ ...S.inp, flex: 1, fontSize: 13 }} />
            <button onClick={handleChangePassword} style={{ padding: '0 16px', background: WG.red, color: WG.white, border: 'none', borderRadius: 6, fontSize: 13, fontFamily: 'Georgia, serif', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 700 }}>Update</button>
          </div>
          {pwMsg && <div style={{ ...(pwMsg.startsWith('✓') ? S.ok : S.err), marginTop: 10, marginBottom: 0 }}>{pwMsg}</div>}
        </div>
      </div>

      {/* ── DANGER ZONE (admin only) ── */}
      {isAdmin && (
        <>
          <div style={{ ...S.sectionTitle, color: '#e8a8a8' }}>Danger Zone</div>
          <div style={{ ...S.card, border: '1px solid #f5c6bc' }}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 14, marginBottom: 6 }}>Delete "{studioName}"</div>
              <div style={{ fontSize: 13, color: WG.textMuted, marginBottom: 14, lineHeight: 1.5 }}>Permanently deletes this studio, all clients and all attendance history. Cannot be undone.</div>
              {!confirmDelete
                ? <button onClick={() => setConfirmDelete(true)} style={S.dangerBtn}>Delete This Studio</button>
                : <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={onDeleteStudio} style={{ ...S.dangerBtn, flex: 1, background: '#c0392b', color: WG.white, borderColor: '#c0392b' }}>Yes, Delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ ...S.ghostBtn, flex: 1 }}>Cancel</button>
                </div>}
            </div>
          </div>
        </>
      )}
      <div style={{ height: 32 }} />
    </div>
  )
}
