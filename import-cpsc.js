const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_CONN_STRING;

let sslConfig = { rejectUnauthorized: false };
const certPath = path.join(__dirname, 'DigiCertGlobalRootCA.crt.pem');
if (fs.existsSync(certPath)) {
  sslConfig = {
    ca: fs.readFileSync(certPath).toString(),
    rejectUnauthorized: true
  };
}

const pool = new Pool({
  connectionString,
  ssl: sslConfig
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
