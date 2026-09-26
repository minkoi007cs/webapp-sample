import { createClient } from '@supabase/supabase-js';

// Public URL + anon key of Supabase "Data 01" (same project the API validates tokens against).
// One pair on purpose: env URL + fallback key from another project broke login.
const SUPABASE_URL = 'https://msozshwatonyxnkaqjfs.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb3pzaHdhdG9ueXhua2FxamZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjU5MzYsImV4cCI6MjA4ODIwMTkzNn0.lbfHxn4YxXNLHB0uVBDInrHh8wsCbusDr1_SroACHgk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSupabaseClient() {
  return supabase;
}
