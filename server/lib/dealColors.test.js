const { describe, test, expect } = require('bun:test');
const { dealColors, newPlayerGetsColor } = require('./dealColors');

describe('dealColors', () => {
    test('deals round-robin to the players with the fewest colours, earlier player first', () => {
        expect(dealColors([[], [], []], ['a', 'b', 'c', 'd', 'e'])).toEqual([['a', 'd'], ['b', 'e'], ['c']]);
    });

    test('tops up whoever has fewest before anyone else', () => {
        expect(dealColors([['a', 'b'], []], ['c', 'd', 'e'])).toEqual([['a', 'b', 'e'], ['c', 'd']]);
    });

    test('with no players nothing is dealt', () => {
        expect(dealColors([], ['a'])).toEqual([]);
    });

    test('does not change its arguments', () => {
        const owned = [['a'], []];
        dealColors(owned, ['b']);
        expect(owned).toEqual([['a'], []]);
    });
});

describe('newPlayerGetsColor', () => {
    test('every colour already owned: no', () => {
        expect(newPlayerGetsColor([['a', 'b'], ['c']], [])).toBe(false);
    });

    test('nothing dealt yet and more colours than players: yes', () => {
        expect(newPlayerGetsColor([[], [], []], ['a', 'b', 'c', 'd'])).toBe(true);
    });

    test('nothing dealt yet and no more colours than players: no', () => {
        expect(newPlayerGetsColor([[], [], [], []], ['a', 'b', 'c', 'd'])).toBe(false);
    });

    test('a leftover colour goes to the newcomer over players who already have some', () => {
        expect(newPlayerGetsColor([['a'], ['b']], ['c'])).toBe(true);
    });

    test('a leftover colour goes to an earlier player who has none instead', () => {
        expect(newPlayerGetsColor([['a'], []], ['b'])).toBe(false);
    });

    test('first player into a group with a picture gets a colour', () => {
        expect(newPlayerGetsColor([], ['a'])).toBe(true);
    });

    test('a picture with no colours has nothing to give', () => {
        expect(newPlayerGetsColor([], [])).toBe(false);
    });
});
