const express = require("express");
const pool = require("../../db");
const { sendInvite } = require("../../lib/mailer");
const router = express.Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Emails a join link for a group. The inviter must already be a member.
router.post('/', async (req, res) => {
    const { groupId, inviterId, email } = req.body
        if (!groupId || !inviterId || !email) {
            return res.status(400).json({message: "Book id, inviter id and email are needed"})
        }
        if (!EMAIL_RE.test(email)) {
            return res.status(400).json({message: "Invalid email address"})
        }

        try {
            const result = await pool.query(
                `select g.name as group_name, u.username
                 from public.group_members gm
                 join public.groups g on g.id = gm.group_id
                 join public.users u on u.id = gm.user_id
                 where gm.group_id = $1 and gm.user_id = $2`,
                [groupId, inviterId]
            );
            if (result.rows.length === 0) {
                return res.status(403).json({message: "You are not a member of this book"})
            }

            const { group_name, username } = result.rows[0]
            const joinUrl = `${FRONTEND_URL}/join?groupId=${encodeURIComponent(groupId)}`
            await sendInvite({ to: email, inviterName: username, groupName: group_name, joinUrl })

            return res.status(200).json({message: "Invite sent"})
        } catch (err) {
            console.log(err)
            return res.status(500).json({error: "Could not send invite"})
        }
});

module.exports = router;
