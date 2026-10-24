const express = require("express")
const router = express.Router()
const { supabase } = require('../../src/lib/supabase')

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
            return res.status(500).json({error: 'Auth Error', detail: error.message});
        }
        const authUserId = data.user.id
        return res.status(201).json({message: "Login Sucessful", authUserId})
    } catch (err) {
        console.log(err)
        return res.status(404).json({message: "User not found"})
    }
});

module.exports = router;