/**
 * admin.main.js — نقطة دخول admin.html
 */

import { Config }       from './core/config.js';
import { adminState }   from './core/state.js';
import { esc, debounce, formatPrice, formatDate } from './core/utils.js';
import { adminLogin, checkExistingSession, adminLogout, canChangeStatus, isManager, hasPermission } from './services/auth.service.js';
import { fetchAllOrders, changeOrderStatus, getFilteredOrders, subscribeToOrders } from './services/order-admin.service.js';
import { savePricing, loadPricing, fetchAllProducts, saveProduct, adjustProductStock, fetchSupplies, saveSupply, adjustSupplyStock } from './services/market.service.js';
import { showToast }    from './components/toast.js';
import { withLoading }  from './components/loading-btn.js';
import { Modal }        from './components/modal.js';
import { Sidebar }      from './admin/sidebar.js';

let sidebar;

// ═══════════════════════════════════════
//  تهيئة
// ═══════════════════════════════════════
async function init() {
  const dark = localStorage.getItem(Config.APP.STORAGE_KEYS.DARK_MODE_ADMIN) === 'true';
  applyTheme(dark);

  Modal.init();
  bindLoginForm();

  // جلسة نشطة؟
  const session = await checkExistingSession();
  if (session) enterDashboard();
}

// ═══════════════════════════════════════
//  Dark Mode
// ═══════════════════════════════════════
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const icon = document.getElementById('dm-icon-adm');
  const lbl  = document.getElementById('dm-lbl-adm');
  if (icon) icon.textContent = dark ? '☀️' : '🌙';
  if (lbl)  lbl.textContent  = dark ? 'نهاري' : 'ليلي';
}

// ═══════════════════════════════════════
//  تسجيل الدخول
// ═══════════════════════════════════════
function bindLoginForm() {
  document.getElementById('login-btn').addEventListener('click', () =>
    withLoading('login-btn', handleLogin)
  );
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
      handleLogin();
    }
  });
}

async function handleLogin() {
  const email = document.getElementById('adm-user').value;
  const pass  = document.getElementById('adm-pass').value;
  const errEl = document.getElementById('loginerr');
  errEl.style.display = 'none';

  try {
    await adminLogin(email, pass);
    enterDashboard();
  } catch(e) {
    errEl.textContent   = '❌ ' + e.message;
    errEl.style.display = 'block';
  }
}

// ═══════════════════════════════════════
//  لوحة التحكم
// ═══════════════════════════════════════
function enterDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display    = 'block';

  const profile = adminState.get('currentProfile');
  document.getElementById('role-badge-top').textContent =
    `${profile?.emoji ?? '👤'} ${profile?.name ?? ''}`;

  // Sidebar
  sidebar = new Sidebar(navigateTo);
  sidebar.render();

  // Topbar buttons
  document.getElementById('dm-toggle-btn').addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    localStorage.setItem(Config.APP.STORAGE_KEYS.DARK_MODE_ADMIN, String(!dark));
    applyTheme(!dark);
  });

  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
    document.getElementById('sidebar-overlay').classList.toggle('show');
  });
  document.getElementById('sidebar-overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  });

  // Accordion (الإعدادات)
  document.querySelectorAll('.acc-header[data-acc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.acc;
      const body = document.getElementById('acc-' + id);
      if (!body) return;
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      btn.classList.toggle('open', !isOpen);
    });
  });

  // فلاتر الطلبات
  bindOrderFilters();

  // الإعدادات
  bindSettings();

  // تفاصيل الطلب
  document.getElementById('det-close-btn').addEventListener('click',  () => { document.getElementById('detov').classList.remove('open'); document.getElementById('detpan').classList.remove('open'); });
  document.getElementById('detov').addEventListener('click',          () => { document.getElementById('detov').classList.remove('open'); document.getElementById('detpan').classList.remove('open'); });

  // إلغاء الطلب
  document.getElementById('cancel-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) Modal.close('cancel-modal');
  });
  document.getElementById('cancel-reasons-grid').addEventListener('click', e => {
    const btn = e.target.closest('.reason-btn');
    if (btn) {
      document.querySelectorAll('.reason-btn').forEach(b => b.style.background = '');
      btn.style.background = 'var(--light-teal)';
      document.getElementById('custom-reason').value = btn.dataset.reason;
    }
  });
  document.getElementById('confirm-cancel-btn').addEventListener('click', () =>
    withLoading('confirm-cancel-btn', confirmCancel)
  );
  document.getElementById('close-cancel-modal').addEventListener('click', () => Modal.close('cancel-modal'));

  // TX Modal (مخزن)
  document.getElementById('tx-cancel-btn').addEventListener('click',  () => Modal.close('supply-tx-modal'));
  document.getElementById('tx-confirm-btn').addEventListener('click', () => withLoading('tx-confirm-btn', confirmSupplyTx));

  // تحميل البيانات
  navigateTo('orders');
  subscribeToOrders(
    order => {
      flashBanner(`🆕 طلب جديد #${order.id}`);
      playAlert('received');
      updatePendingCount();
    },
    () => { renderOrders(); updatePendingCount(); }
  );
}

