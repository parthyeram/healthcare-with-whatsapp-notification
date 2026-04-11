/* =====================================================
   Healthcare+  ·  Appointments Routes
   GET    /api/appointments/user/:userId
   GET    /api/appointments/slots/:doctorId?date=
   POST   /api/appointments
   PUT    /api/appointments/:id
   DELETE /api/appointments/:id   (soft cancel)
   ===================================================== */
const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

/* ── User's Appointments ────────────────────────────── */
router.get('/user/:userId', async (req, res) => {
  try {
    const { status } = req.query;
    let q      = `SELECT a.*,
                         d.name            AS doctor_name,
                         d.profile_image   AS doctor_image,
                         s.name            AS specialization,
                         s.icon,
                         h.name            AS hospital_name
                  FROM   appointments a
                  JOIN   doctors d        ON a.doctor_id   = d.id
                  LEFT JOIN specializations s ON d.specialization_id = s.id
                  LEFT JOIN hospitals     h  ON a.hospital_id = h.id
                  WHERE  a.patient_id = ?`;
    const params = [req.params.userId];
    if (status) { q += ' AND a.status = ?'; params.push(status); }
    q += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    const [rows] = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Available Slots ────────────────────────────────── */
router.get('/slots/:doctorId', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date query param is required' });

    const [docs] = await db.query(
      'SELECT available_from, available_to FROM doctors WHERE id = ?',
      [req.params.doctorId]
    );
    if (!docs.length) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const [booked] = await db.query(
      "SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status != 'cancelled'",
      [req.params.doctorId, date]
    );
    const bookedTimes = booked.map(b => b.appointment_time.substring(0, 5));

    /* Generate 30-min slots between available_from and available_to */
    const from    = docs[0].available_from || '09:00:00';
    const to      = docs[0].available_to   || '17:00:00';
    const current = new Date(`2000-01-01 ${from}`);
    const end     = new Date(`2000-01-01 ${to}`);
    const slots   = [];

    while (current < end) {
      const time = current.toTimeString().substring(0, 5);
      slots.push({ time, available: !bookedTimes.includes(time) });
      current.setMinutes(current.getMinutes() + 30);
    }

    res.json({ success: true, data: slots });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Book Appointment ───────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const { patient_id, doctor_id, hospital_id, appointment_date, appointment_time, reason } = req.body;

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time)
      return res.status(400).json({ success: false, message: 'patient_id, doctor_id, appointment_date and appointment_time are required' });

    /* Check slot availability */
    const [existing] = await db.query(
      "SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelled'",
      [doctor_id, appointment_date, appointment_time]
    );
    if (existing.length)
      return res.status(409).json({ success: false, message: 'This slot is already taken. Please choose another time.' });

    const [result] = await db.query(
      'INSERT INTO appointments (patient_id, doctor_id, hospital_id, appointment_date, appointment_time, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [patient_id, doctor_id, hospital_id || null, appointment_date, appointment_time, reason || null]
    );

    const [[appt]] = await db.query(
      `SELECT a.*, d.name AS doctor_name, s.name AS specialization, h.name AS hospital_name
       FROM   appointments a
       JOIN   doctors d        ON a.doctor_id         = d.id
       LEFT JOIN specializations s ON d.specialization_id = s.id
       LEFT JOIN hospitals     h  ON a.hospital_id       = h.id
       WHERE  a.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: 'Appointment booked!', data: appt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Update Appointment ─────────────────────────────── */
router.put('/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    await db.query('UPDATE appointments SET status = ?, notes = ? WHERE id = ?', [status, notes || null, req.params.id]);
    res.json({ success: true, message: 'Appointment updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Cancel Appointment ─────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    await db.query("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Appointment cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
