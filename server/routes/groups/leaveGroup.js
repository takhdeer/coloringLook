const express = require("express");
const pool = require("../../db");
const router = express.Router()

// Removes a user from a group. Their rows in public.user_colors for that group go too, and the
// colours they owned are handed to the remaining members the next time the picture loads.
// If they were the last member, the group itself is deleted (its members, picture link and scores
// go with it via ON DELETE CASCADE), so empty groups don't linger and keep their name taken.
// Responds 200 { message, deleted } where deleted is true if the group was removed.
router.delete('/:groupId/:userId', async (req, res) => {
    const { groupId, userId } = req.params

        // Use one client so both deletes run in the same transaction
        const client = await pool.connect()
        try {
            await client.query('begin')
            await client.query(
                'delete from public.user_colors where group_id = $1 and user_id = $2', [groupId, userId]
            );
            const result = await client.query(
                'delete from public.group_members where group_id = $1 and user_id = $2 returning *',
                [groupId, userId]
            );

            if (result.rowCount === 0) {
                await client.query('rollback')
                return res.status(404).json({message: "You're not in this book"})
            }

            const remaining = await client.query(
                'select 1 from public.group_members where group_id = $1 limit 1', [groupId]
            );
            const deleted = remaining.rowCount === 0
            if (deleted) {
                await client.query('delete from public.groups where id = $1', [groupId])
            }

            await client.query('commit')
            return res.status(200).json({
                message: deleted ? "Left and deleted the book" : "Left Book Successfully",
                deleted,
            })
        } catch (err) {
            await client.query('rollback')
            console.log(err)
            return res.status(500).json({error: "Database Error", details: err})
        } finally {
            client.release()
        }
});

module.exports = router;