// ═══════════════════════════════════════
//  التنقل بين الصفحات
// ═══════════════════════════════════════
function navigateTo(page) {
  if (page === '__logout__') { handleLogout(); return; }

  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const titles = { orders: 'الطلبات', stats: 'الإحصائيات', dash: 'داشبورد', market: 'قرطاسية الشاطر', supplies: 'المخزن', reports: 'التقارير', settings: 'الإعدادات' };
  document.getElementById('page-title').textContent = titles[page] ?? page;
  sidebar.setActive(page);

  if (page === 'orders')   { fetchAllOrders().then(renderOrders); }
  if (page === 'stats')    { loadStats(); }
  if (page === 'market')   { loadMarketPage(); }
  if (page === 'supplies') { loadSuppliesPage(); }
  if (page === 'reports')  { loadReportsPage(); }
  if (page === 'settings') { loadSettingsPage(); }
}

async function handleLogout() {
  await adminLogout();
  location.reload();
}

// ═══════════════════════════════════════
//  فلاتر الطلبات
// ═══════════════════════════════════════
function bindOrderFilters() {
  const searchEl = document.getElementById('order-search');
  searchEl.addEventListener('input', debounce(() => {
    adminState.set('searchQuery', searchEl.value);
    renderOrders();
  }, 300));

  document.getElementById('type-filter-bar').addEventListener('click', e => {
    const btn = e.target.closest('.filter-tab[data-type]');
    if (!btn) return;
    document.querySelectorAll('#type-filter-bar .filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    adminState.set('typeFilter', btn.dataset.type);
    // إظهار الفلتر المناسب
    document.getElementById('filter-bar').style.display     = btn.dataset.type !== 'market' ? '' : 'none';
    document.getElementById('mkt-filter-bar').style.display = btn.dataset.type === 'market' ? '' : 'none';
    renderOrders();
  });

  document.getElementById('filter-bar').addEventListener('click', e => {
    const btn = e.target.closest('.filter-tab[data-status]');
    if (!btn) return;
    document.querySelectorAll('#filter-bar .filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    adminState.set('statusFilter', btn.dataset.status);
    renderOrders();
  });

  document.getElementById('mkt-filter-bar').addEventListener('click', e => {
    const btn = e.target.closest('.filter-tab[data-mkt-status]');
    if (!btn) return;
    document.querySelectorAll('#mkt-filter-bar .filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    adminState.set('mktStatusFilter', btn.dataset.mktStatus);
    renderOrders();
  });
}

// ═══════════════════════════════════════
//  عرض الطلبات
// ═══════════════════════════════════════
function renderOrders() {
  const orders = getFilteredOrders();
  const list   = document.getElementById('olist');
  updatePendingCount();

  if (!orders.length) {
    list.innerHTML = '<div style="text-align:center;padding:50px;color:var(--text-muted);">لا توجد طلبات</div>';
    return;
  }

  const SM = Config.ORDER_STATUSES;
  list.innerHTML = orders.map(o => {
    const s        = SM[o.status] ?? { label: o.status, css: 'sr', icon: '📦' };
    const isNew    = (Date.now() - new Date(o.created_at)) < 60_000 * 10;
    const actions  = buildActionBtns(o);
    return `
      <div class="order-card${isNew ? ' is-new' : ''}" data-oid="${esc(o.id)}">
        <div class="order-header">
          <div>
            ${isNew ? '<span class="new-badge">جديد</span>' : ''}
            <b style="color:var(--navy);">#${esc(o.id)}</b>
          </div>
          <span class="status-badge ${s.css}">${s.icon} ${s.label}</span>
        </div>
        <div class="order-info-grid">
          <span class="order-info-item">👤 ${esc(o.customer_name ?? '—')}</span>
          <span class="order-info-item">📞 ${esc(o.phone ?? '—')}</span>
          <span class="order-info-item">🏠 ${esc(o.region ?? '—')}</span>
          <span class="order-info-item">💰 ${formatPrice(o.total)}</span>
        </div>
        <div style="font-size:.78rem;color:var(--text-muted);">${formatDate(o.created_at)}</div>
        ${actions ? `<div class="order-actions">${actions}</div>` : ''}
      </div>`;
  }).join('');

  // أحداث
  list.querySelectorAll('.order-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.order-action-btn')) return;
      openOrderDetail(card.dataset.oid);
    });
  });

  list.addEventListener('click', e => {
    const btn = e.target.closest('.order-action-btn[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const { action, oid, from } = btn.dataset;
    if (action === 'cancel') openCancelModal(oid, from);
    else changeStatus(oid, from, action);
  });
}

