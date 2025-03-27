/**
 * server.js (UPDATED FINAL)
 */

const express = require('express');
const path = require('path');
const session = require('express-session');
const { Pool } = require('pg');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// === DB CONNECTION CONFIG ===
const connectionString = process.env.POSTGRES_CONN_STRING;
console.log("📦 DB Connection String =", connectionString?.split('@')[1]); // 只打印地址部分避免暴露密码

let sslConfig = { rejectUnauthorized: false }; // fallback
const certPath = path.join(__dirname, 'DigiCertGlobalRootCA.crt.pem');
if (fs.existsSync(certPath)) {
  sslConfig = {
    ca: fs.readFileSync(certPath).toString(),
    rejectUnauthorized: true
  };
}

const pool = new Pool({
  connectionString,
  ssl: sslConfig
});

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'cpsc-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// === Login endpoint ===
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    req.session.loggedIn = true;
    res.redirect('/index.html');
  } else {
    res.redirect('/login.html?error=true');
  }
});

// === Public routes ===
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/', (req, res) => res.redirect('/login.html'));

// === HTML route protection ===
app.use((req, res, next) => {
  const isPublic = req.path === '/login.html' || req.path === '/api/login';
  const isAsset = req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.startsWith('/assets');
  if (isPublic || isAsset) return next();
  if (req.path.endsWith('.html') && !req.session.loggedIn) return res.redirect('/login.html');
  next();
});

// === Static files ===
app.use(express.static(path.join(__dirname, 'public')));

// === API ROUTES ===

// Get latest 100 recalls
app.get('/api/recalls', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "Recall_ID", "Recall_Number", "Recall_Date",
             "Product_Name", "Product_Type", "Category", "Priority_Status", "URL"
      FROM recalls ORDER BY "Recall_Date" DESC LIMIT 100
    `);
    console.log(`[DB] Loaded ${result.rows.length} rows from Recalls`);
    res.json(result.rows);
  } catch (err) {
    console.error('[DB ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Accept selected recalls
app.post('/api/shortlist', async (req, res) => {
  const ids = req.body.selectedRecalls || [];
  try {
    for (const id of Array.isArray(ids) ? ids : [ids]) {
      await pool.query('UPDATE recalls SET "Priority_Status" = $1 WHERE "Recall_ID" = $2', ['High', id]);
    }
    res.redirect('/shortlist.html');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports - Category
app.get('/api/reports/category', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "Category", COUNT(*) as count
      FROM recalls
      WHERE "Priority_Status" = 'High'
      GROUP BY "Category"
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports - Product Type
app.get('/api/reports/product-type', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "Product_Type", COUNT(*) as count
      FROM recalls
      GROUP BY "Product_Type"
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports - By Month
app.get('/api/reports/by-month', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', "Recall_Date"), 'YYYY-MM') as month, COUNT(*) as count
      FROM recalls
      WHERE "Priority_Status" = 'High'
      GROUP BY month
      ORDER BY month
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Test DB Connection ===
app.get('/api/db-check', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      time: result.rows[0].now,
      message: '✅ Connected to PostgreSQL successfully!'
    });
  } catch (err) {
    console.error('[DB CHECK ERROR]', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
