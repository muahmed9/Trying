/**
 * تحديثات customer.main.js
 * 1. إزالة ملخص الطلب من الأعلى
 * 2. إضافة واجهة الشكر بعد إتمام الطلب
 * 3. حساب إحصائيات الملفات (عدد الصفحات والصور والملفات)
 * 4. حساب صفحات PPTX تلقائياً من اسم الملف
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. إزالة updateSummaryBar من الأعلى (حذف الملخص)
// ═══════════════════════════════════════════════════════════════════════════
// قم بحذف أو تعليق هذه الدالة بالكامل:
/*
function updateSummaryBar() {
  const step = customerState.get('currentStep') ?? 1;
  const bar = document.getElementById('order-summary-bar');
  if (!bar || step === 1) { if (bar) bar.style.display = 'none'; return; }
  // ... الكود الباقي
}
*/

// ═══════════════════════════════════════════════════════════════════════════
// 2. إضافة دالة حساب إحصائيات الملفات
// ═══════════════════════════════════════════════════════════════════════════
function getFileStatistics() {
  const files = customerState.get('files') ?? [];
  let totalPages = 0;
  let totalImages = 0;
  let totalFiles = files.length;

  files.forEach(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    
    // حساب الصفحات
    if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
      // للـ PPTX: قراءة من اسم الملف [عدد الصفحات]
      if (ext === 'pptx') {
        const match = f.name.match(/\[(\d+)\s*p(?:ages?)?\]/i);
        totalPages += match ? parseInt(match[1], 10) * (f.copies ?? 1) : (f.pages ?? 1) * (f.copies ?? 1);
      } else {
        totalPages += (f.pages ?? 1) * (f.copies ?? 1);
      }
    }
    
    // حساب الصور
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      totalImages += f.copies ?? 1;
    }
  });

  return { totalPages, totalImages, totalFiles };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. تحديث دالة updateInvoice لإضافة الإحصائيات
// ═══════════════════════════════════════════════════════════════════════════
// استبدل دالة updateInvoice الموجودة بهذه النسخة المحدثة:
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

  // الحصول على الإحصائيات
  const stats = getFileStatistics();

  const cartTotal = cart.reduce((s, i) => s + (i.effective_price ?? i.price) * (i.qty ?? 1), 0);
  let sugCartTotal = 0;
  
  const rows = [];
  if (files.length > 0) {
    rows.push(['<b style="color:var(--navy);">الملفات المرفوعة:</b>', '']);
    
    // إضافة الإحصائيات
    rows.push(['<span style="margin-right:10px;font-size:0.85rem;color:var(--teal)">📊 إحصائيات:</span>', '']);
    rows.push([
      `<span style="margin-right:20px;font-size:0.8rem">📄 ${stats.totalFiles} ملف</span>`,
      `<span style="font-size:0.8rem">📄 ${stats.totalPages} صفحة</span>`
    ]);
    if (stats.totalImages > 0) {
      rows.push([
        `<span style="margin-right:20px;font-size:0.8rem">🖼️ ${stats.totalImages} صورة</span>`,
        ''
      ]);
    }
    
    files.forEach(f => {
      rows.push([`<span style="margin-right:10px;font-size:0.85rem">📄 ${esc(f.name)} (${f.pages ?? 1} ص × ${f.copies ?? 1} نسخ)</span>`, '']);
    });
    const printCost = totals.subtotal - cartTotal - Object.entries(sugCart).reduce((s,[id,qty])=>{
        const p = suggestedProducts.find(x => x.id === id); return s + (p?.price ?? 0)*qty;
    }, 0);
    rows.push(['<span style="margin-right:10px;font-size:0.85rem;color:var(--teal)">إجمالي تكلفة الطباعة والتغليف</span>', `<b style="color:var(--teal)">${formatPrice(printCost)}</b>`]);
  }

  const cartItems = cart.map(i => ({...i, isSug: false}));
  Object.entries(sugCart).forEach(([id, qty]) => {
     const p = suggestedProducts.find(x => x.id === id);
     if (p) cartItems.push({name: p.name, qty, price: p.price, isSug: true});
  });

  if (cartItems.length > 0) {
    rows.push(['<b style="color:var(--navy);margin-top:8px;display:block;">منتجات القرطاسية:</b>', '']);
    let allCartPrice = 0;
    cartItems.forEach(i => {
      const price = i.effective_price ?? i.price;
      const itemTotal = price * (i.qty ?? 1);
      allCartPrice += itemTotal;
      rows.push([`<span style="margin-right:10px;font-size:0.85rem">${esc(i.name)} × ${i.qty}</span>`, `<span style="font-size:0.85rem">${formatPrice(itemTotal)}</span>`]);
    });
  }

  rows.push(['<hr style="margin:8px 0;border:none;border-top:1px solid var(--border);">', '']);
  rows.push(['<b>الإجمالي الجزئي:</b>', `<b>${formatPrice(totals.subtotal)}</b>`]);
  
  if (totals.discount > 0) {
    rows.push(['<span style="color:var(--green);">الخصم:</span>', `<span style="color:var(--green);">-${formatPrice(totals.discount)}</span>`]);
  }
  if (totals.deliveryFee > 0) {
    rows.push(['<span>رسوم التوصيل:</span>', `<span>${formatPrice(totals.deliveryFee)}</span>`]);
  }
  rows.push(['<b style="color:var(--navy);font-size:1.1rem;">الإجمالي النهائي:</b>', `<b style="color:var(--navy);font-size:1.1rem;">${formatPrice(totals.total)}</b>`]);

  const tbody = document.getElementById('inv-tbody');
  if (tbody) {
    tbody.innerHTML = rows.map(([left, right]) => 
      `<tr><td>${left}</td><td style="text-align:left;">${right}</td></tr>`
    ).join('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. إضافة واجهة الشكر بعد إتمام الطلب
// ═══════════════════════════════════════════════════════════════════════════
// استبدل جزء من دالة sendOrder (بعد submitOrder) بهذا:
async function sendOrder() {
  const errEl = document.getElementById('order-error');
  errEl.style.display = 'none';
  errEl.textContent = '';

  try {
    const userId = customerState.get('user')?.id;
    if (!userId) throw new Error('لم يتم تسجيل الدخول');

    const files = customerState.get('files') ?? [];
    if (files.length > 0) {
      const pcon = document.getElementById('pcon');
      const pbar = document.getElementById('pbar');
      const stxt = document.getElementById('statustxt');
      pcon.style.display = 'block';
      stxt.style.display = 'block';
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.uploadedUrl) continue;
        stxt.textContent = `جاري رفع ${f.name} (${i + 1}/${files.length})...`;
        pbar.style.width = `${((i) / files.length) * 100}%`;
        try {
          const url = await uploadFile(f.file, userId, pct => {
            pbar.style.width = `${((i + pct / 100) / files.length) * 100}%`;
          });
          f.uploadedUrl = url;
        } catch (uploadErr) {
          throw new Error(`فشل رفع الملف ${f.name}: ${uploadErr.message}`);
        }
      }
      pbar.style.width = '100%';
      stxt.textContent = '✅ تم رفع جميع الملفات';
      customerState.set('files', [...files]);
    }

    const orderId = await submitOrder({
      name: document.getElementById('uName').value,
      phone: document.getElementById('uPhone').value,
      region: document.getElementById('uRegion').value,
      notes: document.getElementById('uNotes').value,
      locationUrl: customerState.get('locationUrl'),
    });

    const pcon = document.getElementById('pcon');
    const stxt = document.getElementById('statustxt');
    pcon.style.display = 'none';
    stxt.style.display = 'none';

    const region = document.getElementById('uRegion').value.trim();
    if (region) {
      const saved = JSON.parse(localStorage.getItem(Config.APP.STORAGE_KEYS.SAVED_ADDRESSES) || '[]');
      const updated = [region, ...saved.filter(a => a !== region)].slice(0, Config.APP.MAX_SAVED_ADDRESSES);
      localStorage.setItem(Config.APP.STORAGE_KEYS.SAVED_ADDRESSES, JSON.stringify(updated));
    }

    customerState.set('files', []);
    customerState.set('cart', []);
    customerState.set('suggestedCart', {});
    customerState.set('appliedCoupon', null);
    customerState.set('locationUrl', '');
    customerState.set('express', false);
    customerState.set('packaging', 'none');
    renderFileList();
    updateCartBadge();
    stepper.reset();

    // عرض واجهة الشكر
    showThankYouModal(orderId);
    
    // بعد إغلاق الواجهة، انتقل لصفحة الطلبات
    setTimeout(() => {
      goTab('orders');
      loadOrders();
    }, 2000);
  } catch (e) {
    const pcon = document.getElementById('pcon');
    const stxt = document.getElementById('statustxt');
    pcon.style.display = 'none';
    stxt.style.display = 'none';
    errEl.textContent = '❌ ' + e.message;
    errEl.style.display = 'block';
  }
}

