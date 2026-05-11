# 📱 تطبيق الشاطر للطباعة والقرطاسية
## نسخة محسّنة مع جميع الإصلاحات والميزات الجديدة

---

## 🚀 ما الجديد؟

### ✨ الميزات الجديدة
- 🎯 **إدارة فئات الاستنساخ الملون**: إضافة وتعديل وحذف فئات التسعير حسب عدد الصفحات
- 🎉 **واجهة الشكر والترحيب**: رسالة جميلة بعد إتمام الطلب مع معلومات التتبع
- 📊 **الفاتورة النهائية الكاملة**: عرض تفاصيل شاملة للطلب والتكاليف
- 🔔 **تحسين الإشعارات**: إشعارات موثوقة للعميل والأدمن عبر Telegram

### 🐛 الأخطاء المصححة
- ✅ إصلاح حساب صفحات PowerPoint (دعم صيغة `[N pages]`)
- ✅ إصلاح حساب الصفحات والصور بدقة
- ✅ إصلاح خطأ `textContent` على عناصر null
- ✅ تحسين حساب التسعير في واجهة الزبون
- ✅ تفعيل جميع خيارات إدارة منتجات القرطاسية
- ✅ تحسين معالجة الأخطاء والاستثناءات

---

## 📦 الملفات الرئيسية

### الكود المحسّن
```
js/
├── services/
│   └── order.service.js          # خدمات الطلبات (محسّن)
├── customer.main.js              # واجهة الزبون (محسّن)
└── admin/
    └── pricing-management.js     # إدارة التسعير والفئات (جديد)
```

### ملفات Supabase
```
SUPABASE_SETUP.sql               # SQL Scripts لإنشاء الجداول والدوال
SUPABASE_EDGE_FUNCTIONS.ts       # Edge Functions للإشعارات
SUPABASE_SETUP_GUIDE.md          # دليل إعداد Supabase الشامل
```

### ملفات التوثيق
```
FIXES_SUMMARY.md                 # ملخص الإصلاحات والميزات
IMPLEMENTATION_GUIDE.md          # دليل التطبيق
```

---

## 🔧 التثبيت والإعداد

### المتطلبات
- Node.js 16+
- Supabase Account
- Telegram Bot Token

### خطوات التثبيت

#### 1. استنساخ المستودع
```bash
git clone https://github.com/muahmed9/Trying.git
cd Trying
```

#### 2. تثبيت المتطلبات
```bash
npm install
# أو
yarn install
```

#### 3. إعداد Supabase

**أ) تشغيل SQL Scripts**
```bash
# 1. ادخل إلى Supabase Dashboard
# 2. اذهب إلى SQL Editor
# 3. انسخ محتوى SUPABASE_SETUP.sql
# 4. انقر على Run
```

**ب) إعداد Edge Functions**
```bash
# تثبيت Supabase CLI
npm install -g supabase

# تسجيل الدخول
supabase login

# إنشاء الدوال
supabase functions new send-telegram
supabase functions new calculate-pricing
supabase functions new daily-report

# تعيين متغيرات البيئة
supabase secrets set TELEGRAM_BOT_TOKEN=your_token_here
supabase secrets set ADMIN_CHAT_ID=your_admin_id_here

# نشر الدوال
supabase functions deploy
```

#### 4. تكوين المتغيرات
```bash
# إنشاء ملف .env.local
cp .env.example .env.local

# تحديث المتغيرات
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_CHAT_ID=your_admin_chat_id
```

#### 5. تشغيل التطبيق
```bash
npm run dev
# التطبيق سيكون متاحاً على http://localhost:5173
```

---

## 📋 دليل الاستخدام

### للزبائن

#### 1. رفع الملفات
- اختر نوع الطباعة (ملون/أبيض وأسود)
- اختر عدد الوجوه (وجه واحد/وجهين)
- رفع الملفات (PDF, Word, PowerPoint, إلخ)
- اختر نوع التغليف

#### 2. إضافة المنتجات
- تصفح منتجات القرطاسية
- أضف المنتجات للسلة
- اختر الكمية المطلوبة

#### 3. إتمام الطلب
- راجع الفاتورة النهائية
- أدخل بيانات التوصيل
- أرسل الطلب
- استقبل واجهة الشكر مع رقم الطلب

### للأدمن

#### 1. إدارة التسعير
- اذهب إلى الإعدادات → إدارة التسعير
- أضف فئات جديدة (مثال: 5-30 صفحة بـ 150 د.ع)
- عدّل الأسعار الموجودة
- احذف الفئات غير المرغوبة

