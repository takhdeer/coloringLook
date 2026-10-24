const express = require("express");
const router = express.Router();
const pool = require('../db');
const { supabase } = require('../lib/supabase');

router.post("/", async(req, res) => {
    const { email, password, username } = req.body;

    if (!email || !password || !username)  {
        return res.status(400).json({ message: "Email, password and Username are required" });
    }
    
    try {
      const { data, error } = await supabase.auth.signUp({
        username,
        email,
        password,
        options: {
          emailRedirectTo: process.env.FRONTEND_URL
        }
      });

      if (error) {
        if (error.status === 422 || error.code === 'weak_password') {
          console.log('Password is not secure')
          return res.status(500).json({ error: 'Password error', detail: error.message})
        }
        else {
          console.log(error);
          return res.status(500).json({ error: 'Auth error', detail: error.message});
        }
      }

      if (data.user.identities.length === 0) {
        console.log('User exists');
        return res.status(409).json({ error: 'User Exists'})
      }

      const authUserID = data.user.id
      console.log(authUserID)

      await pool.query(
        'INSERT INTO users (id, email, password, username) VALUES ($1, $2, $3, $4)',
        [authUserID, email, password, username]
      );

      return res.status(201).json({
        message: "Signup Sucessful"
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error registering user" });
    }
});

module.exports = router;