// scripts/import-cpsc.js
// English code + comments

"use strict";

const axios = require("axios");
const pool = require("./db");

async function importCPSC() {
  try {
    // Endpoint
    const url = "https://www.saferproducts.gov/RestWebServices/Recall?format=json";
    const resp = await axios.get(url);
    const data = resp.data; // This is an array of recall objects

    let count = 0;
    for(const item of data) {
      // Example filter: only import if date >= 2023
      let recallDateStr = item.RecallDate;
      if(!recallDateStr) continue;
      let year = parseInt(recallDateStr.substring(0,4),10);
      if(year < 2023) continue;

      // Prepare fields
      const RecallID = item.RecallID.toString(); // ensure string
      const RecallNumber = item.RecallNumber || null;
      const RecallDate = item.RecallDate || null;
      const Description = item.Description || null;
      const URL = item.URL || null;
      const Title = item.Title || null;
      const ConsumerContact = item.ConsumerContact || null;
      const LastPublishDate = item.LastPublishDate || null;

      // Suppose first product item
      let Name = null, Model = null, Type = null, CategoryID = null, NumberOfUnits = 0;
      if(item.Products && item.Products.length>0){
        const p = item.Products[0];
        Name = p.Name || null;
        Model = p.Model || null;
        Type = p.Type || null;
        CategoryID = p.CategoryID || null;
        // parse the number
        // if p.NumberOfUnits is "5,300", we parse out 5300
        if(p.NumberOfUnits){
          let pure = p.NumberOfUnits.replace(/[^\d]/g,"");
          NumberOfUnits = parseInt(pure,10) || 0;
        }
      }

      // Upsert into Postgres
      const query=`
        INSERT INTO recalls(
          "RecallID","RecallNumber","RecallDate","Description","URL","Title",
          "ConsumerContact","LastPublishDate","Name","Model","Type","CategoryID","NumberOfUnits"
        )
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT ("RecallID") DO UPDATE SET
          "RecallNumber"=EXCLUDED."RecallNumber",
          "RecallDate"=EXCLUDED."RecallDate",
          "Description"=EXCLUDED."Description",
          "URL"=EXCLUDED."URL",
          "Title"=EXCLUDED."Title",
          "ConsumerContact"=EXCLUDED."ConsumerContact",
          "LastPublishDate"=EXCLUDED."LastPublishDate",
          "Name"=EXCLUDED."Name",
          "Model"=EXCLUDED."Model",
          "Type"=EXCLUDED."Type",
          "CategoryID"=EXCLUDED."CategoryID",
          "NumberOfUnits"=EXCLUDED."NumberOfUnits"
      `;
      await pool.query(query, [
        RecallID, RecallNumber, RecallDate, Description,
        URL, Title, ConsumerContact, LastPublishDate,
        Name, Model, Type, CategoryID, NumberOfUnits
      ]);
      count++;
    }
    console.log(`Imported/Updated ${count} records from CPSC API.`);
  } catch(err){
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}

importCPSC();
