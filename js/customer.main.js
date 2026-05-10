/**
 * customer.main.js — نقطة دخول index.html
 * FIX: تحسينات شاملة لحساب الصفحات والفاتورة والإشعارات
 */

// ═══════════════════════════════════════
// حساب إحصائيات الملفات - محسّن
// ═══════════════════════════════════════
function getFileStatistics() {
  const files = customerState.get('files') ?? [];
  let totalPages = 0;
  let totalImages = 0;
  let totalFiles = files.length;

  files.forEach(f => {
    if (!f || !f.name) return;
    
    const ext = f.name.split('.').pop().toLowerCase();
    
    // حساب الصفحات
    if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
      let pages = f.pages ?? 1;
      
      // دعم خاص لـ PPTX: البحث عن [N pages] في الاسم
      if (ext === 'pptx') {
        const match = f.name.match(/\[(\d+)\s*p(?:ages?)?\]/i);
        if (match) {
          pages = parseInt(match[1], 10);
        }
      }
      
      // التأكد من أن pages رقم صحيح
      pages = Math.max(1, parseInt(pages, 10) || 1);
      const copies = Math.max(1, parseInt(f.copies, 10) || 1);
      totalPages += pages * copies;
    }
    
    // حساب الصور
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      const copies = Math.max(1, parseInt(f.copies, 10) || 1);
      totalImages += copies;
    }
  });

  return { totalPages, totalImages, totalFiles };
}

// ═══════════════════════════════════════
// تحديث الفاتورة النهائية - محسّن
// ═══════════════════════════════════════
function updateInvoice() {
  const pricing = customerState.get('pricing') ?? Config.DEFAULT_PRICING;
  const totals = calcOrderTotals({
    files: customerState.get('files') ?? [],
    cart: customerState.get('cart') ?? [],
    sugCart: customerState.get('suggestedCart') ?? {},
    pricing, coupon: customerState.get('appliedCoupon'),
    user: customerState.get('user'),
  });

  const files = customerState.get('files') ?? [];
  const cart = customerState.get('cart') ?? [];
  const sugCart = customerState.get('suggestedCart') ?? {};
  const suggestedProducts = customerState.get('suggestedProducts') ?? [];

  const cartTotal = cart.reduce((s, i) => s + (i.effective_price ?? i.price ?? 0) * (i.qty ?? 1), 0);
  
  const rows = [];
  
  // قسم الملفات المرفوعة
  if (files.length > 0) {
    rows.push(['<b style="color:var(--navy);">📄 الملفات المرفوعة:</b>', '']);
    files.forEach(f => {
      if (!f || !f.name) return;
      const pages = f.pages ?? 1;
      const copies = f.copies ?? 1;
      rows.push([`<span style="margin-right:10px;font-size:0.85rem">📄 ${esc(f.name)} (${pages} ص × ${copies} نسخ)</span>`, '']);
    });
    
    const printCost = totals.subtotal - cartTotal - Object.entries(sugCart).reduce((s,[id,qty])=>{
      const p = suggestedProducts.find(x => x.id === id);
      return s + (p?.price ?? 0) * qty;
    }, 0);
    
    rows.push(['<span style="margin-right:10px;font-size:0.85rem;color:var(--teal)">💰 إجمالي تكلفة الطباعة والتغليف</span>', `<b style="color:var(--teal)">${formatPrice(Math.max(0, printCost))}</b>`]);
  }

  // قسم منتجات القرطاسية
  const cartItems = cart.map(i => ({...i, isSug: false}));
  Object.entries(sugCart).forEach(([id, qty]) => {
    const p = suggestedProducts.find(x => x.id === id);
    if (p) cartItems.push({name: p.name, qty, price: p.price, isSug: true});
  });

  if (cartItems.length > 0) {
    rows.push(['<b style="color:var(--navy);margin-top:8px;display:block;">📦 منتجات القرطاسية:</b>', '']);
    let allCartPrice = 0;
    cartItems.forEach(i => {
      const price = i.effective_price ?? i.price ?? 0;
      const t = price * (i.qty ?? 1);
      allCartPrice += t;
      rows.push([`<span style="margin-right:10px;font-size:0.85rem">📦 ${esc(i.name)} × ${i.qty}</span>`, formatPrice(t)]);
    });
    rows.push(['<span style="margin-right:10px;font-size:0.85rem;color:var(--teal)">💰 إجمالي تكلفة القرطاسية</span>', `<b style="color:var(--teal)">${formatPrice(allCartPrice)}</b>`]);
  }

  // قسم التوصيل والخصم
  rows.push(['<b style="color:var(--navy);margin-top:8px;display:block;">🚚 التوصيل والخصم:</b>', '']);
  rows.push(['<span style="font-size:0.85rem;margin-right:10px;">🚚 رسوم التوصيل</span>', totals.deliveryFee === 0 ? '<b style="color:var(--green)">🎁 مجاني</b>' : formatPrice(totals.deliveryFee)]);
  
  if (totals.discount > 0) {
    rows.push(['<span style="font-size:0.85rem;margin-right:10px;">💎 قيمة الخصم</span>', '<b style="color:var(--red)">- ' + formatPrice(totals.discount) + '</b>']);
  }

  // تحديث HTML
  const invdetEl = document.getElementById('invdet');
  if (invdetEl) {
    invdetEl.innerHTML = rows
      .map(([l, v]) => `<div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:.95rem;opacity:.9;"><span>${l}</span><b>${v}</b></div>`)
      .join('');
  }
  
  // تحديث الإجمالي النهائي - مع التحقق من وجود العنصر
  const totlblEl = document.getElementById('totlbl');
  if (totlblEl) {
    totlblEl.textContent = `المجموع النهائي: ${formatPrice(totals.total)}`;
  }
}

