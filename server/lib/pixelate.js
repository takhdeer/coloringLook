const sharp = require('sharp');

// Turns an image (SVG, PNG, JPG...) into a grid of palette indexes for colouring.
// Returns { cols, rows, palette: ['#rrggbb', ...], grid: [[index | null, ...], ...] }
// where grid[y][x] is the palette colour of that cell, or null if the cell is transparent.
// minDistance (CIELAB ΔE, 0 = off) merges picked colours that look closer than that, so the
// palette ends up with clearly different colours (fewer than `colors` if some were similar).
async function pixelate(input, { cols = 32, colors = 8, palette, minDistance = 0 } = {}) {
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

    let centers = palette
        ? palette.map(hexToRgb)
        : kMeans(cells.filter(Boolean), colors);
    if (!palette && minDistance > 0) {
        centers = mergeSimilar(cells.filter(Boolean), centers, minDistance);
    }

    // With merging on, cells go to the colour they look closest to (so shaded beige doesn't
    // land on yellow); otherwise plain RGB distance as before
    const pick = minDistance > 0 ? nearestLab : nearest;
    const grid = [];
    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
            const cell = cells[y * cols + x];
            row.push(cell ? pick(cell, centers) : null);
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

// Repeatedly merges the two colours that look most alike (CIELAB ΔE) until every pair is at
// least minDistance apart. A merged colour is the average of both, weighted by how many pixels
// each covered, so big areas keep their colour.
function mergeSimilar(pixels, centers, minDistance) {
    const counts = centers.map(() => 0);
    for (const px of pixels) counts[nearest(px, centers)]++;
    let groups = centers.map((rgb, i) => ({ rgb, count: counts[i] })).filter((g) => g.count > 0);

    while (groups.length > 1) {
        let best = null;
        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const d = deltaE(groups[i].rgb, groups[j].rgb);
                if (!best || d < best.d) best = { i, j, d };
            }
        }
        if (best.d >= minDistance) break;

        const a = groups[best.i], b = groups[best.j];
        const count = a.count + b.count;
        const rgb = a.rgb.map((v, k) => Math.round((v * a.count + b.rgb[k] * b.count) / count));
        groups = groups.filter((_, k) => k !== best.i && k !== best.j).concat({ rgb, count });
    }

    // Biggest areas first, so palette order is stable and meaningful
    return groups.sort((a, b) => b.count - a.count).map((g) => g.rgb);
}

// Like nearest(), but by how different the colours look (ΔE) rather than raw RGB
function nearestLab(px, centers) {
    let best = 0, bestDist = Infinity;
    for (let c = 0; c < centers.length; c++) {
        const d = deltaE(px, centers[c]);
        if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
}

// How different two colours look to the eye (CIE76 ΔE: ~2 is barely visible, 50+ is very different)
function deltaE(a, b) {
    const la = rgbToLab(a), lb = rgbToLab(b);
    return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

function rgbToLab(rgb) {
    const [r, g, b] = rgb.map((v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
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

// Finds the palette colour that looks closest to `color` ('#rrggbb' or [r, g, b]), the same way
// picture cells are matched. Returns { paletteIndex, color: '#rrggbb', distance } where distance
// is ΔE (0 = exact, under ~10 is a close match, 50+ is a very different colour), or null if the
// palette is empty.
function matchPaletteColor(color, palette) {
    if (!palette || palette.length === 0) return null;
    const rgb = typeof color === 'string' ? hexToRgb(color) : color;
    if (!Array.isArray(rgb) || rgb.length !== 3 || rgb.some((v) => !Number.isFinite(v))) {
        throw new Error('color must be "#rrggbb" or [r, g, b]');
    }
    const paletteRgb = palette.map(hexToRgb);
    const paletteIndex = nearestLab(rgb, paletteRgb);
    const distance = deltaE(rgb, paletteRgb[paletteIndex]);
    return { paletteIndex, color: palette[paletteIndex], distance: Math.round(distance) };
}

// Matching a photo's colour to a picture colour has to forgive lighting (a blue in shadow is still
// blue) but never equate different colours (blue isn't green), so it compares hue for coloured
// colours and brightness for greys/whites/blacks, and never matches one kind with the other.
const PHOTO_HUE_TOLERANCE = 35;          // degrees on the colour wheel
const PHOTO_NEUTRAL_CHROMA = 0.2;        // below this (0-1), a colour counts as grey/white/black
const PHOTO_LIGHTNESS_TOLERANCE = 30;    // CIELAB L, 0-100, for comparing greys

// The candidate colour a photo colour counts as, or null if it isn't close to any of them.
// Returns { color, index, difference } where difference is degrees of hue (coloured) or
// lightness points (greys); smaller is closer.
function matchPhotoColor(photoColor, candidates) {
    let best = null;
    for (const c of comparePhotoColor(photoColor, candidates)) {
        if (c.close && (!best || c.difference < best.difference)) {
            best = { color: c.color, index: c.index, difference: c.difference };
        }
    }
    return best;
}

// How close a photo colour is to each candidate, for showing the player. One entry per candidate:
// { color, index, kind, difference, tolerance, close } where kind is 'hue' (both coloured,
// difference in degrees), 'lightness' (both grey, difference in CIELAB L) or 'mismatch' (one
// coloured and one grey, never close; difference and tolerance are null).
function comparePhotoColor(photoColor, candidates) {
    const photo = hexToRgb(photoColor);
    return candidates.map((hex, index) => {
        const { kind, difference, tolerance } = photoDifference(photo, hexToRgb(hex));
        const rounded = difference === null ? null : Math.round(difference);
        return { color: hex, index, kind, difference: rounded, tolerance, close: difference !== null && difference <= tolerance };
    });
}

function photoDifference(photo, ref) {
    const chroma = (c) => (Math.max(...c) - Math.min(...c)) / 255;
    const photoNeutral = chroma(photo) < PHOTO_NEUTRAL_CHROMA;
    const refNeutral = chroma(ref) < PHOTO_NEUTRAL_CHROMA;
    if (photoNeutral !== refNeutral) return { kind: 'mismatch', difference: null, tolerance: null };

    if (refNeutral) {
        const d = Math.abs(rgbToLab(photo)[0] - rgbToLab(ref)[0]);
        return { kind: 'lightness', difference: d, tolerance: PHOTO_LIGHTNESS_TOLERANCE };
    }
    let d = Math.abs(hue(photo) - hue(ref));
    d = Math.min(d, 360 - d);
    return { kind: 'hue', difference: d, tolerance: PHOTO_HUE_TOLERANCE };
}

// Position on the colour wheel, 0-360 (red 0, yellow 60, green 120, blue 240)
function hue([r, g, b]) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return 0;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
}

module.exports = { pixelate, matchPaletteColor, matchPhotoColor, comparePhotoColor };
