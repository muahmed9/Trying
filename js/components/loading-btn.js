/**
 * ═══════════════════════════════════════════════════
 *  loading-btn.js — مكوّن أزرار التحميل
 * ═══════════════════════════════════════════════════
 *
 *  يمنع ضغط الزر مرتين ويعرض حالة التحميل.
 *
 *  الاستخدام 1 — استدعاء يدوي:
 *    import { withLoading } from '../components/loading-btn.js';
 *
 *    document.getElementById('my-btn').addEventListener('click', () => {
 *      withLoading('my-btn', async () => {
 *        await sendOrder();
 *      });
 *    });
 *
 *  الاستخدام 2 — تسجيل تلقائي لكل .btn-action في الصفحة:
 *    import { initLoadingButtons } from '../components/loading-btn.js';
 *    initLoadingButtons();  // استدعِها مرة واحدة في main.js
 */

/**
 * تشغيل async callback مع تعطيل الزر وعرض نص التحميل
 * @param {string|HTMLButtonElement} buttonOrId
 * @param {Function} asyncFn
 * @param {string} [loadingText]
 */
export async function withLoading(buttonOrId, asyncFn, loadingText) {
  const btn = typeof buttonOrId === 'string'
    ? document.getElementById(buttonOrId)
    : buttonOrId;

  if (!btn) return asyncFn();

  const originalText     = btn.innerHTML;
  const originalDisabled = btn.disabled;
  const text             = loadingText
    ?? btn.dataset.loadingText
    ?? 'جاري الإرسال ⏳...';

  // ── تعطيل ──────────────────────────────────────
  btn.disabled   = true;
  btn.innerHTML  = text;
  btn.classList.add('loading');

  try {
    return await asyncFn();
  } finally {
    // ── استعادة ──────────────────────────────────
    btn.disabled   = originalDisabled;
    btn.innerHTML  = originalText;
    btn.classList.remove('loading');
  }
}

/**
 * تسجيل تلقائي: يضيف addEventListener لكل زر يملك
 * data-async-action="functionName" في الصفحة.
 *
 * مثال في HTML:
 *   <button data-async-action="sendOrder"
 *           data-loading-text="جاري الإرسال ⏳...">
 *     🚀 تأكيد الطلب
 *   </button>
 *
 * ثم في main.js:
 *   window.__actions = { sendOrder };
 *   initLoadingButtons();
 */
export function initLoadingButtons() {
  document.querySelectorAll('[data-async-action]').forEach(btn => {
    const actionName = btn.dataset.asyncAction;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const fn = window.__actions?.[actionName];
      if (typeof fn !== 'function') {
        console.warn(`[loading-btn] الدالة "${actionName}" غير موجودة في window.__actions`);
        return;
      }
      await withLoading(btn, fn);
    });
  });
}
