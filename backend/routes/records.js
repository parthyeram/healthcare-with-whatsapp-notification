/* =====================================================
   Healthcare+  ·  Records / Medicines / Hospitals Routes
   ─────────────────────────────────────────────────────
   Health Records
     GET    /api/health-records/user/:userId
     POST   /api/health-records         (multipart)
     DELETE /api/health-records/:id

   Medicines
     GET    /api/medicines/user/:userId
     POST   /api/medicines
     PUT    /api/medicines/:id
     DELETE /api/medicines/:id

   Hospitals
     GET    /api/hospitals
   ===================================================== */
const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');
const multer  = require('multer');
const path    = require('path');
const { v4: uuid } = require('uuid');

/* ── Multer (image / PDF uploads) ───────────────────── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_PATH || './uploads'),
  filename:    (req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|dcm/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

/* ═══════════════════════════════════════════════════
   HEALTH RECORDS
═══════════════════════════════════════════════════ */
router.get('/health-records/user/:userId', async (req, res) => {
  try {
    const { type } = req.query;
    let q      = 'SELECT * FROM health_records WHERE user_id = ?';
    const params = [req.params.userId];
    if (type) { q += ' AND record_type = ?'; params.push(type); }
    q += ' ORDER BY created_at DESC';
    const [rows] = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/health-records', upload.single('image'), async (req, res) => {
  try {
    const { user_id, record_type, title, description, doctor_name, hospital_name, record_date, tags } = req.body;
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    const [result] = await db.query(
      'INSERT INTO health_records (user_id, record_type, title, description, doctor_name, hospital_name, record_date, image_path, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, record_type, title, description || null, doctor_name || null, hospital_name || null, record_date || null, image_path, tags || null]
    );
    res.status(201).json({ success: true, message: 'Health record saved', id: result.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/health-records/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM health_records WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Record deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

/* ═══════════════════════════════════════════════════
   MEDICINES
═══════════════════════════════════════════════════ */
router.get('/medicines/user/:userId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM medicines WHERE user_id = ? ORDER BY created_at DESC', [req.params.userId]);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/medicines', async (req, res) => {
  try {
    const { user_id, name, dosage, frequency, timing, start_date, end_date, prescribed_by, notes, stock_count } = req.body;
    const [result] = await db.query(
      'INSERT INTO medicines (user_id, name, dosage, frequency, timing, start_date, end_date, prescribed_by, notes, stock_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, name, dosage || null, frequency || null, timing || null, start_date || null, end_date || null, prescribed_by || null, notes || null, stock_count || 0]
    );
    res.status(201).json({ success: true, message: 'Medicine added', id: result.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/medicines/:id', async (req, res) => {
  try {
    const { stock_count, status, notes } = req.body;
    await db.query('UPDATE medicines SET stock_count = ?, status = ?, notes = ? WHERE id = ?',
      [stock_count ?? 0, status || 'active', notes || null, req.params.id]);
    res.json({ success: true, message: 'Medicine updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/medicines/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM medicines WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Medicine removed' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

/* ═══════════════════════════════════════════════════
   HOSPITALS
═══════════════════════════════════════════════════ */
router.get('/hospitals', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM hospitals WHERE status = 'active' ORDER BY rating DESC");
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