function buildActionBtns(o) {
  const transitions = {
    received:   [['printing',   '🖨️ بدء الطباعة',  'btn-print']],
    printing:   [['delivering', '🛵 أرسل للتوصيل', 'btn-deliver']],
    delivering: [['delivered',  '✅ تم التسليم',    'btn-done']],
  };
  const available = transitions[o.status] ?? [];
  const btns = available
    .filter(([to]) => canChangeStatus(o.status, to))
    .map(([to, label, cls]) => `<button class="order-action-btn ${cls}" data-action="${to}" data-oid="${esc(o.id)}" data-from="${o.status}">${label}</button>`)
    .join('');

  const canCancel = canChangeStatus(o.status, 'cancelled') && !['delivered','cancelled'].includes(o.status);
  return btns + (canCancel ? `<button class="order-action-btn btn-cancel" data-action="cancel" data-oid="${esc(o.id)}" data-from="${o.status}">❌ إلغاء</button>` : '');
}

async function changeStatus(orderId, from, to) {
  try {
    await changeOrderStatus(orderId, from, to);
    renderOrders();
    playAlert(to);
    showToast(`✅ تم تغيير الحالة إلى ${Config.ORDER_STATUSES[to]?.label ?? to}`, 'success');
  } catch(e) { showToast('❌ ' + e.message, 'error'); }
}

// ═══════════════════════════════════════
//  لوحة التفاصيل
// ═══════════════════════════════════════
function openOrderDetail(orderId) {
  const orders = adminState.get('allOrders') ?? [];
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  adminState.set('openOrderId',  orderId);
  adminState.set('openOrderTgId', o.user_id);

  const SM = Config.ORDER_STATUSES;
  const s  = SM[o.status] ?? { label: o.status, css: 'sr', icon: '📦' };

  document.getElementById('dettitle').textContent = `تفاصيل الطلب #${orderId}`;
  document.getElementById('detbody').innerHTML = `
    <div style="text-align:center;margin-bottom:16px;">
      <span class="status-badge ${s.css}" style="font-size:1rem;padding:8px 20px;">${s.icon} ${s.label}</span>
    </div>
    ${[
      ['👤 الاسم', o.customer_name],
      ['📞 الهاتف', `<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>`],
      ['🏠 المنطقة', o.region],
      ['💰 المبلغ', formatPrice(o.total)],
      ['📅 التاريخ', formatDate(o.created_at)],
      o.notes ? ['📝 ملاحظات', o.notes] : null,
      o.location_url ? ['📍 الموقع', `<a href="${esc(o.location_url)}" target="_blank" style="color:var(--teal);">فتح الخريطة 🗺️</a>`] : null,
    ].filter(Boolean).map(([l, v]) => `
      <div class="detail-row"><span style="color:var(--text-muted);">${l}</span><b>${esc(v) === v ? esc(v) : v}</b></div>
    `).join('')}
    ${o.cancel_reason ? `<div style="margin-top:12px;padding:12px;background:#fef2f2;border-radius:var(--radius-sm);color:var(--red);">❌ سبب الإلغاء: ${esc(o.cancel_reason)}</div>` : ''}
    <div style="margin-top:16px;">
      <a href="https://t.me/${esc(o.phone)}" target="_blank" style="display:flex;align-items:center;gap:8px;background:#dbeafe;color:#1e40af;padding:10px 14px;border-radius:var(--radius-sm);font-weight:800;text-decoration:none;">
        📱 تواصل عبر تيليجرام
      </a>
    </div>`;

  document.getElementById('detov').classList.add('open');
  document.getElementById('detpan').classList.add('open');
}

