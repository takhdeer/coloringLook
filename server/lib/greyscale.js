// The grey with the same perceived brightness as '#rrggbb' (Rec. 601 luma), as '#llllll'
function toGreyHex(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 0xff;
    const g = (n >> 8) & 0xff;
    const b = n & 0xff;
    const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    return '#' + luma.toString(16).padStart(2, '0').repeat(3);
}

// A palette of '#rrggbb' colours turned grey, in the same order so grid indexes still line up
function greyscalePalette(palette) {
    return palette.map(toGreyHex);
}

module.exports = { toGreyHex, greyscalePalette };
