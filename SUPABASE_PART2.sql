-- ============================================================================
-- 5. إنشاء جدول الإشعارات (إذا لم يكن موجوداً)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
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
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- إنشاء فهرس للإشعارات
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON public.notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

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

-- السياسة: الأدمن يمكنهم إدراج إشعارات
CREATE POLICY IF NOT EXISTS "Admins can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

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
-- 13. إنشاء View لإحصائيات اليوم
-- ============================================================================

CREATE OR REPLACE VIEW public.today_statistics AS
SELECT 
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE status = 'delivered') as completed_orders,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
  COUNT(*) FILTER (WHERE status IN ('received', 'printing', 'delivering')) as pending_orders,
  COALESCE(SUM(total), 0) as total_revenue,
  COALESCE(AVG(total), 0) as avg_order_value
FROM public.orders
WHERE DATE(created_at) = CURRENT_DATE;

-- ============================================================================
-- 14. اختبار الإشعارات - إدراج إشعار تجريبي
-- ============================================================================

-- هذا الأمر اختياري - للاختبار فقط
-- INSERT INTO public.notifications (user_id, message, type)
-- VALUES ('test-user-id', '✅ اختبار الإشعار - تم إنشاء جدول الإشعارات بنجاح!', 'test');

-- ============================================================================
-- 15. التحقق من الجداول والدوال المُنشأة
-- ============================================================================

-- للتحقق من الجداول:
-- SELECT * FROM information_schema.tables WHERE table_schema = 'public';

-- للتحقق من الدوال:
-- SELECT * FROM information_schema.routines WHERE routine_schema = 'public';

-- للتحقق من الفهارس:
-- SELECT * FROM pg_indexes WHERE schemaname = 'public';

-- ============================================================================
-- ملاحظات مهمة:
-- ============================================================================
-- 1. تأكد من تفعيل Row Level Security (RLS) لجميع الجداول
-- 2. تحديث سياسات الأمان حسب احتياجات التطبيق
-- 3. إنشاء نسخ احتياطية منتظمة من البيانات
-- 4. مراقبة الأداء والفهارس بشكل دوري
-- 5. اختبار جميع الدوال قبل الاستخدام في الإنتاج
-- 6. استخدام CREATE TABLE IF NOT EXISTS لتجنب الأخطاء
-- 7. استخدام CREATE POLICY IF NOT EXISTS لتجنب تكرار السياسات
-- 8. تأكد من أن user_id من نوع text وليس uuid