// دالة عرض واجهة الشكر
function showThankYouModal(orderId) {
  const modal = document.createElement('div');
  modal.id = 'thank-you-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
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
    padding: 32px;
    max-width: 400px;
    text-align: center;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    animation: slideUp 0.4s ease-out;
  `;

  content.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: 16px;">✅</div>
    <h2 style="color: var(--navy); margin-bottom: 8px;">شكراً لك!</h2>
    <p style="color: var(--text-muted); margin-bottom: 16px;">تم استقبال طلبك بنجاح</p>
    
    <div style="background: var(--input-bg); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 4px;">رقم الطلب:</p>
      <p style="color: var(--navy); font-size: 1.2rem; font-weight: bold;">#${orderId.slice(0, 8)}</p>
    </div>

    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">
      سيتم قبول طلبك قريباً وسنخطرك بأي تحديثات عبر البوت
    </p>

    <button id="close-thank-you" style="
      background: var(--navy);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
    ">حسناً</button>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  document.getElementById('close-thank-you').addEventListener('click', () => {
    modal.remove();
  });

  // إغلاق تلقائياً بعد 5 ثوان
  setTimeout(() => {
    if (modal.parentElement) modal.remove();
  }, 5000);
}

// إضافة CSS animations
if (!document.getElementById('thank-you-styles')) {
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
  `;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. تحديث handleFiles لحساب صفحات PPTX تلقائياً
// ═══════════════════════════════════════════════════════════════════════════
async function handleFiles(newFiles) {
  const allowed = newFiles.filter(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp'].includes(ext);
  });
  if (!allowed.length) { showToast('❌ نوع الملف غير مدعوم', 'error'); return; }

  const files = [...(customerState.get('files') ?? [])];
  for (const f of allowed) {
    const id = 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    let pages = 1;
    
    // حساب صفحات PPTX من اسم الملف
    if (f.name.toLowerCase().endsWith('.pptx')) {
      const match = f.name.match(/\[(\d+)\s*p(?:ages?)?\]/i);
      if (match) {
        pages = parseInt(match[1], 10);
      }
    }
    
    files.push({ id, name: f.name, size: f.size, pages, copies: 1, file: f });
  }
  customerState.set('files', files);
  renderFileList();
}
