const express = require("express");
const pool = require("../../db");
const router = express.Router()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// POST /api/joinGroup  Body: { groupId, member } (member is the user id)
//   201 { message, groupId }  joined
//   400 { message }           groupId or member isn't a uuid (surrounding spaces and case are ignored)
//   404 { message }           no group has that id
//   409 { message, groupId }  already in the group (groupId is sent so the page can open it)
router.post('/', async (req, res) => {
    // Pasted ids often carry spaces or a line break, which Postgres rejects as a uuid
    const groupId = String(req.body?.groupId ?? '').trim().toLowerCase();
    const member = String(req.body?.member ?? '').trim().toLowerCase();
    if (!UUID.test(groupId)) {
        return res.status(400).json({message: "That doesn't look like a book id"})
    }
    if (!UUID.test(member)) {
        return res.status(400).json({message: "Member id is needed"})
    }

    const client = await pool.connect()
    try {
        await client.query('begin')
        // Anyone with the id (e.g. from an invite) can join, even once every colour is taken: they get
        // colours when someone presses "reassign colours" on the leaderboard
        const group = await client.query('select 1 from public.groups where id = $1 for update', [groupId])
        if (group.rowCount === 0) {
            await client.query('rollback')
            return res.status(404).json({message: "No book has that id"})
        }

        const existing = await client.query(
            'select 1 from public.group_members where group_id = $1 and user_id = $2', [groupId, member]
        )
        if (existing.rowCount > 0) {
            await client.query('rollback')
            return res.status(409).json({message: "You're already in this book", groupId})
        }

        // on conflict: two clicks at once shouldn't turn into a duplicate key error
        await client.query(
            'insert into public.group_members (group_id, user_id) values ($1,$2) on conflict do nothing'
            , [groupId, member]
        )
        await client.query('commit')
        return res.status(201).json({message: "Joined Book Successfully", groupId})
    } catch (err) {
        await client.query('rollback').catch(() => {})
        console.log(err)
        return res.status(500).json({message: "Server Error", details: err.message})
    } finally {
        client.release()
    }
});

module.exports = router;
