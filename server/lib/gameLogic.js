const pool = require('../db');
const { GameError } = require('./groupGame');
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

module.exports = {
    getGroupProgress,
    isGreyscale,
    applyGameState,
};
