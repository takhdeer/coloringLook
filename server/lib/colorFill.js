const pool = require('../db');

// Each score point fills 1% of that colour's cells, so a score of 40 fills 40% of them
const MAX_FILL_PERCENT = 100;

// How much of a colour is filled in for a score, as a whole percent from 0 to 100
function fillPercent(score) {
    return Math.min(MAX_FILL_PERCENT, Math.max(0, Math.floor(Number(score) || 0)));
}

// A small seeded random number generator (mulberry32), so the same seed always gives the same order
function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Turns a string like '12:#3366cc' into a 32-bit seed (FNV-1a)
function hashString(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

// Every [x, y] cell of one palette colour, in the order they get filled in. The order is a shuffle
// seeded by the image and colour, so it's the same on every request: a higher score fills the same
// cells as before plus some more, and the colour appears scattered across its area.
function fillOrder(grid, paletteIndex, seed) {
    const cells = [];
    grid.forEach((row, y) => row.forEach((cell, x) => {
        if (cell === paletteIndex) cells.push([x, y]);
    }));

    const random = seededRandom(seed);
    for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return cells;
}

// The total score of each palette colour in the group (public.user_colors.score), as { hex: score }.
// Colours with no row count as 0. Pass a transaction's client as `db` to see its uncommitted scores.
async function getColorScores(groupId, palette, db = pool) {
    const result = await db.query(
        `select lower(color_id) as color, sum(score)::int as score
         from public.user_colors
         where group_id = $1 and lower(color_id) = any($2::text[])
         group by lower(color_id)`,
        [groupId, palette]
    );
    return Object.fromEntries(result.rows.map((r) => [r.color, r.score]));
}

// Which cells of the picture are filled in, given each colour's score.
// Returns { filled, fill }: filled[y][x] is 1 for a coloured-in cell and 0 otherwise (always 0 for
// transparent cells), and fill[paletteIndex] is { color, score, percent, filledCells, totalCells }.
function buildFill(imageId, grid, palette, scores) {
    const filled = grid.map((row) => row.map(() => 0));

    const fill = palette.map((color, paletteIndex) => {
        const score = scores[color] ?? 0;
        const percent = fillPercent(score);
        const cells = fillOrder(grid, paletteIndex, hashString(`${imageId}:${color}`));
        const filledCells = Math.round(cells.length * percent / 100);
        for (const [x, y] of cells.slice(0, filledCells)) filled[y][x] = 1;
        return { color, score, percent, filledCells, totalCells: cells.length };
    });

    return { filled, fill };
}

module.exports = {
    fillPercent,
    fillOrder,
    getColorScores,
    buildFill,
};
