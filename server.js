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

      req.session.user = {
        Username: user.Username,
        Role: user.Role,
        Name: user.Name
      };

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
// 4) POST /api/import-listing
app.post('/api/import-listing', async (req, res) => {
  const {
    Listing_ID,
    Product_Name,
    Listing_Date,
    Price,
    Category,
    URL,
    Seller_ID,
    Marketplace_ID
  } = req.body;

  if (!Listing_ID || !Product_Name || !Listing_Date || !Price ||
      !Category || !URL || !Seller_ID || !Marketplace_ID) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (new Date(Listing_Date) > new Date()) {
    return res.status(400).json({ error: 'Listing date cannot be in the future.' });
  }

  try {
    await pool.query(`
      INSERT INTO public."Listings"
      ("Listing_ID", "Product_Name", "Listing_Date", "Price", "Category",
       "URL", "Seller_ID", "Marketplace_ID", "Violation")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
    `, [
      Listing_ID,
      Product_Name,
      Listing_Date,
      Price,
      Category,
      URL,
      Seller_ID,
      Marketplace_ID
    ]);

    res.json({ message: 'Listing successfully imported!' });
  } catch (err) {
    console.error('[IMPORT LISTING ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});



// === 5) Violations Endpoints

// GET Violations
app.get('/api/violations', async (req, res) => {
  try {
    const sql = `
      SELECT
        "Violation_ID",
        "Listing_ID",
        "Product_Name",
        "Investigator_Name",
        "Date_Flagged",
        "Violation_Status",
        "Alert_Sent",
        "Alert_Type",
        "Alert_Date",
        "Reasoning"
      FROM "Violations"
      ORDER BY "Violation_ID" DESC
      LIMIT 100
    `;
    const result = await pool.query(sql);
    // Return the rows directly or wrap in { success: true, data: result.rows }
    return res.json(result.rows);
  } catch (err) {
    console.error('[GET /api/violations ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH (Update) a specific Violation
app.patch('/api/violations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, reasoning } = req.body;

    if (!outcome || !reasoning) {
      return res.status(400).json({ error: 'Missing outcome or reasoning.' });
    }

    const investigator_name = req.body.name || req.session?.user?.Name || 'Unknown';

    await pool.query(`
      UPDATE public."Violations"
      SET
        "Violation_Status" = $1,
        "Investigator_Name" = $2,
        "Alert_Sent" = CASE WHEN $1 = 'True Positive' THEN true ELSE false END,
        "Alert_Type" = CASE WHEN $1 = 'True Positive' THEN 'Initial Notice' ELSE NULL END,
        "Alert_Date" = CASE WHEN $1 = 'True Positive' THEN NOW() ELSE NULL END,
        "Reasoning" = $3
      WHERE "Violation_ID" = $4
    `, [outcome, investigator_name, reasoning, id]);

    res.json({ message: 'Violation annotated successfully' });
  } catch (err) {
    console.error('[PATCH /api/violations/:id ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});


// === 6) Manual Run-Matching Endpoint
async function runMatchingNow() {
  // 1) Load Recalls
  const recallRes = await pool.query(`
    SELECT "Product_Name", "Manufacturer"
    FROM public."Recalls"
    ORDER BY "Recall_Date" DESC
    LIMIT 500
  `);
  const recalls = recallRes.rows;

  // 2) Load recent Listings
  const listRes = await pool.query(`
    SELECT "Listing_ID", "Product_Name"
    FROM public."Listings"
    WHERE "Listing_Date" >= NOW() - interval '30 days'
  `);
  const listings = listRes.rows;

  let inserted = 0;

  // 3) Compare listings vs recalls by Product_Name only (ignore Recall_ID)
  for (const listing of listings) {
    const listingName = listing["Product_Name"]?.toLowerCase().trim() || '';

    for (const recall of recalls) {
      const recallName = recall["Product_Name"]?.toLowerCase().trim() || '';

      if (listingName === recallName && listingName !== '') {
        const existing = await pool.query(`
          SELECT 1 FROM public."Violations"
          WHERE "Listing_ID" = $1
        `, [listing["Listing_ID"]]);

        if (existing.rowCount === 0) {
          await pool.query(`
            INSERT INTO public."Violations"
            ("Listing_ID", "Date_Flagged", "Violation_Status", "Investigator_Name")
            VALUES ($1, CURRENT_DATE, false, $2)
          `, [
            listing["Listing_ID"],
           recall["Manufacturer"] || null
        ]);

          console.log(`[MATCHED] Inserted violation from Listing ${listing["Listing_ID"]}, ${recall["Manufacturer"]}`);
          inserted++;
        }
      }
    }
  }

  return inserted;
}

// runMatchingNow
app.post('/api/run-matching', async (req, res) => {
  try {
    const count = await runMatchingNow();
    return res.json({ success: true, inserted: count });
  } catch (err) {
    console.error('[RUN MATCHING ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =======================  Sprint-3 : Responses & Resolutions  ======================= */

const expressCase = { sensitive: false };   // support /Responses or /responses (case-insensitive)

/* ───────────── 1. Seller submits a response →  public."Responses" ───────────── */
app.post(['/api/Responses', '/api/responses'], expressCase, async (req, res) => {
  const {
    Violation_ID,
    Listing_ID,
    Seller_ID,
    Response_Text = '',
    Resolution_Type
  } = req.body;

  /* basic validation */
  if (!Violation_ID || !Listing_ID || !Seller_ID || !Resolution_Type || Response_Text.trim().length < 20) {
    return res.status(400).json({ error: 'Missing or invalid fields.' });
  }

  try {
    /* get original Alert_Date (may be null) */
    const { rows: vRows } = await pool.query(
      `SELECT "Alert_Date" FROM public."Violations" WHERE "Violation_ID"=$1 LIMIT 1`,
      [Violation_ID]
    );

    /* insert into Responses (columns per Attributes doc) */
    await pool.query(`
      INSERT INTO public."Responses"
        ("Violation_ID","Listing_ID","Seller_ID","Alert_Date",
         "Response_Text","Status","Resolution_Type","Response_Date")
      VALUES ($1,$2,$3,$4,$5,'Submitted',$6,NOW())
    `, [
      Violation_ID,
      Listing_ID,
      Seller_ID,
      vRows[0]?.Alert_Date || null,
      Response_Text.trim(),
      Resolution_Type
    ]);

    /* update violation status */
    await pool.query(`
      UPDATE public."Violations"
      SET "Violation_Status" = 'Response Submitted'
      WHERE "Violation_ID"   = $1
    `, [Violation_ID]);

    res.json({ message: 'Seller response recorded.' });
  } catch (err) {
    console.error('[POST /Responses]', err);
    res.status(500).json({ error: err.message });
  }
});

/* helper – return latest response for a given Violation (for Investigator page) */
app.get('/api/Violation/:id/SellerResponse', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT "Response_ID","Response_Text"
      FROM   public."Responses"
      WHERE  "Violation_ID" = $1
      ORDER  BY "Response_Date" DESC
      LIMIT  1
    `, [req.params.id]);
    res.json(rows[0] || {});
  } catch (err) {
    console.error('[GET SellerResponse]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───────────── 2. Investigator finalises →  public."Resolutions" ───────────── */
app.post(['/api/Resolutions', '/api/resolutions'], expressCase, async (req, res) => {
  const {
    Violation_ID,
    Response_ID,
    Investigator_ID,
    Status,               // Resolved | Unresolved
    Resolution_Reason,    // required if Resolved
    Seller_Response = '', // investigator may edit / attach
    Comments = ''
  } = req.body;

  /* validation rules from Requirements doc */
  if (!Violation_ID || !Response_ID || !Investigator_ID || !Status || !Comments.trim()) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (Status === 'Resolved' && !Resolution_Reason) {
    return res.status(400).json({ error: 'Resolution_Reason required when Status = Resolved.' });
  }

  try {
    /* insert into Resolutions (all 10 columns) */
    await pool.query(`
      INSERT INTO public."Resolutions"
        ("Response_ID","Investigator_ID","Status","Resolution_Date",
         "Violation_ID","Resolution_Reason","Seller_Response",
         "Comments","Resolution_Type")
      VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$5)
    `, [
      Response_ID,
      Investigator_ID,
      Status,
      Violation_ID,
      Resolution_Reason || null,
      Seller_Response.trim(),
      Comments.trim()
    ]);

    /* sync Violations current status */
    await pool.query(`
      UPDATE public."Violations"
      SET "Violation_Status" = $2
      WHERE "Violation_ID"   = $1
    `, [Violation_ID, Status]);

    res.json({ message: 'Resolution saved.' });
  } catch (err) {
    console.error('[POST /Resolutions]', err);
    res.status(500).json({ error: err.message });
  }
});

/* =======================  End Sprint-3 block  ======================= */

/* ----------  helper lists for test-db.html  ---------- */
app.get(['/api/Responses', '/api/responses'], async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM public."Responses"
      ORDER BY "Response_Date" DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    console.error('[GET /Responses]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/Resolutions', '/api/resolutions'], async (_, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM public."Resolutions"
      ORDER BY "Resolution_Date" DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    console.error('[GET /Resolutions]', err);
    res.status(500).json({ error: err.message });
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
