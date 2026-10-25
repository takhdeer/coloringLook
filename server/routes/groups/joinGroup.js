const express = require("express");
const pool = require("../../db");
const { isGameInProgress } = require("../../lib/groupGame");
const router = express.Router()

router.post('/', async (req, res) => {
    const { groupId, member} = req.body
        if (!groupId || !member) {
            console.log("Group id and Member id are neeeded")
            return res.status(400).json({message: "Group id and Member id are neeeded"})
        }

        try {
            // Every colour is already dealt out, so a new player would have nothing to colour in
            if (await isGameInProgress(groupId)) {
                return res.status(409).json({message: "This game has already started, so you can't join it"})
            }
            await pool.query(
                'insert into public.group_members (group_id, user_id) values ($1,$2)'
                , [groupId, member]
            )
            return res.status(201).json({message: "Joined Group Sucessfully"})
        } catch (err) {
            console.log(err)
            return res.status(500).json({error: "Database Error", details: err})
        }
});

module.exports = router;