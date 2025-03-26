const axios = require('axios');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

// Connect to Azure PostgreSQL
const pool = new Pool({
  connectionString: process.env.POSTGRES_CONN_STRING,
  ssl: { rejectUnauthorized: false }
});

// Email notifier
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your_email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your_app_password'
  }
});

async function sendHighPriorityEmail(recall) {
  const subject = `🚨 High Priority Recall: ${recall.Product_Name}`;
  const htmlContent = `
    <h3>🚨 New High Priority Recall</h3>
    <p><strong>Recall ID:</strong> ${recall.Recall_ID}</p>
    <p><strong>Product:</strong> ${recall.Product_Name}</p>
    <p><strong>Type:</strong> ${recall.Product_Type}</p>
    <p><strong>Category:</strong> ${recall.Category}</p>
    <p><strong>Date:</strong> ${recall.Recall_Date}</p>
    <p><a href="${recall.URL}" target="_blank">🔗 View Full Recall</a></p>
  `;

  await transporter.sendMail({
    from: '"CPSC Notifier" <your_email@gmail.com>',
    to: 'manager@cpsc.gov',
    subject,
    html: htmlContent
  });
}

async function importRecalls() {
  try {
    const { data } = await axios.get('https://www.saferproducts.gov/RestWebServices/Recall?format=json');
    let count = 0;

    for (const item of data) {
      if (!item.RecallDate || parseInt(item.RecallDate.slice(0, 4)) < 2023) continue;

      const recallID = item.RecallID.toString();
      const exists = await pool.query('SELECT 1 FROM recalls WHERE "Recall_ID" = $1', [recallID]);
      if (exists.rows.length > 0) continue;

      const product = item.Products?.[0] || {};
      const priority = item.PriorityLevel?.toLowerCase() === 'high' ? 'High' : 'Low';

      await pool.query(`
        INSERT INTO recalls (
          "Recall_ID",
          "Recall_Number",
          "Recall_Date",
          "Product_Name",
          "Product_Type",
          "Category",
          "Priority_Status",
          "URL"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        recallID,
        item.RecallNumber || '',
        item.RecallDate || null,
        product.Name || '',
        product.Type || '',
        product.CategoryID || '',
        priority,
        item.URL || ''
      ]);

      count++;

      if (priority === 'High') {
        await sendHighPriorityEmail({
          Recall_ID: recallID,
          Product_Name: product.Name || '(Unknown)',
          Product_Type: product.Type || '',
          Category: product.CategoryID || '',
          Recall_Date: item.RecallDate,
          URL: item.URL || ''
        });
      }
    }

    console.log(`[IMPORT COMPLETE] Inserted ${count} records`);
  } catch (err) {
    console.error('[IMPORT ERROR]', err.message);
  } finally {
    pool.end();
  }
}

importRecalls();
