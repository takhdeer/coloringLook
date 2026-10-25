import '../pages/PlayMembersColumn.css'
import './ViewGroups.css'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { supabase } from '../lib/supabase.mjs'
import trashIcon from '../assets/trash-can.svg'

async function getGroups(userId) {
    const res = await fetch(`http://localhost:3001/api/getUserGroup/${encodeURIComponent(userId)}`);

    if (!res.ok) {
        console.log('Can not get user Groups')
        throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();
    return data.groups;
};

async function leaveGroup(groupId, userId) {
    const res = await fetch(
        `http://localhost:3001/api/leaveGroup/${encodeURIComponent(groupId)}/${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
    );

    if (!res.ok) {
        console.log('Can not leave group')
        throw new Error(`Request failed: ${res.status}`);
    }
};

// Changing refreshKey loads the groups again (e.g. after a score changes a group's progress)
export default function ViewGroups({ refreshKey }) {
    const navigate = useNavigate()
    const { groupId: openGroupId } = useParams()
    const [userId, setUserId] = useState(null)
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            const { data: authData, error } = await supabase.auth.getUser()
            if (error || !authData.user) {
                console.log('No Signed-in user')
                navigate('/login')
                return
            }

            if (!cancelled) setUserId(authData.user.id)

            try {
                const userGroups = await getGroups(authData.user.id)
                if (!cancelled) setGroups(userGroups)
            } catch (err) {
                if (!cancelled) setErrorMessage('Could not load groups')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [navigate, refreshKey])

    // The trash can on a row: leaves that group without also opening it
    const handleLeave = async (event, group) => {
        event.stopPropagation()
        if (!userId || !window.confirm(`Leave "${group.name}"?`)) return

        try {
            await leaveGroup(group.id, userId)
            setGroups((current) => current.filter((g) => g.id !== group.id))
            // Don't keep showing the picture of a group the user just left
            if (openGroupId === group.id) navigate('/play')
        } catch (err) {
            alert('Could not leave the group')
        }
    }

    return (
        <div className="heading">
            <div className='top-bar'>
            <h2 className="play-members-title">Groups</h2>
            <div className="dashboard-actions">
                <button className="dashboard-btn" onClick={() => navigate('/join')}>
                    join group
                </button>
                <button className="dashboard-btn" onClick={() => navigate('/groups')}>
                    create group
                </button>
            </div>
            </div>
            {loading ? (
                <p className="play-members-empty">loading...</p>
            ) : errorMessage ? (
                <p className="play-members-empty">{errorMessage}</p>
            ) : groups.length === 0 ? (
                <p className="play-members-empty">You are not in any groups yet</p>
            ) : (
                <ol className="play-members-list">
                    {groups.map((group) => (
                        <li
                            key={group.id}
                            className="play-members-row group-row"
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/play/${group.id}`)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    navigate(`/play/${group.id}`)
                                }
                            }}
                        >
                            <div className="play-members-header">
                                <span className="play-members-name">{group.name}</span>
                                <button
                                    type="button"
                                    className="group-leave-btn"
                                    onClick={(e) => handleLeave(e, group)}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    aria-label={`leave ${group.name}`}
                                    title="leave group"
                                >
                                    <img className="group-leave-icon" src={trashIcon} alt="" />
                                </button>
                                <span className='play-members-score'>{group.progress}</span>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};
