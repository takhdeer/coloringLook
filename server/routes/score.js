const express = require("express");
const pool = require("../db");
const router = express.Router();
const { GameError } = require('../lib/groupGame');
const { saveUserColors } = require('../lib/gameLogic');
const { scoreImage } = require('../lib/scoring');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/;
const EARTH_RADIUS_KM = 6371;
const DEG = Math.PI / 180; // multiply degrees by this to get radians

// POST /api/score
// Body: { userId, groupId, color, latitude?, longitude? }
//   color              the player's palette colour the photo matched ('#rrggbb', from /api/photoColor)
//   latitude/longitude the PHOTO's coordinates; leave both out if the photo has no GPS data
// Steps 1-3: reads the player's spawnpoint, measures the distance to the photo (haversine, km).
// Steps 4-5: scoreImage() turns the distance into points.
// Then adds the points to that colour's score in public.user_colors and sets
// public.group_members.score (what the leaderboard shows) to the sum of the player's colour scores.
// Scores are whole numbers in the database, so the gain is rounded (2.5 -> 3).
//   200 { color, distanceKm, base, bonus, gain, points, colorScore, newScore }
router.post('/', async (req, res) => {
    const body = req.body ?? {};
    const userId = String(body.userId ?? '').toLowerCase();
    const groupId = String(body.groupId ?? '').toLowerCase();
    const color = String(body.color ?? '').toLowerCase();
    const { latitude, longitude } = body;

    // ---- validate input ----
    if (!UUID.test(userId) || !UUID.test(groupId)) {
        return res.status(400).json({ message: "userId and groupId must be uuids" });
    }
    if (!HEX_COLOR.test(color)) {
        return res.status(400).json({ message: "color must be #rrggbb" });
    }
    const hasLat = latitude !== undefined && latitude !== null;
    const hasLon = longitude !== undefined && longitude !== null;
    if (hasLat !== hasLon) {
        return res.status(400).json({ message: "Send both latitude and longitude, or neither" });
    }
    const hasPhotoLocation = hasLat && hasLon;
    if (hasPhotoLocation) {
        // 0 is a valid coordinate, so check the type instead of truthiness
        if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
            !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return res.status(400).json({ message: "latitude and longitude must be numbers" });
        }
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({ message: "latitude must be -90..90 and longitude -180..180" });
        }
    }

    try {
        // ---- the player must be in the group and own the colour ----
        const member = await pool.query(
            'select 1 from public.group_members where group_id = $1 and user_id = $2', [groupId, userId]
        );
        if (member.rowCount === 0) {
            return res.status(403).json({ message: "You're not in this group" });
        }
        // Also makes sure the player's user_colors rows exist (safe to call again, never resets a score)
        const ownedColors = await saveUserColors(groupId, userId);
        if (!ownedColors.includes(color)) {
            return res.status(403).json({ message: "That colour isn't one of yours in this group" });
        }

        // ---- steps 1-3: spawnpoint -> distance to the photo, in km ----
        let distanceKm = null;
        if (hasPhotoLocation) {
            const spawn = await pool.query('select spawnpoint from public.users where id = $1', [userId]);
            if (spawn.rowCount === 0) {
                return res.status(404).json({ message: "User not found" });
            }
            const spawnpoint = spawn.rows[0].spawnpoint;
            if (spawnpoint == null) {
                return res.status(409).json({ message: "Set a spawn point first" });
            }

            // spawn.js saves it as "longitude, latitude" (LONGITUDE FIRST)
            const [spawnLon, spawnLat] = String(spawnpoint)
                .split(',')
                .map((v) => Number.parseFloat(v.trim()));
            if (!Number.isFinite(spawnLat) || !Number.isFinite(spawnLon) ||
                spawnLat < -90 || spawnLat > 90 || spawnLon < -180 || spawnLon > 180) {
                console.log('Malformed spawnpoint for user', userId, spawnpoint);
                return res.status(500).json({ message: "Stored spawn point is malformed" });
            }

            // haversine
            const dLat = (latitude - spawnLat) * DEG;
            const dLon = (longitude - spawnLon) * DEG;
            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(spawnLat * DEG) * Math.cos(latitude * DEG) * Math.sin(dLon / 2) ** 2;
            distanceKm = 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        // ---- steps 4-5: distance -> points (null distance = base points only) ----
        const result = scoreImage(distanceKm);
        const points = Math.round(result.gain);

        // ---- save: colour score first, then the group total, in one transaction ----
        const client = await pool.connect();
        try {
            await client.query('begin');

            const colorRow = await client.query(
                `update public.user_colors
                 set score = coalesce(score, 0) + $4
                 where group_id = $1 and user_id = $2 and color_id = $3
                 returning score`,
                [groupId, userId, color, points]
            );
            if (colorRow.rowCount === 0) {
                await client.query('rollback');
                return res.status(404).json({ message: "That colour isn't saved for this player yet" });
            }

            const total = await client.query(
                `update public.group_members
                 set score = (select coalesce(sum(score), 0)::int
                              from public.user_colors
                              where group_id = $1 and user_id = $2)
                 where group_id = $1 and user_id = $2
                 returning score`,
                [groupId, userId]
            );

            await client.query('commit');

            return res.status(200).json({
                color,
                // Only the distance goes back, never the spawn coordinates (that's the user's home)
                distanceKm: distanceKm === null ? null : Math.round(distanceKm * 100) / 100,
                base: result.base,
                bonus: result.bonus,
                gain: result.gain,
                points,
                colorScore: colorRow.rows[0].score,
                newScore: total.rows[0].score,
            });
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
        return res.status(500).json({ message: "Error saving the score" });
    }
});

module.exports = router;