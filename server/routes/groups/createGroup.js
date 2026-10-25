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
            // The page needs the new id to upload the book's picture and send invites
            return res.status(201).json({message: "Book Created Successfully", groupId})
        } catch (err) {
            // 23505: groups.name is unique (groups_name_key), so the name is already taken
            if (err.code === '23505' && err.constraint === 'groups_name_key') {
                return res.status(409).json({message: "A room with that name already exists, pick another name"})
            }
            console.log(err)
            return res.status(500).json({error: "Database Error", details: err})
        }
});

module.exports = router;