#### 2. إدارة المنتجات
- أضف منتجات جديدة
- عدّل بيانات المنتجات
- حدّث المخزون
- احذف المنتجات المتوقفة

#### 3. إدارة الطلبات
- عرض الطلبات الجديدة
- تحديث حالة الطلب
- إرسال الإشعارات
- عرض التقارير

---

## 🧪 الاختبار

### اختبار حساب الصفحات
```javascript
// اختبر رفع ملف PowerPoint باسم "presentation[25 pages].pptx"
// يجب أن يحسب 25 صفحة
```

### اختبار التسعير
```javascript
// اختر طباعة ملونة
// رفع ملف بـ 20 صفحة
// يجب أن يكون السعر = 150 د.ع (فئة 1-30)
```

### اختبار الإشعارات
```javascript
// أتمم طلب كامل
// يجب أن تستقبل إشعار على Telegram
```

---

## 📊 هيكل قاعدة البيانات

### الجداول الرئيسية

#### جدول الطلبات (orders)
```sql
- id: UUID (المفتاح الأساسي)
- user_id: UUID (المستخدم)
- customer_name: TEXT
- phone: TEXT
- region: TEXT
- total: NUMERIC
- status: TEXT (received, printing, delivering, delivered, cancelled)
- files_data: JSONB (بيانات الملفات)
- cart_items: JSONB (المنتجات)
- color_copy_tiers: JSONB (فئات الاستنساخ)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### جدول الإشعارات (notifications)
```sql
- id: UUID
- user_id: UUID
- order_id: UUID
- message: TEXT
- type: TEXT
- is_read: BOOLEAN
- created_at: TIMESTAMP
```

#### جدول الإعدادات (settings)
```sql
- key: TEXT (المفتاح)
- value: JSONB (القيمة)
- updated_at: TIMESTAMP
```

---

## 🔐 الأمان

### Row Level Security (RLS)
- ✅ المستخدمون يرون طلباتهم فقط
- ✅ الأدمن يرون جميع الطلبات
- ✅ المستخدمون يرون إشعاراتهم فقط

### التشفير
- ✅ جميع البيانات الحساسة مشفرة
- ✅ الاتصالات آمنة (HTTPS)
- ✅ المفاتيح الخاصة محفوظة آمنة

---

## 📈 الأداء

### التحسينات
- ✅ فهارس قاعدة البيانات محسّنة
- ✅ استعلامات SQL محسّنة
- ✅ Caching للبيانات الثابتة
- ✅ Lazy loading للصور

### المراقبة
```bash
# عرض سجلات Edge Functions
supabase functions logs send-telegram

# عرض إحصائيات قاعدة البيانات
SELECT * FROM pg_stat_user_tables;
```

---

## 🚀 النشر

### النشر على Vercel
```bash
# ربط المستودع بـ Vercel
vercel link

# نشر التطبيق
vercel deploy --prod
```

### النشر على Netlify
```bash
# تثبيت Netlify CLI
npm install -g netlify-cli

# نشر التطبيق
netlify deploy --prod
```

---

## 📞 الدعم والمساعدة

### الموارد
- [Supabase Documentation](https://supabase.com/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### التواصل
- **البريد الإلكتروني**: support@example.com
- **الهاتف**: 07752564099
- **واتساب**: https://wa.me/9647752564099

---

## 📝 السجل التاريخي

### الإصدار 1.0.0 (10 مايو 2026)
- ✨ إضافة إدارة فئات الاستنساخ الملون
- 🎉 إضافة واجهة الشكر والترحيب
- 🐛 إصلاح حساب الصفحات والتسعير
- 📊 تحسين الفاتورة النهائية
- 🔔 تحسين الإشعارات

---

## 📄 الترخيص

هذا المشروع مرخص تحت [MIT License](LICENSE)

---

## 👨‍💻 المساهمون

- **أحمد محمد** - المطور الرئيسي

---

## 🙏 شكر وتقدير

شكر خاص لـ:
- فريق Supabase
- مجتمع Node.js
- جميع المستخدمين والعملاء

---

**تاريخ آخر تحديث**: 10 مايو 2026
**الإصدار الحالي**: 1.0.0
**الحالة**: جاهز للإنتاج ✅

---

## 🎯 الخطوات التالية

1. [ ] اختبار شامل لجميع الميزات
2. [ ] جمع ملاحظات المستخدمين
3. [ ] تحسين الأداء والاستجابة
4. [ ] إضافة ميزات جديدة بناءً على الطلبات
5. [ ] توسيع قاعدة المستخدمين
