const express = require("express");
const pool = require("../../db");
const router = express.Router()

// Top 5 players in a group, highest score first.
// Assumes group_members has `score` (integer) and `colors` (text[] of hex codes).
router.get('/:groupId', async (req, res) => {
    const { groupId } = req.params

    try {
        const result = await pool.query(
            `select u.id, u.username, coalesce(gm.score, 0) as score, coalesce(gm.colors, '{}') as colors
             from public.group_members gm
             join public.users u on u.id = gm.user_id
             where gm.group_id = $1
             order by score desc, u.username asc
             limit 5`,
            [groupId]
        );
        return res.status(200).json({ players: result.rows })
    } catch (err) {
        console.log(err)
        return res.status(500).json({error: "Database Error", details: err})
    }
});

module.exports = router;
