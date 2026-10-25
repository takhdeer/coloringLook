import './createGroup.css'
import { useNavigate } from 'react-router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.mjs'
import { isHeic, toBrowserImage } from '../lib/heicImage'

export default function CreateGroup() {
    const navigate = useNavigate()
    const [roomName, setRoomName] = useState('')
    const [friend, setFriend] = useState('')
    const [friends, setFriends] = useState([])
    const [errorMessage, setErrorMessage] = useState('')
    const [picture, setPicture] = useState(null)
    const [previewUrl, setPreviewUrl] = useState('')
    const [preparingPicture, setPreparingPicture] = useState(false)
    const [creating, setCreating] = useState(false)
    const pictureInputRef = useRef(null)

    // Free the old preview when the picture changes or the page closes
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl)
        }
    }, [previewUrl])

    const handleBack = () => navigate('/play')

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

    const handlePictureChange = async (e) => {
        const original = e.target.files?.[0]
        // Clear the input so picking the same file again still fires onChange
        e.target.value = ''
        if (!original) return
        if (!original.type.startsWith('image/') && !isHeic(original)) {
            setErrorMessage('That file is not an image')
            return
        }

        setPreparingPicture(true)
        try {
            const file = await toBrowserImage(original)
            setPicture(file)
            setPreviewUrl(URL.createObjectURL(file))
            setErrorMessage('')
        } catch (err) {
            console.log('Could not convert the picture', err)
            setErrorMessage('Could not read that picture')
        } finally {
            setPreparingPicture(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!roomName.trim()) {
            setErrorMessage('Give your room a name')
            return
        }
        if (!picture) {
            setErrorMessage('Pick a picture to colour')
            return
        }
        if (friends.length === 0) {
            setErrorMessage('Invite at least one friend')
            return
        }
        setErrorMessage('')
        setCreating(true)
        try {
            await createRoom()
        } finally {
            setCreating(false)
        }
    }

    const createRoom = async () => {

        // getUser is async and returns { data, error }
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
        const res = await fetch('http://localhost:3001/api/createGroup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ groupName: roomName.trim(), groupMembers: [userId] })
        });

        if (!res.ok) {
            setErrorMessage('Server Error')
            return
        }
        const { groupId } = await res.json()

        const pictureName = picture.name.replace(/\.[^.]+$/, '')
        const imageRes = await fetch(
            `/api/groupImage?groupId=${groupId}&name=${encodeURIComponent(pictureName)}`, {
            method: 'POST',
            headers: { 'Content-Type': picture.type },
            body: picture,
        })
        if (!imageRes.ok) {
            const data = await imageRes.json().catch(() => ({}))
            setErrorMessage(data.message ?? 'Could not upload the picture')
            return
        }

        console.log('Created room', { groupName: roomName.trim(), groupMembers: friends })
        navigate('/play')
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
                    <label htmlFor="picture" className="form-label">
                        picture
                    </label>
                    <input
                        type="file"
                        id="picture"
                        accept="image/*,.heic,.heif"
                        hidden
                        ref={pictureInputRef}
                        onChange={handlePictureChange} />
                    <div className="create-group-picture">
                        {previewUrl ? (
                            <img src={previewUrl} alt="picture to colour" className="create-group-preview" />
                        ) : null}
                        <button
                            type="button"
                            className="create-group-upload"
                            disabled={preparingPicture}
                            onClick={() => pictureInputRef.current?.click()}>
                            {preparingPicture ? 'loading…' : picture ? 'change picture' : 'upload picture'}
                        </button>
                    </div>
                    {picture ? <p className="create-group-file">{picture.name}</p> : null}
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
                    <button 
                        type="submit" 
                        className="dashboard-btn"
                        disabled={creating || preparingPicture}>
                        {creating ? 'creating…' : 'create room'}
                    </button>
                </div>
            </form>
        </div>
    )
}
