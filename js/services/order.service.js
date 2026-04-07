/**
 * order.service.js — كل عمليات الطلبات مع Supabase
 */

import { sb }             from '../core/supabase.js';
import { Config }         from '../core/config.js';
import { customerState }  from '../core/state.js';
import { sanitize, isValidIraqiPhone, isValidName } from '../core/utils.js';

const T = Config.TABLES;

// ══════════════════════════════════════
//  إرسال طلب جديد
// ══════════════════════════════════════
export async function submitOrder({ name, phone, region, notes, locationUrl }) {

  // ── Rate Limiting (Client-side) ─────────────────
  const lastTime = customerState.get('lastOrderTime') ?? 0;
  if (Date.now() - lastTime < Config.APP.ORDER_COOLDOWN_MS) {
    const remaining = Math.ceil((Config.APP.ORDER_COOLDOWN_MS - (Date.now() - lastTime)) / 1000);
    throw new Error(`انتظر ${remaining} ثانية قبل إرسال طلب جديد`);
  }

  // ── التحقق من المدخلات ──────────────────────────
  if (!isValidName(name))          throw new Error('يرجى إدخال الاسم الكامل (حرفان على الأقل)');
  if (!isValidIraqiPhone(phone))   throw new Error('رقم الهاتف يجب أن يكون 11 رقماً ويبدأ بـ 07');
  if (!region?.trim())             throw new Error('يرجى إدخال المنطقة أو الحي');

  const files    = customerState.get('files') ?? [];
  const cart     = customerState.get('cart') ?? [];
  const sugCart  = customerState.get('suggestedCart') ?? {};

  if (!files.length && !cart.length && !Object.keys(sugCart).length) {
    throw new Error('يرجى إضافة ملف للطباعة أو منتج للسلة');
  }

  const user     = customerState.get('user');
  if (!user?.id) throw new Error('يرجى إعادة تحميل التطبيق للتعريف بهويتك');
  const pricing  = customerState.get('pricing') ?? Config.DEFAULT_PRICING;
  const coupon   = customerState.get('appliedCoupon');

  // ── حساب المبلغ ─────────────────────────────────
  const totals   = calcOrderTotals({ files, cart, sugCart, pricing, coupon, user });

  // ── بيانات الطلب ────────────────────────────────
  const orderPayload = {
    user_id:       user.id,
    customer_name: sanitize(name, 60),
    phone:         phone.trim(),
    region:        sanitize(region, 80),
    notes:         sanitize(notes, 300),
    location_url:  locationUrl || null,

    color:         customerState.get('printColor'),
    sides:         customerState.get('printSide'),
    packaging:     customerState.get('packaging'),
    express:       customerState.get('express'),

    files_data:    files.map(f => ({
      name:     f.name,
      pages:    f.pages,
      copies:   f.copies,
      size:     f.size,
      url:      f.uploadedUrl ?? null,
    })),

    cart_items:    _buildCartItems(cart, sugCart),

    subtotal:      totals.subtotal,
    delivery_fee:  totals.deliveryFee,
    discount:      totals.discount,
    total:         totals.total,

    coupon_code:   coupon?.code ?? null,
    status:        'received',
    order_type:    files.length && cart.length ? 'combined' : files.length ? 'print' : 'market',
  };

  // ── إدراج في Supabase ────────────────────────────
  const { data, error } = await sb
    .from(T.ORDERS)
    .insert(orderPayload)
    .select('id')
    .single();

  if (error) throw new Error('فشل إرسال الطلب: ' + error.message);

  // ── تحديث حالة المستخدم ─────────────────────────
  customerState.set('lastOrderTime', Date.now());
  customerState.set('lastOrderId',   data.id);

  // تحديث الكوبون (زيادة used_count)
  if (coupon?.id) {
    await sb.from(T.COUPONS)
      .update({ used_count: (coupon.used_count ?? 0) + 1 })
      .eq('id', coupon.id);
  }

  // إرسال إشعار تيليجرام (عبر Edge Function)
  _notifyAdmin(data.id, orderPayload).catch(() => {});

  return data.id;
}

