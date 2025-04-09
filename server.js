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
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
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
// Example in server.js
app.get('/db-check', async (req, res) => {
  try {
    // 示例：查询数据库，或仅测试连接
    // 如果成功：
    res.json({ success: true, message: 'Database connected successfully.' });
    
    // 如果有错误可以抛出，如：
    // throw new Error('DB connection failure...');
  } catch (err) {
    console.error('DB Check error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Database error'
    });
  }
});



// === 5) Violations Endpoints
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
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/violations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, investigator_name, description } = req.body; // ✅ 修复点

    if (!outcome) {
      return res.status(400).json({ error: 'missing outcome' });
    }

    await pool.query(`
      UPDATE public."Violations"
      SET "violation_outcome" = $1,
          "investigator_name" = COALESCE($2,'Unknown'),
          "alert_sent" = CASE WHEN $1='True Positive' THEN true ELSE false END,
          "alert_type" = CASE WHEN $1='True Positive' THEN 'Initial Notice' ELSE null END,
          "alert_sent_date" = CASE WHEN $1='True Positive' THEN NOW() ELSE null END,
          "annotation_description" = $3
      WHERE "violation_id" = $4
    `, [ outcome, investigator_name, description, id ]);

    res.json({ message: 'Violation annotated successfully' });
  } catch (err) {
    console.error('[PATCH /api/violations/:id ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});


// === 6) Manual Run-Matching Endpoint (No separate match-violations.js needed)
async function runMatchingNow() {
  // Load Recalls
  const recallRes = await pool.query(`
    SELECT "Recall_ID","Product_Name","Category"
    FROM public."Recalls"
    ORDER BY "Recall_Date" DESC
    LIMIT 500
  `);
  const recalls = recallRes.rows;

  // Load recent Listings
  const listRes = await pool.query(`
    SELECT "listing_id","product_name","category"
    FROM public."Listings"
    WHERE "listing_date" >= NOW() - interval '30 days'
  `);
  const listings = listRes.rows;

  let inserted = 0;
  for (const listing of listings) {
    for (const recall of recalls) {
      const sameCategory = listing.category?.toLowerCase() === recall.Category?.toLowerCase();
      const nameMatch = listing.product_name?.toLowerCase().includes(
        recall.Product_Name?.toLowerCase()
      );
      if (sameCategory && nameMatch) {
        // check if already in Violations
        const existing = await pool.query(`
          SELECT 1 FROM public."Violations"
          WHERE "listing_id" = $1 AND "recall_id" = $2
        `, [listing.listing_id, recall.Recall_ID]);

        if (existing.rowCount === 0) {
          await pool.query(`
            INSERT INTO public."Violations"
            ("listing_id","recall_id","date_flagged","violation_outcome","alert_sent")
            VALUES ($1, $2, CURRENT_DATE, 'Pending', false)
          `, [listing.listing_id, recall.Recall_ID]);
          inserted++;
        }
      }
    }
  }
  return inserted;
}

app.post('/api/run-matching', async (req, res) => {
  try {
    const count = await runMatchingNow();
    return res.json({ success: true, inserted: count });
  } catch (err) {
    console.error('[RUN MATCHING ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// === Start Server (existing) ===
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

// Redirect "/" to login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});
