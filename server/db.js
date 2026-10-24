const { Pool } = require('pg');

// Database connection
const pool = new Pool ({
    connectionString: process.env.DATABASE_URL,
    ssl : { rejectUnauthorized: false }     // turn off cert verification
});

module.exports = pool;