const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONN_STRING,
  ssl: { rejectUnauthorized: false }
});

async function importRecalls() {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM recalls');
    console.log(`✅ Total records in recalls: ${result.rows[0].count}`);
  } catch (err) {
    console.error('[IMPORT ERROR]', err.message);
  } finally {
    await pool.end(); 
  }
}

importRecalls();
