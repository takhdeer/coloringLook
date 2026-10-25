import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './PlayPictureGrid.css'

// The group's pixelated picture, drawn on a canvas so every square is exactly the same size
export default function PlayPictureGrid({ groupId }) {
    const [picture, setPicture] = useState(null)
    const [error, setError] = useState(null)
    const boxRef = useRef(null)
    const canvasRef = useRef(null)
    // Width available for the grid, in CSS pixels; follows the column as the window resizes
    const [boxWidth, setBoxWidth] = useState(0)

    useEffect(() => {
        if (!groupId) return
        let cancelled = false

        const load = async () => {
            try {
                const res = await fetch(`/api/pixelate/group/${groupId}`)
                const data = await res.json()
                if (!res.ok) throw new Error(data.message || `status ${res.status}`)
                if (!cancelled) {
                    setPicture(data)
                    setError(null)
                }
            } catch (err) {
                if (!cancelled) setError(err.message)
            }
        }

        load()
        return () => { cancelled = true }
    }, [groupId])

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
    useLayoutEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !picture || boxWidth === 0) return

        const dpr = window.devicePixelRatio || 1
        const square = Math.max(1, Math.floor(boxWidth * dpr / picture.cols))
        // A one-pixel line between squares once they're big enough to spare it
        const gap = square >= 6 ? 1 : 0

        canvas.width = square * picture.cols
        canvas.height = square * picture.rows
        canvas.style.width = `${canvas.width / dpr}px`
        canvas.style.height = `${canvas.height / dpr}px`

        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        picture.grid.forEach((row, y) => row.forEach((cell, x) => {
            if (cell === null) return
            // Filled-in cells show their colour, the rest stay grey until that colour's score fills them
            ctx.fillStyle = picture.filled[y][x] ? picture.palette[cell] : picture.greyPalette[cell]
            ctx.fillRect(x * square, y * square, square - gap, square - gap)
        }))
    }, [picture, boxWidth])

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
