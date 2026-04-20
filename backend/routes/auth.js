/* =====================================================
   Healthcare+  ·  Auth Routes
   POST /api/auth/register
   POST /api/auth/login
   GET  /api/auth/profile/:id
   PUT  /api/auth/profile/:id
   ===================================================== */
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/connection');
const wa      = require('../jobs/whatsapp');

function formatPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  const local  = digits.startsWith('91') ? digits.slice(2) : digits;
  if (local.length !== 10) return null;
  return {
    phone: local,
    whatsapp_no: `whatsapp:+91${local}`,
  };
}

async function syncWhatsAppUser(userId, phone) {
  const normalized = formatPhone(phone);
  if (!normalized) return null;

  await db.query(
    `INSERT INTO patient_whatsapp (user_id, phone, whatsapp_no, is_verified, otp_code, otp_expires, opted_in)
     VALUES (?, ?, ?, 1, NULL, NULL, 1)
     ON DUPLICATE KEY UPDATE
       phone = VALUES(phone),
       whatsapp_no = VALUES(whatsapp_no),
       is_verified = 1,
       otp_code = NULL,
       otp_expires = NULL,
       opted_in = 1`,
    [userId, normalized.phone, normalized.whatsapp_no]
  );

  return normalized.whatsapp_no;
}

async function notifyOnAuth(type, userRecord) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return;

  try {
    const whatsappNo = await syncWhatsAppUser(userRecord.id, userRecord.phone);
    if (!whatsappNo) return;

    if (type === 'signup') {
      await wa.sendSignupNotice(whatsappNo, userRecord.name || 'there');
      return;
    }

    if (type === 'login') {
      const at = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
      });
      await wa.sendLoginNotice(whatsappNo, userRecord.name || 'there', at);
    }
  } catch (err) {
    console.warn(`[auth] WhatsApp ${type} notice skipped:`, err.message);
  }
}

/* ── Register ───────────────────────────────────────── */
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password)
      return res.status(400).json({ success: false, message: 'Name, email, phone, and password are required' });

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length)
      return res.status(409).json({ success: false, message: 'Email already registered. Please sign in.' });

    const hash   = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
      [name, email, phone || null, hash]
    );

    const token = jwt.sign(
      { id: result.insertId, email },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { id: result.insertId, name, email, phone }
    });

    notifyOnAuth('signup', { id: result.insertId, name, phone });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Login ──────────────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users.length)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const user  = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password_hash, ...safeUser } = user;
    res.json({ success: true, message: 'Login successful', token, user: safeUser });

    notifyOnAuth('login', safeUser);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Get Profile ────────────────────────────────────── */
router.get('/profile/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, phone, date_of_birth, gender, blood_group, profile_image, address, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Update Profile ─────────────────────────────────── */
router.put('/profile/:id', async (req, res) => {
  try {
    const { name, phone, date_of_birth, gender, blood_group, address } = req.body;
    await db.query(
      'UPDATE users SET name=?, phone=?, date_of_birth=?, gender=?, blood_group=?, address=? WHERE id=?',
      [name, phone, date_of_birth, gender, blood_group, address, req.params.id]
    );
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
