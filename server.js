/**
 * server.js (Azure with PostgreSQL)
 * - Secure session
 * - Serve frontend
 * - Reuse the pool from db.js
 * - Keep all existing Recalls endpoints intact
 * - Add new endpoints for Listings & Violations to meet Sprint 2
 */

process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
});

console.log('✅ App starting...');

const express = require('express');
const path = require('path');
const session = require('express-session');
const pool = require('./config/db'); // <--- import from db.js

const app = express();
const PORT = process.env.PORT || 8080;

// === Debug ===
console.log('🔍 Running server.js, using external db.js pool');

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'cpsc-secret-key',
  resave: false,
  saveUninitialized: true,
}));


// === Public Routes  ===
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT "Username", "Role", "Name" FROM public."Users" 
       WHERE "Username" = $1 AND "Password" = $2`,
      [username, password]
    );

    if (result.rows.length === 1) {
      const user = result.rows[0];
      return res.json({
        success: true,
        name: user.Name,
        role: user.Role,
        username: user.Username
      });
    } else {
      return res.json({ success: false, error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// === Auth Protection (existing) ===
app.use((req, res, next) => {
  const isPublic = req.path === '/login.html' || req.path === '/api/login';
  const isAsset = req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.startsWith('/assets');
  if (isPublic || isAsset) return next();
  if (req.path.endsWith('.html') && !req.session.loggedIn) {
    return res.redirect('/login.html');
  }
  next();
});

// === Static Files (existing) ===
app.use(express.static(path.join(__dirname, 'public')));

// === Existing Recall Endpoints ===

// 1) POST /api/import
app.post('/api/import', async (req, res) => {
  const {
    Recall_ID,
    Recall_Number,
    Recall_Date,
    Product_Name,
    Product_Type,
    Category,
    URL,
    Manufacturer
  } = req.body;

  if (!Recall_ID || !Recall_Number || !Recall_Date || !Product_Name
      || !Product_Type || !Category || !URL || !Manufacturer) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (new Date(Recall_Date) > new Date()) {
    return res.status(400).json({ error: 'Recall date cannot be in the future.' });
  }

  try {
    await pool.query(`
      INSERT INTO public."Recalls"
      ("Recall_ID","Recall_Number","Recall_Date","Product_Name","Product_Type",
       "Category","Priority_Status","URL","Manufacturer")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      Recall_ID,
      Recall_Number,
      Recall_Date,
      Product_Name,
      Product_Type,
      Category,
      false,
      URL,
      Manufacturer
    ]);
    res.json({ message: 'Recall imported successfully' });
  } catch (err) {
    console.error('[IMPORT ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// 2) POST /api/shortlist
app.post('/api/shortlist', async (req, res) => {
  const selectedRecalls = req.body.selectedRecalls;
  if (!Array.isArray(selectedRecalls) 
      || selectedRecalls.length < 3
      || selectedRecalls.length > 5) {
    return res.status(400).json({ error: 'You must select 3 to 5 recalls.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const id of selectedRecalls) {
      await client.query(`
        UPDATE public."Recalls"
        SET "Priority_Status" = true
        WHERE "Recall_ID" = $1
      `, [id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Recalls successfully shortlisted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 3) GET /api/recalls
app.get('/api/recalls', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "Recall_ID","Recall_Number","Recall_Date","Product_Name","Product_Type",
             "Category","Priority_Status","URL","Manufacturer"
      FROM public."Recalls"
      ORDER BY "Recall_Date" DESC
      LIMIT 100
    `);
    console.log(`[DB] Loaded ${result.rows.length} rows`);
    res.json(result.rows);
  } catch (err) {
    console.error('[DB ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// === DB Health Check (existing) ===
app.get('/api/db-check', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === NEW: Listings & Violations APIs ===


// GET /api/violations
app.get('/api/violations', async (req, res) => {
  try {
    const sql = `
      SELECT
        "violation_id","listing_id","date_flagged","investigator_name",
        "violation_outcome","alert_sent","alert_type","alert_sent_date"
      FROM public."Violations"
      ORDER BY "date_flagged" DESC
      LIMIT 100
    `;
    const result = await pool.query(sql);
    return res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/violations ERROR]', err);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/violations/:id
app.patch('/api/violations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, investigator_name } = req.body;
    if (!outcome) {
      return res.status(400).json({ error: 'missing outcome' });
    }

    await pool.query(`
      UPDATE public."Violations"
      SET "violation_outcome" = $1,
          "investigator_name" = COALESCE($2,'Unknown'),
          "alert_sent" = CASE WHEN $1='True Positive' THEN true ELSE false END,
          "alert_type" = CASE WHEN $1='True Positive' THEN 'High Risk Seller' ELSE null END,
          "alert_sent_date" = CASE WHEN $1='True Positive' THEN NOW() ELSE null END
      WHERE "violation_id" = $3
    `, [ outcome, investigator_name || null, id ]);

    return res.json({ message: 'Violation annotated successfully' });
  } catch (err) {
    console.error('[PATCH /api/violations/:id ERROR]', err);
    return res.status(500).json({ error: err.message });
  }
});

// === Start Server (existing) ===
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

// Redirect "/" to login page
app.get('/', (req, res) => {
  if (req.session && req.session.loggedIn && req.session.role === 'Manager') {
    res.redirect('/manager-dashboard.html');
  } else if (req.session && req.session.loggedIn && req.session.role === 'Investigator') {
    res.redirect('/investigator-dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

