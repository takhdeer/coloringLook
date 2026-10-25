import { useEffect, useState } from 'react'
import './PlayCompleted.css'
import PlayPictureGrid from './PlayPictureGrid'

// A Wordle-style "completed!" popup over the Play page: the finished picture, the group's score
// and its members. It assumes the picture is already complete; whatever tracks progress decides
// when to show it. onClose runs when the player clicks ✕, presses Esc or clicks outside.
export default function PlayCompleted({ groupId, onClose }) {
    const [players, setPlayers] = useState(null)

    // The group's members and scores, from the same route the leaderboard uses
    useEffect(() => {
        if (!groupId) return
        let cancelled = false
        fetch(`/api/leaderboard/${groupId}`)
            .then((res) => (res.ok ? res.json() : { players: [] }))
            .then((data) => { if (!cancelled) setPlayers(data.players ?? []) })
            .catch(() => { if (!cancelled) setPlayers([]) })
        return () => { cancelled = true }
    }, [groupId])

    // Esc closes it, like the upload popup
    useEffect(() => {
        const handleKeyDown = (event) => { if (event.key === 'Escape') onClose?.() }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    const list = players ?? []
    const totalScore = list.reduce((sum, p) => sum + Number(p.score), 0)
    const colorCount = new Set(list.flatMap((p) => p.colors)).size

    return (
        <div className="play-completed-overlay" onClick={onClose}>
            <div
                className="play-completed-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="play-completed-title"
                onClick={(event) => event.stopPropagation()}
            >
                <button type="button" className="play-completed-close" onClick={onClose} aria-label="close">
                    ✕
                </button>

                <h2 id="play-completed-title" className="play-completed-title">completed!</h2>

                <div className="play-completed-picture">
                    <PlayPictureGrid groupId={groupId} />
                </div>

                <div className="play-completed-stats">
                    <div className="play-completed-stat">
                        <span className="play-completed-stat-value">{totalScore}</span>
                        <span className="play-completed-stat-label">group score</span>
                    </div>
                    <div className="play-completed-stat">
                        <span className="play-completed-stat-value">{colorCount}</span>
                        <span className="play-completed-stat-label">colours</span>
                    </div>
                    <div className="play-completed-stat">
                        <span className="play-completed-stat-value">{list.length}</span>
                        <span className="play-completed-stat-label">members</span>
                    </div>
                </div>

                <ol className="play-completed-players">
                    {list.map((player, i) => (
                        <li key={player.id} className="play-completed-player">
                            <span className="play-completed-rank">{i + 1}</span>
                            <span className="play-completed-name">{player.username}</span>
                            <span className="play-completed-dots">
                                {player.colors.map((color) => (
                                    <span key={color} className="play-completed-dot" style={{ background: color }} />
                                ))}
                            </span>
                            <span className="play-completed-score">{player.score}</span>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    )
}
