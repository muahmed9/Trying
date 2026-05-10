/**
 * admin.PRICING_MANAGEMENT.js
 * إدارة فئات الاستنساخ الملون والتسعير
 * 
 * FIX: إضافة واجهة كاملة لإدارة فئات الاستنساخ الملون
 */

import { savePricing, loadPricing } from './services/market.service.js';
import { showToast } from './components/toast.js';
import { Modal } from './components/modal.js';
import { adminState } from './core/state.js';
import { Config } from './core/config.js';

/**
 * تحميل صفحة إدارة التسعير
 */
export async function loadPricingPage() {
  const page = document.getElementById('page-pricing');
  if (!page) return;

  try {
    const pricing = await loadPricing();
    adminState.set('_currentPricing', pricing);

    page.innerHTML = `
      <h2 style="color:var(--navy);margin:0 0 20px;">💰 إدارة التسعير</h2>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px;">
        <!-- الأسعار الأساسية -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <h3 style="color:var(--navy);margin:0 0 15px;">⚪ أبيض وأسود</h3>
          <div style="display:flex;gap:10px;margin-bottom:10px;">
            <input type="number" id="bw-single" placeholder="سعر الوجه الواحد" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
            <span style="padding:8px;color:var(--text-muted);">د.ع</span>
          </div>
          <div style="display:flex;gap:10px;">
            <input type="number" id="bw-double" placeholder="سعر الوجهين" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
            <span style="padding:8px;color:var(--text-muted);">د.ع</span>
          </div>
        </div>

        <!-- الأسعار الملونة الأساسية -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <h3 style="color:var(--navy);margin:0 0 15px;">🌈 ملون (أساسي)</h3>
          <div style="display:flex;gap:10px;margin-bottom:10px;">
            <input type="number" id="c-single" placeholder="سعر الوجه الواحد" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
            <span style="padding:8px;color:var(--text-muted);">د.ع</span>
          </div>
          <div style="display:flex;gap:10px;">
            <input type="number" id="c-double" placeholder="سعر الوجهين" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
            <span style="padding:8px;color:var(--text-muted);">د.ع</span>
          </div>
        </div>
      </div>

      <!-- فئات الاستنساخ الملون -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
          <h3 style="color:var(--navy);margin:0;">🎯 فئات الاستنساخ الملون</h3>
          <button id="add-tier-btn" class="btn-primary" style="background:var(--navy);color:#fff;padding:8px 16px;border:none;border-radius:var(--radius-sm);cursor:pointer;">➕ إضافة فئة</button>
        </div>
        <div id="color-tiers-list"></div>
      </div>

      <!-- الإعدادات الأخرى -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <h3 style="color:var(--navy);margin:0 0 15px;">📦 التغليف</h3>
          <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:0.9rem;">كبس (بدون تغليف)</label>
            <input type="number" id="pkg-none" placeholder="0" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
          </div>
          <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:0.9rem;">مقوى + نايلون</label>
            <input type="number" id="pkg-cardboard" placeholder="500" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-size:0.9rem;">سبايرول</label>
            <input type="number" id="pkg-spiral" placeholder="1500" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
          </div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <h3 style="color:var(--navy);margin:0 0 15px;">🚚 التوصيل والخدمات</h3>
          <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:0.9rem;">رسوم التوصيل</label>
            <input type="number" id="delivery-fee" placeholder="1000" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
          </div>
          <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:0.9rem;">توصيل مجاني فوق</label>
            <input type="number" id="delivery-free" placeholder="10000" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-size:0.9rem;">رسوم الطلب العاجل</label>
            <input type="number" id="express-fee" placeholder="1500" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;">
        <button id="save-pricing-btn" class="btn-primary" style="background:var(--green);color:#fff;padding:12px 24px;border:none;border-radius:var(--radius-sm);cursor:pointer;flex:1;">💾 حفظ التسعير</button>
        <button id="reset-pricing-btn" class="btn-secondary" style="background:var(--text-muted);color:#fff;padding:12px 24px;border:none;border-radius:var(--radius-sm);cursor:pointer;flex:1;">🔄 استعادة الافتراضي</button>
      </div>
    `;

    renderColorTiers(pricing.color_copy_tiers ?? Config.DEFAULT_PRICING.color_copy_tiers);
    populatePricingForm(pricing);
    bindPricingEvents();
  } catch (e) {
    page.innerHTML = `<p style="color:var(--red);">❌ خطأ: ${e.message}</p>`;
  }
}

