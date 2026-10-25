const express = require("express")
const router = express.Router()
const { supabase } = require('../lib/supabase')
const pool = require('../db')

router.post('/', async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        console.log("Email and Password are required")
        return res.status(400).json({message: "Email and Password are required"});
    } 
    
    try {
        const {data, error} = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.log(error)
            if (error.code === 'email_not_confirmed') {
                return res.status(403).json({ message: 'Confirm email, please check inbox' });
            }
            return res.status(400).json({error: 'Auth Error', detail: error.message});
        }
        const authUserId = data.user.id

        // The frontend uses this to send the user to /play or /spawn
        let spawnpoint = null
        try {
            const result = await pool.query(
                'SELECT spawnpoint FROM public.users WHERE id = $1;', [authUserId]
            )
            spawnpoint = result.rows[0]?.spawnpoint ?? null
        } catch (err) {
            console.log('Could not look up spawn point', err)
        }

        return res.status(200).json({
            message: "Login Sucessful",
            authUserId,
            spawnpoint,
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
        })
    } catch (err) {
        console.log(err)
        return res.status(404).json({message: "User not found"})
    }
});

module.exports = router;