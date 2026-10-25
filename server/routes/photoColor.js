const express = require("express");
const pool = require("../db");
const router = express.Router();
const { GameError, getPhotoColor, matchPlayerColor } = require('../lib/groupGame');
const { scoreImage } = require('../lib/scoring');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// POST /api/photoColor?userId=<uuid>&groupId=<uuid>
// Body: the photo file itself (Content-Type image/*), e.g. fetch(url, { method: 'POST', body: file })
// Finds the photo's most prominent colour and matches it to the player's own colours in the
// group's picture. Nothing is stored (not the photo, not the colour). Responds with a status the
// page can show:
//   matched     200 { status, color, photoColor, comparisons }
//                   color = the player's colour it counts as
//   no_match    200 { status, message, photoColor, yourColors, comparisons }
//                   too different from all their colours
//   no_colours  200 { status, message, photoColor }  the player owns no colours yet
// comparisons is how close the photo colour is to each of the player's colours (see
// comparePhotoColor in lib/pixelate.js).
router.post('/', express.raw({ type: 'image/*', limit: '15mb' }), async (req, res) => {
    const userId = String(req.query.userId ?? '').toLowerCase();
    const groupId = String(req.query.groupId ?? '').toLowerCase();

    if (!UUID.test(userId) || !UUID.test(groupId)) {
        return res.status(400).json({ message: "userId and groupId must be uuids" });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ message: "Send the photo as the request body with an image/* Content-Type" });
    }

    try {
        const member = await pool.query(
            'select 1 from public.group_members where group_id = $1 and user_id = $2', [groupId, userId]
        );
        if (member.rowCount === 0) {
            return res.status(403).json({ message: "You're not in this group" });
        }

        const photoColor = await getPhotoColor(req.body);
        const { match, colors, comparisons } = await matchPlayerColor(groupId, userId, photoColor);

        if (colors.length === 0) {
            return res.status(200).json({
                status: 'no_colours', photoColor,
                message: "You don't have any colours in this picture yet",
            });
        }
        if (!match) {
            return res.status(200).json({
                status: 'no_match', photoColor, yourColors: colors, comparisons,
                message: "That photo's colour doesn't match any of your colours",
            });
        }

        return res.status(200).json({ status: 'matched', color: match.color, photoColor, comparisons });
    } catch (err) {
        if (err instanceof GameError) {
            return res.status(err.status).json({ message: err.message, ...err.extra });
        }
        console.log(err);
        return res.status(500).json({ error: "Database Error", details: err.message });
    }
});

// POST /api/photoColor/extract
// Body: the photo file itself (Content-Type image/*). Only finds the photo's most prominent colour,
// so the page can show it before the player confirms: 200 { photoColor }. Nothing is stored.
router.post('/extract', express.raw({ type: 'image/*', limit: '15mb' }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ message: "Send the photo as the request body with an image/* Content-Type" });
    }

    try {
        return res.status(200).json({ photoColor: await getPhotoColor(req.body) });
    } catch (err) {
        if (err instanceof GameError) {
            return res.status(err.status).json({ message: err.message, ...err.extra });
        }
        console.log(err);
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
});

module.exports = router;
