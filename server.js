/**
 * server.js (Azure with PostgreSQL)
 * - Secure session
 * - Serve frontend
 * - PostgreSQL via environment variable
 */
process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
});

console.log('✅ App starting...');

const express = require('express');
const path = require('path');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8080;

// === Debug: 输出连接字符串看是否读取成功 ===
console.log('🔍 POSTGRES_CONN_STRING:', process.env.POSTGRES_CONN_STRING);

// === DB Connection ===
const pool = new Pool({
  host: 'team6.postgres.database.azure.com',
  user: 'admin1',
  password: 'BIT4454!',
  database: 'Recalls',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'cpsc-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// === Login Endpoint ===
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    req.session.loggedIn = true;
    res.redirect('/index.html');
  } else {
    res.redirect('/login.html?error=true');
  }
});

// === Public Routes ===
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// === Auth Protection ===
app.use((req, res, next) => {
  const isPublic = req.path === '/login.html' || req.path === '/api/login';
  const isAsset = req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.startsWith('/assets');
  if (isPublic || isAsset) return next();
  if (req.path.endsWith('.html') && !req.session.loggedIn) return res.redirect('/login.html');
  next();
});

// === Static Files ===
app.use(express.static(path.join(__dirname, 'public')));

// === API Routes ===
// === Import Recall Endpoint ===
app.post('/api/import', async (req, res) => {
  const {
    Recall_ID,
    Recall_Number,
    Recall_Date,
    Product_Name,
    Product_Type,
    Category,
    Priority_Status,
    URL
  } = req.body;

  if (!Recall_ID || !Recall_Number || !Recall_Date || !Product_Name || !Product_Type ||
      !Category || !Priority_Status || !URL) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (new Date(Recall_Date) > new Date()) {
    return res.status(400).json({ error: 'Recall date cannot be in the future.' });
  }

  try {
    await pool.query(`
      INSERT INTO public."Recalls" 
      ("Recall_ID", "Recall_Number", "Recall_Date", "Product_Name", "Product_Type", "Category", "Priority_Status", "URL", "ShortlistedFlag")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)
    `, [
      Recall_ID,
      Recall_Number,
      Recall_Date,
      Product_Name,
      Product_Type,
      Category,
      Priority_Status,
      URL
    ]);

    res.json({ message: 'Recall imported successfully' });
  } catch (err) {
    console.error('[IMPORT ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// === Shortlist Selected Recalls ===
app.post('/api/shortlist', async (req, res) => {
  const selectedRecalls = req.body.selectedRecalls;
  if (!Array.isArray(selectedRecalls) || selectedRecalls.length < 3 || selectedRecalls.length > 5) {
    return res.status(400).json({ error: 'You must select 3 to 5 recalls.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const id of selectedRecalls) {
      await client.query(`
        UPDATE public."Recalls"
        SET "ShortlistedFlag" = TRUE
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

app.get('/api/recalls', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "Recall_ID", "Recall_Number", "Recall_Date",
             "Product_Name", "Product_Type", "Category", "Priority_Status", "URL"
      FROM public."Recalls" ORDER BY "Recall_Date" DESC LIMIT 100;
    `);
    console.log(`[DB] Loaded ${result.rows.length} rows`);
    res.json(result.rows);
  } catch (err) {
    console.error('[DB ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/category', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "Category", COUNT(*) as count
      FROM public."Recalls" WHERE "Priority_Status" = 'High'
      GROUP BY "Category" ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/product-type', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "Product_Type", COUNT(*) as count
      FROM public."Recalls" GROUP BY "Product_Type" ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/by-month', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', "Recall_Date"), 'YYYY-MM') as month, COUNT(*) as count
      FROM public."Recalls" WHERE "Priority_Status" = 'High'
      GROUP BY month ORDER BY month
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === DB Health Check Endpoint ===
app.get('/api/db-check', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
