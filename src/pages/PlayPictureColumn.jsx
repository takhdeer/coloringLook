import { useEffect, useState } from 'react'
import './PlayPictureColumn.css'

export default function PlayPictureColumn({ groupId }) {
    const [picture, setPicture] = useState(null)
    const [error, setError] = useState(null)

    // The group's pixelated picture
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

    if (error) {
        return (
            <section className="play-col play-picture">
                <p className="play-picture-message">couldn't load the picture: {error}</p>
            </section>
        )
    }
    if (!picture) {
        return (
            <section className="play-col play-picture">
                <p className="play-picture-message">loading picture...</p>
            </section>
        )
    }

    return (
        <section className="play-col play-picture">
            <div
                className="play-picture-grid"
                style={{
                    gridTemplateColumns: `repeat(${picture.cols}, 1fr)`,
                    aspectRatio: `${picture.cols} / ${picture.rows}`,
                }}
            >
                {picture.grid.flatMap((row, y) => row.map((cell, x) => (
                    <div
                        key={`${x},${y}`}
                        className={'play-picture-cell' + (cell === null ? ' play-picture-cell-empty' : '')}
                        style={cell === null ? undefined : { background: picture.palette[cell] }}
                    />
                )))}
            </div>
        </section>
    )
}
