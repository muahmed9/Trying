/**
 * order-admin.service.js — إدارة الطلبات من جانب الإدارة
 */

import { sb }         from '../core/supabase.js';
import { Config }     from '../core/config.js';
import { adminState } from '../core/state.js';
import { canChangeStatus, canSeeStatus } from './auth.service.js';

const T = Config.TABLES;

// ══════════════════════════════════════
//  جلب كل الطلبات
// ══════════════════════════════════════
export async function fetchAllOrders() {
  const { data, error } = await sb
    .from(T.ORDERS)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;

  const orders = (data ?? []).filter(o => canSeeStatus(o.status));
  adminState.set('allOrders', orders);
  return orders;
}

// ══════════════════════════════════════
//  تغيير حالة طلب
// ══════════════════════════════════════
export async function changeOrderStatus(orderId, fromStatus, toStatus, cancelReason = '') {
  if (!canChangeStatus(fromStatus, toStatus)) {
    throw new Error('ليس لديك صلاحية تغيير الحالة');
  }

  const updateData = {
    status:     toStatus,
    updated_at: new Date().toISOString(),
  };

  if (toStatus === 'cancelled' && cancelReason) {
    updateData.cancel_reason = cancelReason;
  }

  // إضافة للـ status_history
  const order = adminState.get('allOrders')?.find(o => o.id === orderId);
  if (order) {
    const history = order.status_history ?? [];
    history.push({ status: toStatus, at: new Date().toISOString() });
    updateData.status_history = history;
  }

  const { error } = await sb
    .from(T.ORDERS)
    .update(updateData)
    .eq('id', orderId);

  if (error) throw error;

  // إشعار الزبون عبر تيليجرام
  if (order?.user_id) {
    const msg = Config.customerMessage(orderId, toStatus, cancelReason);
    if (msg) {
      sb.functions.invoke(Config.FUNCTIONS.SEND_TG, {
        body: { chat_id: order.user_id, text: msg },
      }).catch(() => {});
    }
  }

  // تحديث الحالة المحلية
  const orders = adminState.get('allOrders') ?? [];
  const idx    = orders.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    orders[idx] = { ...orders[idx], ...updateData };
    adminState.set('allOrders', [...orders]);
  }
}

// ══════════════════════════════════════
//  فلترة الطلبات (محلية)
// ══════════════════════════════════════
export function getFilteredOrders() {
  const orders         = adminState.get('allOrders') ?? [];
  const statusFilter   = adminState.get('statusFilter');
  const typeFilter     = adminState.get('typeFilter');
  const mktFilter      = adminState.get('mktStatusFilter');
  const searchQuery    = adminState.get('searchQuery')?.toLowerCase().trim();

  return orders.filter(o => {
    // ── فلتر النوع ──────────────────────────────
    if (typeFilter === 'print'    && o.order_type !== 'print')    return false;
    if (typeFilter === 'market'   && o.order_type !== 'market')   return false;
    if (typeFilter === 'combined' && o.order_type !== 'combined') return false;

    // ── فلتر الحالة ─────────────────────────────
    if (o.order_type === 'market') {
      if (mktFilter !== 'all' && o.status !== mktFilter) return false;
    } else {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    }

    // ── البحث ────────────────────────────────────
    if (searchQuery) {
      const haystack = [
        o.id, o.customer_name, o.phone, o.region
      ].join(' ').toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }

    return true;
  });
}

// ══════════════════════════════════════
//  Realtime — الاشتراك بالطلبات الجديدة
// ══════════════════════════════════════
export function subscribeToOrders(onNewOrder, onStatusChange) {
  const channel = sb.channel('admin-orders')
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  T.ORDERS,
    }, payload => {
      const order = payload.new;
      // إضافة للقائمة المحلية
      const orders = adminState.get('allOrders') ?? [];
      adminState.set('allOrders', [order, ...orders]);
      onNewOrder?.(order);
    })
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  T.ORDERS,
    }, payload => {
      const updated = payload.new;
      const orders  = adminState.get('allOrders') ?? [];
      const idx     = orders.findIndex(o => o.id === updated.id);
      if (idx !== -1) {
        orders[idx] = updated;
        adminState.set('allOrders', [...orders]);
      }
      onStatusChange?.(updated);
    })
    .subscribe();

  adminState.set('realtimeChannel', channel);
  return channel;
}