// ═══════════════════════════════════════
//  إلغاء الطلب
// ═══════════════════════════════════════
function openCancelModal(orderId, from) {
  adminState.set('openOrderId', orderId);
  adminState.set('_cancelFrom', from);
  document.getElementById('custom-reason').value = '';
  document.querySelectorAll('.reason-btn').forEach(b => b.style.background = '');
  Modal.open('cancel-modal');
}

async function confirmCancel() {
  const orderId = adminState.get('openOrderId');
  const from    = adminState.get('_cancelFrom');
  const reason  = document.getElementById('custom-reason').value.trim();
  if (!reason) { showToast('❌ يرجى اختيار سبب الإلغاء', 'error'); return; }
  try {
    await changeOrderStatus(orderId, from, 'cancelled', reason);
    Modal.close('cancel-modal');
    renderOrders();
    showToast('✅ تم إلغاء الطلب', 'success');
  } catch(e) { showToast('❌ ' + e.message, 'error'); }
}

// ═══════════════════════════════════════
//  الإحصائيات
// ═══════════════════════════════════════
function loadStats() {
  const orders = adminState.get('allOrders') ?? [];
  const today  = new Date().toDateString();
  const tod    = orders.filter(o => new Date(o.created_at).toDateString() === today);

  document.getElementById('s-today').textContent    = tod.length;
  document.getElementById('s-pending').textContent  = orders.filter(o => ['received','printing','delivering'].includes(o.status)).length;
  document.getElementById('s-revenue').textContent  = formatPrice(tod.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total ?? 0), 0));
  document.getElementById('s-total').textContent    = orders.length;
  document.getElementById('s-market').textContent   = orders.filter(o => o.order_type === 'market').length;
  document.getElementById('s-combined').textContent = orders.filter(o => o.order_type === 'combined').length;
  document.getElementById('s-delivered').textContent= orders.filter(o => o.status === 'delivered').length;
  document.getElementById('s-cancelled').textContent= orders.filter(o => o.status === 'cancelled').length;
}

// ═══════════════════════════════════════
//  إعدادات
// ═══════════════════════════════════════
function bindSettings() {
  document.getElementById('save-pricing-btn').addEventListener('click', () =>
    withLoading('save-pricing-btn', savePricingForm)
  );
  document.getElementById('create-staff-btn').addEventListener('click', () =>
    withLoading('create-staff-btn', createStaffAccount)
  );
  document.getElementById('create-coupon-btn').addEventListener('click', () =>
    withLoading('create-coupon-btn', createCoupon)
  );
}

async function loadSettingsPage() {
  const pricing = await loadPricing();
  if (!pricing) return;
  const P = pricing;
  document.getElementById('pr-min-pages').value  = P.min_pages;
  document.getElementById('pr-min-price').value  = P.min_price;
  document.getElementById('pr-c1').value          = P.color_tiers?.[0]?.price ?? 150;
  document.getElementById('pr-c2').value          = P.color_tiers?.[1]?.price ?? 130;
  document.getElementById('pr-c3').value          = P.color_tiers?.[2]?.price ?? 120;
  document.getElementById('pr-c4').value          = P.color_tiers?.[3]?.price ?? 100;
  document.getElementById('pr-bw1').value         = P.bw_single;
  document.getElementById('pr-bw2').value         = P.bw_double;
  document.getElementById('pr-del').value         = P.delivery_fee;
  document.getElementById('pr-del-free').value    = P.delivery_free_threshold;
  document.getElementById('pr-express').value     = P.express_fee;
  document.getElementById('pr-pkg-none').value      = P.packaging?.none ?? 0;
  document.getElementById('pr-pkg-cardboard').value = P.packaging?.cardboard ?? 500;
  document.getElementById('pr-pkg-spiral').value    = P.packaging?.spiral ?? 1500;
}

