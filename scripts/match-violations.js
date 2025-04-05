// match-violations.js
const pool = require('./config/db'); 

async function matchViolations() {
  console.log('[match-violations] Starting...');
  try {
    // 1) load Recalls
    const recallRes = await pool.query(`
      SELECT "Recall_ID","Product_Name","Category"
      FROM public."Recalls"
      ORDER BY "Recall_Date" DESC
      LIMIT 500
    `);
    const recalls = recallRes.rows;

    // 2) load new/unmatched listings
    // (Example: only last 30 days)
    const listRes = await pool.query(`
      SELECT "listing_id","product_name","category"
      FROM public."Listings"
      WHERE "listing_date" >= NOW() - interval '30 days'
    `);
    const listings = listRes.rows;

    let inserted = 0;
    for (const listing of listings) {
      for (const recall of recalls) {
        if (listing.category && recall.Category &&
            listing.category.toLowerCase() === recall.Category.toLowerCase()) {
          // e.g. if listing.product_name contains recall.Product_Name
          if (listing.product_name.toLowerCase()
              .includes(recall.Product_Name.toLowerCase())) {
            // check if already in Violations
            const check = await pool.query(`
              SELECT 1 FROM public."Violations"
              WHERE "listing_id" = $1
            `, [listing.listing_id]);
            if (check.rowCount === 0) {
              await pool.query(`
                INSERT INTO public."Violations"
                ("listing_id","date_flagged","violation_outcome")
                VALUES ($1, CURRENT_DATE, 'Pending')
              `, [listing.listing_id]);
              inserted++;
            }
          }
        }
      }
    }
    console.log(`[match-violations] Inserted ${inserted} new violation rows.`);
  } catch (err) {
    console.error('[match-violations ERROR]', err);
  } finally {
    pool.end();
  }
}

if (require.main === module) {
  matchViolations().then(() => process.exit(0));
}

module.exports = { matchViolations };
