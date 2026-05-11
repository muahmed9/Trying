-- ============================================================================
-- تطبيق الشاطر للطباعة والقرطاسية - إعدادات Supabase (نسخة محسّنة)
-- ============================================================================
-- تم إصلاح مشكلة نوع البيانات (uuid vs text)

-- ============================================================================
-- 1. جدول الإعدادات (Settings) - لحفظ التسعير والفئات
-- ============================================================================

-- التحقق من وجود جدول الإعدادات وإنشاؤه إذا لم يكن موجوداً
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT NOW()
);

-- تحديث الإعدادات الموجودة أو إنشاء جديدة
INSERT INTO public.settings (key, value, updated_at)
VALUES (
  'pricing',
  '{
    "min_pages": 5,
    "min_price": 1000,
    "c_single": 150,
    "c_double": 130,
    "bw_single": 90,
    "bw_double": 75,
    "delivery_fee": 1000,
    "delivery_free_threshold": 10000,
    "express_fee": 1500,
    "packaging": {
      "none": 0,
      "cardboard": 500,
      "spiral": 1500
    },
    "color_copy_tiers": [
      {"min": 1, "max": 30, "price": 150},
      {"min": 31, "max": 60, "price": 120},
      {"min": 61, "max": 100, "price": 100},
      {"min": 101, "max": 999999, "price": 80}
    ]
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ============================================================================
-- 2. التحقق من وجود الأعمدة المطلوبة في جدول الطلبات
-- ============================================================================

-- إضافة عمود color_copy_tiers إذا لم يكن موجوداً
ALTER TABLE IF EXISTS public.orders
ADD COLUMN IF NOT EXISTS color_copy_tiers jsonb DEFAULT '[]'::jsonb;

-- إضافة عمود order_metadata لحفظ بيانات إضافية
ALTER TABLE IF EXISTS public.orders
ADD COLUMN IF NOT EXISTS order_metadata jsonb DEFAULT '{}'::jsonb;

-- إضافة عمود للملاحظات الداخلية
ALTER TABLE IF EXISTS public.orders
ADD COLUMN IF NOT EXISTS internal_notes text;

-- إضافة عمود لتتبع الطلب
ALTER TABLE IF EXISTS public.orders
ADD COLUMN IF NOT EXISTS tracking_number text;

-- إضافة عمود لوقت الاستلام المتوقع
ALTER TABLE IF EXISTS public.orders
ADD COLUMN IF NOT EXISTS estimated_delivery_date timestamp;

-- ============================================================================
-- 3. إنشاء جدول الإشعارات (مع معالجة نوع البيانات)
-- ============================================================================

-- إنشاء جدول الإشعارات بدون foreign key في البداية
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,  -- نفس نوع البيانات من جدول users
  order_id uuid,
  message text NOT NULL,
  type text DEFAULT 'order_status',
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT NOW(),
  read_at timestamp with time zone
);

-- إضافة foreign key للطلبات (إذا كان موجوداً)
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
ON CONFLICT DO NOTHING;

