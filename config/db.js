// config/db.js
const { Pool } = require('pg');

const pool = new Pool({
    host: 'team6.postgres.database.azure.com',
    user: 'admin1',
    password: 'BIT4454!',
    database: 'Recalls',
    port: 5432,
    ssl: { rejectUnauthorized: false }
  });

module.exports = pool;
