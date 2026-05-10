/**
 * Supabase Edge Functions
 * تطبيق الشاطر للطباعة والقرطاسية
 * 
 * هذه الدوال تعمل على Supabase Edge Functions
 * يمكن نشرها باستخدام: supabase functions deploy
 */

// ============================================================================
// 1. دالة إرسال الإشعارات عبر Telegram
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

serve(async (req: Request) => {
  // التحقق من الطريقة
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { chat_id, text, parse_mode = "HTML" } = await req.json();

    // التحقق من المدخلات
    if (!chat_id || !text) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // إرسال الرسالة عبر Telegram
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

// ============================================================================
// 2. دالة معالجة Webhook من Telegram
// ============================================================================

/*
// supabase/functions/telegram-webhook/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const update = await req.json();
    const message = update.message;

    if (!message) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const userId = message.from.id;
    const text = message.text;

    // معالجة الأوامر
    if (text === "/start") {
      // تسجيل المستخدم الجديد
      const { error } = await supabase.from("users").upsert({
        id: userId.toString(),
        telegram_id: userId,
        telegram_username: message.from.username,
        first_order_done: false,
      });

      if (error) console.error("Error:", error);

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
*/

// ============================================================================
// 3. دالة حساب التسعير (Edge Function)
// ============================================================================

/*
// supabase/functions/calculate-pricing/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseKey);

interface PricingRequest {
  files: Array<{ pages: number; copies: number; name: string }>;
  cart: Array<{ price: number; qty: number }>;
  color: "c" | "bw";
  sides: "1" | "2";
  packaging: "none" | "cardboard" | "spiral";
  express: boolean;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: PricingRequest = await req.json();

    // جلب الإعدادات من Supabase
    const { data: settingsData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "pricing")
      .single();

    const pricing = settingsData?.value || {};

    // حساب تكلفة الطباعة
    let printSubtotal = 0;

    for (const file of payload.files) {
      const pages = file.pages || 1;
      const copies = file.copies || 1;
      const totalPages = pages * copies;

      let pricePerPage = 0;

      if (payload.color === "c") {
        // البحث عن الفئة المناسبة
        const tiers = pricing.color_copy_tiers || [];
        for (const tier of tiers) {
          if (pages >= tier.min && pages <= tier.max) {
            pricePerPage = tier.price;
            break;
          }
        }
        if (pricePerPage === 0) {
          pricePerPage = pricing.c_single || 150;
        }
      } else {
        // أبيض وأسود
        pricePerPage =
          payload.sides === "2"
            ? pricing.bw_double || 75
            : pricing.bw_single || 90;
      }

      printSubtotal += totalPages * pricePerPage;
    }

    // إضافة التغليف
    const pkgCost =
      pricing.packaging?.[payload.packaging] || 0;
    printSubtotal += pkgCost;

    // إضافة الطلب العاجل
    if (payload.express) {
      printSubtotal += pricing.express_fee || 1500;
    }

    // حساب تكلفة السلة
    let cartSubtotal = 0;
    for (const item of payload.cart) {
      cartSubtotal += (item.price || 0) * (item.qty || 1);
    }

    const subtotal = printSubtotal + cartSubtotal;

    // حساب رسوم التوصيل
    const deliveryFee =
      subtotal >= (pricing.delivery_free_threshold || 10000)
        ? 0
        : pricing.delivery_fee || 1000;

    return new Response(
      JSON.stringify({
        subtotal,
        printSubtotal,
        cartSubtotal,
        deliveryFee,
        total: subtotal + deliveryFee,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
*/

// ============================================================================
// 4. دالة إرسال تقرير يومي للأدمن
// ============================================================================

/*
// supabase/functions/daily-report/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseKey);

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ADMIN_CHAT_ID = Deno.env.get("ADMIN_CHAT_ID");
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

serve(async (req: Request) => {
  try {
    // جلب إحصائيات اليوم
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayOrders } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", today.toISOString())
      .lt("created_at", new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());

    const totalOrders = todayOrders?.length || 0;
    const totalRevenue = todayOrders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
    const completedOrders = todayOrders?.filter((o) => o.status === "delivered").length || 0;
    const cancelledOrders = todayOrders?.filter((o) => o.status === "cancelled").length || 0;

    // إنشاء الرسالة
    const message = `
📊 <b>تقرير اليوم</b>
━━━━━━━━━━━━━━━━━━
📅 التاريخ: ${today.toLocaleDateString("ar-IQ")}

📦 إجمالي الطلبات: ${totalOrders}
💰 إجمالي الإيرادات: ${totalRevenue.toLocaleString("ar-IQ")} د.ع
✅ الطلبات المكتملة: ${completedOrders}
❌ الطلبات الملغاة: ${cancelledOrders}

━━━━━━━━━━━━━━━━━━
⏰ آخر تحديث: ${new Date().toLocaleTimeString("ar-IQ")}
    `;

    // إرسال الرسالة
    await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
*/

// ============================================================================
// ملاحظات التثبيت:
// ============================================================================
/*
1. إنشاء Edge Functions:
   supabase functions new send-telegram
   supabase functions new calculate-pricing
   supabase functions new daily-report

2. تعيين متغيرات البيئة:
   supabase secrets set TELEGRAM_BOT_TOKEN=your_token
   supabase secrets set ADMIN_CHAT_ID=your_chat_id

3. نشر الدوال:
   supabase functions deploy send-telegram
   supabase functions deploy calculate-pricing
   supabase functions deploy daily-report

4. جدولة التقرير اليومي:
   استخدم pg_cron أو Supabase Cron Jobs

5. اختبار الدوال:
   supabase functions invoke send-telegram --body '{"chat_id": 123, "text": "Hello"}'
*/
