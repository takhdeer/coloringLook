import '../pages/Dashboard.css'
import './joinGroup.css'
import { useNavigate } from 'react-router'
import { useState } from 'react'

export default function JoinGroup() {
    const navigate = useNavigate()
    const [groupId, setGroupId] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    const handleBack = () => navigate('/dashboard')

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!groupId.trim()) {
            setErrorMessage('Enter a group id')
            return
        }
        setErrorMessage('')
        // TODO: send to the join group endpoint once the backend is hooked up
        console.log('Join room', { groupId: groupId.trim() })
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
                        group id
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
