/**
 * stepper.js — نظام الخطوات (Wizard)
 *
 * الخطوات:
 *  1 → رفع الملفات
 *  2 → خيارات الطباعة والتغليف
 *  3 → الإضافات (متجر + عاجل)
 *  4 → العنوان والتأكيد
 */

import { customerState } from '../core/state.js';

export class Stepper {
  #totalSteps;
  #currentStep = 1;
  #validators  = {};   // { stepNum: () => boolean|string }
  #onStepChange = null;

  constructor(totalSteps = 4, onStepChange = null) {
    this.#totalSteps  = totalSteps;
    this.#onStepChange = onStepChange;
    customerState.set('currentStep', 1);
  }

  // ── تسجيل validator لخطوة ───────────────────────
  /**
   * @param {number}   step
   * @param {Function} fn  — يُعيد true أو رسالة خطأ (string)
   */
  setValidator(step, fn) {
    this.#validators[step] = fn;
  }

  // ── الانتقال للأمام ─────────────────────────────
  next() {
    // تحقق من الخطوة الحالية
    const result = this.#validate(this.#currentStep);
    if (result !== true) return result; // رسالة الخطأ

    if (this.#currentStep < this.#totalSteps) {
      this.#goTo(this.#currentStep + 1);
    }
    return true;
  }

  // ── الرجوع للخلف ────────────────────────────────
  prev() {
    if (this.#currentStep > 1) {
      this.#goTo(this.#currentStep - 1);
    }
  }

  // ── الانتقال المباشر ────────────────────────────
  goTo(step) {
    // يسمح فقط بالرجوع أو الانتقال للخطوة التالية مباشرة
    if (step < this.#currentStep) {
      this.#goTo(step);
    }
  }

  get current() { return this.#currentStep; }

  // ── تحديث واجهة الـ Stepper Header ─────────────
  renderHeader() {
    document.querySelectorAll('.step-item').forEach((item, i) => {
      const step = i + 1;
      item.classList.remove('done', 'active', 'locked');

      if (step < this.#currentStep)       item.classList.add('done');
      else if (step === this.#currentStep) item.classList.add('active');
      else                                 item.classList.add('locked');
    });
  }

  // ── تحديث لوحات الخطوات ──────────────────────
  renderPanels() {
    document.querySelectorAll('.step-panel').forEach((panel, i) => {
      panel.classList.toggle('active', i + 1 === this.#currentStep);
    });
  }

  // ── تحديث أزرار التنقل ──────────────────────────
  renderNav() {
    const prevBtn = document.getElementById('stepper-prev');
    const nextBtn = document.getElementById('stepper-next');
    const submitBtn = document.getElementById('stepper-submit');

    if (prevBtn)   prevBtn.style.display   = this.#currentStep > 1 ? '' : 'none';
    if (nextBtn)   nextBtn.style.display   = this.#currentStep < this.#totalSteps ? '' : 'none';
    if (submitBtn) submitBtn.style.display = this.#currentStep === this.#totalSteps ? '' : 'none';
  }

  render() {
    this.renderHeader();
    this.renderPanels();
    this.renderNav();
  }

  // ── داخلي ────────────────────────────────────────
  #goTo(step) {
    this.#currentStep = step;
    customerState.set('currentStep', step);
    this.render();
    this.#onStepChange?.(step);
    // تمرير للأعلى
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  #validate(step) {
    const fn = this.#validators[step];
    if (!fn) return true;
    return fn() ?? true;
  }
}
