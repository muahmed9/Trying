/**
 * ═══════════════════════════════════════════════════
 *  toast.js — نظام الإشعارات (Toast Notifications)
 * ═══════════════════════════════════════════════════
 *
 *  الاستخدام:
 *    import { showToast } from '../components/toast.js';
 *    showToast('✅ تم الحفظ بنجاح');
 *    showToast('❌ حدث خطأ', 'error');
 */

import { Config } from '../core/config.js';

let _toastTimer = null;

/**
 * عرض إشعار منبثق
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} [type]
 * @param {number} [duration]
 */
export function showToast(message, type = 'info', duration = Config.APP.TOAST_DURATION_MS) {
  let el = document.getElementById('toast');

  // إنشاء العنصر إذا لم يكن موجوداً
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }

  // تخصيص اللون حسب النوع
  const colors = {
    info:    'var(--navy)',
    success: 'var(--green)',
    error:   'var(--red)',
    warning: 'var(--orange)',
  };
  el.style.background = colors[type] ?? colors.info;
  el.textContent      = message;

  // إظهار
  el.classList.remove('show');
  void el.offsetWidth; // إعادة تشغيل الـ animation
  el.classList.add('show');

  // إخفاء تلقائي
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, duration);
}
