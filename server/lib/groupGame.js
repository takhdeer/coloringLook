const pool = require('../db');
const { supabase } = require('./supabase');
const { pixelate, matchPaletteColor, matchPhotoColor, comparePhotoColor } = require('./pixelate');

// Supabase Storage bucket holding the image files; public.images.path is a file name in here
const BUCKET = 'images';

// Every group's picture is pixelated with these settings, so all players see the same cells.
// The canvas is a square GRID_COLS × GRID_COLS; the picture is fitted inside it, centred.
const GRID_COLS = 128;
const GRID_COLORS = 8;
// Picked colours that look closer than this (CIELAB ΔE) are merged, so every palette colour is
// clearly different and uploaded photos match one unambiguously. Usually leaves 4-6 colours.
const GRID_MIN_COLOR_DISTANCE = 25;

// An error with the HTTP status a route should answer with
class GameError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

// Downloads an image file from the bucket by its public.images id
async function loadImageFile(imageId) {
    const result = await pool.query('select path from public.images where id = $1', [imageId]);
    if (result.rowCount === 0) throw new GameError(404, "Image not found");
    const { path } = result.rows[0];

    const { data: file, error } = await supabase.storage.from(BUCKET).download(path);
    if (error) {
        console.log(error);
        throw new GameError(502, "Could not download the image file", { path });
    }
    return Buffer.from(await file.arrayBuffer());
}

// The picture attached to a group in public.group_image (the newest one if there are several)
async function getGroupImageId(groupId) {
    const result = await pool.query(
        'select image_id from public.group_image where group_id = $1 order by created_at desc limit 1',
        [groupId]
    );
    if (result.rowCount === 0) throw new GameError(404, "This group has no picture yet");
    return Number(result.rows[0].image_id);
}

// Pixelating takes a moment, and every request for a group needs the same grid, so keep them
const gridCache = new Map();

// The group's picture as a grid, using the shared settings above.
// The palette is also saved to public.images.palette so other code (e.g. the photo uploader)
// can read it straight from the database.
async function getGroupGrid(groupId) {
    const imageId = await getGroupImageId(groupId);
    if (!gridCache.has(imageId)) {
        const file = await loadImageFile(imageId);
        let grid;
        try {
            grid = await pixelate(file, { cols: GRID_COLS, colors: GRID_COLORS, minDistance: GRID_MIN_COLOR_DISTANCE, square: true, dropWhite: true });
        } catch (err) {
            console.log(err);
            throw new GameError(422, "Stored file could not be read as an image");
        }
        // Only writes when the stored palette is missing or out of date (e.g. GRID_COLORS changed)
        await pool.query(
            'update public.images set palette = $2 where id = $1 and palette is distinct from $2',
            [imageId, grid.palette]
        );
        gridCache.set(imageId, grid);
    }
    return { imageId, ...gridCache.get(imageId) };
}

// The group picture's palette colour closest to `color` ('#rrggbb' or [r, g, b]), and who owns it.
// For the photo uploader: matches a photo's dominant colour to one of the picture's colours.
// Returns { paletteIndex, color, distance, userId, username } (see matchPaletteColor for distance).
async function matchGroupColor(groupId, color) {
    const { palette } = await getGroupGrid(groupId);
    const match = matchPaletteColor(color, palette);
    if (!match) throw new GameError(422, "This group's picture has no colours");
    const owners = await getColorOwners(groupId, palette);
    const { userId, username } = owners[match.paletteIndex];
    return { ...match, userId, username };
}

// The group's members in join order, with the palette colours they own (group_members.colors)
async function getMembers(groupId) {
    const result = await pool.query(
        `select gm.user_id, u.username, coalesce(gm.colors, '{}') as colors
         from public.group_members gm
         left join public.users u on u.id = gm.user_id
         where gm.group_id = $1
         order by gm.joined_at, gm.user_id`,
        [groupId]
    );
    return result.rows.map((r) => ({
        userId: r.user_id,
        username: r.username,
        colors: r.colors.map((c) => c.toLowerCase()),
    }));
}

