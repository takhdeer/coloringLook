import './createGroup.css'
import { useNavigate } from 'react-router'
import { useState } from 'react'

export default function CreateGroup() {
    const navigate = useNavigate()
    const [roomName, setRoomName] = useState('')
    const [friend, setFriend] = useState('')
    const [friends, setFriends] = useState([])
    const [errorMessage, setErrorMessage] = useState('')

    const handleBack = () => navigate('/dashboard')

    const handleAddFriend = () => {
        const name = friend.trim()
        if (!name) return
        if (friends.includes(name)) {
            setErrorMessage(`${name} is already invited`)
            return
        }
        setFriends([...friends, name])
        setFriend('')
        setErrorMessage('')
    }

    // Enter in the friend box adds them instead of submitting the form
    const handleFriendKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleAddFriend()
        }
    }

    const handleRemoveFriend = (name) => {
        setFriends(friends.filter((f) => f !== name))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!roomName.trim()) {
            setErrorMessage('Give your room a name')
            return
        }
        if (friends.length === 0) {
            setErrorMessage('Invite at least one friend')
            return
        }
        setErrorMessage('')
        // TODO: send to /api/createGroup once the backend is hooked up
        console.log('Create room', { groupName: roomName.trim(), groupMembers: friends })
    }

    return (
        <div className="dashboard">
            <button className="create-group-back" onClick={handleBack}>
                {"<"}
            </button>

            <h1 className="dashboard-title">New Room</h1>

            <form className="create-group-card" onSubmit={handleSubmit}>
                <div className="create-group-field">
                    <label htmlFor="roomName" className="form-label">
                        room name
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        id="roomName"
                        placeholder="the crayon crew"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)} />
                </div>

                <div className="create-group-field">
                    <label htmlFor="friend" className="form-label">
                        invite friends
                    </label>
                    <div className="create-group-invite">
                        <input
                            type="text"
                            className="form-control"
                            id="friend"
                            placeholder="username"
                            value={friend}
                            onChange={(e) => setFriend(e.target.value)}
                            onKeyDown={handleFriendKeyDown} />
                        <button
                            type="button"
                            className="create-group-add"
                            onClick={handleAddFriend}>
                            +
                        </button>
                    </div>
                </div>

                {friends.length > 0 ? (
                    <ul className="create-group-friends">
                        {friends.map((name) => (
                            <li key={name} className="create-group-chip">
                                {name}
                                <button
                                    type="button"
                                    aria-label={`remove ${name}`}
                                    onClick={() => handleRemoveFriend(name)}>
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="create-group-empty">no friends invited yet</p>
                )}

                {errorMessage ? <p className="create-group-error">{errorMessage}</p> : null}

                <div className="create-group-submit">
                    <button type="submit" className="dashboard-btn">
                        create room
                    </button>
                </div>
            </form>
        </div>
    )
}
