const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'team6.postgres.database.azure.com',
  user: 'admin1',
  password: 'BIT4454!',
  database: 'Recalls',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function importRecalls() {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM public."Recalls";');
    console.log(`✅ Total records in recalls: ${result.rows[0].count}`);
  } catch (err) {
    console.error('[IMPORT ERROR]', err.message);
  } finally {
    await pool.end(); 
  }
}

importRecalls();
