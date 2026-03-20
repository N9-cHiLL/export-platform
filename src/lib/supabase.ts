
import { createClient } from '@supabase/supabase-js';

// Uses NEXT_PUBLIC_ env vars so it works on client and server where appropriate.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
