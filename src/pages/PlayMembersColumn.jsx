import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.mjs'
import './PlayMembersColumn.css'

const MAX_PLAYERS = 5
const POLL_MS = 3000

export default function PlayMembersColumn({ groupId }) {
    const [players, setPlayers] = useState([])
    const [error, setError] = useState(null)
    const rowRefs = useRef(new Map())
    const prevTops = useRef(new Map())
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteStatus, setInviteStatus] = useState(null)   // { ok, message }
    const [inviting, setInviting] = useState(false)

    const handleInvite = async (e) => {
        e.preventDefault()
        if (!inviteEmail.trim()) return
        setInviting(true)
        setInviteStatus(null)
        try {
            const { data: authData } = await supabase.auth.getUser()
            if (!authData?.user) throw new Error('sign in to invite friends')

            const res = await fetch('/api/inviteGroup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId, inviterId: authData.user.id, email: inviteEmail.trim() }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.message || data.error || `status ${res.status}`)

            setInviteStatus({ ok: true, message: 'invite sent' })
            setInviteEmail('')
        } catch (err) {
            setInviteStatus({ ok: false, message: err.message })
        } finally {
            setInviting(false)
        }
    }

    // Poll the server so the board reorders as scores change
    useEffect(() => {
        if (!groupId) return
        let cancelled = false

        const load = async () => {
            try {
                const res = await fetch(`/api/leaderboard/${groupId}`)
                if (!res.ok) throw new Error(`status ${res.status}`)
                const data = await res.json()
                if (cancelled) return
                const sorted = [...data.players]
                    .sort((a, b) => b.score - a.score)
                    .slice(0, MAX_PLAYERS)
                setPlayers(sorted)
                setError(null)
            } catch (err) {
                if (!cancelled) setError(err.message)
            }
        }

        load()
        const timer = setInterval(load, POLL_MS)
        return () => {
            cancelled = true
            clearInterval(timer)
        }
    }, [groupId])

    // Slide rows from their old position to the new one when the order changes
    useLayoutEffect(() => {
        rowRefs.current.forEach((el, id) => {
            // offsetTop is the layout position, unaffected by scroll or an in-progress slide
            const top = el.offsetTop
            const prev = prevTops.current.get(id)
            if (prev !== undefined && prev !== top) {
                el.style.transition = 'none'
                el.style.transform = `translateY(${prev - top}px)`
                // Force a reflow so the browser registers the start position, then let it slide back
                void el.offsetHeight
                el.style.transition = ''
                el.style.transform = ''
            }
            prevTops.current.set(id, top)
        })
    }, [players])

    return (
        <section className="play-members">
            <h2 className="play-members-title">leaderboard</h2>

            {error && players.length === 0 && (
                <p className="play-members-empty">couldn't load players</p>
            )}
            {!error && players.length === 0 && (
                <p className="play-members-empty">no players yet</p>
            )}

            <ol className="play-members-list">
                {players.map((player, i) => (
                    <li
                        key={player.id}
                        className="play-members-row"
                        ref={(el) => {
                            if (el) rowRefs.current.set(player.id, el)
                            else rowRefs.current.delete(player.id)
                        }}
                    >
                        <div className="play-members-header">
                            <span className="play-members-rank">{i + 1}</span>
                            <span className="play-members-name">{player.username}</span>
                            <span className="play-members-score">{player.score}</span>
                        </div>
                        <div className="play-members-colors">
                            {player.colors.map((color, j) => (
                                <span
                                    key={j}
                                    className="play-members-dot"
                                    style={{ background: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                    </li>
                ))}
            </ol>

            {groupId && (
                <form className="play-members-invite" onSubmit={handleInvite}>
                    <input
                        type="email"
                        className="play-members-invite-input"
                        placeholder="friend's email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <button type="submit" className="play-members-invite-btn" disabled={inviting}>
                        {inviting ? 'sending…' : 'invite'}
                    </button>
                    {inviteStatus && (
                        <p className={`play-members-invite-status${inviteStatus.ok ? '' : ' is-error'}`}>
                            {inviteStatus.message}
                        </p>
                    )}
                </form>
            )}
        </section>
    )
}
