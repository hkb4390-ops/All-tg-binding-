🔗 Telegram Binding Bot

A reusable Telegram Binding/Login service for apps.

✨ Features

- Telegram Bot based login
- "/start" deep-link login
- Unique login sessions
- One-time temporary login tokens
- PostgreSQL database
- Developer integration guide
- No developer account required
- No Firebase required
- Render deployment ready

📁 Project Structure

telegram-binding-bot/
│
├── src/
│   ├── bot.js
│   ├── db.js
│   ├── security.js
│   └── server.js
│
├── package.json
├── render.yaml
├── .env.example
├── .gitignore
└── README.md

🔧 Environment Variables

Create these variables in Render:

BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
BOT_USERNAME=HrryBindBot
DATABASE_URL=YOUR_RENDER_POSTGRES_URL
PUBLIC_BASE_URL=https://your-service.onrender.com
PORT=3000
TOKEN_TTL_SECONDS=600

BOT_TOKEN

Get this from Telegram's BotFather.

Never publish this token on GitHub.

BOT_USERNAME

The Telegram bot username without "@".

Example:

HrryBindBot

DATABASE_URL

Your Render PostgreSQL connection URL.

Never publish this URL because it contains database credentials.

PUBLIC_BASE_URL

Your deployed Render Web Service URL.

Example:

https://telegram-binding-bot.onrender.com

🚀 Local Installation

Install dependencies:

npm install

Start:

npm start

🌐 Render Deployment

1. Create a Render PostgreSQL database.
2. Create a Render Web Service.
3. Connect your GitHub repository.
4. Add the required Environment Variables.
5. Deploy.

Render will run:

npm install

and:

npm start

🔗 Developer Integration

After deployment, developers can open:

https://YOUR-SERVICE.onrender.com/docs

The documentation explains the login flow.

🔐 Security

Never put the following inside an Android APK or frontend:

- Telegram Bot Token
- PostgreSQL password
- Database connection URL

Keep all secrets on the backend.

⚠️ Important

This project provides the Telegram verification/binding bridge.

The integrating application's own backend should verify the login session before creating its own application session.

📄 License

MIT
