import '../pages/Spawn.css'
import './joinGroup.css'
import { useNavigate, useSearchParams } from 'react-router'
import { useState } from 'react'
import { supabase } from '../lib/supabase.mjs'

export default function JoinGroup() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    // Invite emails link to /join?groupId=...
    const [groupId, setGroupId] = useState(searchParams.get('groupId') ?? '')
    const [errorMessage, setErrorMessage] = useState('')

    const handleBack = () => navigate('/play')

    const handleSubmit = async (e) => {
        e.preventDefault()
        // Pasted ids often carry spaces or a line break
        const id = groupId.trim()
        if (!id) {
            setErrorMessage('Enter a book id')
            return
        }
        setErrorMessage('')

        const { data: authData, error } = await supabase.auth.getUser()
        if (error) {
            console.log('Could not get user', error.message)
            setErrorMessage('Could not get user')
            return
        }
        if (!authData.user) {
            console.log('No Signed-in user')
            navigate('/login')
            return
        }
        const userId = authData.user.id

        // TODO: friends are usernames, but the backend expects user ids
        const res = await fetch('http://localhost:3001/api/joinGroup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ groupId: groupId.trim(), member: userId})
        });
        const data = await res.json().catch(() => ({}))

        // Joined, or already a member: either way, open the group
        if (res.ok || data.groupId) {
            navigate(`/play/${data.groupId ?? id}`)
            return
        }

        setErrorMessage(data.message || 'Server Error')
        navigate(`/play/${encodeURIComponent(groupId.trim())}`)
    }

    return (
        <div className="dashboard">
            <button className="join-group-back" onClick={handleBack}>
                {"<"}
            </button>

            <h1 className="dashboard-title">Join Room</h1>

            <form className="join-group-card" onSubmit={handleSubmit}>
                <div className="join-group-field">
                    <label htmlFor="groupId" className="form-label">
                        book id
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        id="groupId"
                        placeholder="paste the id your friend sent you"
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)} />
                </div>

                {errorMessage ? <p className="join-group-error">{errorMessage}</p> : null}

                <div className="join-group-submit">
                    <button type="submit" className="dashboard-btn">
                        join room
                    </button>
                </div>
            </form>
        </div>
    )
}
