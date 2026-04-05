/**
 * ═══════════════════════════════════════════════════
 *  state.js — إدارة الحالة المركزية (AppState)
 * ═══════════════════════════════════════════════════
 *
 *  بدلاً من متغيرات عامة مبعثرة في كل مكان، كل حالة
 *  التطبيق تعيش هنا. يُصدَّر كـ singleton واحدة.
 *
 *  الاستخدام:
 *    import { state } from './state.js';
 *    state.set('currentFilter', 'all');
 *    const filter = state.get('currentFilter');
 *    state.subscribe('currentFilter', newVal => console.log(newVal));
 */

class AppState {
  #data     = {};
  #listeners = {};   // { key: Set<Function> }

  constructor(initialState = {}) {
    this.#data = { ...initialState };
  }

  // ── قراءة قيمة ─────────────────────────────────
  get(key) {
    return this.#data[key];
  }

  // ── كتابة قيمة وإشعار المشتركين ────────────────
  set(key, value) {
    const prev = this.#data[key];
    this.#data[key] = value;
    if (prev !== value) {
      this.#notify(key, value, prev);
    }
  }

  // ── تحديث جزئي لكائن ────────────────────────────
  merge(key, partial) {
    const prev = this.#data[key] ?? {};
    this.set(key, { ...prev, ...partial });
  }

  // ── الاشتراك بتغيير قيمة ────────────────────────
  /** @returns {Function} unsubscribe */
  subscribe(key, fn) {
    if (!this.#listeners[key]) this.#listeners[key] = new Set();
    this.#listeners[key].add(fn);
    return () => this.#listeners[key].delete(fn);
  }

  // ── داخلي: إشعار المشتركين ──────────────────────
  #notify(key, newVal, oldVal) {
    this.#listeners[key]?.forEach(fn => {
      try { fn(newVal, oldVal); } catch (e) { console.error('[state] subscriber error:', e); }
    });
  }
}

// ════════════════════════════════════════
//  حالة تطبيق الزبون (index.html)
// ════════════════════════════════════════
export const customerState = new AppState({
  // الملفات المرفوعة
  files: [],

  // خيارات الطباعة
  printColor:  'c',     // 'c' = ملون | 'n' = أبيض وأسود
  printSide:   '1',     // '1' = وجه واحد | '2' = وجهين
  packaging:   'none',  // 'none' | 'cardboard' | 'spiral'
  express:     false,

  // الزبون والموقع
  user: {
    id:               null,
    name:             '',
    username:         '',
    loyalty_points:   0,
    total_orders:     0,
    total_spent:      0,
    first_order_done: false,
  },
  locationUrl: '',

  // السلة (المتجر)
  cart: [],              // [{ id, name, price, effective_price, qty, unit, stock }]
  suggestedCart: {},     // { productId: qty } — المنتجات المقترحة في نموذج الطلب

  // الكوبون
  appliedCoupon: null,

  // نتيجة آخر طلب مُرسَل
  lastOrderId:  null,
  lastOrderTime: 0,      // timestamp — لـ rate limiting

  // التسعير (يُحمَّل من Supabase)
  pricing: null,

  // فلاتر
  orderFilter:   'all',
  marketFilter:  'all',

  // الخطوة الحالية في Stepper
  currentStep: 1,         // 1..4
});

// ════════════════════════════════════════
//  حالة لوحة الإدارة (admin.html)
// ════════════════════════════════════════
export const adminState = new AppState({
  // المستخدم الحالي بعد تسجيل الدخول
  currentUser: null,          // Supabase User object
  currentProfile: null,       // { role, name, emoji, permissions }
  currentRole: '',            // 'admin' | 'operator' | 'driver' | 'custom' | ...
  customPermissions: [],      // للحسابات المخصصة

  // الطلبات
  allOrders:         [],
  allMarketOrders:   [],

  // فلاتر الطلبات
  statusFilter:      'all',
  typeFilter:        'all',
  mktStatusFilter:   'all',
  searchQuery:       '',

  // الطلب المفتوح في لوحة التفاصيل
  openOrderId:       null,
  openOrderTgId:     null,

  // الصفحة النشطة في القائمة الجانبية
  activePage:        'orders',  // 'orders' | 'stats' | 'market' | 'supplies' | 'reports' | 'settings'

  // Realtime channel مرجع للتنظيف عند الخروج
  realtimeChannel:   null,
});
