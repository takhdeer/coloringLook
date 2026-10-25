const express = require("express");
const pool = require("../db");
const router = express.Router();
const { GameError, getGroupGrid } = require('../lib/groupGame');
const { saveUserColors, updateGroupProgress } = require('../lib/gameLogic');
const { comparePhotoColor } = require('../lib/pixelate');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// A colour's score of 100 fills in all of its cells (colorFill.js)
const FULL_SCORE = 100;
// With { leaveOne: true }, one colour stops here, so a few of its cells stay grey
const ALMOST_SCORE = 97;

// The colour leaveOne holds back: the biggest blue in the palette (palettes are ranked by area),
// using the same colour families as photo matching. Falls back to the biggest colour of all when
// the picture has no blue.
function pickLeftColor(palette) {
    const blue = comparePhotoColor('#0000ff', palette).find((c) => c.family === 'blue');
    return blue ? blue.color : palette[0];
}

// POST /api/completeGroup/:groupId
// A testing shortcut: fills in the whole picture by raising every colour's score in the group to
// at least 100 (higher scores are kept), then updates each member's total and the group's progress
// the same way /api/score does. Turned off when NODE_ENV is 'production'.
// Body { leaveOne: true } instead leaves the picture almost done: every colour but one goes to at
// least 100 and that one is set to exactly 97. That's the blue (see pickLeftColor). A colour with
// fewer than 17 cells rounds 97% up to all of them, so then the picture still comes out complete.
//   200 { groupProgress, leftColor }   leftColor is the colour set to 97, or null
router.post('/:groupId', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: "Not found" });
    }
    const groupId = String(req.params.groupId ?? '').toLowerCase();
    if (!UUID.test(groupId)) {
        return res.status(400).json({ message: "groupId must be a uuid" });
    }
    const leaveOne = req.body?.leaveOne === true;

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
        const leftColor = leaveOne ? pickLeftColor((await getGroupGrid(groupId)).palette) : null;

        const client = await pool.connect();
        try {
            await client.query('begin');

            await client.query(
                `update public.user_colors
                 set score = case when lower(color_id) = $3 then $4
                                  else greatest(coalesce(score, 0), $2) end
                 where group_id = $1`,
                [groupId, FULL_SCORE, leftColor, ALMOST_SCORE]
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
            return res.status(200).json({ groupProgress, leftColor });
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
