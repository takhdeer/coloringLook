const sharp = require('sharp');

// Turns an image (SVG, PNG, JPG...) into a grid of palette indexes for colouring.
// Returns { cols, rows, palette: ['#rrggbb', ...], grid: [[index | null, ...], ...] }
// where grid[y][x] is the palette colour of that cell, or null if the cell is transparent.
async function pixelate(input, { cols = 32, colors = 8, palette } = {}) {
    // density only matters for SVGs: rasterise them sharp enough before shrinking
    const image = sharp(input, { density: 300 });
    const { width, height } = await image.metadata();
    const rows = Math.max(1, Math.round(cols * height / width));

    // Shrinking averages each block of the original into one pixel
    const { data } = await image
        .resize(cols, rows, { fit: 'fill', kernel: 'cubic' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const cells = [];
    for (let p = 0; p < cols * rows; p++) {
        const i = p * 4;
        cells.push(data[i + 3] < 128 ? null : [data[i], data[i + 1], data[i + 2]]);
    }

    const centers = palette
        ? palette.map(hexToRgb)
        : kMeans(cells.filter(Boolean), colors);

    const grid = [];
    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
            const cell = cells[y * cols + x];
            row.push(cell ? nearest(cell, centers) : null);
        }
        grid.push(row);
    }

    return { cols, rows, palette: centers.map(rgbToHex), grid };
}

// Picks k representative colours from a list of [r, g, b]
function kMeans(pixels, k) {
    if (pixels.length === 0) return [];
    k = Math.min(k, pixels.length);

    // Start from colours spread evenly through the list (sorted by brightness)
    const sorted = [...pixels].sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
    let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor((i + 0.5) * sorted.length / k)]);

    for (let iter = 0; iter < 15; iter++) {
        const sums = centers.map(() => [0, 0, 0, 0]);
        for (const px of pixels) {
            const c = nearest(px, centers);
            sums[c][0] += px[0]; sums[c][1] += px[1]; sums[c][2] += px[2]; sums[c][3]++;
        }
        centers = centers.map((c, i) => sums[i][3] ? sums[i].slice(0, 3).map((v) => Math.round(v / sums[i][3])) : c);
    }

    // Drop duplicate colours that ended up identical
    return [...new Map(centers.map((c) => [rgbToHex(c), c])).values()];
}

function nearest(px, centers) {
    let best = 0, bestDist = Infinity;
    for (let c = 0; c < centers.length; c++) {
        const d = (px[0] - centers[c][0]) ** 2 + (px[1] - centers[c][1]) ** 2 + (px[2] - centers[c][2]) ** 2;
        if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
}

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function rgbToHex(rgb) {
    return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Finds the palette colour closest to `color` ('#rrggbb' or [r, g, b]).
// Returns { paletteIndex, color: '#rrggbb', distance } where distance is the straight-line RGB
// distance (0 = exact match, up to ~441 for black vs white), or null if the palette is empty.
function matchPaletteColor(color, palette) {
    if (!palette || palette.length === 0) return null;
    const rgb = typeof color === 'string' ? hexToRgb(color) : color;
    if (!Array.isArray(rgb) || rgb.length !== 3 || rgb.some((v) => !Number.isFinite(v))) {
        throw new Error('color must be "#rrggbb" or [r, g, b]');
    }
    const paletteRgb = palette.map(hexToRgb);
    const paletteIndex = nearest(rgb, paletteRgb);
    const distance = Math.hypot(...rgb.map((v, i) => v - paletteRgb[paletteIndex][i]));
    return { paletteIndex, color: palette[paletteIndex], distance: Math.round(distance) };
}

module.exports = { pixelate, matchPaletteColor };
