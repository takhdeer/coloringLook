const express = require("express");
const router = express.Router();
const { pixelate } = require('../lib/pixelate');
const { GameError, loadImageFile, getGroupGrid, getColorOwners, matchGroupColor } = require('../lib/groupGame');

// Sends a GameError's status and message, or a 500 for anything unexpected
function sendError(res, err) {
    if (err instanceof GameError) {
        return res.status(err.status).json({ message: err.message, ...err.extra });
    }
    console.log(err);
    return res.status(500).json({ error: "Server Error", details: err.message });
}

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

// GET /api/pixelate/group/:groupId
// Everything the Play page needs to draw a group's picture: the grid (fixed game settings),
// and which player owns each palette colour
router.get('/group/:groupId', async (req, res) => {
    const groupId = req.params.groupId.toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(groupId)) {
        return res.status(400).json({ message: "Group id must be a uuid" });
    }

    try {
        const grid = await getGroupGrid(groupId);
        const owners = await getColorOwners(groupId, grid.palette);
        return res.status(200).json({ groupId, ...grid, owners });
    } catch (err) {
        return sendError(res, err);
    }
});

// GET /api/pixelate/group/:groupId/match?color=%23aabbcc
// The group picture's colour closest to `color`, and which player owns it
router.get('/group/:groupId/match', async (req, res) => {
    const groupId = req.params.groupId.toLowerCase();
    const color = String(req.query.color ?? '').toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(groupId)) {
        return res.status(400).json({ message: "Group id must be a uuid" });
    }
    if (!/^#[0-9a-f]{6}$/.test(color)) {
        return res.status(400).json({ message: "color must be #rrggbb (write # as %23 in the URL)" });
    }

    try {
        return res.status(200).json({ groupId, input: color, ...await matchGroupColor(groupId, color) });
    } catch (err) {
        return sendError(res, err);
    }
});

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

    let input;
    try {
        input = await loadImageFile(imageId);
    } catch (err) {
        return sendError(res, err);
    }

    try {
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
