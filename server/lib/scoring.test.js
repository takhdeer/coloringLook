const { describe, test, expect } = require('bun:test');
const {
    SCORING, distanceBonus, scoreImage, countColorCells, weightedProgress, progressPercent,
} = require('./scoring');

describe('distanceBonus', () => {
    // Both sides of every tier boundary (upper bounds are inclusive)
    test.each([
        [0, 0],
        [1, 0],
        [1.01, 5],
        [10, 5],
        [10.01, 10],
        [25, 10],
        [25.01, 13.5],
        [40, 13.5],
        [40.01, 17.5],
        [55, 17.5],
        [55.01, 22.5],
        [70, 22.5],
        [70.01, 27.5],
        [5000, 27.5],
    ])('%p km -> +%p', (distanceKm, bonus) => {
        expect(distanceBonus(distanceKm)).toBe(bonus);
    });

    test.each([null, undefined, NaN, Infinity, -5, '12'])('unusable distance %p -> no bonus', (distanceKm) => {
        expect(distanceBonus(distanceKm)).toBe(0);
    });
});

describe('scoreImage', () => {
    test.each([
        [null, 2.5],
        [0.5, 2.5],
        [5, 7.5],
        [20, 12.5],
        [30, 16],
        [50, 20],
        [60, 25],
        [300, 30],
    ])('%p km is worth %p%%', (distanceKm, gain) => {
        expect(scoreImage(distanceKm).gain).toBe(gain);
    });

    test('returns every part of the score', () => {
        expect(scoreImage(12)).toEqual({ distanceKm: 12, base: 2.5, bonus: 10, gain: 12.5 });
    });

    test('no coords gives just the base', () => {
        expect(scoreImage(undefined)).toEqual({ distanceKm: null, base: SCORING.baseGain, bonus: 0, gain: SCORING.baseGain });
    });
});

describe('SCORING config', () => {
    test('tiers go up in distance and bonus, and the last one covers any distance', () => {
        const tiers = SCORING.distanceBonus;
        for (let i = 1; i < tiers.length; i++) {
            expect(tiers[i].maxKm).toBeGreaterThan(tiers[i - 1].maxKm);
            expect(tiers[i].bonus).toBeGreaterThan(tiers[i - 1].bonus);
        }
        expect(tiers.at(-1).maxKm).toBe(Infinity);
    });
});

describe('countColorCells', () => {
    test('counts each colour by hex and skips transparent cells', () => {
        const grid = [
            [0, 0, 1],
            [null, 1, 2],
        ];
        expect(countColorCells(grid, ['#ff0000', '#00ff00', '#0000ff'])).toEqual(
            new Map([['#ff0000', 2], ['#00ff00', 2], ['#0000ff', 1]])
        );
    });

    test('a colour with no cells counts 0', () => {
        expect(countColorCells([[0, 0]], ['#ff0000', '#00ff00']).get('#00ff00')).toBe(0);
    });
});

describe('weightedProgress', () => {
    // Red is 60% of the picture, green 40%
    const cells = new Map([['#ff0000', 60], ['#00ff00', 40]]);

    test('weights each colour by how much of the picture it covers', () => {
        const scores = new Map([['#ff0000', 50], ['#00ff00', 25]]);
        expect(weightedProgress(['#ff0000', '#00ff00'], cells, scores)).toBe(40);
    });

    test('colours without a score count as 0', () => {
        expect(weightedProgress(['#ff0000', '#00ff00'], cells, new Map([['#ff0000', 100]]))).toBe(60);
    });

    test('only the given colours count (a player\'s own completion)', () => {
        const scores = new Map([['#ff0000', 50], ['#00ff00', 100]]);
        expect(weightedProgress(['#ff0000'], cells, scores)).toBe(50);
    });

    test('scores above 100 count as 100', () => {
        expect(weightedProgress(['#ff0000'], cells, new Map([['#ff0000', 130]]))).toBe(100);
    });

    test('no colours, or colours with no cells, is 0', () => {
        expect(weightedProgress([], cells, new Map())).toBe(0);
        expect(weightedProgress(['#0000ff'], cells, new Map([['#0000ff', 100]]))).toBe(0);
    });
});

describe('progressPercent', () => {
    test.each([
        [0, 0],
        [-3, 0],
        [0.2, 1],
        [1.4, 1],
        [40.5, 41],
        [99.6, 99],
        [100, 100],
        [120, 100],
    ])('%p -> %p', (progress, percent) => {
        expect(progressPercent(progress)).toBe(percent);
    });
});
