/**
 * ═══════════════════════════════════════════════════
 *  modal.js — مدير النوافذ المنبثقة
 * ═══════════════════════════════════════════════════
 *
 *  الاستخدام:
 *    import { Modal } from '../components/modal.js';
 *
 *    Modal.open('supply-tx-modal');
 *    Modal.close('supply-tx-modal');
 *    Modal.closeAll();
 *
 *    // إغلاق عند الضغط خارج النافذة
 *    Modal.init();  // استدعِ مرة واحدة في main.js
 */

export class Modal {

  /** فتح نافذة بـ id */
  static open(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  /** إغلاق نافذة بـ id */
  static close(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    if (!document.querySelector('.modal-overlay.open')) {
      document.body.style.overflow = '';
    }
  }

  /** إغلاق كل النوافذ المفتوحة */
  static closeAll() {
    document.querySelectorAll('.modal-overlay.open').forEach(el => {
      el.classList.remove('open');
    });
    document.body.style.overflow = '';
  }

  /**
   * تهيئة إغلاق النوافذ عند:
   * - الضغط على زر إغلاق داخل النافذة (.modal-close)
   * - الضغط خارج صندوق المحتوى (.modal-box)
   * - الضغط على Escape
   */
  static init() {
    // إغلاق بزر الـ X
    document.addEventListener('click', (e) => {
      if (e.target.closest('.modal-close')) {
        const overlay = e.target.closest('.modal-overlay');
        if (overlay) Modal.close(overlay.id);
      }
    });

    // إغلاق بالضغط خارج الصندوق
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        Modal.close(e.target.id);
      }
    });

    // إغلاق بـ Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Modal.closeAll();
    });
  }
}
