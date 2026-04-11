/* ═══════════════════════════════════════════════════════
   Healthcare+  ·  WhatsApp Reminder API Routes

   POST   /api/reminders/whatsapp/register   → save phone + send OTP
   POST   /api/reminders/whatsapp/verify      → verify OTP
   GET    /api/reminders/whatsapp/:userId     → get WhatsApp info
   DELETE /api/reminders/whatsapp/:userId     → opt out

   GET    /api/reminders/:userId              → list all reminders
   POST   /api/reminders                      → create reminder
   PUT    /api/reminders/:id                  → update reminder
   DELETE /api/reminders/:id                  → delete reminder
   PATCH  /api/reminders/:id/toggle           → enable / disable

   GET    /api/reminders/logs/:userId         → send history
   POST   /api/reminders/test/:userId         → send test message
   POST   /api/reminders/incoming             → Twilio webhook (TAKEN/SKIP/STOP)
   GET    /api/reminders/stats/:userId        → adherence stats
   ═══════════════════════════════════════════════════════ */
require('dotenv').config();
const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const wa      = require('../jobs/whatsapp');

/* ── Helpers ─────────────────────────────────────────── */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  const local  = digits.startsWith('91') ? digits.slice(2) : digits;
  if (local.length !== 10) throw new Error('Phone must be 10 digits');
  return { phone: local, whatsapp_no: `whatsapp:+91${local}` };
}

/* ════════════════════════════════════════════════════════
   WHATSAPP REGISTRATION & VERIFICATION
════════════════════════════════════════════════════════ */