-- إنشاء فهرس للإشعارات
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON public.notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================================================
-- 4. إنشاء دالة لحساب التسعير (PostgreSQL Function)
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_order_total(
  p_files jsonb,
  p_cart jsonb,
  p_color_copy_tiers jsonb,
  p_print_color text,
  p_print_side text,
  p_packaging text,
  p_express boolean,
  p_pricing jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_print_subtotal numeric := 0;
  v_cart_subtotal numeric := 0;
  v_file jsonb;
  v_cart_item jsonb;
  v_pages numeric;
  v_copies numeric;
  v_price_per_page numeric;
  v_is_color boolean;
  v_is_double boolean;
  v_total_pages numeric;
  v_pkg_cost numeric := 0;
  v_express_fee numeric := 0;
  v_delivery_fee numeric := 0;
  v_subtotal numeric;
  v_tier jsonb;
BEGIN
  -- تحديد نوع الطباعة
  v_is_color := (p_print_color = 'c');
  v_is_double := (p_print_side = '2');
  
  -- حساب تكلفة الطباعة
  FOR v_file IN SELECT * FROM jsonb_array_elements(p_files)
  LOOP
    v_pages := COALESCE((v_file->>'pages')::numeric, 1);
    v_copies := COALESCE((v_file->>'copies')::numeric, 1);
    v_total_pages := v_pages * v_copies;
    
    -- حساب السعر حسب النوع
    IF v_is_color THEN
      -- البحث عن الفئة المناسبة
      v_price_per_page := 150; -- القيمة الافتراضية
      
      FOR v_tier IN SELECT * FROM jsonb_array_elements(p_color_copy_tiers)
      LOOP
        IF v_pages >= (v_tier->>'min')::numeric AND v_pages <= (v_tier->>'max')::numeric THEN
          v_price_per_page := (v_tier->>'price')::numeric;
          EXIT;
        END IF;
      END LOOP;
    ELSE
      -- أبيض وأسود
      v_price_per_page := CASE 
        WHEN v_is_double THEN COALESCE((p_pricing->>'bw_double')::numeric, 75)
        ELSE COALESCE((p_pricing->>'bw_single')::numeric, 90)
      END;
    END IF;
    
    v_print_subtotal := v_print_subtotal + (v_total_pages * v_price_per_page);
  END LOOP;
  
  -- إضافة تكلفة التغليف
  v_pkg_cost := CASE p_packaging
    WHEN 'cardboard' THEN COALESCE((p_pricing->'packaging'->>'cardboard')::numeric, 500)
    WHEN 'spiral' THEN COALESCE((p_pricing->'packaging'->>'spiral')::numeric, 1500)
    ELSE 0
  END;
  
  v_print_subtotal := v_print_subtotal + v_pkg_cost;
  
  -- إضافة رسوم الطلب العاجل
  IF p_express THEN
    v_express_fee := COALESCE((p_pricing->>'express_fee')::numeric, 1500);
    v_print_subtotal := v_print_subtotal + v_express_fee;
  END IF;
  
  -- حساب تكلفة السلة
  FOR v_cart_item IN SELECT * FROM jsonb_array_elements(p_cart)
  LOOP
    v_cart_subtotal := v_cart_subtotal + 
      (COALESCE((v_cart_item->>'price')::numeric, 0) * COALESCE((v_cart_item->>'qty')::numeric, 1));
  END LOOP;
  
  v_subtotal := v_print_subtotal + v_cart_subtotal;
  
  -- حساب رسوم التوصيل
  v_delivery_fee := CASE 
    WHEN v_subtotal >= COALESCE((p_pricing->>'delivery_free_threshold')::numeric, 10000) THEN 0
    ELSE COALESCE((p_pricing->>'delivery_fee')::numeric, 1000)
  END;
  
  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'print_subtotal', v_print_subtotal,
    'cart_subtotal', v_cart_subtotal,
    'delivery_fee', v_delivery_fee,
    'total', v_subtotal + v_delivery_fee
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 5. إنشاء دالة لتحديث حالة الطلب وإرسال إشعار
-- ============================================================================

CREATE OR REPLACE FUNCTION update_order_status_with_notification(
  p_order_id uuid,
  p_new_status text,
  p_cancel_reason text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_order record;
  v_notification_msg text;
  v_user_id text;
BEGIN
  -- جلب بيانات الطلب
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- الحصول على user_id (قد يكون uuid أو text)
  v_user_id := COALESCE(v_order.user_id::text, '');
  
  -- تحديث حالة الطلب
  UPDATE public.orders 
  SET 
    status = p_new_status,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- إنشاء رسالة الإشعار حسب الحالة
  v_notification_msg := CASE p_new_status
    WHEN 'printing' THEN '🖨️ طلبك #' || p_order_id || ' قيد الطباعة الآن!'
    WHEN 'delivering' THEN '🛵 طلبك #' || p_order_id || ' في الطريق إليك!'
    WHEN 'delivered' THEN '✅ تم تسليم طلبك #' || p_order_id || ' بنجاح!'
    WHEN 'cancelled' THEN '❌ تم إلغاء طلبك #' || p_order_id || '. السبب: ' || COALESCE(p_cancel_reason, 'غير محدد')
    ELSE 'تحديث على طلبك #' || p_order_id || ': ' || p_new_status
  END;
  
  -- إدراج الإشعار في جدول الإشعارات
  INSERT INTO public.notifications (user_id, order_id, message, type, created_at)
  VALUES (v_user_id, p_order_id, v_notification_msg, 'order_status', NOW())
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'new_status', p_new_status,
    'notification', v_notification_msg
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. إنشاء جدول سجل التسعير (للتتبع التاريخي)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pricing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_data jsonb NOT NULL,
  changed_by text,
  changed_at timestamp with time zone DEFAULT NOW(),
  notes text
);

-- إنشاء فهرس لسجل التسعير
CREATE INDEX IF NOT EXISTS idx_pricing_history_changed_at ON public.pricing_history(changed_at DESC);

-- ============================================================================
-- 7. إضافة سياسات الأمان (RLS) للإشعارات
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- السياسة: المستخدمون يمكنهم رؤية إشعاراتهم فقط
CREATE POLICY IF NOT EXISTS "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid()::text = user_id);

-- السياسة: المستخدمون يمكنهم تحديث إشعاراتهم
CREATE POLICY IF NOT EXISTS "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid()::text = user_id);

-- ============================================================================
-- 8. إنشاء دالة لحساب إحصائيات الطلبات
-- ============================================================================

CREATE OR REPLACE FUNCTION get_order_statistics(
  p_user_id text DEFAULT NULL,
  p_start_date timestamp DEFAULT NULL,
  p_end_date timestamp DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_total_orders integer;
  v_total_revenue numeric;
  v_average_order_value numeric;
  v_completed_orders integer;
  v_cancelled_orders integer;
BEGIN
  SELECT 
    COUNT(*),
    COALESCE(SUM(total), 0),
    COALESCE(AVG(total), 0),
    COUNT(*) FILTER (WHERE status = 'delivered'),
    COUNT(*) FILTER (WHERE status = 'cancelled')
  INTO 
    v_total_orders,
    v_total_revenue,
    v_average_order_value,
    v_completed_orders,
    v_cancelled_orders
  FROM public.orders
  WHERE 
    (p_user_id IS NULL OR user_id::text = p_user_id)
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);
  
  RETURN jsonb_build_object(
    'total_orders', v_total_orders,
    'total_revenue', v_total_revenue,
    'average_order_value', v_average_order_value,
    'completed_orders', v_completed_orders,
    'cancelled_orders', v_cancelled_orders,
    'completion_rate', CASE 
      WHEN v_total_orders = 0 THEN 0
      ELSE ROUND((v_completed_orders::numeric / v_total_orders) * 100, 2)
    END
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. تحديث الفهارس لتحسين الأداء
-- ============================================================================

-- فهرس للبحث السريع عن الطلبات حسب الحالة
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- فهرس للبحث السريع عن الطلبات حسب المستخدم والحالة
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders(user_id, status);

-- فهرس للبحث السريع عن الطلبات حسب التاريخ
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- ============================================================================
-- 10. إنشاء View للطلبات الجديدة (للأدمن)
-- ============================================================================

CREATE OR REPLACE VIEW public.pending_orders AS
SELECT 
  id,
  customer_name,
  phone,
  region,
  total,
  status,
  created_at,
  order_type
FROM public.orders
WHERE status IN ('received', 'printing', 'delivering')
ORDER BY created_at DESC;

-- ============================================================================
-- 11. إنشاء View للمنتجات منخفضة المخزون
-- ============================================================================

CREATE OR REPLACE VIEW public.low_stock_products AS
SELECT 
  id,
  name,
  stock,
  min_stock,
  price,
  category
FROM public.market_products
WHERE stock <= min_stock AND active = true
ORDER BY stock ASC;

-- ============================================================================
-- 12. إنشاء View للإشعارات غير المقروءة
-- ============================================================================

CREATE OR REPLACE VIEW public.unread_notifications AS
SELECT 
  id,
  user_id,
  order_id,
  message,
  type,
  created_at
FROM public.notifications
WHERE is_read = false
ORDER BY created_at DESC;

-- ============================================================================
-- ملاحظات مهمة:
-- ============================================================================
-- 1. تم إصلاح مشكلة نوع البيانات (uuid vs text) للـ user_id
-- 2. تأكد من تفعيل Row Level Security (RLS) لجميع الجداول
-- 3. تحديث سياسات الأمان حسب احتياجات التطبيق
-- 4. إنشاء نسخ احتياطية منتظمة من البيانات
-- 5. مراقبة الأداء والفهارس بشكل دوري
-- 6. اختبار جميع الدوال قبل الاستخدام في الإنتاج
-- 7. استخدام CREATE TABLE IF NOT EXISTS لتجنب الأخطاء
-- 8. استخدام CREATE POLICY IF NOT EXISTS لتجنب تكرار السياسات
