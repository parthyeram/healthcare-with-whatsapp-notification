/* =====================================================
   Healthcare+  ·  Express Server
   ===================================================== */
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── Middleware ─────────────────────────────────────── */
app.use(cors({
  origin:      process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/* Serve uploaded files */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ── Health check ───────────────────────────────────── */
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    message:   '🏥 Healthcare+ API is running',
    timestamp: new Date().toISOString(),
    version:   '1.0.0',
  });
});

/* ── Routes ─────────────────────────────────────────── */
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/doctors',      require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api',              require('./routes/records'));      // health-records, medicines, hospitals
app.use('/api/chatbot',      require('./routes/chatbot'));
app.use('/api/reminders',    require('./routes/reminders'));    // WhatsApp medicine reminders

/* ── 404 ────────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

/* ── Global error handler ───────────────────────────── */
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

/* ── Start ──────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║      🏥  Healthcare+  API             ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`\n✅  Running on  http://localhost:${PORT}`);
  console.log(`📋  Health check: http://localhost:${PORT}/api/health\n`);

  // Start the WhatsApp medicine reminder scheduler
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const { startScheduler } = require('./jobs/scheduler');
    startScheduler();
  } else {
    console.log('⚠️   WhatsApp reminders disabled — set TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN in .env to enable.');
  }
});

module.exports = app;
