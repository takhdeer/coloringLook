import { useEffect, useState } from 'react'
import './PlayPictureGrid.css'

// The group's pixelated picture, drawn as a grid of coloured cells
export default function PlayPictureGrid({ groupId }) {
    const [picture, setPicture] = useState(null)
    const [error, setError] = useState(null)

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
        <div
            className="play-grid"
            style={{
                gridTemplateColumns: `repeat(${picture.cols}, 1fr)`,
                aspectRatio: `${picture.cols} / ${picture.rows}`,
            }}
        >
            {picture.grid.flatMap((row, y) => row.map((cell, x) => (
                <div
                    key={`${x},${y}`}
                    className={cell === null ? 'play-grid-cell-empty' : undefined}
                    style={cell === null ? undefined : { background: picture.palette[cell] }}
                />
            )))}
        </div>
    )
}