// ═══════════════════════════════════════
// إرسال الطلب - محسّن
// ═══════════════════════════════════════
async function sendOrder() {
  const errEl = document.getElementById('errbox');
  if (errEl) errEl.style.display = 'none';

  try {
    // رفع الملفات إلى Supabase storage قبل إرسال الطلب
    const files = customerState.get('files') ?? [];
    const userId = customerState.get('user')?.id ?? 'guest';
    const pcon = document.getElementById('pcon');
    const pbar = document.getElementById('pbar');
    const stxt = document.getElementById('statustxt');

    if (files.length) {
      if (pcon) pcon.style.display = 'block';
      if (stxt) stxt.style.display = 'block';
      
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.uploadedUrl) continue; // تم رفعه بالفعل
        
        if (stxt) stxt.textContent = `جاري رفع ${f.name} (${i + 1}/${files.length})...`;
        if (pbar) pbar.style.width = `${((i) / files.length) * 100}%`;
        
        try {
          const url = await uploadFile(f.file, userId, pct => {
            if (pbar) pbar.style.width = `${((i + pct / 100) / files.length) * 100}%`;
          });
          f.uploadedUrl = url;
        } catch (uploadErr) {
          throw new Error(`فشل رفع الملف ${f.name}: ${uploadErr.message}`);
        }
      }
      
      if (pbar) pbar.style.width = '100%';
      if (stxt) stxt.textContent = '✅ تم رفع جميع الملفات';
      customerState.set('files', [...files]);
    }

    const orderId = await submitOrder({
      name: document.getElementById('uName')?.value ?? '',
      phone: document.getElementById('uPhone')?.value ?? '',
      region: document.getElementById('uRegion')?.value ?? '',
      notes: document.getElementById('uNotes')?.value ?? '',
      locationUrl: customerState.get('locationUrl'),
    });

    if (pcon) pcon.style.display = 'none';
    if (stxt) stxt.style.display = 'none';

    const region = document.getElementById('uRegion')?.value?.trim() ?? '';
    if (region) {
      const saved = JSON.parse(localStorage.getItem(Config.APP.STORAGE_KEYS.SAVED_ADDRESSES) || '[]');
      const updated = [region, ...saved.filter(a => a !== region)].slice(0, Config.APP.MAX_SAVED_ADDRESSES);
      localStorage.setItem(Config.APP.STORAGE_KEYS.SAVED_ADDRESSES, JSON.stringify(updated));
    }

    // مسح البيانات
    customerState.set('files', []);
    customerState.set('cart', []);
    customerState.set('suggestedCart', {});
    customerState.set('appliedCoupon', null);
    customerState.set('locationUrl', '');
    customerState.set('express', false);
    customerState.set('packaging', 'none');
    
    renderFileList();
    updateCartBadge();
    updateSummaryBar();
    stepper.reset();

    // عرض واجهة الشكر والترحيب
    showThankYouModal(orderId);
    
    // بعد إغلاق الواجهة، انتقل لصفحة الطلبات
    setTimeout(() => {
      goTab('orders');
      loadOrders();
      showOrderDetail(orderId);
    }, 3000);
  } catch (e) {
    const pcon = document.getElementById('pcon');
    const stxt = document.getElementById('statustxt');
    if (pcon) pcon.style.display = 'none';
    if (stxt) stxt.style.display = 'none';
    
    if (errEl) {
      errEl.textContent = '❌ ' + e.message;
      errEl.style.display = 'block';
    }
  }
}

