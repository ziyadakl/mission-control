import { createClient, SupabaseClient } from '@supabase/supabase-js';

const globalForSupabase = global as unknown as { supabase?: SupabaseClient };

export function getSupabase(): SupabaseClient {
  if (!globalForSupabase.supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    }
    globalForSupabase.supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return globalForSupabase.supabase;
}
