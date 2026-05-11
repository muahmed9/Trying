# 🚀 دليل البدء السريع - Supabase
## تطبيق الشاطر للطباعة والقرطاسية

---

## ⚡ البدء السريع (5 دقائق)

### الخطوة 1️⃣: نسخ SQL Scripts

```bash
# 1. ادخل إلى Supabase Dashboard
# 2. اذهب إلى SQL Editor
# 3. انقر على "New Query"
# 4. انسخ والصق الكود التالي:
```

```sql
-- إنشاء جدول الإشعارات
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  message text NOT NULL,
  type text DEFAULT 'order_status',
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT NOW(),
  read_at timestamp with time zone
);

-- إضافة الفهارس
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_order_id ON public.notifications(order_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- تحديث إعدادات التسعير
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

-- إضافة الأعمدة الجديدة للطلبات
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS color_copy_tiers jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS internal_notes text;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS tracking_number text;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS estimated_delivery_date timestamp;

-- تفعيل RLS للإشعارات
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- إنشاء السياسات
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
```

### الخطوة 2️⃣: إعداد Telegram Bot

```bash
# 1. افتح Telegram وابحث عن @BotFather
# 2. أرسل /newbot
# 3. اتبع التعليمات واحصل على الرمز (Token)
# 4. احفظ الرمز (ستحتاجه لاحقاً)

# مثال على الرمز:
# 123456789:ABCDefGhIjKlMnOpQrStUvWxYz_AbCdEfGhIjKl
```

### الخطوة 3️⃣: الحصول على معرف الدردشة

```bash
# 1. ابدأ محادثة مع البوت الخاص بك
# 2. أرسل رسالة اختبار
# 3. افتح هذا الرابط في المتصفح:
#    https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates
#    (استبدل {YOUR_BOT_TOKEN} برمزك)
# 4. ابحث عن "chat.id" في الاستجابة

# مثال على الاستجابة:
# {
#   "ok": true,
#   "result": [
#     {
#       "update_id": 123456789,
#       "message": {
#         "message_id": 1,
#         "from": {
#           "id": 987654321,  <-- هذا هو معرف الدردشة
#           ...
```

### الخطوة 4️⃣: إنشاء Edge Function

```bash
# 1. تثبيت Supabase CLI
npm install -g supabase

# 2. تسجيل الدخول
supabase login

# 3. إنشاء دالة جديدة
supabase functions new send-telegram

# 4. انسخ الكود التالي إلى supabase/functions/send-telegram/index.ts:
```

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { chat_id, text, parse_mode = "HTML" } = await req.json();

    if (!chat_id || !text) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text,
        parse_mode,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram error:", data);
      return new Response(
        JSON.stringify({ error: data.description }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: data.result.message_id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

### الخطوة 5️⃣: تعيين المتغيرات والنشر

```bash
# 1. تعيين متغيرات البيئة
supabase secrets set TELEGRAM_BOT_TOKEN=123456789:ABCDefGhIjKlMnOpQrStUvWxYz_AbCdEfGhIjKl

# 2. نشر الدالة
supabase functions deploy send-telegram

# 3. اختبار الدالة
supabase functions invoke send-telegram --body '{
  "chat_id": 987654321,
  "text": "✅ اختبار الإشعار"
}'
```

---

## 📝 الأكواد الجاهزة للاستخدام

### 1️⃣ كود JavaScript لإرسال إشعار

```javascript
// استخدم هذا الكود في التطبيق الخاص بك

async function sendNotification(chatId, message) {
  try {
    const { data, error } = await supabase.functions.invoke('send-telegram', {
      body: {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      }
    });
    
    if (error) {
      console.error('Error sending notification:', error);
      return false;
    }
    
    console.log('Notification sent successfully:', data);
    return true;
  } catch (e) {
    console.error('Exception:', e);
    return false;
  }
}

// مثال على الاستخدام:
sendNotification(987654321, '✅ تم استقبال طلبك #12345');
```

### 2️⃣ كود SQL لحساب التسعير

```sql
-- استخدم هذا الكود لحساب سعر الطلب

SELECT 
  CASE 
    WHEN pages >= 1 AND pages <= 30 THEN 150
    WHEN pages >= 31 AND pages <= 60 THEN 120
    WHEN pages >= 61 AND pages <= 100 THEN 100
    ELSE 80
  END as price_per_page,
  pages * copies as total_pages,
  CASE 
    WHEN pages >= 1 AND pages <= 30 THEN 150 * pages * copies
    WHEN pages >= 31 AND pages <= 60 THEN 120 * pages * copies
    WHEN pages >= 61 AND pages <= 100 THEN 100 * pages * copies
    ELSE 80 * pages * copies
  END as total_price
FROM (
  SELECT 20 as pages, 2 as copies
) as calc;
```

### 3️⃣ كود SQL لعرض الطلبات المعلقة

```sql
-- عرض جميع الطلبات التي تحتاج معالجة

SELECT 
  id,
  customer_name,
  phone,
  region,
  total,
  status,
  created_at,
  DATE_TRUNC('hour', created_at) as hour
FROM public.orders
WHERE status IN ('received', 'printing', 'delivering')
ORDER BY created_at DESC;
```

### 4️⃣ كود SQL لعرض الإحصائيات

```sql
-- عرض إحصائيات اليوم

SELECT 
  COUNT(*) as total_orders,
  SUM(total) as total_revenue,
  AVG(total) as avg_order_value,
  COUNT(*) FILTER (WHERE status = 'delivered') as completed_orders,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders
FROM public.orders
WHERE DATE(created_at) = CURRENT_DATE;
```

---

## ✅ قائمة التحقق

- [ ] تم نسخ SQL Scripts وتشغيلها
- [ ] تم إنشاء Telegram Bot والحصول على الرمز
- [ ] تم الحصول على معرف الدردشة
- [ ] تم إنشاء Edge Function
- [ ] تم تعيين المتغيرات
- [ ] تم نشر الدالة
- [ ] تم اختبار الإشعارات
- [ ] تم التحقق من الفاتورة
- [ ] تم اختبار حساب الصفحات
- [ ] تم اختبار فئات الاستنساخ الملون

---

## 🔗 الروابط المهمة

- [Supabase Dashboard](https://app.supabase.com)
- [Telegram BotFather](https://t.me/BotFather)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

## 🆘 استكشاف الأخطاء

### المشكلة: الإشعارات لا تصل
**الحل**:
1. تحقق من صحة رمز Telegram Bot
2. تحقق من معرف الدردشة
3. عرّض السجلات: `supabase functions logs send-telegram`

### المشكلة: خطأ في حساب التسعير
**الحل**:
1. تحقق من أن الفئات محفوظة بشكل صحيح
2. تحقق من صيغة JSON للفئات
3. أعد تشغيل SQL Scripts

### المشكلة: الفاتورة لا تظهر
**الحل**:
1. تحقق من أن الملفات تم رفعها بنجاح
2. تحقق من أن الأعمدة الجديدة موجودة
3. افحص console للأخطاء

---

## 📞 الدعم

إذا واجهت مشاكل:
1. تحقق من السجلات: `supabase functions logs`
2. اقرأ الوثائق الكاملة: `SUPABASE_SETUP_GUIDE.md`
3. تواصل مع الفريق: support@example.com

---

**تاريخ الإنشاء**: 10 مايو 2026
**الإصدار**: 1.0.0
**الحالة**: جاهز للاستخدام ✅
