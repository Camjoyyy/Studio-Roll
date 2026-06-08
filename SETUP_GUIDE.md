# Studio Roll v3 — Setup Guide
## Fresh install, tested and complete

---

## BEFORE YOU START
Delete your old Studio-Roll repository on GitHub and start fresh.
Go to github.com → your Studio-Roll repo → Settings → scroll to bottom → Delete this repository.

---

## STEP 1 — Reset Supabase (2 mins)

1. Go to supabase.com → your Roll Call project
2. Left sidebar → SQL Editor → New query
3. Open SUPABASE_SETUP.sql in Notepad → Ctrl+A → Ctrl+C
4. Paste into SQL editor → click Run
5. You should see: Success. No rows returned ✓

---

## STEP 2 — Add your API keys (2 mins)

1. Supabase → Settings → API
2. Copy your Project URL (e.g. https://suxtqzoqpwexyxpwnsld.supabase.co)
3. Copy your anon public key (the long eyJ... string) — use the Copy button
4. Open src/supabase.js in a TEXT EDITOR (NOT Notepad — use Notepad++ or VS Code to avoid encoding issues)
   - Download Notepad++ free from notepad-plus-plus.org if needed
5. Replace YOUR_PROJECT_ID.supabase.co with your full Project URL
6. Replace YOUR_ANON_KEY with your anon key
7. Save — make sure it saves as UTF-8 encoding

---

## STEP 3 — Upload to GitHub (3 mins)

1. github.com → New repository → name it studio-roll → Create repository
2. Click "uploading an existing file"
3. Select ALL files from this folder (Ctrl+A) and drag into GitHub
4. Click Commit changes

---

## STEP 4 — Deploy on Vercel (2 mins)

1. vercel.com → Add New Project → Import studio-roll repo
2. Click Deploy — wait 60 seconds
3. Your app is live at a vercel.app URL

---

## STEP 5 — Create your account & set as Admin

1. Open your app URL → click "No account? Sign up"
2. Enter your email and password → Create Account
3. Check email for confirmation link → click it → log back in
4. Go to Supabase → SQL Editor → New query → run:

update user_profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';

5. Log out of the app → log back in
6. You'll see "No studios yet" → type your studio name → Add Studio ✓

---

## STEP 6 — Install on phones

iPhone (Safari only):
- Open app URL in Safari → Share button → Add to Home Screen → Add

Android (Chrome):
- Open in Chrome → three dots menu → Add to Home Screen

---

## That's it — you're done!
No more SQL editor visits. Everything is managed inside the app.
