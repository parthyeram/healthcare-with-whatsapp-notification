<div align="center">

# 🏥 Healthcare+
### Complete Health Companion with WhatsApp Medicine Reminders

![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8+-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Twilio](https://img.shields.io/badge/Twilio-WhatsApp-F22F46?style=for-the-badge&logo=twilio&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

> A full-stack health management web application — doctor discovery, appointment booking, health records, medicine tracking, AI chatbot, and **WhatsApp medicine reminders** via Twilio.

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [WhatsApp Setup](#-whatsapp-setup-twilio)
- [Scheduled Jobs](#-scheduled-jobs)
- [Database Tables](#-database-tables-whatsapp-reminders)
- [Message Templates](#-message-templates)
- [Frontend Sections](#-frontend-sections)
- [Security](#-security)
- [Support](#-support)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Authentication** | Register, login, JWT-based sessions |
| 👨‍⚕️ **Find Doctors** | Browse and filter by specialty |
| 🏨 **Hospitals** | Nearby hospital listings |
| 📅 **Appointments** | Book, view, and manage appointments |
| 📁 **Health Records** | Upload and track medical documents |
| 💊 **Medicines** | Add and monitor your medicine schedule |
| 🤖 **AI Chatbot** | Powered by Anthropic Claude for health queries |
| 💬 **WhatsApp Reminders** | OTP-verified medicine reminders, logs, and adherence stats via Twilio |

---

## 🛠 Tech Stack

**Backend**
- Node.js · Express · MySQL2
- JWT · bcryptjs · Multer
- Twilio · node-cron · moment-timezone
- Anthropic SDK (Claude AI)

**Frontend**
- Vanilla HTML / CSS / JS
- Sora + DM Serif fonts · Font Awesome icons

**Database**
- MySQL 8+

---

## 📁 Project Structure

```
healthcareplus+/
├── backend/
│   ├── db/
│   │   ├── connection.js          # MySQL connection pool
│   │   ├── schema.sql             # Main database schema
│   │   └── schema_reminders.sql   # WhatsApp reminders schema
│   ├── jobs/
│   │   ├── whatsapp.js            # Twilio sender + message templates
│   │   └── scheduler.js           # Cron jobs — reminders, weekly summary, low-stock alerts
│   ├── routes/
│   │   ├── auth.js                # Register / Login / JWT
│   │   ├── doctors.js             # Doctor listings
│   │   ├── appointments.js        # Appointment CRUD
│   │   ├── records.js             # Health records + medicines + hospitals
│   │   ├── chatbot.js             # Claude AI chatbot
│   │   └── reminders.js           # WhatsApp reminder API (full CRUD + webhook)
│   ├── .env.example               # Environment variable template
│   ├── package.json               # Dependencies
│   └── server.js                  # Express app entry point
└── frontend/
    ├── index.html                 # Single-page app (all sections)
    ├── css/
    │   └── styles.css             # All styles including WhatsApp reminder styles
    └── js/
        └── main.js                # All frontend logic including reminder JS
```

---

## ✅ Prerequisites

- Node.js **v18** or higher
- MySQL **8+**
- A **Twilio account** with WhatsApp enabled (sandbox or approved sender)
- An **Anthropic API key** (for the AI chatbot)

---

## 🚀 Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-username/healthcareplus.git
cd healthcareplus/backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
```
Open `.env` and fill in all required values *(see [Environment Variables](#-environment-variables) below)*.

### 4. Set up the database

Create the database in MySQL:
```sql
CREATE DATABASE healthcare_plus;
```

Run the main schema:
```bash
mysql -u root -p healthcare_plus < db/schema.sql
```

Run the WhatsApp reminders schema *(must run after schema.sql)*:
```bash
mysql -u root -p healthcare_plus < db/schema_reminders.sql
```

### 5. Start the server

**Development mode** (auto-restart on file changes):
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The API runs at **http://localhost:3001** by default.

### 6. Open the frontend

Open `frontend/index.html` in your browser, or serve it with any static file server.
The frontend communicates with the backend at `http://localhost:3001`.

---

## ⚙️ Environment Variables

Create a `.env` file in the `backend/` folder using the template below:

```env
# ── Server ──────────────────────────────────────
PORT=3001

# ── MySQL ────────────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=healthcare_plus

# ── JWT ──────────────────────────────────────────
JWT_SECRET=a_long_random_secret_string
JWT_EXPIRES_IN=7d

# ── Anthropic (AI Chatbot) ────────────────────────
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# ── File Uploads ──────────────────────────────────
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# ── CORS ─────────────────────────────────────────
FRONTEND_URL=http://localhost:3000

# ── Twilio WhatsApp ───────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# ── App Settings ──────────────────────────────────
APP_NAME=Healthcare+
SUPPORT_NUMBER=1800-111-555
TIMEZONE=Asia/Kolkata
```

> **Note:** If `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are not set, the server starts normally but the reminder scheduler is **disabled** — all other features continue to work.

---

## 📡 API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create new account |
| `POST` | `/api/auth/login` | Login, returns JWT |

### WhatsApp Registration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/reminders/whatsapp/register` | Save phone number, send OTP |
| `POST` | `/api/reminders/whatsapp/verify` | Verify OTP, send welcome message |
| `GET` | `/api/reminders/whatsapp/:userId` | Get WhatsApp registration info |
| `DELETE` | `/api/reminders/whatsapp/:userId` | Opt out |

### Reminders — CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reminders/:userId` | List all reminders for a user |
| `POST` | `/api/reminders` | Create a reminder |
| `PUT` | `/api/reminders/:id` | Update a reminder |
| `DELETE` | `/api/reminders/:id` | Delete a reminder |
| `PATCH` | `/api/reminders/:id/toggle` | Enable or disable a reminder |

### Logs & Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reminders/logs/:userId` | Message history (paginated) |
| `GET` | `/api/reminders/stats/:userId` | Adherence stats by day |
| `POST` | `/api/reminders/test/:userId` | Send a test WhatsApp message |
| `POST` | `/api/reminders/incoming` | Twilio webhook for inbound replies |

---

## 💬 WhatsApp Setup (Twilio)

### Using the Twilio Sandbox (Development)

1. Go to [console.twilio.com](https://console.twilio.com) → **Messaging → Try it out → Send a WhatsApp message**
2. Users must send a join code (e.g. `join bright-moon`) to **+1 415 523 8886** once to opt in
3. Set in your `.env`:
   ```
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```

### Incoming Webhook

Set your Twilio WhatsApp sandbox **webhook URL** to:
```
https://your-domain.com/api/reminders/incoming
```

Supported inbound reply commands:

| Command | Action |
|---------|--------|
| `TAKEN` | Acknowledges medicine was taken |
| `SKIP` | Skips today's dose |
| `LIST` | Shows today's active medicines |
| `STOP` | Unsubscribes from all reminders |
| `START` | Re-subscribes |

---

## ⏱️ Scheduled Jobs

The scheduler starts automatically when the server boots *(requires Twilio credentials)*.

| Schedule | Job |
|----------|-----|
| **Every minute** | Check for due reminders and send WhatsApp messages |
| **Daily at 9:00 PM IST** | Low-stock alert for medicines with ≤ 5 tablets remaining |
| **Every Sunday at 8:00 PM IST** | Weekly adherence summary sent to all users |

> Timezone is controlled by the `TIMEZONE` environment variable (default: `Asia/Kolkata`).

---

## 🗄️ Database Tables (WhatsApp Reminders)

| Table | Description |
|-------|-------------|
| `patient_whatsapp` | Phone number, verification status, OTP, and opt-in consent per user |
| `medicine_reminders` | One reminder per medicine per user with time, days of week, and message template |
| `reminder_logs` | Every message attempted with Twilio SID, status (`queued / sent / delivered / failed`), and error details |

---

## 📨 Message Templates

| Template | Description |
|----------|-------------|
| `default` | Full reminder with dosage, frequency, timing, and reply instructions |
| `morning` | Friendly good morning greeting with medicine name |
| `evening` | Brief evening nudge |
| `low_stock` | Alert when stock count drops to 5 or below |
| `weekly_summary` | Sunday adherence report with percentage and emoji feedback |

---

## 🖥️ Frontend Sections

Single-page application with section-based navigation:

| Section | Description |
|---------|-------------|
| 🏠 **Home** | Hero, stats, feature overview |
| 👨‍⚕️ **Find Doctors** | Doctor cards with specialty filter |
| 🏥 **Hospitals** | Hospital listings |
| 📅 **Appointments** | Book and manage appointments |
| 📁 **Health Records** | Document upload and history |
| 💊 **Medicines** | Add and track medicines |
| 💬 **Reminders** | WhatsApp OTP setup, reminder scheduling, message history, adherence stats |

---

## 🔒 Security

- Passwords hashed with **bcryptjs**
- JWT tokens expire after **7 days** (configurable via `JWT_EXPIRES_IN`)
- OTPs expire after **10 minutes**
- WhatsApp opt-in is **explicit** — users unsubscribe anytime by replying `STOP`
- `.env` is never committed — use `.env.example` as the template

---

## 📞 Support

| Channel | Details |
|---------|---------|
| 📧 Email | support@healthcareplus.in |
| 🆘 Emergency | 108 |
| ☎️ App Helpline | 1800-111-555 |

For bugs or questions, please [open an issue](https://github.com/your-username/healthcareplus/issues).

---

<div align="center">

**MIT License** — Free to use and modify for personal and commercial projects.

Made with ❤️ for better healthcare accessibility

</div>
