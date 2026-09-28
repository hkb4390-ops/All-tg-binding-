import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_sessions (
      id BIGSERIAL PRIMARY KEY,
      state TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      telegram_user_id TEXT,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      photo_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_login_sessions_state
    ON login_sessions(state);

    CREATE INDEX IF NOT EXISTS idx_login_sessions_expires
    ON login_sessions(expires_at);
  `);

  console.log("Database initialized");
}
