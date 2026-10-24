const express = require("express");
const pool = require("../db");
const router = express.Router();
const { pixelate } = require('../lib/pixelate');
const { supabase } = require('../lib/supabase');

// Supabase Storage bucket holding the image files; public.images.path is a file name in here
const BUCKET = 'images';

// Returns an error message if the grid options are invalid, otherwise null
function checkOptions(cols, colors, palette) {
    if (!Number.isInteger(cols) || cols < 4 || cols > 128) {
        return "cols must be a whole number from 4 to 128";
    }
    if (!Number.isInteger(colors) || colors < 2 || colors > 32) {
        return "colors must be a whole number from 2 to 32";
    }
    if (palette && (!Array.isArray(palette) || !palette.every((c) => /^#[0-9a-f]{6}$/i.test(c)))) {
        return "palette must be a list of #rrggbb colours";
    }
    return null;
}

// GET /api/pixelate/:imageId?cols=32&colors=8&palette=%23000000,%23ffffff
// Pixelates an image from the storage bucket, looked up by its row in public.images
router.get('/:imageId', async (req, res) => {
    const { imageId } = req.params;
    const cols = req.query.cols === undefined ? 32 : Number(req.query.cols);
    const colors = req.query.colors === undefined ? 8 : Number(req.query.colors);
    const palette = req.query.palette ? req.query.palette.split(',') : undefined;

    if (!/^\d+$/.test(imageId)) {
        return res.status(400).json({ message: "Image id must be a number" });
    }
    const optionsError = checkOptions(cols, colors, palette);
    if (optionsError) {
        return res.status(400).json({ message: optionsError });
    }

    let path;
    try {
        const result = await pool.query('select path from public.images where id = $1', [imageId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Image not found" });
        }
        path = result.rows[0].path;
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Database Error", details: err });
    }

    const { data: file, error } = await supabase.storage.from(BUCKET).download(path);
    if (error) {
        console.log(error);
        return res.status(502).json({ message: "Could not download the image file", path });
    }

    try {
        const input = Buffer.from(await file.arrayBuffer());
        const grid = await pixelate(input, { cols, colors, palette });
        return res.status(200).json({ imageId: Number(imageId), ...grid });
    } catch (err) {
        console.log(err);
        return res.status(422).json({ message: "Stored file could not be read as an image" });
    }
});

// POST /api/pixelate
// Body: { svg: "<svg ...>" } or { image: "<base64 png/jpg>" }, plus optional
// cols (grid width, default 32), colors (palette size, default 8), palette (["#rrggbb", ...])
router.post('/', async (req, res) => {
    const { svg, image, cols = 32, colors = 8, palette } = req.body;

    if (!svg && !image) {
        return res.status(400).json({ message: "An svg or image is required" });
    }
    const optionsError = checkOptions(cols, colors, palette);
    if (optionsError) {
        return res.status(400).json({ message: optionsError });
    }

    try {
        const input = svg ? Buffer.from(svg) : Buffer.from(image, 'base64');
        const result = await pixelate(input, { cols, colors, palette });
        return res.status(200).json(result);
    } catch (err) {
        console.log(err);
        return res.status(400).json({ message: "Could not read that image" });
    }
});

module.exports = router;
