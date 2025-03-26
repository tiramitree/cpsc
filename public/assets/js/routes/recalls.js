// routes/recalls.js
// English code + comments

const express = require("express");
const router = express.Router();
const pool = require("../scripts/db"); // We'll create db.js that exports a PG pool

// POST /api/import => import a single recall from form
router.post("/import", async (req, res)=>{
  try {
    const {
      RecallID, RecallNumber, RecallDate, Description,
      URL, Title, ConsumerContact, LastPublishDate,
      Name, Model, Type, CategoryID, NumberOfUnits
    } = req.body;

    // Minimal validation
    if(!RecallID) {
      return res.status(400).send("RecallID is required");
    }

    // Insert or update
    const query = `
      INSERT INTO recalls (
        "RecallID","RecallNumber","RecallDate","Description","URL","Title",
        "ConsumerContact","LastPublishDate","Name","Model","Type","CategoryID","NumberOfUnits"
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
      Name, Model, Type, CategoryID,
      NumberOfUnits || 0
    ]);

    return res.send(`
      <script>
        alert("Recall imported successfully");
        window.location.href="/recalls.html";
      </script>
    `);
  } catch (err) {
    console.error("Import error:", err);
    return res.status(500).send("Server error");
  }
});

// POST /api/shortlist => manager selects 3-5 recalls
router.post("/shortlist", async (req, res)=>{
  try {
    // selectedRecalls is array from checkboxes
    let selected = req.body.selectedRecalls;
    if(!selected){
      return res.status(400).send("No recalls selected");
    }
    // If only one item, it might be string not array
    if(!Array.isArray(selected)){
      selected = [selected];
    }
    if(selected.length < 3 || selected.length > 5){
      return res.status(400).send(`
        <script>
          alert("Must select between 3 and 5 recalls");
          window.history.back();
        </script>
      `);
    }
    // Update flagged
    for(const rid of selected){
      await pool.query(`UPDATE recalls SET "ShortlistedFlag"=true WHERE "RecallID"=$1`, [rid]);
    }
    return res.send(`
      <script>
        alert("Recalls successfully shortlisted");
        window.location.href="/shortlist.html";
      </script>
    `);

  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

module.exports = router;
