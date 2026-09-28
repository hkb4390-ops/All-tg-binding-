import "dotenv/config";

import express from "express";
import { pool, initDatabase } from "./db.js";
import { createState } from "./security.js";
import { startBot } from "./bot.js";

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL ||
  `http://localhost:${PORT}`
).replace(/\/$/, "");

const TOKEN_TTL_SECONDS = Number(
  process.env.TOKEN_TTL_SECONDS || 600
);

const BOT_USERNAME = process.env.BOT_USERNAME || "";

// --------------------------------------------------
// Health Check
// --------------------------------------------------

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "telegram-binding-bot",
      database: "connected"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      database: "error"
    });
  }
});

// --------------------------------------------------
// Developer Documentation
// --------------------------------------------------

app.get("/docs", (req, res) => {
  res.type("html").send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Telegram Binding API</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 900px;
      margin: auto;
      padding: 20px;
      line-height: 1.6;
      background: #f5f7fb;
      color: #111827;
    }

    .card {
      background: white;
      padding: 20px;
      border-radius: 14px;
      margin-bottom: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,.06);
    }

    code, pre {
      background: #111827;
      color: #fff;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      display: block;
    }

    h1 {
      color: #2563eb;
    }
  </style>
</head>

<body>

  <div class="card">
    <h1>🔗 Telegram Binding API</h1>

    <p>
      अपने App में Telegram Binding/Login जोड़ने के लिए
      इस service का इस्तेमाल किया जा सकता है।
    </p>
  </div>

  <div class="card">
    <h2>1. Login Session बनाना</h2>

    <p>अपने App के backend से:</p>

    <pre>
POST ${PUBLIC_BASE_URL}/api/login/create
Content-Type: application/json

{}
    </pre>

    <p>Response:</p>

    <pre>
{
  "ok": true,
  "state": "UNIQUE_STATE",
  "telegram_url": "https://t.me/YOUR_BOT?start=UNIQUE_STATE",
  "expires_in": ${TOKEN_TTL_SECONDS}
}
    </pre>
  </div>

  <div class="card">
    <h2>2. User को Telegram पर भेजें</h2>

    <p>
      Response में मिलने वाले <b>telegram_url</b> को अपने
      App में खोलें।
    </p>
  </div>

  <div class="card">
    <h2>3. Login Status Check करें</h2>

    <pre>
GET ${PUBLIC_BASE_URL}/api/login/status/UNIQUE_STATE
    </pre>

    <p>
      जब user Telegram में Start करेगा, status
      <b>authorized</b> हो जाएगा।
    </p>
  </div>

  <div class="card">
    <h2>4. Authorized Response</h2>

    <pre>
{
  "ok": true,
  "status": "authorized",
  "user": {
    "telegram_id": "123456789",
    "username": "example",
    "first_name": "User",
    "last_name": "Name"
  }
}
    </pre>
  </div>

  <div class="card">
    <h2>⚠️ Security</h2>

    <p>
      Telegram Bot Token को कभी भी Android APK,
      frontend JavaScript या public application में
      मत रखें।
    </p>

    <p>
      Login status को अपने backend से verify करना बेहतर है।
    </p>
  </div>

</body>
</html>
  `);
});

// --------------------------------------------------
// Create Login Session
// --------------------------------------------------

app.post("/api/login/create", async (req, res) => {
  try {
    const state = createState();

    await pool.query(
      `
      INSERT INTO login_sessions
      (
        state,
        status,
        expires_at
      )
      VALUES
      (
        $1,
        'pending',
        NOW() + ($2 * INTERVAL '1 second')
      )
      `,
      [state, TOKEN_TTL_SECONDS]
    );

    let telegramUrl;

    if (BOT_USERNAME) {
      telegramUrl =
        `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(state)}`;
    } else {
      telegramUrl =
        `https://t.me/?start=${encodeURIComponent(state)}`;
    }

    res.json({
      ok: true,
      state,
      telegram_url: telegramUrl,
      poll_url:
        `${PUBLIC_BASE_URL}/api/login/status/${state}`,
      expires_in: TOKEN_TTL_SECONDS
    });

  } catch (error) {
    console.error("Create login error:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to create login session"
    });
  }
});

// --------------------------------------------------
// Login Status
// --------------------------------------------------

app.get("/api/login/status/:state", async (req, res) => {
  try {
    const { state } = req.params;

    const result = await pool.query(
      `
      SELECT
        state,
        status,
        telegram_user_id,
        username,
        first_name,
        last_name,
        expires_at
      FROM login_sessions
      WHERE state = $1
      LIMIT 1
      `,
      [state]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Login session not found"
      });
    }

    const session = result.rows[0];

    // Expired
    if (
      session.status === "pending" &&
      new Date(session.expires_at).getTime() < Date.now()
    ) {
      await pool.query(
        `
        UPDATE login_sessions
        SET status = 'expired'
        WHERE state = $1
        `,
        [state]
      );

      return res.json({
        ok: true,
        status: "expired"
      });
    }

    // Still waiting
    if (session.status === "pending") {
      return res.json({
        ok: true,
        status: "pending"
      });
    }

    // Authorized
    if (session.status === "authorized") {
      return res.json({
        ok: true,
        status: "authorized",
        user: {
          telegram_id: session.telegram_user_id,
          username: session.username,
          first_name: session.first_name,
          last_name: session.last_name
        }
      });
    }

    return res.json({
      ok: true,
      status: session.status
    });

  } catch (error) {
    console.error("Status error:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to check login status"
    });
  }
});

// --------------------------------------------------
// Cleanup expired sessions
// --------------------------------------------------

async function cleanupExpiredSessions() {
  try {
    await pool.query(
      `
      UPDATE login_sessions
      SET status = 'expired'
      WHERE status = 'pending'
        AND expires_at <= NOW()
      `
    );
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

// --------------------------------------------------
// Start Server
// --------------------------------------------------

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(
        `Server running on port ${PORT}`
      );

      console.log(
        `Docs: ${PUBLIC_BASE_URL}/docs`
      );
    });

    await startBot();

    setInterval(
      cleanupExpiredSessions,
      60 * 1000
    );

  } catch (error) {
    console.error(
      "Failed to start application:",
      error
    );

    process.exit(1);
  }
}

startServer();