/**
 * عرض قائمة فئات الاستنساخ الملون
 */
function renderColorTiers(tiers) {
  const list = document.getElementById('color-tiers-list');
  if (!list) return;

  if (!tiers || tiers.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);text-align:center;">لا توجد فئات محددة</p>';
    return;
  }

  list.innerHTML = tiers.map((tier, idx) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--input-bg);border-radius:var(--radius-sm);margin-bottom:8px;">
      <div style="flex:1;">
        <div style="font-weight:600;color:var(--navy);">من ${tier.min} إلى ${tier.max} صفحة</div>
        <div style="font-size:0.9rem;color:var(--text-muted);">السعر: ${tier.price} د.ع</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="edit-tier-btn" data-idx="${idx}" style="background:var(--navy);color:#fff;border:none;padding:6px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.85rem;">✏️ تعديل</button>
        <button class="delete-tier-btn" data-idx="${idx}" style="background:var(--red);color:#fff;border:none;padding:6px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:0.85rem;">🗑️ حذف</button>
      </div>
    </div>
  `).join('');

  // ربط أزرار التعديل والحذف
  list.querySelectorAll('.edit-tier-btn').forEach(btn => {
    btn.addEventListener('click', () => editColorTier(parseInt(btn.dataset.idx)));
  });

  list.querySelectorAll('.delete-tier-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteColorTier(parseInt(btn.dataset.idx)));
  });
}

/**
 * ملء نموذج التسعير بالقيم الحالية
 */
function populatePricingForm(pricing) {
  document.getElementById('bw-single').value = pricing.bw_single ?? 90;
  document.getElementById('bw-double').value = pricing.bw_double ?? 75;
  document.getElementById('c-single').value = pricing.c_single ?? 150;
  document.getElementById('c-double').value = pricing.c_double ?? 130;
  document.getElementById('pkg-none').value = pricing.packaging?.none ?? 0;
  document.getElementById('pkg-cardboard').value = pricing.packaging?.cardboard ?? 500;
  document.getElementById('pkg-spiral').value = pricing.packaging?.spiral ?? 1500;
  document.getElementById('delivery-fee').value = pricing.delivery_fee ?? 1000;
  document.getElementById('delivery-free').value = pricing.delivery_free_threshold ?? 10000;
  document.getElementById('express-fee').value = pricing.express_fee ?? 1500;
}

/**
 * ربط أحداث التسعير
 */
function bindPricingEvents() {
  document.getElementById('add-tier-btn').addEventListener('click', () => showTierModal());
  document.getElementById('save-pricing-btn').addEventListener('click', savePricingForm);
  document.getElementById('reset-pricing-btn').addEventListener('click', resetPricing);
}

/**
 * عرض نموذج إضافة/تعديل فئة
 */
function showTierModal(tierIdx = null) {
  const pricing = adminState.get('_currentPricing') ?? Config.DEFAULT_PRICING;
  const tiers = pricing.color_copy_tiers ?? [];
  const tier = tierIdx !== null ? tiers[tierIdx] : null;

  const modal = document.createElement('div');
  modal.id = 'tier-modal';
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
    z-index: 9000;
  `;

  modal.innerHTML = `
    <div style="background:white;border-radius:var(--radius);padding:30px;max-width:400px;width:90%;">
      <h3 style="color:var(--navy);margin:0 0 20px;">${tier ? '✏️ تعديل الفئة' : '➕ إضافة فئة جديدة'}</h3>
      
      <div style="margin-bottom:15px;">
        <label style="display:block;margin-bottom:5px;font-weight:600;">من (عدد الصفحات)</label>
        <input type="number" id="tier-min" placeholder="1" value="${tier?.min ?? ''}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
      </div>

      <div style="margin-bottom:15px;">
        <label style="display:block;margin-bottom:5px;font-weight:600;">إلى (عدد الصفحات)</label>
        <input type="number" id="tier-max" placeholder="30" value="${tier?.max ?? ''}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
      </div>

      <div style="margin-bottom:20px;">
        <label style="display:block;margin-bottom:5px;font-weight:600;">السعر (د.ع)</label>
        <input type="number" id="tier-price" placeholder="150" value="${tier?.price ?? ''}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);">
      </div>

      <div style="display:flex;gap:10px;">
        <button id="tier-save-btn" style="flex:1;background:var(--navy);color:#fff;border:none;padding:10px;border-radius:var(--radius-sm);cursor:pointer;font-weight:600;">حفظ</button>
        <button id="tier-cancel-btn" style="flex:1;background:var(--text-muted);color:#fff;border:none;padding:10px;border-radius:var(--radius-sm);cursor:pointer;font-weight:600;">إلغاء</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('tier-save-btn').addEventListener('click', () => {
    const min = parseInt(document.getElementById('tier-min').value);
    const max = parseInt(document.getElementById('tier-max').value);
    const price = parseInt(document.getElementById('tier-price').value);

    if (!min || !max || !price) {
      showToast('❌ يرجى ملء جميع الحقول', 'error');
      return;
    }

    if (min > max) {
      showToast('❌ يجب أن يكون "من" أصغر من "إلى"', 'error');
      return;
    }

    const pricing = adminState.get('_currentPricing') ?? Config.DEFAULT_PRICING;
    const tiers = pricing.color_copy_tiers ?? [];

    if (tierIdx !== null) {
      tiers[tierIdx] = { min, max, price };
    } else {
      tiers.push({ min, max, price });
    }

    tiers.sort((a, b) => a.min - b.min);
    pricing.color_copy_tiers = tiers;
    adminState.set('_currentPricing', pricing);

    renderColorTiers(tiers);
    modal.remove();
    showToast(tierIdx !== null ? '✅ تم تحديث الفئة' : '✅ تمت إضافة الفئة', 'success');
  });

  document.getElementById('tier-cancel-btn').addEventListener('click', () => modal.remove());
}

/**
 * حذف فئة
 */
function deleteColorTier(tierIdx) {
  if (!confirm('هل أنت متأكد من حذف هذه الفئة؟')) return;

  const pricing = adminState.get('_currentPricing') ?? Config.DEFAULT_PRICING;
  const tiers = pricing.color_copy_tiers ?? [];
  tiers.splice(tierIdx, 1);
  pricing.color_copy_tiers = tiers;
  adminState.set('_currentPricing', pricing);

  renderColorTiers(tiers);
  showToast('✅ تم حذف الفئة', 'success');
}

/**
 * تعديل فئة
 */
function editColorTier(tierIdx) {
  showTierModal(tierIdx);
}

/**
 * حفظ التسعير
 */
async function savePricingForm() {
  try {
    const pricing = adminState.get('_currentPricing') ?? Config.DEFAULT_PRICING;

    pricing.bw_single = parseInt(document.getElementById('bw-single').value) || 90;
    pricing.bw_double = parseInt(document.getElementById('bw-double').value) || 75;
    pricing.c_single = parseInt(document.getElementById('c-single').value) || 150;
    pricing.c_double = parseInt(document.getElementById('c-double').value) || 130;
    pricing.packaging = {
      none: parseInt(document.getElementById('pkg-none').value) || 0,
      cardboard: parseInt(document.getElementById('pkg-cardboard').value) || 500,
      spiral: parseInt(document.getElementById('pkg-spiral').value) || 1500,
    };
    pricing.delivery_fee = parseInt(document.getElementById('delivery-fee').value) || 1000;
    pricing.delivery_free_threshold = parseInt(document.getElementById('delivery-free').value) || 10000;
    pricing.express_fee = parseInt(document.getElementById('express-fee').value) || 1500;

    await savePricing(pricing);
    showToast('✅ تم حفظ التسعير بنجاح', 'success');
  } catch (e) {
    showToast('❌ فشل حفظ التسعير: ' + e.message, 'error');
  }
}

/**
 * استعادة التسعير الافتراضي
 */
async function resetPricing() {
  if (!confirm('هل تريد استعادة التسعير الافتراضي؟')) return;

  try {
    await savePricing(Config.DEFAULT_PRICING);
    adminState.set('_currentPricing', Config.DEFAULT_PRICING);
    loadPricingPage();
    showToast('✅ تم استعادة التسعير الافتراضي', 'success');
  } catch (e) {
    showToast('❌ فشل الاستعادة: ' + e.message, 'error');
  }
}

export { loadPricingPage };
