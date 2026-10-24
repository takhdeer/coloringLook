require("dotenv").config({ path: __dirname + "/.env" });
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
const registerRoute = require('./routes/register');


// Endpoints
app.use('/api/register', registerRoute);

// Test endpoints 
app.get("/db-test", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS database_time");
    res.json({ connected: true, ...result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ connected: false, error: error.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});