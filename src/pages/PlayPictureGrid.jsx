import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './PlayPictureGrid.css'

// Newly filled-in cells are coloured by a highlighter swiped across each row, top to bottom like
// highlighting lines of text. The ink is see-through and fades once the swipe is done, leaving the
// cells in their colour.
const SWIPE_MIN_MS = 250 // a swipe over a short row
const SWIPE_MAX_MS = 700 // a swipe right across the picture
const INK_FADE_MS = 600 // the highlighter ink fading off after a swipe
const MAX_SPREAD_MS = 2500 // the last row's swipe starts at most this long after the first

// Which cells were filled in when the player last saw each group's picture, so cells filled in
// since (by this player or anyone else) get painted on. Storage can be unavailable (private windows).
const seenKey = (groupId) => `coloringlook:filled-seen:${groupId}`
const encodeFilled = (picture) => `${picture.cols}x${picture.rows}:`
    + picture.filled.map((row) => row.map((f) => (f ? '1' : '0')).join('')).join('')
function loadSeen(groupId) {
    try { return localStorage.getItem(seenKey(groupId)) } catch { return null }
}
function saveSeen(groupId, picture) {
    try { localStorage.setItem(seenKey(groupId), encodeFilled(picture)) } catch { /* everything just shows */ }
}