// ══════════════════════════════════════
//  جلب طلبات المستخدم
// ══════════════════════════════════════
export async function fetchUserOrders(userId) {
  const { data, error } = await sb
    .from(T.ORDERS)
    .select('id, status, total, created_at, cancel_reason, rating, files_data, cart_items')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

// ══════════════════════════════════════
//  جلب تفاصيل طلب واحد
// ══════════════════════════════════════
export async function fetchOrderById(orderId) {
  const { data, error } = await sb
    .from(T.ORDERS)
    .select('*')
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}

// ══════════════════════════════════════
//  تقييم طلب
// ══════════════════════════════════════
export async function submitRating(orderId, stars, comment = '') {
  const { error } = await sb
    .from(T.ORDERS)
    .update({ rating: stars, rating_comment: sanitize(comment, 200) || null })
    .eq('id', orderId);

  if (error) throw error;
}

// ══════════════════════════════════════
//  تطبيق كوبون خصم
// ══════════════════════════════════════
export async function validateCoupon(code) {
  if (!code?.trim()) return null;

  const { data, error } = await sb
    .from(T.COUPONS)
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('active', true)
    .maybeSingle();

  if (error || !data)                                   throw new Error('كود الخصم غير صالح');
  if (data.max_uses > 0 && data.used_count >= data.max_uses) throw new Error('تم استنفاد هذا الكوبون');
  if (data.expires_at && new Date(data.expires_at) < new Date()) throw new Error('انتهت صلاحية هذا الكوبون');

  return data;
}

// ══════════════════════════════════════
//  حساب المجاميع
// ══════════════════════════════════════
export function calcOrderTotals({ files, cart, sugCart, pricing, coupon, user }) {
  const P = pricing ?? Config.DEFAULT_PRICING;

  // ── ملفات الطباعة ─────────────────────────────
  let printSubtotal = 0;
  for (const f of files) {
    const pages   = (f.pages ?? 1) * (f.copies ?? 1);
    const isColor = customerState.get('printColor') === 'c';
    const isDouble = customerState.get('printSide') === '2';

    let pricePerPage;
    if (isColor) {
      const tier = P.color_tiers.find(t => pages <= t.max_pages);
      pricePerPage = tier?.price ?? P.color_tiers.at(-1).price;
    } else {
      pricePerPage = isDouble ? P.bw_double : P.bw_single;
    }

    const cost = pages * pricePerPage;
    printSubtotal += Math.max(cost, P.min_price);
  }

  // ── التغليف ───────────────────────────────────
  const pkgKey  = customerState.get('packaging') ?? 'none';
  const pkgCost = P.packaging?.[pkgKey] ?? 0;
  printSubtotal += pkgCost;

  // ── طلب عاجل ─────────────────────────────────
  if (customerState.get('express')) printSubtotal += P.express_fee;

  // ── المتجر ───────────────────────────────────
  let cartSubtotal = 0;
  for (const item of cart) {
    cartSubtotal += (item.effective_price ?? item.price) * (item.qty ?? 1);
  }
  for (const [id, qty] of Object.entries(sugCart ?? {})) {
    // السعر يُجلَب من المنتج في المتجر — هنا نحتاج فقط القيمة المخزنة مسبقاً
    const prod = customerState.get('suggestedProducts')?.find(p => p.id === id);
    if (prod) cartSubtotal += prod.price * qty;
  }

  const subtotal = printSubtotal + cartSubtotal;

  // ── نقاط الولاء ───────────────────────────────
  const usePoints = document.getElementById('ptstog')?.checked;
  const pointsSaving = usePoints
    ? Math.min((user?.loyalty_points ?? 0) * 10, subtotal * 0.3)
    : 0;

  // ── كوبون الخصم ──────────────────────────────
  let couponDiscount = 0;
  if (coupon && subtotal >= (coupon.min_order_amount ?? 0)) {
    const scope = coupon.scope ?? 'all';
    let base = subtotal;
    if (scope === 'market' || scope === 'market_only') base = cartSubtotal;
    if (scope === 'print') base = printSubtotal;
    couponDiscount = coupon.discount_type === 'percent'
      ? base * (coupon.discount_value / 100)
      : coupon.discount_value;
    couponDiscount = Math.min(couponDiscount, base);
  }

  const discount    = Math.round(pointsSaving + couponDiscount);
  const afterDisc   = Math.max(0, subtotal - discount);

  // ── التوصيل ───────────────────────────────────
  const deliveryFee = afterDisc >= P.delivery_free_threshold ? 0 : P.delivery_fee;

  const total = afterDisc + deliveryFee;

  return { subtotal, discount, deliveryFee, total };
}

// ══════════════════════════════════════
//  دوال داخلية
// ══════════════════════════════════════
function _buildCartItems(cart, sugCart) {
  const items = cart.map(i => ({
    id: i.id, name: i.name, qty: i.qty,
    price: i.effective_price ?? i.price, unit: i.unit,
  }));

  const suggested = customerState.get('suggestedProducts') ?? [];
  for (const [id, qty] of Object.entries(sugCart ?? {})) {
    const p = suggested.find(x => x.id === id);
    if (p) items.push({ id, name: p.name, qty, price: p.price, unit: p.unit ?? 'قطعة', is_suggested: true });
  }
  return items;
}

async function _notifyAdmin(orderId, payload) {
  const msg = `🆕 طلب جديد #${orderId}\n👤 ${payload.customer_name}\n📞 ${payload.phone}\n🏠 ${payload.region}\n💰 ${payload.total?.toLocaleString()} د.ع`;
  await sb.functions.invoke(Config.FUNCTIONS.SEND_TG, {
    body: { chat_id: Config.TELEGRAM.ADMIN_TG_ID, text: msg },
  });
}
