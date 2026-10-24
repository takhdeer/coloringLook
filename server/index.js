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
const loginRoute = require('./routes/login')
const createGroup = require('./routes/groups/createGroup')
const deleteGroup = require('./routes/groups/deleteGroup')
const leaderboard = require('./routes/groups/leaderboard')


// Endpoints
app.use('/api/register', registerRoute);
app.use('/api/login', loginRoute);
app.use('/api/createGroup', createGroup);
app.use('/api/deleteGroup', deleteGroup);
app.use('/api/leaderboard', leaderboard);

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