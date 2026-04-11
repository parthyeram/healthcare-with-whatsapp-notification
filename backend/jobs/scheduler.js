/* ═══════════════════════════════════════════════════════
   Healthcare+  ·  Medicine Reminder Scheduler
   Runs every minute, checks which reminders are due,
   sends WhatsApp messages via Twilio
   ═══════════════════════════════════════════════════════ */
require('dotenv').config();
const cron    = require('node-cron');
const moment  = require('moment-timezone');
const db      = require('../db/connection');
const wa      = require('./whatsapp');

const TZ = process.env.TIMEZONE || 'Asia/Kolkata';

/* ── Pick the right message template by time of day ──── */
function pickTemplate(timeStr) {
  const h = parseInt(timeStr.split(':')[0]);
  if (h >= 5  && h < 12) return 'morning';
  if (h >= 17 && h < 21) return 'evening';
  return 'default';
}

/* ── Check if today matches days_of_week setting ─────── */
function isDueToday(daysOfWeek) {
  if (!daysOfWeek || daysOfWeek === 'all') return true;
  const today = moment().tz(TZ).isoWeekday(); // 1=Mon … 7=Sun
  return daysOfWeek.split(',').map(Number).includes(today);
}

/* ══════════════════════════════════════════════════════
   MAIN REMINDER JOB  — runs every minute
══════════════════════════════════════════════════════ */
async function runReminderJob() {
  const now         = moment().tz(TZ);
  const currentTime = now.format('HH:mm');    // e.g. "08:00"
  const today       = now.format('YYYY-MM-DD');

  console.log(`[Scheduler] ⏰ ${currentTime} — checking reminders…`);

  try {
    const [reminders] = await db.query(
      `SELECT
         mr.*,
         m.name        AS med_name,
         m.dosage      AS med_dosage,
         m.frequency   AS med_frequency,
         m.timing      AS med_timing,
         m.notes       AS med_notes,
         m.stock_count AS med_stock,
         m.status      AS med_status,
         m.end_date    AS med_end_date,
         pw.whatsapp_no,
         pw.is_verified,
         pw.opted_in,
         u.name        AS patient_name
       FROM medicine_reminders mr
       JOIN medicines       m  ON mr.medicine_id = m.id
       JOIN patient_whatsapp pw ON mr.user_id    = pw.user_id
       JOIN users           u  ON mr.user_id     = u.id
       WHERE mr.is_active     = 1
         AND mr.reminder_time = ?
         AND pw.is_verified   = 1
         AND pw.opted_in      = 1
         AND m.status         = 'active'
         AND (m.end_date IS NULL OR m.end_date >= ?)`,
      [`${currentTime}:00`, today]
    );

    console.log(`[Scheduler] Found ${reminders.length} reminder(s) due`);

    for (const rem of reminders) {
      if (!isDueToday(rem.days_of_week)) {
        console.log(`[Scheduler] Skipping ${rem.med_name} — not scheduled today`);
        continue;
      }

      // Prevent duplicate sends
      const [already] = await db.query(
        `SELECT id FROM reminder_logs
         WHERE reminder_id = ? AND DATE(sent_at) = ? AND status IN ('sent','delivered','queued')`,
        [rem.id, today]
      );
      if (already.length > 0) {
        console.log(`[Scheduler] Already sent ${rem.med_name} today, skipping`);
        continue;
      }

      const medicine = {
        name:        rem.med_name,
        dosage:      rem.med_dosage,
        frequency:   rem.med_frequency,
        timing:      rem.med_timing,
        notes:       rem.med_notes,
        stock_count: rem.med_stock,
      };

      const [logResult] = await db.query(
        `INSERT INTO reminder_logs
         (user_id, medicine_id, reminder_id, phone, message_body, status)
         VALUES (?, ?, ?, ?, ?, 'queued')`,
        [rem.user_id, rem.medicine_id, rem.id, rem.whatsapp_no, '']
      );
      const logId = logResult.insertId;

      try {
        const tpl    = pickTemplate(currentTime);
        const result = await wa.sendMedicineReminder(rem.whatsapp_no, medicine, tpl);

        await db.query(
          `UPDATE reminder_logs SET twilio_sid = ?, status = 'sent', message_body = ?
           WHERE id = ?`,
          [result.sid, result.status, logId]
        );

        await db.query(
          'UPDATE medicine_reminders SET last_sent_at = NOW() WHERE id = ?',
          [rem.id]
        );

        console.log(`[Scheduler] ✅ Sent to ${rem.patient_name} (${rem.whatsapp_no}) — ${rem.med_name}`);

        if (rem.med_stock !== null && rem.med_stock <= 5) {
          await wa.sendLowStockAlert(rem.whatsapp_no, medicine);
          console.log(`[Scheduler] ⚠️  Low stock alert sent for ${rem.med_name}`);
        }

      } catch (sendErr) {
        await db.query(
          "UPDATE reminder_logs SET status = 'failed', error_msg = ? WHERE id = ?",
          [sendErr.message, logId]
        );
        console.error(`[Scheduler] ❌ Failed for ${rem.patient_name}:`, sendErr.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler] DB error:', err.message);
  }
}

/* ══════════════════════════════════════════════════════
   WEEKLY SUMMARY JOB  — every Sunday at 8 PM IST
══════════════════════════════════════════════════════ */
async function runWeeklySummaryJob() {
  console.log('[Scheduler] 📊 Running weekly summary job…');
  const now   = moment().tz(TZ);
  const start = now.clone().subtract(7, 'days').format('YYYY-MM-DD');
  const end   = now.format('YYYY-MM-DD');

  try {
    const [users] = await db.query(
      `SELECT DISTINCT pw.user_id, pw.whatsapp_no, u.name
       FROM patient_whatsapp pw
       JOIN users u ON pw.user_id = u.id
       WHERE pw.is_verified = 1 AND pw.opted_in = 1`
    );

    for (const user of users) {
      const [logs] = await db.query(
        `SELECT
           COUNT(*) AS total,
           SUM(status = 'delivered' OR status = 'sent') AS sent
         FROM reminder_logs
         WHERE user_id = ? AND DATE(sent_at) BETWEEN ? AND ?`,
        [user.user_id, start, end]
      );

      const stats = {
        total:   logs[0].total   || 0,
        taken:   logs[0].sent    || 0,
        skipped: 0,
        missed:  (logs[0].total - logs[0].sent) || 0,
      };

      if (stats.total > 0) {
        await wa.sendWeeklySummary(user.whatsapp_no, user.name, stats);
      }
    }
    console.log(`[Scheduler] Weekly summaries sent to ${users.length} users`);
  } catch (err) {
    console.error('[Scheduler] Weekly summary error:', err.message);
  }
}

/* ── Nightly low-stock check for all users ───────────── */
async function checkLowStockAll() {
  console.log('[Scheduler] 📦 Running nightly low-stock check…');
  try {
    const [medicines] = await db.query(
      `SELECT m.*, pw.whatsapp_no, u.name AS patient_name
       FROM medicines m
       JOIN patient_whatsapp pw ON m.user_id = pw.user_id
       JOIN users u ON m.user_id = u.id
       WHERE m.status = 'active'
         AND m.stock_count IS NOT NULL
         AND m.stock_count <= m.low_stock_alert
         AND pw.is_verified = 1
         AND pw.opted_in    = 1`
    );
    for (const med of medicines) {
      await wa.sendLowStockAlert(med.whatsapp_no, {
        name:        med.name,
        stock_count: med.stock_count,
      });
    }
    console.log(`[Scheduler] Low-stock alerts sent for ${medicines.length} medicines`);
  } catch (err) {
    console.error('[Scheduler] Low-stock check error:', err.message);
  }
}

/* ══════════════════════════════════════════════════════
   START CRON JOBS
══════════════════════════════════════════════════════ */
function startScheduler() {
  console.log('🕐  Starting Medicine Reminder Scheduler (TZ: ' + TZ + ')');

  // Every minute — check and send due reminders
  cron.schedule('* * * * *', runReminderJob, { timezone: TZ });

  // Every Sunday at 8:00 PM — weekly summary
  cron.schedule('0 20 * * 0', runWeeklySummaryJob, { timezone: TZ });

  // Every day at 9:00 PM — nightly low-stock alerts
  cron.schedule('0 21 * * *', checkLowStockAll, { timezone: TZ });

  console.log('✅  Scheduler running. Checking reminders every minute.');
}

module.exports = { startScheduler, runReminderJob };
