const pool = require('../db');
const { GameError, getGroupGrid, getColorOwners } = require('./groupGame');
const { greyscalePalette } = require('./greyscale');
const { getColorScores, buildFill } = require('./colorFill');

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

module.exports = {
    saveUserColors,
    getGroupProgress,
    applyGameState,
};
