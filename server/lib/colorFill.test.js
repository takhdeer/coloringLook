const { describe, test, expect } = require('bun:test');
const { fillPercent, fillOrder, buildFill, progressFromFill } = require('./colorFill');

// A 10 × 10 picture: the top half is red (palette 0), the bottom half blue (palette 1), except one
// transparent cell in each half
function makeGrid() {
    const grid = Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, () => (y < 5 ? 0 : 1)));
    grid[0][0] = null;
    grid[9][9] = null;
    return grid;
}
const palette = ['#ff0000', '#0000ff'];

const filledCount = (filled) => filled.flat().reduce((sum, v) => sum + v, 0);

describe('fillPercent', () => {
    test.each([
        [0, 0],
        [2.5, 2],
        [40, 40],
        [99.9, 99],
        [100, 100],
        [250, 100],
        [-5, 0],
        [null, 0],
        ['abc', 0],
    ])('score %p fills %p%%', (score, percent) => {
        expect(fillPercent(score)).toBe(percent);
    });
});

describe('fillOrder', () => {
    test('lists every cell of the colour exactly once', () => {
        const cells = fillOrder(makeGrid(), 0, 123);
        expect(cells).toHaveLength(49);
        expect(new Set(cells.map(([x, y]) => `${x},${y}`)).size).toBe(49);
        expect(cells.every(([x, y]) => makeGrid()[y][x] === 0)).toBe(true);
    });

    test('the same seed always gives the same order', () => {
        expect(fillOrder(makeGrid(), 1, 42)).toEqual(fillOrder(makeGrid(), 1, 42));
    });

    test('a different seed gives a different order', () => {
        expect(fillOrder(makeGrid(), 1, 42)).not.toEqual(fillOrder(makeGrid(), 1, 43));
    });
});

describe('buildFill', () => {
    test('no scores leaves every cell unfilled', () => {
        const { filled, fill } = buildFill(7, makeGrid(), palette, {});
        expect(filledCount(filled)).toBe(0);
        expect(fill.map((f) => f.filledCells)).toEqual([0, 0]);
    });

    test('only the scored colour fills in, by its percent', () => {
        const grid = makeGrid();
        const { filled, fill } = buildFill(7, grid, palette, { '#0000ff': 40 });
        // 40% of blue's 49 cells, rounded
        expect(fill[1]).toEqual({ color: '#0000ff', score: 40, percent: 40, filledCells: 20, totalCells: 49 });
        expect(fill[0].filledCells).toBe(0);
        expect(filledCount(filled)).toBe(20);
        // Every filled cell is blue
        filled.forEach((row, y) => row.forEach((v, x) => {
            if (v) expect(grid[y][x]).toBe(1);
        }));
    });

    test('a higher score keeps the cells already filled and adds more', () => {
        const before = buildFill(7, makeGrid(), palette, { '#ff0000': 20 }).filled;
        const after = buildFill(7, makeGrid(), palette, { '#ff0000': 60 }).filled;
        before.forEach((row, y) => row.forEach((v, x) => {
            if (v) expect(after[y][x]).toBe(1);
        }));
        expect(filledCount(after)).toBeGreaterThan(filledCount(before));
    });

    test('scores over 100 fill the colour completely and no more', () => {
        const { fill } = buildFill(7, makeGrid(), palette, { '#ff0000': 180 });
        expect(fill[0].percent).toBe(100);
        expect(fill[0].filledCells).toBe(fill[0].totalCells);
    });

    test('transparent cells are never filled', () => {
        const { filled } = buildFill(7, makeGrid(), palette, { '#ff0000': 100, '#0000ff': 100 });
        expect(filled[0][0]).toBe(0);
        expect(filled[9][9]).toBe(0);
        expect(filledCount(filled)).toBe(98);
    });
});

describe('progressFromFill', () => {
    const fill = (filledCells, totalCells) => ({ filledCells, totalCells });

    test('is the share of all cells that are filled in, so big colours count for more', () => {
        // 30 of 60 + 0 of 40 -> 30% of the picture
        expect(progressFromFill([fill(30, 60), fill(0, 40)])).toBe(30);
    });

    test('nothing filled is 0, everything filled is 100', () => {
        expect(progressFromFill([fill(0, 60), fill(0, 40)])).toBe(0);
        expect(progressFromFill([fill(60, 60), fill(40, 40)])).toBe(100);
    });

    test('any filled cell counts as at least 1%, and almost done is 99%', () => {
        expect(progressFromFill([fill(1, 1000)])).toBe(1);
        expect(progressFromFill([fill(999, 1000)])).toBe(99);
    });

    test('a picture with no cells is 0', () => {
        expect(progressFromFill([])).toBe(0);
    });

    test('matches buildFill for a real grid', () => {
        // 40% of blue's 49 cells is 20 of the picture's 98 cells -> 20%
        const { fill: real } = buildFill(7, makeGrid(), palette, { '#0000ff': 40 });
        expect(progressFromFill(real)).toBe(20);
    });
});
