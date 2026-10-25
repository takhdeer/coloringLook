// Deals the colours nobody owns yet: each one goes to the player with the fewest colours, and the
// earlier player (in the order given, i.e. join order) wins a tie. `owned` is one list of colours
// per player; returns new lists, leaving the arguments untouched.
function dealColors(owned, unowned) {
    const dealt = owned.map((list) => [...list]);
    if (dealt.length === 0) return dealt;
    for (const hex of unowned) {
        let pick = 0;
        dealt.forEach((list, i) => { if (list.length < dealt[pick].length) pick = i; });
        dealt[pick].push(hex);
    }
    return dealt;
}

// Whether one more player joining now would be dealt at least one colour. `owned` is the current
// players' colours (only those still in the palette), `unowned` the palette colours nobody has.
function newPlayerGetsColor(owned, unowned) {
    return dealColors([...owned, []], unowned).at(-1).length > 0;
}

module.exports = { dealColors, newPlayerGetsColor };
