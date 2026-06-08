import { createClient } from '@supabase/supabase-js'

// Replace these two values with yours from Supabase → Settings → API
const SUPABASE_URL = 'https://suxtqzoqpwexyxpwnsld.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'

export const supabase = createClient(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1eHRxem9xcHdleHl4cHduc2xkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTYxNzEsImV4cCI6MjA5NjM5MjE3MX0.NTBnfZn7iR5g_SoWSXzR7NJ_yxI0goT4xzzNmjf2ud0)
