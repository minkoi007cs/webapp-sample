import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://gohczmqykjkrgdblgbog.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvaGN6bXF5a2prcmdkYmxnYm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTI3NjgsImV4cCI6MjA4OTg2ODc2OH0.nSDygTI2AsSbt94Qw7wJLbObIrxWcTjFShnYtyNEtzs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSupabaseClient() {
  return supabase;
}
