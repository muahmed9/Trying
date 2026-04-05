/**
 * ═══════════════════════════════════════════════════
 *  utils.js — دوال مساعدة مشتركة
 * ═══════════════════════════════════════════════════
 */

import { Config } from './config.js';

// ════════════════════════════════════════
//  🔒 الأمان — منع XSS
// ════════════════════════════════════════

/**
 * تحويل نص إلى HTML آمن (Escape)
 * استخدم دائماً عند عرض بيانات مستخدم في innerHTML
 * @param {any} s
 * @returns {string}
 */
export function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

/**
 * تنظيف نص من أكواد HTML (لمدخلات المستخدم)
 * @param {string} str
 * @param {number} [maxLen]
 * @returns {string}
 */
export function sanitize(str, maxLen = 500) {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

// ════════════════════════════════════════
//  🔢 تنسيق الأرقام والتواريخ
// ════════════════════════════════════════

/**
 * تنسيق سعر بالدينار العراقي
 * @param {number} amount
 * @returns {string}  مثال: "1,500 د.ع"
 */
export function formatPrice(amount) {
  if (amount == null || isNaN(amount)) return '0 د.ع';
  return Number(amount).toLocaleString('ar-IQ') + ' د.ع';
}

/**
 * تنسيق تاريخ عربي مختصر
 * @param {string|Date} dateStr
 * @returns {string}  مثال: "اليوم 14:35" أو "أمس 09:10" أو "15/04/2025"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = now - d;
  const pad  = n => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  if (diff < 86_400_000 && d.getDate() === now.getDate()) return `اليوم ${time}`;
  if (diff < 172_800_000) return `أمس ${time}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * تنسيق فترة زمنية نسبية (منذ X)
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

// ════════════════════════════════════════
//  🎨 DOM Helpers
// ════════════════════════════════════════

/**
 * اختصار document.getElementById مع throw إذا لم يوجد
 * @param {string} id
 * @returns {HTMLElement}
 */
export function el(id) {
  const elem = document.getElementById(id);
  if (!elem) throw new Error(`[utils] العنصر #${id} غير موجود`);
  return elem;
}

/**
 * اختصار document.querySelector مع throw إذا لم يوجد
 * @param {string} selector
 * @param {Element} [root]
 * @returns {Element}
 */
export function qs(selector, root = document) {
  const elem = root.querySelector(selector);
  if (!elem) throw new Error(`[utils] المحدد "${selector}" لم يُطابق أي عنصر`);
  return elem;
}

/**
 * اختصار document.querySelectorAll
 * @param {string} selector
 * @param {Element} [root]
 * @returns {NodeList}
 */
export function qsa(selector, root = document) {
  return root.querySelectorAll(selector);
}

/**
 * إظهار عنصر
 * @param {string|HTMLElement} target  — id أو عنصر مباشرة
 * @param {string} [display]
 */
export function show(target, display = 'block') {
  const elem = typeof target === 'string' ? document.getElementById(target) : target;
  if (elem) elem.style.display = display;
}

/**
 * إخفاء عنصر
 * @param {string|HTMLElement} target
 */
export function hide(target) {
  const elem = typeof target === 'string' ? document.getElementById(target) : target;
  if (elem) elem.style.display = 'none';
}

// ════════════════════════════════════════
//  ⏱️ أدوات الأداء
// ════════════════════════════════════════

/**
 * Debounce — تأخير تنفيذ دالة حتى يتوقف المستخدم عن الكتابة
 * @param {Function} fn
 * @param {number} [delay]
 * @returns {Function}
 */
export function debounce(fn, delay = Config.APP.SEARCH_DEBOUNCE_MS) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle — تنفيذ دالة مرة كل X ملي ثانية كحدٍّ أقصى
 * @param {Function} fn
 * @param {number} limit
 * @returns {Function}
 */
export function throttle(fn, limit) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= limit) { last = now; fn(...args); }
  };
}

// ════════════════════════════════════════
//  📁 معالجة الملفات
// ════════════════════════════════════════

/**
 * تنسيق حجم الملف
 * @param {number} bytes
 * @returns {string}  مثال: "2.3 MB"
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B','KB','MB','GB'];
  let i = 0, size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * الحصول على امتداد الملف
 * @param {string} filename
 * @returns {string}  مثال: "pdf"
 */
export function getExt(filename) {
  return (filename.split('.').pop() || '').toLowerCase();
}

/**
 * التحقق من نوع الملف المسموح به
 * @param {File} file
 * @returns {boolean}
 */
export function isAllowedFile(file) {
  const allowed = ['pdf','doc','docx','ppt','pptx','xls','xlsx','jpg','jpeg','png'];
  return allowed.includes(getExt(file.name));
}

// ════════════════════════════════════════
//  🔑 معرّف فريد
// ════════════════════════════════════════

/**
 * توليد معرّف فريد قصير
 * @returns {string}  مثال: "k7x2m9"
 */
export function uid() {
  return Math.random().toString(36).slice(2, 8);
}

// ════════════════════════════════════════
//  📋 نسخ النص
// ════════════════════════════════════════

/**
 * نسخ نص إلى الحافظة
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback للمتصفحات القديمة
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

// ════════════════════════════════════════
//  ✅ التحقق من المدخلات
// ════════════════════════════════════════

/**
 * التحقق من رقم هاتف عراقي (11 رقم يبدأ بـ 07)
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidIraqiPhone(phone) {
  return /^07[0-9]{9}$/.test(phone?.trim() ?? '');
}

/**
 * التحقق من اسم صالح (2-60 حرف)
 * @param {string} name
 * @returns {boolean}
 */
export function isValidName(name) {
  return (name?.trim().length ?? 0) >= 2 && (name?.trim().length ?? 0) <= 60;
}
