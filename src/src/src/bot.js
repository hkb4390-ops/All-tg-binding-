import { Telegraf, Markup } from "telegraf";
import { pool } from "./db.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS || 600);

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is missing");
}

const bot = new Telegraf(BOT_TOKEN);

// Developer guide
const GUIDE = `
🔗 TELEGRAM BINDING GUIDE

अपने App में Telegram Binding लगाने के लिए:

1️⃣ अपने App में "Binding From Telegram" button लगाएँ।

2️⃣ Button दबने पर आपके App का backend हमारे
login-session endpoint से एक unique login link बनाएगा।

3️⃣ User को Telegram पर हमारे Bot पर भेजें।

4️⃣ Telegram Bot user को:
• Telegram User ID
• Username
• First Name
• Last Name

के साथ verify करेगा।

5️⃣ Verification के बाद आपका App login-session
का status check करके user को अपने App में login कर सकता है।

⚠️ Security:
Telegram Bot Token को कभी भी अपने App/APK में
मत डालें। Secret केवल backend/server पर रखें।

📚 Integration:
${PUBLIC_BASE_URL || "YOUR_SERVER_URL"}/docs
`;

bot.start(async (ctx) => {
  const payload = (ctx.message.text || "").split(" ").slice(1).join(" ").trim();

  // Normal /start
  if (!payload) {
    await ctx.reply(
      `👋 Welcome ${ctx.from.first_name || "there"}!\n\n` +
      `यह Bot Apps में Telegram Binding/Login के लिए है।\n\n` +
      `अगर आप Developer हैं और अपने App में Telegram Binding लगाना चाहते हैं, नीचे YES दबाएँ।`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "✅ YES — Binding लगानी है",
            "developer_guide"
          )
        ],
        [
          Markup.button.callback(
            "❌ Cancel",
            "cancel"
          )
        ]
      ])
    );
    return;
  }

  // Login token from an app
  const result = await pool.query(
    `
    SELECT *
    FROM login_sessions
    WHERE state = $1
      AND status = 'pending'
      AND expires_at > NOW()
    LIMIT 1
    `,
    [payload]
  );

  if (result.rows.length === 0) {
    await ctx.reply(
      "❌ यह Login Link invalid या expired है।\n\nकृपया अपने App से नया Binding/Login request शुरू करें।"
    );
    return;
  }

  const session = result.rows[0];

  await pool.query(
    `
    UPDATE login_sessions
    SET
      status = 'authorized',
      telegram_user_id = $1,
      username = $2,
      first_name = $3,
      last_name = $4
    WHERE state = $5
    `,
    [
      String(ctx.from.id),
      ctx.from.username || null,
      ctx.from.first_name || null,
      ctx.from.last_name || null,
      payload
    ]
  );

  await ctx.reply(
    `✅ Telegram Binding Successful!\n\n` +
    `👤 Name: ${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim() +
    `\n🆔 Telegram ID: ${ctx.from.id}` +
    `${ctx.from.username ? `\n📱 Username: @${ctx.from.username}` : ""}` +
    `\n\nअब अपने App में वापस जाएँ।`
  );
});

// Developer guide button
bot.action("developer_guide", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    GUIDE,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "📋 Integration समझाएँ",
          "integration_info"
        )
      ],
      [
        Markup.button.callback(
          "💻 Example Code",
          "example_code"
        )
      ]
    ])
  );
});

// Integration information
bot.action("integration_info", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    `📋 INTEGRATION FLOW\n\n` +
    `आपके App में:\n\n` +
    `1. User "Binding From Telegram" दबाएगा।\n` +
    `2. आपका backend एक unique login state बनाएगा।\n` +
    `3. User को हमारे Telegram Bot के deep-link पर भेजें।\n` +
    `4. Telegram automatically /start <state> भेजेगा।\n` +
    `5. हमारा Bot Telegram account verify करेगा।\n` +
    `6. आपका backend session status check करेगा।\n` +
    `7. Authorized user को आपके App में login कर दें।\n\n` +
    `हर login request का state अलग होना चाहिए।`
  );
});

// Example code
bot.action("example_code", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    `💻 BASIC EXAMPLE\n\n` +
    `आपका App backend पहले login session बनाएगा:\n\n` +
    `POST /api/login/create\n\n` +
    `फिर response में मिलने वाले Telegram URL को खोलें:\n\n` +
    `https://t.me/YOUR_BOT?start=UNIQUE_STATE\n\n` +
    `User Telegram में Start दबाएगा और Bot उस state को authorize करेगा।\n\n` +
    `इसके बाद आपका backend:\n\n` +
    `GET /api/login/status/UNIQUE_STATE\n\n` +
    `से status check कर सकता है।`
  );
});

// Cancel
bot.action("cancel", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("ठीक है 👍 जब चाहें /start करके फिर से शुरू करें।");
});

bot.catch((error) => {
  console.error("Telegram Bot Error:", error);
});

export async function startBot() {
  await bot.launch();
  console.log("Telegram Bot started");
}
