Healthcare+ — Complete Health Companion with WhatsApp Medicine Reminders
Overview
Healthcare+ is a full-stack health management web application built with Node.js, Express, MySQL, and a vanilla JS single-page frontend. It covers doctor discovery, appointment booking, health records, medicine tracking, an AI chatbot, and — newly integrated — WhatsApp medicine reminders via Twilio.

Features

Authentication — Register, login, JWT-based sessions
Find Doctors — Browse and filter doctors by specialty
Hospitals — Nearby hospital listings
Appointments — Book, view, and manage appointments
Health Records — Upload and track medical documents
Medicines — Add and monitor your medicine schedule
AI Chatbot — Powered by Anthropic Claude for health queries
WhatsApp Reminders — OTP-verified WhatsApp medicine reminders with scheduling, logs, and adherence stats (Twilio)

Project Structure
healthcareplus+/
├── backend/
│   ├── db/
│   │   ├── connection.js            # MySQL connection pool
│   │   ├── schema.sql               # Main database schema
│   │   └── schema_reminders.sql     # WhatsApp reminders schema (run after schema.sql)
│   ├── jobs/
│   │   ├── whatsapp.js              # Twilio WhatsApp sender + message templates
│   │   └── scheduler.js             # Cron jobs — reminders, weekly summary, low-stock alerts
│   ├── routes/
│   │   ├── auth.js                  # Register / login / JWT
│   │   ├── doctors.js               # Doctor listings
│   │   ├── appointments.js          # Appointment CRUD
│   │   ├── records.js               # Health records + medicines + hospitals
│   │   ├── chatbot.js               # Claude AI chatbot
│   │   └── reminders.js             # WhatsApp reminder API (full CRUD + webhook)
│   ├── .env.example                 # Environment variable template
│   ├── package.json
│   └── server.js                    # Express app entry point
└── frontend/
    ├── index.html                   # Single-page app (all sections)
    ├── css/
    │   └── styles.css               # All styles including WhatsApp reminder styles
    └── js/
        └── main.js                  # All frontend logic including reminder JS



Tech Stack
Backend — Node.js, Express, MySQL2, JWT, bcryptjs, Multer, Twilio, node-cron, moment-timezone, Anthropic SDK
Frontend — Vanilla HTML/CSS/JS, Sora + DM Serif fonts, Font Awesome icons
Database — MySQL

Prerequisites

Node.js v18 or higher
MySQL 8+
A Twilio account with WhatsApp enabled (sandbox or approved sender)
An Anthropic API key (for the chatbot)


Installation
1. Clone or extract the project
bashcd healthcareplus+/backend
2. Install dependencies
bashnpm install
3. Set up environment variables
bashcp .env.example .env
Open .env and fill in all values (see Environment Variables section below).
4. Set up the database
Create the database in MySQL:
sqlCREATE DATABASE healthcare_plus;
Run the main schema:
bashmysql -u root -p healthcare_plus < db/schema.sql
Run the WhatsApp reminders schema (must be run after schema.sql):
bashmysql -u root -p healthcare_plus < db/schema_reminders.sql
5. Start the server
Development mode (with auto-restart):
bashnpm run dev
Production mode:
bashnpm start
The API runs at http://localhost:3001 by default.
6. Open the frontend
Open frontend/index.html in your browser directly, or serve it with any static file server. The frontend talks to the backend at http://localhost:3001.

Environment Variables

# Server
PORT=3001

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=healthcare_plus

# JWT
JWT_SECRET=a_long_random_secret_string
JWT_EXPIRES_IN=7d

# Anthropic (chatbot)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# File uploads
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# CORS
FRONTEND_URL=http://localhost:3000

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# App settings
APP_NAME=Healthcare+
SUPPORT_NUMBER=1800-111-555
TIMEZONE=Asia/Kolkata

If TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are not set, the server starts normally but the reminder scheduler is disabled — all other features continue to work.

API Reference
Auth
MethodEndpointDescriptionPOST/api/auth/registerCreate new accountPOST/api/auth/loginLogin, returns JWT
Reminders — WhatsApp
MethodEndpointDescriptionPOST/api/reminders/whatsapp/registerSave phone number, send OTPPOST/api/reminders/whatsapp/verifyVerify OTP, send welcome messageGET/api/reminders/whatsapp/:userIdGet WhatsApp registration infoDELETE/api/reminders/whatsapp/:userIdOpt out
Reminders — CRUD
MethodEndpointDescriptionGET/api/reminders/:userIdList all reminders for a userPOST/api/remindersCreate a reminderPUT/api/reminders/:idUpdate a reminderDELETE/api/reminders/:idDelete a reminderPATCH/api/reminders/:id/toggleEnable or disable a reminder
Reminders — Logs & Stats
MethodEndpointDescriptionGET/api/reminders/logs/:userIdMessage history (paginated)GET/api/reminders/stats/:userIdAdherence stats by dayPOST/api/reminders/test/:userIdSend a test WhatsApp messagePOST/api/reminders/incomingTwilio webhook for inbound replies


WhatsApp Setup (Twilio)
Using the Twilio Sandbox (development)

Go to console.twilio.com and navigate to Messaging → Try it out → Send a WhatsApp message
Your users must send a join code (e.g. join bright-moon) to +1 415 523 8886 once to opt in to the sandbox
Set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 in your .env

Twilio Incoming Webhook
Set your Twilio WhatsApp sandbox webhook URL to:
https://your-domain.com/api/reminders/incoming
This handles inbound replies from patients. Supported commands:
CommandActionTAKENAcknowledges medicine was takenSKIPSkips today's doseLISTShows today's active medicinesSTOPUnsubscribes from all remindersSTARTRe-subscribes

Scheduled Jobs
The scheduler starts automatically when the server boots (if Twilio credentials are present).
ScheduleJobEvery minuteCheck for due reminders and send WhatsApp messagesDaily at 9:00 PM ISTNightly low-stock alert for medicines with 5 or fewer tablets remainingEvery Sunday at 8:00 PM ISTWeekly adherence summary sent to all users
The timezone is controlled by the TIMEZONE environment variable (default: Asia/Kolkata).

Database Tables (WhatsApp Reminders)
patient_whatsapp — stores phone number, verification status, OTP, and opt-in consent per user
medicine_reminders — stores one reminder per medicine per user with time, days of week, and message template
reminder_logs — records every message attempted, with Twilio SID, status (queued / sent / delivered / failed), and error details

Message Templates
Five templates are available when creating a reminder:

default — Full reminder with dosage, frequency, timing, and reply instructions
morning — Friendly good morning greeting with medicine name
evening — Brief evening nudge
low_stock — Alert when stock count drops to 5 or below
weekly_summary — Sunday adherence report with percentage and emoji feedback


Frontend Sections
The frontend is a single HTML file with section-based navigation:

Home — Hero, stats, feature overview
Find Doctors — Doctor cards with specialty filter
Hospitals — Hospital listings
Appointments — Book and manage appointments
Health Records — Document upload and history
Medicines — Add and track medicines
Reminders — WhatsApp setup (OTP flow), reminder scheduling, message history, and adherence stats


Security Notes

All passwords are hashed with bcryptjs
JWT tokens expire after 7 days (configurable)
OTPs expire after 10 minutes
WhatsApp opt-in is explicit and users can unsubscribe at any time by replying STOP
Environment variables are never committed — use .env.example as the template


License
MIT — free to use and modify for personal and commercial projects.

Support
For questions, open an issue or contact support@healthcareplus.in
Emergency helpline: 108 | App support: 1800-111-555
