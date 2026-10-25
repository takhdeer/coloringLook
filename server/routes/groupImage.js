const express = require("express");
const sharp = require("sharp");
const pool = require("../db");
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabase');
const { BUCKET } = require('../lib/groupGame');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// POST /api/groupImage?groupId=<uuid>&name=<picture name>
// Body: the image file itself (Content-Type image/*), e.g. fetch(url, { method: 'POST', body: file })
// Sets the picture a group colours in: stores the file in the images bucket, adds a row to
// public.images and links it in public.group_image. The Play page pixelates it from there.
// Responds 201 { imageId }
router.post('/', express.raw({ type: 'image/*', limit: '15mb' }), async (req, res) => {
    const groupId = String(req.query.groupId ?? '').toLowerCase();
    const name = String(req.query.name ?? '').trim() || 'group picture';

    if (!UUID.test(groupId)) {
        return res.status(400).json({ message: "groupId must be a uuid" });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ message: "Send the picture as the request body with an image/* Content-Type" });
    }
    if (!supabaseAdmin) {
        return res.status(500).json({ message: "Server is missing SUPABASE_SERVICE_ROLE_KEY" });
    }

    // Check it's something sharp (and so pixelate) can read before storing it
    try {
        await sharp(req.body).metadata();
    } catch (err) {
        return res.status(422).json({ message: "That file isn't an image we can read" });
    }

    const client = await pool.connect();
    try {
        const group = await client.query('select 1 from public.groups where id = $1', [groupId]);
        if (group.rowCount === 0) {
            return res.status(404).json({ message: "Group not found" });
        }

        // image/svg+xml -> svg, image/jpeg -> jpg
        const subtype = req.get('Content-Type').split('/')[1].split(/[+;]/)[0].trim();
        const ext = subtype === 'jpeg' ? 'jpg' : subtype;
        const path = `groups/${groupId}/${Date.now()}.${ext}`;

        const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, req.body, {
            contentType: req.get('Content-Type'),
        });
        if (error) {
            console.log(error);
            return res.status(502).json({ message: "Could not upload the picture", details: error.message });
        }

        await client.query('begin');
        const image = await client.query(
            'insert into public.images (name, path) values ($1, $2) returning id', [name, path]
        );
        const imageId = Number(image.rows[0].id);
        await client.query(
            'insert into public.group_image (group_id, image_id) values ($1, $2)', [groupId, imageId]
        );
        await client.query('commit');

        return res.status(201).json({ imageId });
    } catch (err) {
        await client.query('rollback').catch(() => {});
        console.log(err);
        return res.status(500).json({ message: "Database Error" });
    } finally {
        client.release();
    }
});

module.exports = router;
