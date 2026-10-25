const pool = require('../db');
const { GameError, getGroupGrid, getColorOwners } = require('./groupGame');
const { greyscalePalette } = require('./greyscale');

async function getGroupProgress(groupId) {
    const result = await pool.query('select progress from public.groups where id = $1', [groupId]);
    if (result.rowCount === 0) throw new GameError(404, "Group not found");
    return Number(result.rows[0].progress ?? 0);
}

// A picture nobody has started colouring yet is shown in greyscale
function isGreyscale(progress) {
    return progress <= 0;
}

// The group's grid as players should see it right now: adds { progress, greyscale } and swaps in a
// grey palette when greyscale. Returns a new object, so the cached grid keeps its real colours.
async function applyGameState(groupId, grid) {
    const progress = await getGroupProgress(groupId);
    const greyscale = isGreyscale(progress);
    return {
        ...grid,
        progress,
        greyscale,
        palette: greyscale ? greyscalePalette(grid.palette) : grid.palette,
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
    return colors;
}

module.exports = {
    saveUserColors,
    getGroupProgress,
    isGreyscale,
    applyGameState,
};
