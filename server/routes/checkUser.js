const express = require("express");
const pool = require("../db");
const router = express.Router();

// GET /api/checkUser/:username
// Whether a username is registered in public.users. The match is exact, like the unique
// username check in register. Responds 200 { username, valid, userId } (userId is null when not valid).
router.get('/:username', async (req, res) => {
    const username = req.params.username.trim();
    if (!username) {
        return res.status(400).json({ message: "Username is needed" });
    }

    try {
        const result = await pool.query('select id from public.users where username = $1', [username]);
        const valid = result.rowCount > 0;
        return res.status(200).json({ username, valid, userId: valid ? result.rows[0].id : null });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Database Error", details: err.message });
    }
});

module.exports = router;
