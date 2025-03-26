/**
 * server.js
 * 
 * This is the main Express server file.
 * 1) Serves static files from public/ folder.
 * 2) Provides API endpoints for login and retrieving recalls from PostgreSQL.
 */

const express = require('express');
const path = require('path');
const { Pool } = require('pg');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON from requests (if needed)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure PostgreSQL connection
// You can set environment variables for production
// e.g. process.env.DB_USER, DB_HOST, DB_NAME, DB_PASS
const pool = new Pool({
  user: process.env.DB_USER || 'your_pg_user',
  host: process.env.DB_HOST || 'your_pg_host',
  database: process.env.DB_NAME || 'your_pg_database',
  password: process.env.DB_PASS || 'your_pg_password',
  port: 5432,
  ssl: false
});

/**
 * Default route:
 * If user directly visits '/', we redirect them to 'login.html'
 * or you can show index if you prefer. Let's keep login as main entry.
 */
app.get('/', (req, res) => {
  // If you want to show index by default, just do:
  // res.sendFile(path.join(__dirname, 'public', 'index.html'));
  res.redirect('/login.html');
});

/**
 * POST /api/login
 * Very simple login logic: only accepts admin/admin as credentials.
 * On success, redirect to index.html. On failure, return an error message.
 */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === 'admin') {
    return res.redirect('/index.html');
  } else {
    return res.redirect('/login.html?error=true');
  }
});


/**
 * GET /api/recalls
 * Fetch all recall records from PostgreSQL and return as JSON.
 */
app.get('/api/recalls', async (req, res) => {
  try {
    // Adjust columns as needed for your data
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

    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recalls:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Start listening on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
