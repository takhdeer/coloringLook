const express = require("express");
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {
    const { longitude, latitude, userId } = req.body

    // 0 is a valid coordinate, so check for missing values instead of falsy ones
    if (longitude == null || latitude == null || !userId) {
        console.log('Coordinates and user id are required')
        return res.status(400).json({message: 'Coordinates and user id are required'})
    }

    const coordinates = `${longitude}, ${latitude}`
    try {
        const result = await pool.query(
            'UPDATE public.users SET spawnpoint = $1 WHERE id = $2;', [coordinates, userId]
        )
        if (result.rowCount === 0) {
            return res.status(404).json({message: 'User not found'})
        }
    } catch (err) {
        console.log(err)
        return res.status(500).json({message: 'Error Setting Spawn Point'})
    }
    return res.status(200).json({message: 'Spawn Point Set', spawnpoint: coordinates});
});

module.exports = router;
