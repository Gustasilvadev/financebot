import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

// Client Supabase (singleton) com service_role: acesso admin, ignora o RLS.
export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