async function savePricingForm() {
  const pricing = {
    min_pages:  Number(document.getElementById('pr-min-pages').value),
    min_price:  Number(document.getElementById('pr-min-price').value),
    color_tiers: [
      { max_pages: 25,      price: Number(document.getElementById('pr-c1').value) },
      { max_pages: 40,      price: Number(document.getElementById('pr-c2').value) },
      { max_pages: 70,      price: Number(document.getElementById('pr-c3').value) },
      { max_pages: 9999999, price: Number(document.getElementById('pr-c4').value) },
    ],
    bw_single:               Number(document.getElementById('pr-bw1').value),
    bw_double:               Number(document.getElementById('pr-bw2').value),
    delivery_fee:            Number(document.getElementById('pr-del').value),
    delivery_free_threshold: Number(document.getElementById('pr-del-free').value),
    express_fee:             Number(document.getElementById('pr-express').value),
    packaging: {
      none:      Number(document.getElementById('pr-pkg-none').value),
      cardboard: Number(document.getElementById('pr-pkg-cardboard').value),
      spiral:    Number(document.getElementById('pr-pkg-spiral').value),
    },
  };
  await savePricing(pricing);
  showToast('✅ تم حفظ التسعير', 'success');
}

async function createStaffAccount() {
  const { sb } = await import('./core/supabase.js');
  const name   = document.getElementById('new-staff-name').value.trim();
  const email  = document.getElementById('new-staff-user').value.trim();
  const pass   = document.getElementById('new-staff-pass').value;
  const emoji  = document.getElementById('new-staff-emoji').value || '👤';

  if (!name || !email || pass.length < 6) {
    showToast('❌ يرجى إدخال الاسم والبريد وكلمة المرور (6+ أحرف)', 'error');
    return;
  }

  const perms = ['perm-rp','perm-pd','perm-dd','perm-canc','perm-market','perm-supplies']
    .map(id => document.getElementById(id))
    .filter(el => el?.checked)
    .map(el => el.value);

  if (!perms.length) { showToast('❌ اختر صلاحية واحدة على الأقل', 'error'); return; }

  try {
    const { data, error } = await sb.functions.invoke(Config.FUNCTIONS.CREATE_STAFF, {
      body: { email, password: pass, name, emoji, permissions: perms }
    });
    if (error) throw error;
    showToast('✅ تم إنشاء الحساب بنجاح', 'success');
  } catch(e) { showToast('❌ ' + e.message, 'error'); }
}

async function createCoupon() {
  const { sb } = await import('./core/supabase.js');
  const code   = document.getElementById('cpn-code').value.trim().toUpperCase();
  const type   = document.getElementById('cpn-type').value;
  const value  = Number(document.getElementById('cpn-value').value);
  const maxUse = Number(document.getElementById('cpn-max').value) || 0;
  const minOrd = Number(document.getElementById('cpn-min-order').value) || 0;
  const expiry = document.getElementById('cpn-expires').value || null;

  if (!code || !value) { showToast('❌ يرجى إدخال الكود والقيمة', 'error'); return; }

  const { error } = await sb.from(Config.TABLES.COUPONS).insert({
    code, discount_type: type, discount_value: value,
    max_uses: maxUse, min_order_amount: minOrd,
    expires_at: expiry, active: true, used_count: 0,
  });

  if (error) { showToast('❌ ' + error.message, 'error'); return; }
  showToast('✅ تم إنشاء الكوبون', 'success');
}

// ═══════════════════════════════════════
//  المتجر (Admin)
// ═══════════════════════════════════════
async function loadMarketPage() {
  if (!isManager() && !hasPermission('manage_market')) return;
  const products = await fetchAllProducts();
  const page = document.getElementById('page-market');
  page.innerHTML = `
    <h2 style="color:var(--navy);margin:0 0 20px;">📦 قرطاسية الشاطر</h2>
    <button id="add-product-btn" class="btn-primary" style="background:var(--navy);color:#fff;margin-bottom:16px;max-width:200px;">➕ منتج جديد</button>
    <div id="products-list-admin"></div>`;

  renderProductsList(products);
  document.getElementById('add-product-btn').addEventListener('click', () => showProductForm());
}

