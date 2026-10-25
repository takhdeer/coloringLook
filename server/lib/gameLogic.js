const pool = require('../db');
const { GameError, getGroupGrid, getColorOwners } = require('./groupGame');
const { greyscalePalette } = require('./greyscale');
const { getColorScores, buildFill } = require('./colorFill');
const { countColorCells, weightedProgress, progressPercent } = require('./scoring');

async function getGroupProgress(groupId) {
    const result = await pool.query('select progress from public.groups where id = $1', [groupId]);
    if (result.rowCount === 0) throw new GameError(404, "Group not found");
    return Number(result.rows[0].progress ?? 0);
}

// The group's grid as players should see it right now. Cells that aren't filled in yet are drawn
// grey: each colour fills in as its score goes up (see colorFill.js), so with no score at all the
// whole picture is greyscale. Adds { progress, greyscale, greyPalette, filled, fill } and returns a
// new object, so the cached grid is never changed.
async function applyGameState(groupId, grid) {
    const progress = await getGroupProgress(groupId);
    const scores = await getColorScores(groupId, grid.palette);
    const { filled, fill } = buildFill(grid.imageId, grid.grid, grid.palette, scores);
    return {
        ...grid,
        progress,
        greyscale: fill.every((f) => f.filledCells === 0),
        greyPalette: greyscalePalette(grid.palette),
        filled,
        fill,
    };
}

// Writes every palette colour this player owns in the group to public.user_colors, one row each
// with score 0. Rows that already exist are left as they are, so calling it again never resets a
// score. Returns the player's colours as '#rrggbb'.
async function saveUserColors(groupId, userId) {
    const { palette } = await getGroupGrid(groupId);
    const owners = await getColorOwners(groupId, palette);
    const colors = owners.filter((o) => o.userId === userId).map((o) => palette[o.paletteIndex]);

    if (colors.length > 0) {
        await pool.query(
            `insert into public.user_colors (group_id, user_id, color_id, score)
             select $1, $2, unnest($3::text[]), 0
             on conflict (group_id, user_id, color_id) do nothing`,
            [groupId, userId, colors]
        );
    }
    // Drop rows for colours the player no longer owns (e.g. the palette changed), so every row
    // matches a colour in the picture and its score fills it in
    await pool.query(
        `delete from public.user_colors
         where group_id = $1 and user_id = $2 and not (color_id = any($3::text[]))`,
        [groupId, userId, colors]
    );
    return colors;
}

// Adds `gain` percentage points to one of the player's colours in public.user_colors (capped at
// 100), then recomputes the group's total in public.groups.progress: every colour's score weighted
// by how much of the picture it covers, with colours nobody has scored counting as 0. The group row
// is locked while this runs, so two uploads at once can't overwrite each other's total.
// Returns { colorScore, memberProgress, groupProgress }: the colour's new score, the player's
// completion over all their colours (both 0-100, to one decimal) and the group's saved percentage.
async function addProgress(groupId, userId, color, gain) {
    const { grid, palette } = await getGroupGrid(groupId);
    const cellsOf = countColorCells(grid, palette);
    const owners = await getColorOwners(groupId, palette);
    const playerColors = owners.filter((o) => o.userId === userId).map((o) => palette[o.paletteIndex]);

    const client = await pool.connect();
    try {
        await client.query('begin');
        const group = await client.query('select 1 from public.groups where id = $1 for update', [groupId]);
        if (group.rowCount === 0) throw new GameError(404, "Group not found");

        // $4::real: without the cast Postgres reads least(100, $4) as integers and rejects 2.5
        const updated = await client.query(
            `insert into public.user_colors (group_id, user_id, color_id, score)
             values ($1, $2, $3, least(100, $4::real))
             on conflict (group_id, user_id, color_id) do update
                 set score = least(100, user_colors.score + excluded.score)
             returning score`,
            [groupId, userId, color, gain]
        );

        // A colour can have rows from more than one player if it changed owner; those add up
        const rows = await client.query(
            'select user_id, color_id, score from public.user_colors where group_id = $1', [groupId]
        );
        const groupScores = new Map();
        const playerScores = new Map();
        for (const row of rows.rows) {
            const hex = row.color_id.toLowerCase();
            const score = Number(row.score);
            groupScores.set(hex, (groupScores.get(hex) ?? 0) + score);
            if (row.user_id === userId) playerScores.set(hex, score);
        }

        const groupProgress = progressPercent(weightedProgress(palette, cellsOf, groupScores));
        await client.query('update public.groups set progress = $2 where id = $1', [groupId, groupProgress]);
        await client.query('commit');

        const oneDecimal = (n) => Math.round(n * 10) / 10;
        return {
            colorScore: oneDecimal(Number(updated.rows[0].score)),
            memberProgress: oneDecimal(weightedProgress(playerColors, cellsOf, playerScores)),
            groupProgress,
        };
    } catch (err) {
        await client.query('rollback');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    saveUserColors,
    addProgress,
    getGroupProgress,
    applyGameState,
};
