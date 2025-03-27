const fs = require('fs');
const { Client } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONN_STRING,
  ssl: { rejectUnauthorized: false }
});

async function importRecalls() {
  try {
    await conn.connect();
    console.log('Connected to Azure PostgreSQL');

    // Future use: fetch data from CPSC API and insert
    // (Preserved here, not running)
    // const axios = require('axios');
    // const { data } = await axios.get('https://www.saferproducts.gov/RestWebServices/Recall?format=json');

    const res = await conn.query('SELECT COUNT(*) FROM recalls');
    console.log(`✅ Total records in recalls: ${res.rows[0].count}`);

  } catch (err) {
    console.error('[IMPORT ERROR]', err.message);
  } finally {
    await conn.end();
  }
}

importRecalls();