function renderProductsList(products) {
  const list = document.getElementById('products-list-admin');
  if (!list) return;
  list.innerHTML = products.map(p => `
    <div class="product-admin-card">
      <div style="display:flex;gap:12px;align-items:center;">
        <div style="width:60px;height:60px;border-radius:var(--radius-sm);background:var(--input-bg);display:flex;align-items:center;justify-content:center;font-size:2rem;overflow:hidden;flex-shrink:0;">
          ${p.image_url ? `<img class="product-thumb" src="${esc(p.image_url)}" alt="${esc(p.name)}">` : '📦'}
        </div>
        <div style="flex:1;min-width:0;">
          <b style="color:var(--navy);">${esc(p.name)}</b>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:2px;">${formatPrice(p.price)} / ${esc(p.unit ?? 'قطعة')}</div>
          <div class="stock-bar-wrap"><div class="stock-bar" style="width:${Math.min((p.stock / (p.min_stock * 3 || 30)) * 100, 100)}%;background:${p.stock <= p.min_stock ? 'var(--red)' : 'var(--green)'}"></div></div>
          <div style="font-size:.72rem;">${p.stock <= p.min_stock ? `<span class="stock-low">⚠️ ${p.stock} متبقي</span>` : `<span class="stock-ok">✅ ${p.stock} ${esc(p.unit ?? '')}</span>`}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button class="order-action-btn btn-print" data-edit-prod="${esc(p.id)}">✏️ تعديل</button>
          <button class="order-action-btn btn-deliver" data-adj-prod="${esc(p.id)}">📦 مخزون</button>
        </div>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-edit-prod]').forEach(btn => btn.addEventListener('click', () => showProductForm(products.find(p => p.id === btn.dataset.editProd))));
  list.querySelectorAll('[data-adj-prod]').forEach(btn => btn.addEventListener('click', () => adjProductStock(btn.dataset.adjProd, products)));
}

function showProductForm(product = null) { /* TODO: modal لنموذج المنتج */ showToast('سيتم تنفيذه قريباً'); }
function adjProductStock(id, products)   { /* TODO: modal لتعديل المخزون */ showToast('سيتم تنفيذه قريباً'); }

// ═══════════════════════════════════════
//  المخزن (Admin)
// ═══════════════════════════════════════
async function loadSuppliesPage() {
  if (!isManager() && !hasPermission('manage_supplies')) return;
  const supplies = await fetchSupplies();
  const low      = supplies.filter(s => s.stock <= (s.min_stock ?? 0));
  const page     = document.getElementById('page-supplies');
  page.innerHTML = `
    <h2 style="color:var(--navy);margin:0 0 20px;">🗄️ مخزن المواد</h2>
    ${low.length ? `<div class="alert-low"><p class="alert-low-title">⚠️ ${low.length} مواد تحت الحد الأدنى</p>${low.map(s => `<span style="font-size:.82rem;margin-left:8px;">• ${esc(s.name)} (${s.stock})</span>`).join('')}</div>` : ''}
    <div class="stats-grid" style="margin-bottom:18px;">
      <div class="stat-card"><div class="stat-num" style="color:var(--navy);">${supplies.length}</div><div class="stat-lbl">إجمالي المواد</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--orange);">${low.length}</div><div class="stat-lbl">منخفضة المخزون</div></div>
    </div>
    <div id="supplies-list-admin">${supplies.map(s => `
      <div class="product-admin-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <b style="color:var(--navy);">${esc(s.name)}</b>
            <div style="font-size:.78rem;color:var(--text-muted);">${s.stock} ${esc(s.unit ?? '')} | حد التنبيه: ${s.min_stock ?? 0}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="order-action-btn btn-deliver" data-add-sup="${esc(s.id)}" data-sup-name="${esc(s.name)}">➕ إضافة</button>
            <button class="order-action-btn btn-cancel"  data-sub-sup="${esc(s.id)}" data-sup-name="${esc(s.name)}">➖ خصم</button>
          </div>
        </div>
      </div>`).join('')}</div>`;

  adminState.set('_suppliesData', supplies);

  page.querySelectorAll('[data-add-sup]').forEach(btn => btn.addEventListener('click', () => openSupplyTx(btn.dataset.addSup, btn.dataset.supName, 'add')));
  page.querySelectorAll('[data-sub-sup]').forEach(btn => btn.addEventListener('click', () => openSupplyTx(btn.dataset.subSup, btn.dataset.supName, 'sub')));
}

function openSupplyTx(id, name, type) {
  adminState.set('_txSupplyId',   id);
  adminState.set('_txSupplyType', type);
  document.getElementById('tx-type-label').textContent  = type === 'add' ? '➕ إضافة مخزون' : '➖ خصم من المخزون';
  document.getElementById('tx-supply-name').textContent = name;
  document.getElementById('tx-qty').value               = '';
  document.getElementById('tx-notes').value             = '';
  Modal.open('supply-tx-modal');
}

async function confirmSupplyTx() {
  const id    = adminState.get('_txSupplyId');
  const type  = adminState.get('_txSupplyType');
  const qty   = Number(document.getElementById('tx-qty').value);
  const note  = document.getElementById('tx-notes').value;
  if (!qty || qty <= 0) { showToast('❌ أدخل كمية صحيحة', 'error'); return; }
  try {
    await adjustSupplyStock(id, type, qty, note);
    Modal.close('supply-tx-modal');
    showToast('✅ تم تحديث المخزون', 'success');
    loadSuppliesPage();
  } catch(e) { showToast('❌ ' + e.message, 'error'); }
}

// ═══════════════════════════════════════
//  التقارير
// ═══════════════════════════════════════
function loadReportsPage() {
  document.getElementById('export-orders-csv').addEventListener('click', () => exportOrdersCSV());
}

function exportOrdersCSV() {
  const orders = adminState.get('allOrders') ?? [];
  const from   = document.getElementById('rep-from').value;
  const to     = document.getElementById('rep-to').value;
  const filtered = orders.filter(o => {
    const d = new Date(o.created_at);
    if (from && d < new Date(from)) return false;
    if (to   && d > new Date(to + 'T23:59:59')) return false;
    return true;
  });
  const rows = [
    ['رقم الطلب','الاسم','الهاتف','المنطقة','المبلغ','الحالة','التاريخ'],
    ...filtered.map(o => [o.id, o.customer_name, o.phone, o.region, o.total, Config.ORDER_STATUSES[o.status]?.label ?? o.status, new Date(o.created_at).toLocaleString('ar-IQ')])
  ];
  const csv  = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `orders_${Date.now()}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════
//  مساعدات
// ═══════════════════════════════════════
function updatePendingCount() {
  const count = (adminState.get('allOrders') ?? []).filter(o => ['received','printing'].includes(o.status)).length;
  document.getElementById('pcnt').textContent = count;
  sidebar?.updateBadge(count);
}

let _bannerTimer;
function flashBanner(msg) {
  const b = document.getElementById('new-order-banner');
  const t = document.getElementById('new-order-banner-text');
  if (!b) return;
  if (t) t.textContent = msg;
  b.classList.add('show');
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(() => b.classList.remove('show'), Config.APP.BANNER_DURATION_MS);
}

let _ac = null;
function playAlert(status) {
  if (!_ac) {
    try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  }
  try {
    if (_ac.state === 'suspended') _ac.resume();
    const t = _ac.currentTime;
    const note = (f, st, dur, vol = 0.35) => {
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.connect(g); g.connect(_ac.destination);
      o.frequency.value = f;
      g.gain.setValueAtTime(vol, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + dur);
      o.start(st); o.stop(st + dur);
    };
    if (status === 'received')   { note(880, t, .18); note(880, t+.28, .18); note(880, t+.56, .22); }
    if (status === 'delivered')  { note(523, t, .14); note(659, t+.18, .14); note(784, t+.36, .14); note(1047, t+.54, .26); }
    if (status === 'cancelled')  { note(440, t, .45); note(220, t+.52, .55); }
  } catch {}
}

// Connectivity
window.addEventListener('online',  () => { const b = document.getElementById('conn-badge'); b.className = 'online';  b.textContent = '✅ الاتصال يعمل'; setTimeout(() => b.className = '', 3000); });
window.addEventListener('offline', () => { const b = document.getElementById('conn-badge'); b.className = 'offline'; b.textContent = '❌ لا يوجد اتصال'; });

init().catch(console.error);
