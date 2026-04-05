/**
 * ═══════════════════════════════════════════════════
 *  auth.service.js — طبقة المصادقة والصلاحيات
 * ═══════════════════════════════════════════════════
 *
 *  يتولى:
 *  1. تسجيل دخول المدير/الموظف (Supabase Auth فقط)
 *  2. التحقق من هوية مستخدم تيليجرام (Edge Function)
 *  3. إدارة الجلسة وتحديد الصلاحيات
 *  4. تسجيل الخروج
 *
 *  ❌ لا يوجد هنا أي كلمة مرور مكتوبة نصياً (Hardcoded)
 */

import { sb }          from '../core/supabase.js';
import { Config }      from '../core/config.js';
import { adminState }  from '../core/state.js';

const { STAFF_ROLES, FUNCTIONS } = Config;

// ════════════════════════════════════════
//  تسجيل دخول لوحة الإدارة
// ════════════════════════════════════════

/**
 * تسجيل الدخول عبر Supabase Auth وجلب بيانات الدور
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user, profile }>}
 * @throws {Error} رسالة خطأ للمستخدم
 */
export async function adminLogin(email, password) {
  // 1. التحقق الأساسي من المدخلات
  if (!email?.trim() || !password) {
    throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور');
  }

  // 2. تسجيل الدخول عبر Supabase Auth
  const { data, error } = await sb.auth.signInWithPassword({
    email:    email.trim().toLowerCase(),
    password,
  });
  if (error) {
    // ترجمة رسائل الخطأ الشائعة
    const msg = _translateAuthError(error.message);
    throw new Error(msg);
  }

  // 3. جلب الدور والصلاحيات من جدول profiles
  const profile = await _fetchProfile(data.user.id);
  if (!profile) {
    await sb.auth.signOut();
    throw new Error('لا يوجد صلاحيات مرتبطة بهذا الحساب. تواصل مع المدير.');
  }

  // 4. تحديث الحالة المركزية
  _applyProfileToState(data.user, profile);

  return { user: data.user, profile };
}

/**
 * التحقق من وجود جلسة نشطة عند تحميل الصفحة (Auto-login)
 * @returns {Promise<{ user, profile } | null>}
 */
export async function checkExistingSession() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;

    const profile = await _fetchProfile(session.user.id);
    if (!profile) return null;

    _applyProfileToState(session.user, profile);
    return { user: session.user, profile };
  } catch (e) {
    console.warn('[auth] فشل التحقق من الجلسة:', e.message);
    return null;
  }
}

/**
 * تسجيل الخروج
 */
export async function adminLogout() {
  // إيقاف قناة Realtime قبل الخروج
  const channel = adminState.get('realtimeChannel');
  if (channel) {
    try { sb.removeChannel(channel); } catch {}
  }

  await sb.auth.signOut();

  // إعادة تعيين الحالة
  adminState.set('currentUser',       null);
  adminState.set('currentProfile',    null);
  adminState.set('currentRole',       '');
  adminState.set('customPermissions', []);
  adminState.set('realtimeChannel',   null);
}

// ════════════════════════════════════════
//  مصادقة مستخدم تيليجرام (Customer)
// ════════════════════════════════════════

/**
 * التحقق من بيانات تيليجرام عبر Edge Function والحصول على جلسة
 * @returns {Promise<boolean>} true إذا نجح التحقق
 */
export async function authenticateTelegramUser() {
  const tg       = window.Telegram?.WebApp;
  const initData = tg?.initData;

  if (!initData) {
    console.info('[auth] التطبيق لا يعمل داخل تيليجرام — وضع ضيف');
    return false;
  }

  try {
    const { data: authData, error: authErr } = await sb.functions.invoke(
      FUNCTIONS.TG_AUTH,
      { body: { initData } }
    );

    if (authErr || !authData?.session) {
      console.warn('[auth] فشل مصادقة تيليجرام:', authErr?.message || 'لا توجد جلسة');
      return false;
    }

    await sb.auth.setSession(authData.session);
    return true;
  } catch (e) {
    console.error('[auth] خطأ في الاتصال بـ Edge Function:', e.message);
    return false;
  }
}

// ════════════════════════════════════════
//  التحقق من الصلاحيات (Admin)
// ════════════════════════════════════════

/**
 * هل يمكن للمستخدم الحالي تغيير حالة الطلب؟
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
export function canChangeStatus(fromStatus, toStatus) {
  const role  = adminState.get('currentRole');
  const perms = adminState.get('customPermissions') || [];

  const allowedTransitions = role === 'custom'
    ? perms
    : (STAFF_ROLES[role]?.can ?? []);

  if (allowedTransitions.includes(`${fromStatus}→${toStatus}`)) return true;
  if (toStatus === 'cancelled' && allowedTransitions.includes('any→cancelled')) return true;
  return false;
}

/**
 * هل يملك صلاحية معينة؟
 * @param {string} permission  مثال: 'manage_market' | 'manage_supplies'
 * @returns {boolean}
 */
export function hasPermission(permission) {
  const role  = adminState.get('currentRole');
  const perms = adminState.get('customPermissions') || [];

  if (role === 'admin') return true;
  if (STAFF_ROLES[role]?.extra?.includes(permission)) return true;
  if (role === 'custom' && perms.includes(permission)) return true;
  return false;
}

/**
 * هل هو مدير (يرى كل الأقسام)؟
 * @returns {boolean}
 */
export function isManager() {
  const role = adminState.get('currentRole');
  return STAFF_ROLES[role]?.isManager === true || role === 'admin';
}

/**
 * هل يجب أن يرى هذا الموظف الطلبَ بحسب حالته؟
 * @param {string} orderStatus
 * @returns {boolean}
 */
export function canSeeStatus(orderStatus) {
  const role = adminState.get('currentRole');
  const sees = STAFF_ROLES[role]?.sees;
  if (sees === null) return true; // يرى كل شيء (admin/storekeeper)
  if (role === 'custom') return true; // الحسابات المخصصة ترى كل شيء (يمكن تقييدها لاحقاً)
  return sees?.includes(orderStatus) ?? false;
}

// ════════════════════════════════════════
//  دوال داخلية
// ════════════════════════════════════════

/**
 * جلب بيانات الدور من جدول profiles
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function _fetchProfile(userId) {
  try {
    const { data, error } = await sb
      .from(Config.TABLES.PROFILES)
      .select('role, name, emoji, permissions')
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * تطبيق بيانات الملف الشخصي على الحالة المركزية
 * @param {Object} user     - Supabase User
 * @param {Object} profile  - { role, name, emoji, permissions }
 */
function _applyProfileToState(user, profile) {
  adminState.set('currentUser',    user);
  adminState.set('currentProfile', profile);
  adminState.set('currentRole',    profile.role);

  if (profile.role === 'custom') {
    adminState.set('customPermissions', profile.permissions ?? []);
  } else {
    adminState.set('customPermissions', []);
  }
}

/**
 * ترجمة رسائل خطأ Supabase Auth إلى العربية
 * @param {string} msg
 * @returns {string}
 */
function _translateAuthError(msg) {
  const map = {
    'Invalid login credentials':      'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'Email not confirmed':             'يرجى تأكيد البريد الإلكتروني أولاً',
    'Too many requests':               'محاولات كثيرة — انتظر قليلاً ثم حاول مجدداً',
    'User not found':                  'لا يوجد حساب بهذا البريد الإلكتروني',
    'Invalid email':                   'صيغة البريد الإلكتروني غير صحيحة',
  };
  return map[msg] ?? msg;
}