// Who owns each palette colour, as [{ paletteIndex, userId, username }]. Colours nobody owns yet
// are dealt out to the members with the fewest colours (join order breaks ties), so this is safe
// to call every time. Once every colour is owned, players who join later get none.
async function getColorOwners(groupId, palette) {
    let members = await getMembers(groupId);
    const ownerOf = (hex) => members.find((m) => m.colors.includes(hex));
    const unowned = palette.filter((hex) => !ownerOf(hex));
    // Colours a player holds that aren't in the palette any more (e.g. white after it was made
    // empty space, or shades from an older grid size) would otherwise linger on the leaderboard
    const stale = members.some((m) => m.colors.some((c) => !palette.includes(c)));

    if ((unowned.length > 0 || stale) && members.length > 0) {
        // Anything in colors that isn't in this picture's palette is dropped
        const owned = members.map((m) => m.colors.filter((c) => palette.includes(c)));
        for (const hex of unowned) {
            let pick = 0;
            owned.forEach((list, i) => { if (list.length < owned[pick].length) pick = i; });
            owned[pick].push(hex);
        }
        for (const [i, m] of members.entries()) {
            await pool.query(
                'update public.group_members set colors = $3 where group_id = $1 and user_id = $2',
                [groupId, m.userId, owned[i]]
            );
        }
        members = await getMembers(groupId);
    }

    return palette.map((hex, paletteIndex) => {
        const owner = ownerOf(hex);
        return { paletteIndex, userId: owner?.userId ?? null, username: owner?.username ?? null };
    });
}

// Whether the group's game is already going: its picture has a palette and every colour of it is
// owned by a member. Reads the palette saved in public.images, so it doesn't pixelate anything;
// a group whose picture hasn't been loaded yet (no saved palette) counts as not started.
async function isGameInProgress(groupId) {
    const result = await pool.query(
        `select i.palette
         from public.group_image gi
         join public.images i on i.id = gi.image_id
         where gi.group_id = $1
         order by gi.created_at desc
         limit 1`,
        [groupId]
    );
    const palette = (result.rows[0]?.palette ?? []).map((c) => c.toLowerCase());
    if (palette.length === 0) return false;
    const members = await getMembers(groupId);
    return palette.every((hex) => members.some((m) => m.colors.includes(hex)));
}

// The most prominent colour of an uploaded photo as '#rrggbb', found exactly like a group picture's
// palette (same grid size, colour count and merging), then taking the colour that covers the most
// area. The photo itself isn't kept anywhere.
async function getPhotoColor(photo) {
    let result;
    try {
        result = await pixelate(photo, { cols: GRID_COLS, colors: GRID_COLORS, minDistance: GRID_MIN_COLOR_DISTANCE });
    } catch (err) {
        console.log(err);
        throw new GameError(422, "Could not read that photo");
    }

    // Palette is ranked biggest area first, so [0] is the most prominent colour
    if (result.palette.length === 0) throw new GameError(422, "That photo has no visible colours");
    return result.palette[0];
}

// Matches a photo's colour against the colours this player owns in the group's picture (only
// those are accepted). Returns { match, colors, comparisons } where match is matchPhotoColor's
// result (null if it's too different from all of them), colors is the player's own colours and
// comparisons is comparePhotoColor's closeness to each of them.
async function matchPlayerColor(groupId, userId, photoColor) {
    const { palette } = await getGroupGrid(groupId);
    const owners = await getColorOwners(groupId, palette);
    const colors = owners.filter((o) => o.userId === userId).map((o) => palette[o.paletteIndex]);
    return {
        match: colors.length ? matchPhotoColor(photoColor, colors) : null,
        colors,
        comparisons: comparePhotoColor(photoColor, colors),
    };
}

module.exports = {
    GameError,
    getPhotoColor,
    matchPlayerColor,
    loadImageFile,
    getGroupGrid,
    getColorOwners,
    matchGroupColor,
    isGameInProgress,
};