// The colour mixed towards white, for the wet shine on fresh paint
function lighten(hex, amount) {
    const n = parseInt(hex.slice(1), 16)
    const mix = (c) => Math.round(c + (255 - c) * amount)
    return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

// A snapshot where nothing was filled in, so every filled cell counts as new (the ?paint=1 preview)
const emptySeen = (picture) => `${picture.cols}x${picture.rows}:` + '0'.repeat(picture.cols * picture.rows)

// One highlighter swipe per row that has cells filled in since the last seen picture. Each swipe
// runs from its row's first new cell to its last, in the colour most of them are, starting `delay` ms
// after the animation does.
function findSwipes(picture, seen) {
    const prefix = `${picture.cols}x${picture.rows}:`
    // Nothing to compare with (first visit, or the picture changed): show it as it is
    if (!seen || !seen.startsWith(prefix)) return []
    const bits = seen.slice(prefix.length)

    const swipes = []
    picture.grid.forEach((row, y) => {
        const cells = []
        row.forEach((cell, x) => {
            if (cell !== null && picture.filled[y][x] && bits[y * picture.cols + x] !== '1') cells.push({ x, cell })
        })
        if (cells.length === 0) return

        const counts = {}
        cells.forEach((c) => { counts[c.cell] = (counts[c.cell] || 0) + 1 })
        const ink = Number(Object.keys(counts).reduce((a, b) => (counts[b] > counts[a] ? b : a)))
        const x0 = cells[0].x
        const x1 = cells[cells.length - 1].x + 1
        const duration = SWIPE_MIN_MS + (SWIPE_MAX_MS - SWIPE_MIN_MS) * ((x1 - x0) / picture.cols)
        swipes.push({ y, x0, x1, cells, ink, duration })
    })

    const spread = Math.min(MAX_SPREAD_MS, swipes.length * 180)
    swipes.forEach((swipe, i) => {
        swipe.delay = swipes.length > 1 ? (i / (swipes.length - 1)) * spread : 0
    })
    return swipes
}

// The group's pixelated picture, drawn on a canvas so every square is exactly the same size.
// Changing refreshKey loads the picture again (e.g. after a score fills in more cells).
// onProgress(progress) is called with the group's progress (0-100) every time the picture loads.
// While paused (e.g. a popup covers the picture), newly filled-in cells wait grey and get painted
// on once it's unpaused.
export default function PlayPictureGrid({ groupId, refreshKey, onProgress, paused = false }) {
    const [picture, setPicture] = useState(null)
    const [error, setError] = useState(null)
    const boxRef = useRef(null)
    const canvasRef = useRef(null)
    // Latest onProgress, so a new callback from the parent doesn't reload the picture
    const onProgressRef = useRef(onProgress)
    onProgressRef.current = onProgress
    // Width available for the grid, in CSS pixels; follows the column as the window resizes
    const [boxWidth, setBoxWidth] = useState(0)
    // The highlighter swipes still to play for the loaded picture, and when their animation started
    const [swipes, setSwipes] = useState([])
    const animStartRef = useRef(null)
    // ?paint=1 on the Play page's URL highlights the whole picture on its first load, to preview the animation
    const previewPaintRef = useRef(new URLSearchParams(window.location.search).has('paint'))

    useEffect(() => {
        if (!groupId) return
        let cancelled = false

        const load = async () => {
            try {
                const res = await fetch(`/api/pixelate/group/${groupId}`)
                const data = await res.json()
                if (!res.ok) throw new Error(data.message || `status ${res.status}`)
                if (!cancelled) {
                    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
                    const seen = previewPaintRef.current ? emptySeen(data) : loadSeen(groupId)
                    previewPaintRef.current = false
                    const found = reduceMotion ? [] : findSwipes(data, seen)
                    setSwipes(found)
                    animStartRef.current = null
                    // Cells only count as seen once they've been highlighted, so if the page reloads while
                    // a popup holds the animation back, it plays after the reload instead
                    if (found.length === 0) saveSeen(groupId, data)
                    setPicture(data)
                    setError(null)
                    onProgressRef.current?.(data.progress ?? 0)
                }
            } catch (err) {
                if (!cancelled) setError(err.message)
            }
        }

        load()
        return () => { cancelled = true }
    }, [groupId, refreshKey])

    // Track the space the grid can use
    useLayoutEffect(() => {
        const box = boxRef.current
        if (!box) return
        const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width))
        observer.observe(box)
        return () => observer.disconnect()
    }, [picture])

    // Draw the grid. Squares are a whole number of screen pixels each, so they're all identical;
    // the canvas is sized to exactly cols × square and centred in whatever space is left over.
    // Newly filled-in cells are drawn grey first, then highlighted in frame by frame.
    useLayoutEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !picture || boxWidth === 0) return

        const dpr = window.devicePixelRatio || 1
        const square = Math.max(1, Math.floor(boxWidth * dpr / picture.cols))
        // A one-pixel line between squares once they're big enough to spare it
        const gap = square >= 6 ? 1 : 0
        const size = square - gap

        canvas.width = square * picture.cols
        canvas.height = square * picture.rows
        canvas.style.width = `${canvas.width / dpr}px`
        canvas.style.height = `${canvas.height / dpr}px`

        // Everything except the cells being highlighted, drawn once and copied onto every frame
        const isNew = new Set()
        swipes.forEach((swipe) => swipe.cells.forEach((c) => isNew.add(swipe.y * picture.cols + c.x)))
        const base = document.createElement('canvas')
        base.width = canvas.width
        base.height = canvas.height
        const baseCtx = base.getContext('2d')
        picture.grid.forEach((row, y) => row.forEach((cell, x) => {
            if (cell === null) return
            // Filled-in cells show their colour, the rest stay grey until that colour's score fills them
            const showColour = picture.filled[y][x] && !isNew.has(y * picture.cols + x)
            baseCtx.fillStyle = showColour ? picture.palette[cell] : picture.greyPalette[cell]
            baseCtx.fillRect(x * square, y * square, size, size)
        }))

        const ctx = canvas.getContext('2d')
        const drawBase = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(base, 0, 0)
        }

        if (swipes.length === 0 || paused) {
            // Pausing part-way starts the highlighting over once it's unpaused
            animStartRef.current = null
            drawBase()
            return
        }

        const ink = picture.palette.map((hex) => lighten(hex, 0.25))
        // A highlighter is a bit taller than a line of text: here, a bit taller than a row, and never
        // so thin it can't be seen
        const inkHeight = Math.max(square * 1.5, 8 * dpr)
        // The chisel tip slants the ends of the stroke
        const slant = inkHeight * 0.35

        let frame = null
        const drawFrame = (now) => {
            if (animStartRef.current === null) {
                animStartRef.current = now
                saveSeen(groupId, picture)
            }
            const elapsed = now - animStartRef.current
            drawBase()

            let busy = false
            const strokes = []
            for (const swipe of swipes) {
                const t = (elapsed - swipe.delay) / swipe.duration
                if (t <= 0) { busy = true; continue }

                const start = swipe.x0 * square
                const tip = start + (swipe.x1 * square - start) * easeInOut(Math.min(1, t))
                // Cells colour in as the tip passes their middle
                swipe.cells.forEach((c) => {
                    if ((c.x + 0.5) * square > tip) return
                    ctx.fillStyle = picture.palette[c.cell]
                    ctx.fillRect(c.x * square, swipe.y * square, size, size)
                })

                const fade = t < 1 ? 0 : (elapsed - swipe.delay - swipe.duration) / INK_FADE_MS
                if (fade < 1) {
                    busy = true
                    strokes.push({ swipe, start, tip, alpha: 0.45 * (1 - fade) })
                }
            }

            // The ink goes on top, multiplied like real highlighter so the cells show through it
            ctx.globalCompositeOperation = 'multiply'
            for (const { swipe, start, tip, alpha } of strokes) {
                const middle = swipe.y * square + size / 2
                const top = middle - inkHeight / 2
                const bottom = middle + inkHeight / 2
                ctx.globalAlpha = alpha
                ctx.fillStyle = ink[swipe.ink]
                ctx.beginPath()
                ctx.moveTo(start + slant, top)
                ctx.lineTo(tip + slant, top)
                ctx.lineTo(tip, bottom)
                ctx.lineTo(start, bottom)
                ctx.closePath()
                ctx.fill()
                // Ink pools a little darker where the tip first touched down
                const pool = Math.min(start + slant * 1.5, tip)
                ctx.globalAlpha = alpha * 0.5
                ctx.beginPath()
                ctx.moveTo(start + slant, top)
                ctx.lineTo(pool + slant, top)
                ctx.lineTo(pool, bottom)
                ctx.lineTo(start, bottom)
                ctx.closePath()
                ctx.fill()
            }
            ctx.globalCompositeOperation = 'source-over'
            ctx.globalAlpha = 1

            if (busy) {
                frame = requestAnimationFrame(drawFrame)
            } else {
                // All highlighted: from now on the picture is drawn plainly
                setSwipes([])
            }
        }
        frame = requestAnimationFrame(drawFrame)
        return () => cancelAnimationFrame(frame)
    }, [groupId, picture, boxWidth, swipes, paused])

    if (!groupId) {
        return <p className="play-grid-message">pick a group on the left to see its picture</p>
    }
    if (error) {
        return <p className="play-grid-message">couldn't load the picture: {error}</p>
    }
    if (!picture) {
        return <p className="play-grid-message">loading picture...</p>
    }

    return (
        <div ref={boxRef} className="play-grid">
            <canvas ref={canvasRef} className="play-grid-canvas" role="img" aria-label="the group's picture" />
        </div>
    )
}
