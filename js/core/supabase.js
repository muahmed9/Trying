import { Config } from './config.js';
const { URL, ANON_KEY } = Config.SUPABASE;
if (!URL || !ANON_KEY) throw new Error('[supabase.js] مفاتيح Supabase مفقودة في config.js');
export const sb = window.supabase.createClient(URL, ANON_KEY, {
  auth:     { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { timeout: 20_000 },
});
