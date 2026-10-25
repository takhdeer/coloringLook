const express = require("express");
const pool = require("../../db");
const router = express.Router()

router.post('/', async (req, res) => {
    const { groupName, groupMembers} = req.body
        if (!groupName || !groupMembers) {
            console.log("Book name and Book Members are needed")
            return res.status(400).json({message: "Book name and Book Members are needed"})
        }

        try {
            const result = await pool.query(
                'insert into public.groups (name) values ($1) returning *', [groupName]
            );
            const groupId = result.rows[0].id
            for (const member of groupMembers) {
                await pool.query(
                    'insert into public.group_members (group_id, user_id) values ($1,$2)'
                    , [groupId, member]
                )
            }
            return res.status(201).json({message: "Book Created Successfully"})
        } catch (err) {
            console.log(err)
            return res.status(500).json({error: "Database Error", details: err})
        }
});

module.exports = router;