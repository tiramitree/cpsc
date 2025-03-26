/**
 * server.js
 * 
 * This is the main Express server file.
 * 1) Serves static files from public/ folder.
 * 2) Provides API endpoints for login and retrieving recalls from PostgreSQL.
 */

const express = require('express');
const path = require('path');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup session management
app.use(session({
  secret: 'cpsc-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'your_pg_user',
  host: process.env.DB_HOST || 'your_pg_host',
  database: process.env.DB_NAME || 'your_pg_database',
  password: process.env.DB_PASS || 'your_pg_password',
  port: 5432,
  ssl: process.env.DB_SSL === 'true' || false
});

// Redirect root to login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Login POST
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    req.session.loggedIn = true;
    res.redirect('/index.html');
  } else {
    res.redirect('/login.html?error=true');
  }
});

// Login check middleware for all protected routes
app.use((req, res, next) => {
  const publicFiles = ['/login.html', '/api/login'];
  if (publicFiles.includes(req.path) || req.path.startsWith('/assets') || req.path.endsWith('.css') || req.path.endsWith('.js')) {
    return next();
  }
  if (!req.session.loggedIn) {
    return res.redirect('/login.html');
  }
  next();
});

// Recalls data API
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

// Launch server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
