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

/* ── Register ───────────────────────────────────────── */
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, date_of_birth, gender, blood_group } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length)
      return res.status(409).json({ success: false, message: 'Email already registered. Please sign in.' });

    const hash   = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (name, email, phone, password_hash, date_of_birth, gender, blood_group) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone || null, hash, date_of_birth || null, gender || null, blood_group || null]
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
