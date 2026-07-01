/**
 * Supabase client for auth + workbook persistence.
 *
 * Cloud features (auth, save/load, sharing) are entirely optional: without
 * VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY set, `supabase` is null and the
 * app falls back to local-only mode (no accounts, nothing persisted across
 * reloads) so dev/CI environments keep working without any setup.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isCloudEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isCloudEnabled
  ? createClient(url as string, anonKey as string)
  : null;
