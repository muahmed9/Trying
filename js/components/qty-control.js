/**
 * ═══════════════════════════════════════════════════
 *  qty-control.js — مكوّن التحكم في الكمية (+/-)
 * ═══════════════════════════════════════════════════
 *
 *  مكوّن موحَّد يُستخدم في:
 *  - سلة المتجر
 *  - ملفات الطباعة
 *  - المنتجات المقترحة
 *
 *  الاستخدام:
 *    import { QtyControl } from '../components/qty-control.js';
 *
 *    // إنشاء مكوّن
 *    const ctrl = new QtyControl({
 *      id:       'product-123',
 *      value:    1,
 *      min:      0,
 *      max:      10,
 *      onChange: (newQty, id) => console.log(newQty),
 *    });
 *
 *    // الحصول على عنصر HTML لإدراجه
 *    container.appendChild(ctrl.render());
 *
 *    // تحديث القيمة برمجياً
 *    ctrl.setValue(3);
 *
 *    // إنشاء HTML مباشرة (للـ templates)
 *    QtyControl.html({ id, value, min, max })
 */

export class QtyControl {
  #id;
  #value;
  #min;
  #max;
  #onChange;
  #element = null;

  /**
   * @param {Object} options
   * @param {string}   options.id
   * @param {number}   [options.value=1]
   * @param {number}   [options.min=0]
   * @param {number}   [options.max=999]
   * @param {Function} [options.onChange]  — (newValue, id) => void
   */
  constructor({ id, value = 1, min = 0, max = 999, onChange = () => {} }) {
    this.#id       = id;
    this.#value    = Math.min(Math.max(value, min), max);
    this.#min      = min;
    this.#max      = max;
    this.#onChange = onChange;
  }

  // ── إنشاء عنصر DOM ──────────────────────────────
  render() {
    const wrap = document.createElement('div');
    wrap.className          = 'qty-ctrl';
    wrap.dataset.id         = this.#id;
    wrap.innerHTML          = this.#buildHTML();

    // ربط الأحداث
    wrap.querySelector('.qty-dec').addEventListener('click', (e) => {
      e.stopPropagation();
      this.#adjust(-1);
    });
    wrap.querySelector('.qty-inc').addEventListener('click', (e) => {
      e.stopPropagation();
      this.#adjust(+1);
    });

    this.#element = wrap;
    this.#syncUI();
    return wrap;
  }

  // ── تحديث القيمة برمجياً ────────────────────────
  setValue(newVal) {
    this.#value = Math.min(Math.max(newVal, this.#min), this.#max);
    this.#syncUI();
  }

  getValue() { return this.#value; }

  // ── HTML ثابت للقوالب (static helper) ───────────
  /**
   * يُعيد HTML string جاهزاً للـ innerHTML.
   * الأحداث تُضاف لاحقاً عبر event delegation.
   *
   * @param {Object} opts
   * @param {string} opts.id
   * @param {number} [opts.value=1]
   * @param {number} [opts.min=0]
   * @param {number} [opts.max=999]
   * @returns {string}
   */
  static html({ id, value = 1, min = 0, max = 999 }) {
    const decDisabled = value <= min ? 'disabled' : '';
    const incDisabled = value >= max ? 'disabled' : '';
    return `
      <div class="qty-ctrl" data-id="${id}" data-min="${min}" data-max="${max}">
        <button class="qty-btn qty-dec" ${decDisabled} aria-label="تقليل">−</button>
        <span class="qty-val">${value}</span>
        <button class="qty-btn qty-inc" ${incDisabled} aria-label="زيادة">+</button>
      </div>`.trim();
  }

  /**
   * Event Delegation — سجِّله مرة واحدة على الـ container
   * ثم مرِّر callback يأخذ (id, delta).
   *
   * مثال:
   *   QtyControl.delegate(document.getElementById('cart-list'), (id, delta) => {
   *     cartStore.adjustQty(id, delta);
   *   });
   *
   * @param {Element}  container
   * @param {Function} onAdjust  — (id: string, delta: number) => void
   */
  static delegate(container, onAdjust) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.qty-btn');
      if (!btn) return;

      e.stopPropagation();
      const wrap  = btn.closest('.qty-ctrl');
      if (!wrap) return;

      const id    = wrap.dataset.id;
      const min   = Number(wrap.dataset.min ?? 0);
      const max   = Number(wrap.dataset.max ?? 999);
      const valEl = wrap.querySelector('.qty-val');
      if (!valEl) return;

      let cur   = parseInt(valEl.textContent, 10) || 0;
      const delta = btn.classList.contains('qty-dec') ? -1 : +1;
      const next  = Math.min(Math.max(cur + delta, min), max);

      valEl.textContent = next;

      // تحديث حالة الأزرار
      wrap.querySelector('.qty-dec').disabled = next <= min;
      wrap.querySelector('.qty-inc').disabled = next >= max;

      onAdjust(id, delta, next);
    });
  }

  // ── داخلي ────────────────────────────────────────
  #adjust(delta) {
    const next = Math.min(Math.max(this.#value + delta, this.#min), this.#max);
    if (next === this.#value) return;
    this.#value = next;
    this.#syncUI();
    this.#onChange(this.#value, this.#id);
  }

  #buildHTML() {
    return `
      <button class="qty-btn qty-dec" aria-label="تقليل">−</button>
      <span class="qty-val">${this.#value}</span>
      <button class="qty-btn qty-inc" aria-label="زيادة">+</button>
    `;
  }

  #syncUI() {
    if (!this.#element) return;
    const valEl = this.#element.querySelector('.qty-val');
    const decEl = this.#element.querySelector('.qty-dec');
    const incEl = this.#element.querySelector('.qty-inc');

    if (valEl) valEl.textContent = this.#value;
    if (decEl) decEl.disabled   = this.#value <= this.#min;
    if (incEl) incEl.disabled   = this.#value >= this.#max;
  }
}
