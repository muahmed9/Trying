# دليل إعداد Supabase
## تطبيق الشاطر للطباعة والقرطاسية

---

## 📋 المحتويات

1. [إعداد قاعدة البيانات](#إعداد-قاعدة-البيانات)
2. [إعداد Edge Functions](#إعداد-edge-functions)
3. [إعداد الإشعارات](#إعداد-الإشعارات)
4. [الأمان والصلاحيات](#الأمان-والصلاحيات)
5. [الاختبار والتصحيح](#الاختبار-والتصحيح)

---

## 🗄️ إعداد قاعدة البيانات

### الخطوة 1: تشغيل SQL Scripts

انسخ محتوى ملف `SUPABASE_SETUP.sql` وقم بتنفيذه في Supabase SQL Editor:

```sql
-- 1. ادخل إلى Supabase Dashboard
-- 2. اذهب إلى SQL Editor
-- 3. انقر على "New Query"
-- 4. انسخ محتوى SUPABASE_SETUP.sql
-- 5. انقر على "Run"
```

**الخطوات المفصلة**:

#### أ) إنشاء جدول الإشعارات

```sql
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

-- إنشاء الفهارس
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_order_id ON public.notifications(order_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
```

#### ب) إضافة الأعمدة الجديدة للطلبات

```sql
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
```

#### ج) إنشاء الدوال المساعدة

```sql
-- دالة حساب التسعير
CREATE OR REPLACE FUNCTION calculate_order_total(...)
RETURNS jsonb AS $$
-- [انظر SUPABASE_SETUP.sql للكود الكامل]
$$ LANGUAGE plpgsql IMMUTABLE;

-- دالة تحديث حالة الطلب
CREATE OR REPLACE FUNCTION update_order_status_with_notification(...)
RETURNS jsonb AS $$
-- [انظر SUPABASE_SETUP.sql للكود الكامل]
$$ LANGUAGE plpgsql;
```

#### د) إنشاء Views

```sql
-- View للطلبات المعلقة
CREATE OR REPLACE VIEW public.pending_orders AS
SELECT id, customer_name, phone, region, total, status, created_at, order_type
FROM public.orders
WHERE status IN ('received', 'printing', 'delivering')
ORDER BY created_at DESC;

-- View للمنتجات منخفضة المخزون
CREATE OR REPLACE VIEW public.low_stock_products AS
SELECT id, name, stock, min_stock, price, category
FROM public.market_products
WHERE stock <= min_stock AND active = true
ORDER BY stock ASC;
```

### الخطوة 2: تحديث الإعدادات

```sql
-- إدراج أو تحديث إعدادات التسعير
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
```

### الخطوة 3: تفعيل Row Level Security (RLS)

```sql
-- تفعيل RLS للإشعارات
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- السياسة: المستخدمون يمكنهم رؤية إشعاراتهم فقط
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- السياسة: المستخدمون يمكنهم تحديث إشعاراتهم
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
```

---

## ⚡ إعداد Edge Functions

### الخطوة 1: تثبيت Supabase CLI

```bash
# تثبيت Supabase CLI
npm install -g supabase

# أو باستخدام Homebrew (macOS)
brew install supabase/tap/supabase
```

### الخطوة 2: إنشاء Edge Functions

#### أ) دالة إرسال الإشعارات عبر Telegram

```bash
# إنشاء الدالة
supabase functions new send-telegram

# نسخ الكود من SUPABASE_EDGE_FUNCTIONS.ts
```

**الملف**: `supabase/functions/send-telegram/index.ts`

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

#### ب) دالة حساب التسعير

```bash
supabase functions new calculate-pricing
```

#### ج) دالة التقرير اليومي

```bash
supabase functions new daily-report
```

### الخطوة 3: تعيين متغيرات البيئة

```bash
# تعيين رمز Telegram Bot
supabase secrets set TELEGRAM_BOT_TOKEN=your_bot_token_here

# تعيين معرف الدردشة للأدمن
supabase secrets set ADMIN_CHAT_ID=your_admin_chat_id_here

# تعيين معرف الدردشة للعملاء
supabase secrets set CUSTOMER_CHAT_ID=your_customer_chat_id_here
```

### الخطوة 4: نشر الدوال

```bash
# نشر جميع الدوال
supabase functions deploy

# أو نشر دالة محددة
supabase functions deploy send-telegram
supabase functions deploy calculate-pricing
supabase functions deploy daily-report
```

### الخطوة 5: اختبار الدوال

```bash
# اختبار دالة إرسال الإشعارات
supabase functions invoke send-telegram --body '{
  "chat_id": 123456789,
  "text": "اختبار الإشعار"
}'

# اختبار دالة حساب التسعير
supabase functions invoke calculate-pricing --body '{
  "files": [{"pages": 20, "copies": 1, "name": "document.pdf"}],
  "cart": [],
  "color": "c",
  "sides": "1",
  "packaging": "none",
  "express": false
}'
```

---

## 🔔 إعداد الإشعارات

### الخطوة 1: الحصول على رمز Telegram Bot

```bash
# 1. افتح Telegram وابحث عن @BotFather
# 2. أرسل /newbot
# 3. اتبع التعليمات واحصل على الرمز (Token)
# 4. انسخ الرمز وأضفه إلى متغيرات البيئة
```

### الخطوة 2: الحصول على معرف الدردشة

```bash
# 1. ابدأ محادثة مع البوت الخاص بك
# 2. أرسل رسالة اختبار
# 3. افتح هذا الرابط:
#    https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates
# 4. ابحث عن "chat.id" في الاستجابة
```

### الخطوة 3: اختبار الإشعارات

```javascript
// من داخل التطبيق
async function testNotification() {
  const { data, error } = await supabase.functions.invoke('send-telegram', {
    body: {
      chat_id: 123456789,
      text: '✅ اختبار الإشعار',
      parse_mode: 'HTML'
    }
  });
  
  if (error) console.error('Error:', error);
  else console.log('Success:', data);
}
```

---

## 🔐 الأمان والصلاحيات

### الخطوة 1: تفعيل Row Level Security

```sql
-- تفعيل RLS لجميع الجداول الحساسة
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_products ENABLE ROW LEVEL SECURITY;
```

### الخطوة 2: إنشاء السياسات

```sql
-- السياسة: المستخدمون يمكنهم رؤية طلباتهم فقط
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- السياسة: المستخدمون يمكنهم إدراج طلبات جديدة
CREATE POLICY "Users can insert their own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- السياسة: الأدمن يمكنهم رؤية جميع الطلبات
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### الخطوة 3: إدارة الأدوار

```sql
-- إضافة عمود الدور للمستخدمين
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role text DEFAULT 'customer';

-- تحديث دور المستخدم إلى أدمن
UPDATE public.users SET role = 'admin' WHERE id = 'admin-user-id';
```

---

## 🧪 الاختبار والتصحيح

### اختبار الاتصال بـ Supabase

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

// اختبار الاتصال
async function testConnection() {
  const { data, error } = await supabase.auth.getSession();
  if (error) console.error('Connection error:', error);
  else console.log('Connected successfully');
}
```

### اختبار الدوال

```javascript
// اختبار حساب التسعير
async function testPricing() {
  const { data, error } = await supabase.functions.invoke('calculate-pricing', {
    body: {
      files: [
        { pages: 20, copies: 1, name: 'document.pdf' }
      ],
      cart: [],
      color: 'c',
      sides: '1',
      packaging: 'none',
      express: false
    }
  });
  
  if (error) console.error('Error:', error);
  else console.log('Pricing:', data);
}

// اختبار الإشعارات
async function testNotification() {
  const { data, error } = await supabase.functions.invoke('send-telegram', {
    body: {
      chat_id: 123456789,
      text: 'اختبار الإشعار'
    }
  });
  
  if (error) console.error('Error:', error);
  else console.log('Notification sent:', data);
}
```

### عرض السجلات

```bash
# عرض سجلات Edge Functions
supabase functions list

# عرض سجلات دالة محددة
supabase functions logs send-telegram

# عرض السجلات في الوقت الفعلي
supabase functions logs send-telegram --follow
```

---

## 📊 المراقبة والصيانة

### الخطوة 1: مراقبة الأداء

```sql
-- عرض إحصائيات الطلبات
SELECT 
  COUNT(*) as total_orders,
  SUM(total) as total_revenue,
  AVG(total) as avg_order_value,
  status,
  DATE(created_at) as date
FROM public.orders
GROUP BY status, DATE(created_at)
ORDER BY date DESC;
```

### الخطوة 2: النسخ الاحتياطية

```bash
# إنشاء نسخة احتياطية يدوية
supabase db dump -f backup.sql

# استعادة من نسخة احتياطية
psql -U postgres -d postgres -f backup.sql
```

### الخطوة 3: تحسين الأداء

```sql
-- تحليل استخدام الفهارس
SELECT * FROM pg_stat_user_indexes;

-- تحليل استخدام الجداول
SELECT * FROM pg_stat_user_tables;

-- تنظيف الجداول
VACUUM ANALYZE;
```

---

## 🚀 النشر في الإنتاج

### قائمة التحقق

- [ ] تم تشغيل جميع SQL Scripts
- [ ] تم إنشاء Edge Functions
- [ ] تم تعيين متغيرات البيئة
- [ ] تم اختبار جميع الدوال
- [ ] تم تفعيل RLS
- [ ] تم إنشاء النسخ الاحتياطية
- [ ] تم مراجعة السياسات الأمنية
- [ ] تم اختبار الإشعارات

---

## 📞 الدعم والمساعدة

- **Supabase Docs**: https://supabase.com/docs
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

**تاريخ الإنشاء**: 10 مايو 2026
**الإصدار**: 1.0.0
**الحالة**: جاهز للاستخدام ✅