// ═══════════════════════════════════════
// واجهة الشكر والترحيب - محسّنة
// ═══════════════════════════════════════
function showThankYouModal(orderId) {
  const modal = document.createElement('div');
  modal.id = 'thank-you-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.3s ease-in;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    border-radius: 16px;
    padding: 40px;
    max-width: 450px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    animation: slideUp 0.4s ease-out;
  `;

  content.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: 20px;">✅</div>
    <h2 style="color: #1a5f3a; margin: 0 0 10px; font-size: 1.8rem; font-weight: 700;">شكراً لك!</h2>
    <p style="color: #666; margin: 0 0 20px; font-size: 1rem;">تم استقبال طلبك بنجاح</p>
    
    <div style="background: #f0f9f7; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #1a5f3a;">
      <div style="font-size: 0.9rem; color: #666; margin-bottom: 8px;">رقم الطلب</div>
      <div style="font-size: 1.4rem; font-weight: 700; color: #1a5f3a; font-family: monospace;">#${orderId}</div>
    </div>
    
    <div style="background: #f9f9f9; border-radius: 12px; padding: 15px; margin: 15px 0; text-align: left;">
      <div style="font-size: 0.85rem; color: #666; margin-bottom: 8px;">📍 حالة الطلب</div>
      <div style="font-size: 0.95rem; color: #333;">سيتم قبول طلبك قريباً وسنخطرك بأي تحديثات عبر البوت</div>
    </div>
    
    <div style="background: #f9f9f9; border-radius: 12px; padding: 15px; margin: 15px 0; text-align: left;">
      <div style="font-size: 0.85rem; color: #666; margin-bottom: 8px;">📞 التواصل</div>
      <div style="font-size: 0.9rem; color: #333;">
        <div>☎️ هاتف: 07752564099</div>
        <div>💬 واتساب: <a href="https://wa.me/9647752564099" style="color: #1a5f3a; text-decoration: none;">اضغط هنا</a></div>
      </div>
    </div>
    
    <button id="thank-you-close" style="
      background: #1a5f3a;
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
      width: 100%;
      transition: background 0.3s;
    ">إغلاق</button>
  `;

  // إضافة الأنماط
  const style = document.createElement('style');
  style.id = 'thank-you-styles';
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    #thank-you-close:hover {
      background: #155a30 !important;
    }
  `;
  
  if (!document.getElementById('thank-you-styles')) {
    document.head.appendChild(style);
  }

  modal.appendChild(content);
  document.body.appendChild(modal);

  document.getElementById('thank-you-close').addEventListener('click', () => {
    modal.remove();
  });

  // إغلاق تلقائي بعد 5 ثواني
  setTimeout(() => {
    if (modal.parentNode) modal.remove();
  }, 5000);
}

// ═══════════════════════════════════════
// دوال مساعدة - محسّنة
// ═══════════════════════════════════════

function updateSummaryBar() {
  const step = customerState.get('currentStep') ?? 1;
  const bar = document.getElementById('order-summary-bar');
  if (!bar || step === 1) { if (bar) bar.style.display = 'none'; return; }

  const files = customerState.get('files') ?? [];
  const cart = customerState.get('cart') ?? [];
  const color = customerState.get('printColor') === 'c' ? '🌈 ملون' : '⚪ أبيض وأسود';
  const side = customerState.get('printSide') === '2' ? 'وجهين' : 'وجه واحد';
  const pkg = { none: '📎 كبس', cardboard: '📋 مقوى+نايلون', spiral: '🔩 سبايرول' }[customerState.get('packaging') ?? 'none'];
  const express = customerState.get('express') ? ' ⚡ عاجل' : '';

  const filesText = files.length ? `📁 ${files.length} ملف (${color} • ${side})` : '';
  const cartText = cart.length ? `🛒 ${cart.length} منتج` : '';
  const optText = files.length ? `${pkg}${express}` : '';

  const summaryFilesEl = document.getElementById('summary-files');
  const summaryOptionsEl = document.getElementById('summary-options');
  
  if (summaryFilesEl) summaryFilesEl.textContent = [filesText, cartText].filter(Boolean).join(' + ');
  if (summaryOptionsEl) summaryOptionsEl.textContent = optText;
  
  if (bar) bar.style.display = 'block';
}

function updateCartBadge() {
  const count = (customerState.get('cart') ?? []).reduce((s, i) => s + (i.qty ?? 1), 0);
  const badges = ['cart-count', 'nav-cart-badge', 'mkt-badge'];
  
  badges.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = count || '';
      el.style.display = count > 0 ? '' : 'none';
    }
  });
  
  const fab = document.getElementById('cart-fab');
  if (fab) fab.style.display = count > 0 ? 'flex' : 'none';
}

// تصدير الدوال المهمة
export { getFileStatistics, updateInvoice, sendOrder, showThankYouModal, updateSummaryBar, updateCartBadge };
