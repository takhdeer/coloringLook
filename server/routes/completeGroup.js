const express = require("express");
const pool = require("../db");
const router = express.Router();
const { GameError } = require('../lib/groupGame');
const { saveUserColors, updateGroupProgress } = require('../lib/gameLogic');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// A colour's score of 100 fills in all of its cells (colorFill.js)
const FULL_SCORE = 100;

// POST /api/completeGroup/:groupId
// A testing shortcut: fills in the whole picture by raising every colour's score in the group to
// at least 100 (higher scores are kept), then updates each member's total and the group's progress
// the same way /api/score does. Turned off when NODE_ENV is 'production'.
//   200 { groupProgress }
router.post('/:groupId', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: "Not found" });
    }
    const groupId = String(req.params.groupId ?? '').toLowerCase();
    if (!UUID.test(groupId)) {
        return res.status(400).json({ message: "groupId must be a uuid" });
    }

    try {
        const members = await pool.query(
            'select user_id from public.group_members where group_id = $1', [groupId]
        );
        if (members.rowCount === 0) {
            return res.status(409).json({ message: "This book has no members to colour it in" });
        }
        // Makes sure every member has a user_colors row for each colour they own
        for (const { user_id } of members.rows) {
            await saveUserColors(groupId, user_id);
        }

        const client = await pool.connect();
        try {
            await client.query('begin');

            await client.query(
                `update public.user_colors
                 set score = greatest(coalesce(score, 0), $2)
                 where group_id = $1`,
                [groupId, FULL_SCORE]
            );
            await client.query(
                `update public.group_members m
                 set score = (select coalesce(sum(score), 0)::int
                              from public.user_colors c
                              where c.group_id = m.group_id and c.user_id = m.user_id)
                 where m.group_id = $1`,
                [groupId]
            );
            const groupProgress = await updateGroupProgress(client, groupId);

            await client.query('commit');
            return res.status(200).json({ groupProgress });
        } catch (err) {
            await client.query('rollback').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        if (err instanceof GameError) {
            return res.status(err.status).json({ message: err.message, ...err.extra });
        }
        console.log(err);
        return res.status(500).json({ message: "Error completing the picture" });
    }
});

module.exports = router;
