const express = require("express");
const pool = require("../db");
const router = express.Router();
const { GameError } = require('../lib/groupGame');
const { saveUserColors } = require('../lib/gameLogic');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// POST /api/userColors?userId=<uuid>&groupId=<uuid>
// Saves every colour the player owns in the group's picture to public.user_colors (score 0).
// Responds 201 { groupId, userId, colors } with the player's colours as '#rrggbb' (empty if none).
router.post('/', async (req, res) => {
    const userId = String(req.query.userId ?? '').toLowerCase();
    const groupId = String(req.query.groupId ?? '').toLowerCase();

    if (!UUID.test(userId) || !UUID.test(groupId)) {
        return res.status(400).json({ message: "userId and groupId must be uuids" });
    }

    try {
        const member = await pool.query(
            'select 1 from public.group_members where group_id = $1 and user_id = $2', [groupId, userId]
        );
        if (member.rowCount === 0) {
            return res.status(403).json({ message: "You're not in this book" });
        }

        const colors = await saveUserColors(groupId, userId);
        return res.status(201).json({ groupId, userId, colors });
    } catch (err) {
        if (err instanceof GameError) {
            return res.status(err.status).json({ message: err.message, ...err.extra });
        }
        console.log(err);
        return res.status(500).json({ error: "Database Error", details: err.message });
    }
});

module.exports = router;
