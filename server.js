/**
 * server.js
 * 
 * 1. Protects all routes from unauthorized access
 * 2. Serves static files only after login
 * 3. Handles login + session + PostgreSQL + recalls API
 */

const express = require('express');
const path = require('path');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8080;

// Parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup session
app.use(session({
  secret: 'cpsc-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// PostgreSQL connection (Azure)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONN_STRING,
  ssl: { rejectUnauthorized: false }
});


// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    req.session.loggedIn = true;
    res.redirect('/index.html');
  } else {
    res.redirect('/login.html?error=true');
  }
});

// Public access for login only
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Redirect root to login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Middleware: Block HTML access unless logged in
app.use((req, res, next) => {
  const isPublic = (req.path === '/login.html' || req.path === '/api/login');
  const isAsset = req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.startsWith('/assets');

  if (isPublic || isAsset) return next();

  if (req.path.endsWith('.html') && !req.session.loggedIn) {
    return res.redirect('/login.html');
  }

  next();
});

// Serve static files (once authorized)
app.use(express.static(path.join(__dirname, 'public')));

/**
 * GET /api/recalls
 * Fetch up to 100 recall records from PostgreSQL and return as JSON.
 */
app.get('/api/recalls', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        "RecallID",
        "RecallNumber",
        "RecallDate",
        "Title",
        "ConsumerContact",
        "PriorityLevel",
        "URL",
        "LastPublishDate"
      FROM recalls
      ORDER BY "RecallDate" DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recalls:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
