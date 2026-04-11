/* =====================================================
   Healthcare+  ·  MySQL Connection Pool
   ===================================================== */
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT) || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'healthcare_plus',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  timezone:         '+05:30',   // IST
});

/* Test connection on startup */
pool.getConnection()
  .then(conn => {
    console.log('✅  MySQL connected →', process.env.DB_NAME || 'healthcare_plus');
    conn.release();
  })
  .catch(err => {
    console.error('❌  MySQL connection error:', err.message);
    console.error('    Check your .env DB_* variables and ensure MySQL is running.');
  });

module.exports = pool;
