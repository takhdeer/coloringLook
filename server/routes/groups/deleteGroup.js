const express = require("express");
const pool = require("../../db");
const router = express.Router()

router.delete('/:groupId', async (req, res) => {
    const { groupId } = req.params
        if (!groupId) {
            console.log("Group ID is needed")
            return res.status(400).json({message: "Group ID is needed"})
        }

        // Use one client so both deletes run in the same transaction
        const client = await pool.connect()
        try {
            await client.query('begin')
            await client.query(
                'delete from public.group_members where group_id = $1', [groupId]
            );
            const result = await client.query(
                'delete from public.groups where id = $1 returning *', [groupId]
            );

            if (result.rowCount === 0) {
                await client.query('rollback')
                return res.status(404).json({message: "Group not found"})
            }

            await client.query('commit')
            return res.status(200).json({message: "Group Deleted Sucessfully"})
        } catch (err) {
            await client.query('rollback')
            console.log(err)
            return res.status(500).json({error: "Database Error", details: err})
        } finally {
            client.release()
        }
});

module.exports = router;
