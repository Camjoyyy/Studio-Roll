import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://suxtqzoqpwexyxpwnsld.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1eHRxem9xcHdleHl4cHduc2xkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQyMTYzODAsImV4cCI6MjAxOTc5MjM4MH0.NTBnfZn7iR5g_SoWSXzR7NJ_yxI0goT4xzzNmjf2ud0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
