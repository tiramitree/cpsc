// daily-import-listings.js
// For daily scheduled import from eBay (or other) APIs
// in synergy with server.js, but no changes to server.js are required

const pool = require('../config/db'); 
 // same connection

 const { getAccessToken } = require('../config/ebay-oauth');
 const axios = require('axios');
 
 async function fetchFromEbayAPI() {
   const token = await getAccessToken();
 
   const res = await axios.get('https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=tv&limit=5', {
     headers: {
       Authorization: `Bearer ${token}`
     }
   });
 
   const items = res.data.itemSummaries;
 
   return items.map(item => ({
    listing_id: item.itemId,
    product_name: item.title,
    product_id: null,
    seller_id: item.seller?.username || 'Unknown',
    platform: item.marketplaceId || 'eBay',
    category: item.categoryId || 'Other',
    listing_date: item.itemCreationDate || new Date().toISOString(),
    price: item.price?.value || null,
    url: item.itemWebUrl || '',
  }));
  
 }
 

async function dailyImportListings() {
  console.log('[daily-import-listings] Starting import...');
  try {
    const items = await fetchFromEbayAPI();
    let count = 0;
    for (const it of items) {
      const check = await pool.query(`
        SELECT 1 FROM public."Listings" 
         WHERE "listing_id" = $1
      `, [it.listing_id]);
      if (check.rowCount === 0) {
        await pool.query(`
          INSERT INTO public."Listings"
          ("listing_id","product_name","product_id","seller_id","platform","category","listing_date","price","url")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [
          it.listing_id, it.product_name, it.product_id, it.seller_id,
          it.platform, it.category, it.listing_date, it.price, it.url
        ]);
        count++;
      }
    }
    console.log(`[daily-import-listings] Inserted ${count} new items.`);
  } catch (err) {
    console.error('[daily-import-listings ERROR]', err);
  } finally {
    pool.end();
  }
}

if (require.main === module) {
  dailyImportListings().then(() => process.exit(0));
}

module.exports = { dailyImportListings };
