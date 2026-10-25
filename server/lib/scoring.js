const SCORING = {
    baseGain: 2.5,
    distanceBonus: [
        { maxKm: 1, bonus: 0 },
        { maxKm: 10, bonus: 5 },
        { maxKm: 25, bonus: 10 },
        { maxKm: 40, bonus: 13.5 },
        { maxKm: 55, bonus: 17.5 },
        { maxKm: 70, bonus: 22.5 },
        { maxKm: Infinity, bonus: 27.5 },
    ],
};

function distanceBonus(distanceKm) {
    if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0) return 0;
    return SCORING.distanceBonus.find((tier) => distanceKm <= tier.maxKm).bonus;
}

function scoreImage(distanceKm) {
    const bonus = distanceBonus(distanceKm);
    return { distanceKm: distanceKm ?? null, base: SCORING.baseGain, bonus, gain: SCORING.baseGain + bonus };
}

// How many cells of the picture each palette colour covers, as a Map '#rrggbb' -> count.
// Transparent (null) cells don't count.
function countColorCells(grid, palette) {
    const counts = palette.map(() => 0);
    for (const row of grid) {
        for (const cell of row) {
            if (cell !== null) counts[cell]++;
        }
    }
    return new Map(palette.map((hex, i) => [hex, counts[i]]));
}

// Completion of a set of colours, 0-100: each colour's score weighted by how many cells it
// covers, so a big colour counts for more than a small one. scoreOf maps '#rrggbb' -> score;
// colours without a score count as 0. Not rounded.
function weightedProgress(colors, cellsOf, scoreOf) {
    let filled = 0;
    let total = 0;
    for (const hex of colors) {
        const cells = cellsOf.get(hex) ?? 0;
        total += cells;
        filled += cells * Math.min(100, scoreOf.get(hex) ?? 0);
    }
    return total ? filled / total : 0;
}

// A whole-number percentage for groups.progress (int4). Any progress at all shows as at least 1,
// so the picture leaves greyscale after the first matched photo, and only a finished picture
// shows 100.
function progressPercent(progress) {
    if (progress <= 0) return 0;
    if (progress >= 100) return 100;
    return Math.min(99, Math.max(1, Math.round(progress)));
}

module.exports = {
    SCORING,
    distanceBonus,
    scoreImage,
    countColorCells,
    weightedProgress,
    progressPercent,
};

