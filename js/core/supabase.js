/**
 * ═══════════════════════════════════════════════════
 *  supabase.js — تهيئة Supabase Client (مرة واحدة فقط)
 * ═══════════════════════════════════════════════════
 *
 *  كل ملف يحتاج Supabase يستورد { sb } من هنا.
 *  يضمن هذا وجود instance واحدة طوال عمر التطبيق
 *  ويتجنب تعدد الاتصالات أو تسرب الذاكرة.
 */

import { Config } from './config.js';

const { URL, ANON_KEY } = Config.SUPABASE;

if (!URL || !ANON_KEY) {
  throw new Error('[supabase.js] مفاتيح Supabase مفقودة في config.js');
}

// window.supabase يُحقَن من CDN في الـ HTML
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
export const sb = window.supabase.createClient(URL, ANON_KEY, {
  auth: {
    // الاحتفاظ بالجلسة تلقائياً في localStorage
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: false,
  },
  realtime: {
    // timeout أعلى للشبكات البطيئة
    timeout: 20_000,
  },
});
