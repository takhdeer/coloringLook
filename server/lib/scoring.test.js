const { describe, test, expect } = require('bun:test');
const { SCORING, distanceBonus, scoreImage, progressPercent } = require('./scoring');

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
