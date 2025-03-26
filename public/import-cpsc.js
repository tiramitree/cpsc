// import-cpsc.js
// Automated recall importer with high-priority email alerts

const axios = require('axios');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

// PostgreSQL connection
const pool = new Pool({
  user: 'your_pg_user',
  host: 'your_pg_host',
  database: 'your_pg_database',
  password: 'your_pg_password',
  port: 5432,
  ssl: false // 如果你的部署要求 SSL，请设为 true
});

// Email setup - Gmail SMTP or use SendGrid, Mailgun, etc.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your_email@gmail.com',
    pass: 'your_app_password' // 使用应用专用密码，不要用真实密码
  }
});

// Send alert for high-priority recalls
async function sendHighPriorityEmail(recall) {
  const subject = `🚨 New High-Priority Recall: ${recall.Name} – ${recall.Description.slice(0, 40)}...`;

  const htmlContent = `
    <h2>🚨 High-Priority Recall Imported</h2>
    <p><strong>Product:</strong> ${recall.Name}</p>
    <p><strong>Manufacturer:</strong> ${recall.Manufacturer || 'N/A'}</p>
    <p><strong>Recall Date:</strong> ${recall.RecallDate}</p>
    <p><strong>Hazard:</strong> ${recall.Description}</p>
    <p><a href="${recall.URL}" target="_blank">🔗 View Full Recall</a></p>
  `;

  const mailOptions = {
    from: '"CPSC Recall Bot" <your_email@gmail.com>',
    to: 'manager@cpsc.gov',
    subject: subject,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SENT] RecallID ${recall.RecallID} - Message ID: ${info.messageId}`);
  } catch (err) {
    console.error(`[EMAIL FAILED] RecallID ${recall.RecallID} - ${err.message}`);
  }
}

// Import recall data
async function importRecalls() {
  try {
    const { data } = await axios.get('https://www.saferproducts.gov/RestWebServices/Recall?format=json');

    let count = 0;
    for (const item of data) {
      // Filter recent years only
      if (!item.RecallDate || parseInt(item.RecallDate.slice(0, 4)) < 2023) continue;

      const recallID = item.RecallID.toString();

      // Check for existing recall
      const exists = await pool.query('SELECT 1 FROM recalls WHERE "RecallID" = $1', [recallID]);
      if (exists.rows.length > 0) continue;

      // Prepare fields
      const product = item.Products?.[0] || {};
      const NumberOfUnits = parseInt((product.NumberOfUnits || '0').replace(/[^\d]/g, '')) || 0;

      // Default PriorityLevel = 'Low' unless explicitly provided
      const priority = item.PriorityLevel?.toLowerCase() === 'high' ? 'High' : 'Low';

      await pool.query(`
        INSERT INTO recalls (
          "RecallID", "RecallNumber", "RecallDate", "Description", "URL", "Title",
          "ConsumerContact", "LastPublishDate", "Name", "Model", "Type", "CategoryID",
          "NumberOfUnits", "ShortlistedFlag", "PriorityLevel"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,$15)
      `, [
        recallID,
        item.RecallNumber || '',
        item.RecallDate || null,
        item.Description || '',
        item.URL || '',
        item.Title || '',
        item.ConsumerContact || '',
        item.LastPublishDate || null,
        product.Name || '',
        product.Model || '',
        product.Type || '',
        product.CategoryID || '',
        NumberOfUnits,
        priority
      ]);

      count++;

      // Trigger email if high priority
      if (priority === 'High') {
        await sendHighPriorityEmail({
          RecallID: recallID,
          Name: product.Name || '(Unknown)',
          Manufacturer: product.Manufacturer || '',
          RecallDate: item.RecallDate,
          Description: item.Description,
          URL: item.URL
        });
      }
    }

    console.log(`[IMPORT COMPLETE] Total new records inserted: ${count}`);
  } catch (err) {
    console.error('[IMPORT ERROR]', err.message);
  } finally {
    pool.end();
  }
}

importRecalls();
