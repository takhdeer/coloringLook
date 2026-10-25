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

// A whole-number percentage for groups.progress (int4). Any progress at all shows as at least 1,
// so a started picture never shows 0% in the group list, and only a finished picture shows 100.
function progressPercent(progress) {
    if (progress <= 0) return 0;
    if (progress >= 100) return 100;
    return Math.min(99, Math.max(1, Math.round(progress)));
}

module.exports = {
    SCORING,
    distanceBonus,
    scoreImage,
    progressPercent,
};

