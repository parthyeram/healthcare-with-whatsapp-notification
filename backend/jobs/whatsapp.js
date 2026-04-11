/* ═══════════════════════════════════════════════════════
   Healthcare+  ·  WhatsApp Sender (Twilio)
   ═══════════════════════════════════════════════════════ */
require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
const APP  = process.env.APP_NAME             || 'Healthcare+';

/* ── Message Templates ───────────────────────────────── */
const TEMPLATES = {

  default: (med) => `
🏥 *${APP} Medicine Reminder*

💊 *${med.name}*
📋 Dosage: ${med.dosage || 'As prescribed'}
⏰ Time: ${med.timing || 'Now'}
🔄 Frequency: ${med.frequency}

${med.notes ? `📝 Note: ${med.notes}\n` : ''}
✅ Reply *TAKEN* to confirm
❌ Reply *SKIP* to skip once
🔕 Reply *STOP* to unsubscribe

_${APP} — Your Health Companion_
`.trim(),

  low_stock: (med) => `
⚠️ *${APP} Low Stock Alert*

💊 *${med.name}* is running low!
📦 Remaining: *${med.stock_count} tablets*

Please refill soon to avoid missing doses.

👉 Open Healthcare+ app to reorder
📞 Support: ${process.env.SUPPORT_NUMBER || '1800-111-555'}

_${APP} — Your Health Companion_
`.trim(),

  morning: (med) => `
🌅 *Good Morning! Time for your medicine*

💊 *${med.name}*
📋 ${med.dosage || 'As prescribed'} — *${med.timing || 'After breakfast'}*

Have a healthy day! 😊

✅ Reply *TAKEN* to confirm
`.trim(),

  evening: (med) => `
🌆 *Evening Reminder — ${APP}*

💊 Don't forget: *${med.name}*
📋 ${med.dosage || 'As prescribed'} — *${med.timing || 'After dinner'}*

✅ Reply *TAKEN* to confirm
`.trim(),

  otp: (otp) => `
🔐 *${APP} — Verify WhatsApp*

Your OTP is: *${otp}*

Valid for 10 minutes. Do not share this with anyone.

_${APP} Team_
`.trim(),

  welcome: (name) => `
👋 *Welcome to ${APP} Medicine Reminders!*

Hi ${name}! Your WhatsApp is now verified ✅

You will receive daily medicine reminders on this number.

Commands you can use:
✅ *TAKEN* — Mark medicine as taken
❌ *SKIP* — Skip today's dose
📋 *LIST* — See today's medicines
🔕 *STOP* — Unsubscribe from reminders
🔔 *START* — Re-subscribe

Stay healthy! 💚
`.trim(),

  weekly_summary: (name, stats) => `
📊 *${APP} — Weekly Health Summary*

Hi ${name}! Here's your medicine adherence this week:

💊 Total doses scheduled: *${stats.total}*
✅ Taken on time: *${stats.taken}* (${Math.round((stats.taken / stats.total) * 100)}%)
⏭️ Skipped: *${stats.skipped}*
❌ Missed: *${stats.missed}*

${stats.taken / stats.total >= 0.8 ? '🌟 Great job! Keep it up!' : '💪 Try to take your medicines on time for better health.'}

_${APP} — Your Health Companion_
`.trim(),
};

/* ── Send a single WhatsApp message ──────────────────── */
async function sendWhatsApp(to, body) {
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const msg = await client.messages.create({
    from: FROM,
    to:   toFormatted,
    body,
  });
  return { sid: msg.sid, status: msg.status };
}

/* ── Send reminder for one medicine ─────────────────── */
async function sendMedicineReminder(phone, medicine, templateName = 'default') {
  const tpl  = TEMPLATES[templateName] || TEMPLATES.default;
  const body = tpl(medicine);
  return sendWhatsApp(phone, body);
}

/* ── Send OTP ────────────────────────────────────────── */
async function sendOTP(phone, otp) {
  return sendWhatsApp(phone, TEMPLATES.otp(otp));
}

/* ── Send welcome message ────────────────────────────── */
async function sendWelcome(phone, name) {
  return sendWhatsApp(phone, TEMPLATES.welcome(name));
}

/* ── Send low stock alert ────────────────────────────── */
async function sendLowStockAlert(phone, medicine) {
  return sendWhatsApp(phone, TEMPLATES.low_stock(medicine));
}

/* ── Send weekly summary ─────────────────────────────── */
async function sendWeeklySummary(phone, name, stats) {
  return sendWhatsApp(phone, TEMPLATES.weekly_summary(name, stats));
}

module.exports = {
  sendWhatsApp,
  sendMedicineReminder,
  sendOTP,
  sendWelcome,
  sendLowStockAlert,
  sendWeeklySummary,
  TEMPLATES,
};