// Register phone — send OTP
router.post('/whatsapp/register', async (req, res) => {
  try {
    const { user_id, phone } = req.body;
    if (!user_id || !phone)
      return res.status(400).json({ success: false, message: 'user_id and phone are required' });

    const { phone: clean, whatsapp_no } = formatPhone(phone);
    const otp     = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await db.query(
      `INSERT INTO patient_whatsapp (user_id, phone, whatsapp_no, otp_code, otp_expires, is_verified)
       VALUES (?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE
         phone = VALUES(phone), whatsapp_no = VALUES(whatsapp_no),
         otp_code = VALUES(otp_code), otp_expires = VALUES(otp_expires),
         is_verified = 0`,
      [user_id, clean, whatsapp_no, otp, expires]
    );

    await wa.sendOTP(whatsapp_no, otp);

    res.json({ success: true, message: `OTP sent to WhatsApp +91${clean}` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Verify OTP
router.post('/whatsapp/verify', async (req, res) => {
  try {
    const { user_id, otp } = req.body;
    if (!user_id || !otp)
      return res.status(400).json({ success: false, message: 'user_id and otp are required' });

    const [rows] = await db.query(
      'SELECT * FROM patient_whatsapp WHERE user_id = ?', [user_id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'No pending verification found' });

    const rec = rows[0];

    if (rec.otp_code !== otp)
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });

    if (new Date() > new Date(rec.otp_expires))
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });

    await db.query(
      'UPDATE patient_whatsapp SET is_verified = 1, otp_code = NULL, otp_expires = NULL, opted_in = 1 WHERE user_id = ?',
      [user_id]
    );

    const [[user]] = await db.query('SELECT name FROM users WHERE id = ?', [user_id]);
    await wa.sendWelcome(rec.whatsapp_no, user?.name || 'there');

    res.json({ success: true, message: 'WhatsApp verified! Welcome message sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get WhatsApp info
router.get('/whatsapp/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT phone, whatsapp_no, is_verified, opted_in, created_at FROM patient_whatsapp WHERE user_id = ?',
      [req.params.userId]
    );
    if (!rows.length)
      return res.json({ success: true, data: null, registered: false });

    res.json({ success: true, data: rows[0], registered: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Opt out
router.delete('/whatsapp/:userId', async (req, res) => {
  try {
    await db.query(
      'UPDATE patient_whatsapp SET opted_in = 0 WHERE user_id = ?',
      [req.params.userId]
    );
    res.json({ success: true, message: 'Opted out from WhatsApp reminders' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ════════════════════════════════════════════════════════
   REMINDER CRUD
════════════════════════════════════════════════════════ */

// List reminders for a user
router.get('/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT mr.*, m.name AS medicine_name, m.dosage, m.frequency, m.timing, m.stock_count
       FROM medicine_reminders mr
       JOIN medicines m ON mr.medicine_id = m.id
       WHERE mr.user_id = ?
       ORDER BY mr.reminder_time ASC`,
      [req.params.userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create reminder
router.post('/', async (req, res) => {
  try {
    const { medicine_id, user_id, reminder_time, days_of_week, message_tpl } = req.body;

    if (!medicine_id || !user_id || !reminder_time)
      return res.status(400).json({ success: false, message: 'medicine_id, user_id and reminder_time are required' });

    if (!/^\d{2}:\d{2}$/.test(reminder_time))
      return res.status(400).json({ success: false, message: 'reminder_time must be HH:MM format' });

    const [wa_rows] = await db.query(
      'SELECT id FROM patient_whatsapp WHERE user_id = ? AND is_verified = 1 AND opted_in = 1',
      [user_id]
    );
    if (!wa_rows.length)
      return res.status(400).json({
        success: false,
        message: 'Please verify your WhatsApp number first before creating reminders'
      });

    const [result] = await db.query(
      `INSERT INTO medicine_reminders (medicine_id, user_id, reminder_time, days_of_week, message_tpl)
       VALUES (?, ?, ?, ?, ?)`,
      [medicine_id, user_id, `${reminder_time}:00`, days_of_week || 'all', message_tpl || 'default']
    );

    res.status(201).json({ success: true, message: 'Reminder created!', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update reminder
router.put('/:id', async (req, res) => {
  try {
    const { reminder_time, days_of_week, message_tpl, is_active } = req.body;
    await db.query(
      `UPDATE medicine_reminders
       SET reminder_time = ?, days_of_week = ?, message_tpl = ?, is_active = ?
       WHERE id = ?`,
      [`${reminder_time}:00`, days_of_week || 'all', message_tpl || 'default', is_active ?? 1, req.params.id]
    );
    res.json({ success: true, message: 'Reminder updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Enable / disable toggle
router.patch('/:id/toggle', async (req, res) => {
  try {
    const [[rem]] = await db.query('SELECT is_active FROM medicine_reminders WHERE id = ?', [req.params.id]);
    if (!rem) return res.status(404).json({ success: false, message: 'Reminder not found' });

    const newState = rem.is_active ? 0 : 1;
    await db.query('UPDATE medicine_reminders SET is_active = ? WHERE id = ?', [newState, req.params.id]);

    res.json({
      success:   true,
      is_active: newState,
      message:   newState ? 'Reminder enabled' : 'Reminder paused'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete reminder
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM medicine_reminders WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Reminder deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ════════════════════════════════════════════════════════
   LOGS, TEST & STATS
════════════════════════════════════════════════════════ */

// Send test WhatsApp message
router.post('/test/:userId', async (req, res) => {
  try {
    const [[waRec]] = await db.query(
      'SELECT whatsapp_no FROM patient_whatsapp WHERE user_id = ? AND is_verified = 1',
      [req.params.userId]
    );
    if (!waRec)
      return res.status(404).json({ success: false, message: 'No verified WhatsApp found for this user' });

    const testMed = {
      name:      req.body.medicine_name || 'Test Medicine',
      dosage:    req.body.dosage        || '1 tablet',
      frequency: req.body.frequency     || 'Once daily',
      timing:    req.body.timing        || 'After meals',
      notes:     'This is a test reminder from Healthcare+',
    };

    const result = await wa.sendMedicineReminder(waRec.whatsapp_no, testMed, 'default');
    res.json({ success: true, message: 'Test message sent!', sid: result.sid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Message logs
router.get('/logs/:userId', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const [rows] = await db.query(
      `SELECT rl.*, m.name AS medicine_name
       FROM reminder_logs rl
       LEFT JOIN medicines m ON rl.medicine_id = m.id
       WHERE rl.user_id = ?
       ORDER BY rl.sent_at DESC
       LIMIT ? OFFSET ?`,
      [req.params.userId, parseInt(limit), parseInt(offset)]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Adherence stats
router.get('/stats/:userId', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const [rows] = await db.query(
      `SELECT
         COUNT(*)                                  AS total_sent,
         SUM(status IN ('sent','delivered'))       AS delivered,
         SUM(status = 'failed')                    AS failed,
         DATE(sent_at)                             AS date
       FROM reminder_logs
       WHERE user_id = ? AND sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(sent_at)
       ORDER BY date ASC`,
      [req.params.userId, parseInt(days)]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ════════════════════════════════════════════════════════
   TWILIO INCOMING WEBHOOK
   Handles replies: TAKEN, SKIP, STOP, START, LIST
════════════════════════════════════════════════════════ */
router.post('/incoming', async (req, res) => {
  try {
    const body  = (req.body.Body  || '').trim().toUpperCase();
    const from  = req.body.From   || '';  // whatsapp:+91XXXXXXXXXX

    console.log(`[Incoming] From: ${from}, Body: ${body}`);

    const [[waRec]] = await db.query(
      'SELECT * FROM patient_whatsapp WHERE whatsapp_no = ?', [from]
    );

    if (!waRec) {
      await wa.sendWhatsApp(from,
        `You are not registered with Healthcare+.\nVisit our app to sign up. 🏥`
      );
      return res.set('Content-Type', 'text/xml').send('<Response/>');
    }

    if (body === 'STOP') {
      await db.query('UPDATE patient_whatsapp SET opted_in = 0 WHERE whatsapp_no = ?', [from]);
      await wa.sendWhatsApp(from,
        '🔕 You have been unsubscribed from Healthcare+ reminders.\nReply START anytime to re-subscribe.'
      );

    } else if (body === 'START') {
      await db.query('UPDATE patient_whatsapp SET opted_in = 1 WHERE whatsapp_no = ?', [from]);
      await wa.sendWhatsApp(from,
        '🔔 You have been re-subscribed to Healthcare+ reminders!\nYou will receive your medicine reminders as scheduled.'
      );

    } else if (body === 'TAKEN') {
      await wa.sendWhatsApp(from, '✅ Great job! Medicine marked as taken. Stay healthy! 💊');

    } else if (body === 'SKIP') {
      await wa.sendWhatsApp(from,
        '⏭️ Dose skipped for today. Please try not to miss too many doses.\nConsult your doctor if needed.'
      );

    } else if (body === 'LIST') {
      const [meds] = await db.query(
        `SELECT m.name, m.dosage, mr.reminder_time
         FROM medicine_reminders mr
         JOIN medicines m ON mr.medicine_id = m.id
         WHERE mr.user_id = ? AND mr.is_active = 1
         ORDER BY mr.reminder_time ASC`,
        [waRec.user_id]
      );
      if (!meds.length) {
        await wa.sendWhatsApp(from, '💊 You have no active medicine reminders set up.');
      } else {
        const list = meds.map(m =>
          `• ${m.name} (${m.dosage}) — ${m.reminder_time.substring(0, 5)}`
        ).join('\n');
        await wa.sendWhatsApp(from, `📋 *Your Active Medicines:*\n\n${list}`);
      }

    } else {
      await wa.sendWhatsApp(from,
        `Commands:\n✅ TAKEN — Mark medicine as taken\n⏭️ SKIP — Skip today's dose\n📋 LIST — View your medicines\n🔕 STOP — Unsubscribe\n🔔 START — Re-subscribe`
      );
    }

    res.set('Content-Type', 'text/xml').send('<Response/>');
  } catch (err) {
    console.error('[Incoming] Error:', err.message);
    res.set('Content-Type', 'text/xml').send('<Response/>');
  }
});

module.exports = router;
