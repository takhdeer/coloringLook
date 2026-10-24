const express = require("express");
const router = express.Router();
const pool = require('../db');
const { supabase } = require('../lib/supabase');

router.post("/", async (req, res) => {
  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ message: "Email, password and Username are required" });
  }

  try {
    const taken = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (taken.rowCount > 0) {
      return res.status(409).json({ message: 'That username is already taken' });
    }

    const { data, error } = await supabase.auth.signUp({
      // username -> HM removed this
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: process.env.FRONTEND_URL
      }
    });

    if (error) {
      if (error.status === 422 || error.code === 'weak_password') {
        return res.status(422).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }

    if (!data.user || data.user.identities?.length === 0) {
      return res.status(409).json({ message: 'An account with that email already exists' });
    }

    const authUserID = data.user.id
    console.log(authUserID)

    await pool.query(
      'INSERT INTO users (id, email, username) VALUES ($1, $2, $3)',
      [authUserID, email, username]
      // HM removed password field from this
    );

    return res.status(201).json({
      message: "Signup Sucessful",
      user: { id: authUserID, email, username },
      session: data.session
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error registering user" });
  }
});

module.exports = router;