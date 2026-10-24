// TEST ONLY: fake leaderboard players for /play (no groupId), so the column can be tried without the database.
// To remove: delete this file and the lines marked "TEST" in PlayMembersColumn.jsx and App.jsx.

const POLL_MS = 3000

let testPlayers = [
    { id: 't1', username: 'takh', score: 40, colors: ['#e63946', '#f4a261', '#2a9d8f'] },
    { id: 't2', username: 'jonas', score: 55, colors: ['#264653', '#e9c46a'] },
    { id: 't3', username: 'mira', score: 20, colors: ['#8338ec'] },
    { id: 't4', username: 'sam', score: 70, colors: ['#ff006e', '#3a86ff', '#fb5607', '#ffbe0b'] },
    { id: 't5', username: 'lee', score: 10, colors: [] },
]

// Feeds fake players to setPlayers, bumping a random score each tick so the reordering is visible.
// Returns a cleanup function that stops the updates.
export function startTestPlayers(setPlayers) {
    const tick = () => {
        const lucky = Math.floor(Math.random() * testPlayers.length)
        testPlayers = testPlayers.map((p, i) =>
            i === lucky ? { ...p, score: p.score + Math.floor(Math.random() * 30) + 1 } : p
        )
        setPlayers([...testPlayers].sort((a, b) => b.score - a.score).slice(0, 5))
    }

    tick()
    const timer = setInterval(tick, POLL_MS)
    return () => clearInterval(timer)
}
