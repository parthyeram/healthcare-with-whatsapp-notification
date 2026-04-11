/* =====================================================
   Healthcare+  ·  Doctors Routes
   GET  /api/doctors              – list with filters
   GET  /api/doctors/:id          – doctor + reviews
   GET  /api/doctors/meta/specializations
   GET  /api/doctors/ai/suggest   – AI keyword match
   POST /api/doctors/:id/review
   ===================================================== */
const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

/* ── List Doctors ───────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { specialization, hospital, search, page = 1, limit = 12 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let q      = `SELECT d.*, s.name AS specialization_name, s.keywords, s.icon,
                         h.name AS hospital_name, h.city
                  FROM   doctors d
                  LEFT JOIN specializations s ON d.specialization_id = s.id
                  LEFT JOIN hospitals       h ON d.hospital_id       = h.id
                  WHERE  d.status = 'active'`;
    const params = [];

    if (specialization) { q += ' AND d.specialization_id = ?'; params.push(specialization); }
    if (hospital)       { q += ' AND d.hospital_id = ?';       params.push(hospital); }
    if (search) {
      q += ' AND (d.name LIKE ? OR s.name LIKE ? OR s.keywords LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    q += ' ORDER BY d.rating DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [doctors]       = await db.query(q, params);
    const [[{ total }]]   = await db.query("SELECT COUNT(*) AS total FROM doctors WHERE status = 'active'");

    res.json({ success: true, data: doctors, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Specializations (for filter dropdowns) ─────────── */
router.get('/meta/specializations', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM specializations ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── AI Doctor Suggest ──────────────────────────────── */
router.get('/ai/suggest', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ success: false, message: 'query param is required' });

    const [specs] = await db.query('SELECT * FROM specializations');
    const ql      = query.toLowerCase();

    const matched = specs.filter(s => {
      const kws = (s.keywords || '').toLowerCase().split(',').map(k => k.trim());
      return kws.some(k => ql.includes(k) || k.includes(ql.split(' ')[0]));
    });

    let doctors = [];
    if (matched.length) {
      const ids = matched.map(s => s.id);
      const ph  = ids.map(() => '?').join(',');
      [doctors] = await db.query(
        `SELECT d.*, s.name AS specialization_name, s.icon, h.name AS hospital_name, h.city
         FROM   doctors d
         LEFT JOIN specializations s ON d.specialization_id = s.id
         LEFT JOIN hospitals       h ON d.hospital_id       = h.id
         WHERE  d.specialization_id IN (${ph}) AND d.status = 'active'
         ORDER BY d.rating DESC LIMIT 6`,
        ids
      );
    }

    res.json({
      success:                true,
      matched_specializations: matched,
      doctors,
      message: matched.length
        ? `Based on "${query}", we recommend consulting a ${matched.map(m => m.name).join(' or ')}`
        : 'No specific specialization matched. Consider a General Physician first.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Doctor Detail ──────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, s.name AS specialization_name, s.icon,
              h.name AS hospital_name, h.address AS hospital_address, h.city
       FROM   doctors d
       LEFT JOIN specializations s ON d.specialization_id = s.id
       LEFT JOIN hospitals       h ON d.hospital_id       = h.id
       WHERE  d.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const [reviews] = await db.query(
      `SELECT dr.*, u.name AS patient_name
       FROM   doctor_reviews dr
       JOIN   users u ON dr.user_id = u.id
       WHERE  dr.doctor_id = ?
       ORDER  BY dr.created_at DESC LIMIT 10`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], reviews } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Submit Review ──────────────────────────────────── */
router.post('/:id/review', async (req, res) => {
  try {
    const { user_id, rating, comment } = req.body;
    await db.query(
      'INSERT INTO doctor_reviews (doctor_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
      [req.params.id, user_id, rating, comment]
    );
    /* Recalculate averages */
    await db.query(
      `UPDATE doctors SET
         rating        = (SELECT AVG(rating)  FROM doctor_reviews WHERE doctor_id = ?),
         total_reviews = (SELECT COUNT(*)      FROM doctor_reviews WHERE doctor_id = ?)
       WHERE id = ?`,
      [req.params.id, req.params.id, req.params.id]
    );
    res.json({ success: true, message: 'Review submitted. Thank you!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
