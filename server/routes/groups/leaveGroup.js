const express = require("express");
const pool = require("../../db");
const router = express.Router()

// Removes a user from a group. Their rows in public.user_colors for that group go too, and the
// colours they owned are handed to the remaining members the next time the picture loads.
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

            await client.query('commit')
            return res.status(200).json({message: "Left Book Successfully"})
        } catch (err) {
            await client.query('rollback')
            console.log(err)
            return res.status(500).json({error: "Database Error", details: err})
        } finally {
            client.release()
        }
});

module.exports = router;
