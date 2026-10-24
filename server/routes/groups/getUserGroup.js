const express = require("express");
const pool = require("../../db");
const router = express.Router()

// Every group the user is a member of, alphabetical by name.
router.get('/:userId', async (req, res) => {
    const { userId } = req.params

    try {
        const result = await pool.query(
            `select g.*
             from public.group_members gm
             join public.groups g on g.id = gm.group_id
             where gm.user_id = $1
             order by g.name asc`,
            [userId]
        );
        return res.status(200).json({ groups: result.rows })
    } catch (err) {
        console.log(err)
        return res.status(500).json({error: "Database Error", details: err})
    }
});

module.exports = router;
