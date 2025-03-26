// routes/auth.js
// English code + comments

const express = require("express");
const router = express.Router();

// Hard-coded user for demonstration
const mockUser = {
  username: "manager",
  password: "12345"
};

// POST /api/login
router.post("/login", (req, res)=>{
  const { username, password } = req.body;
  // Validate credentials
  if (username === mockUser.username && password === mockUser.password){
    // Set session
    req.session.user = { username, role: "Manager" };
    return res.redirect("/recalls.html");
  } else {
    // Invalid
    return res.status(401).send(`
      <script>
        alert("Invalid login credentials");
        window.location.href="/login.html";
      </script>
    `);
  }
});

module.exports = router;
