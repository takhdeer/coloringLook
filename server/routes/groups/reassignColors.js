const express = require("express");
const pool = require("../../db");
const { reassignColors } = require("../../lib/groupGame");
const router = express.Router()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// POST /api/reassignColors  Body: { groupId, userId } (userId is whoever pressed the button)
// Deals all of the picture's colours out again among every member (see reassignColors).
//   200 { message, players: [{ userId, colors }] }
//   400 { message }  groupId or userId isn't a uuid
//   403 { message }  userId isn't in the group
//   404 { message }  no group has that id
router.post('/', async (req, res) => {
    const groupId = String(req.body?.groupId ?? '').trim().toLowerCase();
    const userId = String(req.body?.userId ?? '').trim().toLowerCase();
    if (!UUID.test(groupId) || !UUID.test(userId)) {
        return res.status(400).json({message: "Book id and user id are needed"})
    }

    const client = await pool.connect()
    try {
        await client.query('begin')
        const member = await client.query(
            'select 1 from public.group_members where group_id = $1 and user_id = $2', [groupId, userId]
        )
        if (member.rowCount === 0) {
            await client.query('rollback')
            return res.status(403).json({message: "You're not in this book"})
        }

        const players = await reassignColors(client, groupId)
        await client.query('commit')
        return res.status(200).json({message: "Colours reassigned", players})
    } catch (err) {
        await client.query('rollback').catch(() => {})
        console.log(err)
        return res.status(err.status ?? 500).json({message: err.status ? err.message : "Server Error", details: err.message})
    } finally {
        client.release()
    }
});

module.exports = router;
