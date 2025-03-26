// server.js
// English code + comments

"use strict";

const express = require("express");
const session = require("express-session");
const path = require("path");
const authRoutes = require("./routes/auth");
const recallsRoutes = require("./routes/recalls");
const app = express();

// Use body-parser-like
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup session
app.use(session({
  secret: "cpsc-secret",
  resave: false,
  saveUninitialized: false
}));

// Serve static files from "public"
app.use(express.static(path.join(__dirname, "public")));

// Mount routes
app.use("/api", authRoutes);
app.use("/api", recallsRoutes);

// Simple authentication middleware
function authMiddleware(req, res, next) {
  if(!req.session.user){
    return res.redirect("/login.html");
  }
  next();
}

// Example protected route
app.get("/protected", authMiddleware, (req, res)=>{
  res.send("You are authorized");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> {
  console.log("Server running on port", PORT);
});
