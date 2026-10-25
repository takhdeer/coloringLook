const pool = require('../db');
const { GameError, getGroupGrid, getColorOwners } = require('./groupGame');
const { greyscalePalette } = require('./greyscale');
const { getColorScores, buildFill } = require('./colorFill');
const { progressPercent } = require('./scoring');

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

// Recomputes public.groups.progress: the share of the picture's cells that are coloured in, which
// is exactly what players see (buildFill), so big colours count for more than small ones.
// Run it inside the transaction that changed a score, passing its client, so it sees that score.
// The group row is locked first, so two scores saved at once can't overwrite each other's total.
// Returns the saved whole percent.
async function updateGroupProgress(client, groupId) {
    const group = await client.query('select 1 from public.groups where id = $1 for update', [groupId]);
    if (group.rowCount === 0) throw new GameError(404, "Group not found");

    const grid = await getGroupGrid(groupId);
    const scores = await getColorScores(groupId, grid.palette, client);
    const { fill } = buildFill(grid.imageId, grid.grid, grid.palette, scores);
    const filledCells = fill.reduce((sum, f) => sum + f.filledCells, 0);
    const totalCells = fill.reduce((sum, f) => sum + f.totalCells, 0);
    const progress = progressPercent(totalCells ? filledCells * 100 / totalCells : 0);

    await client.query('update public.groups set progress = $2 where id = $1', [groupId, progress]);
    return progress;
}

module.exports = {
    saveUserColors,
    updateGroupProgress,
    getGroupProgress,
    applyGameState,
};
