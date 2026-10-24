import '../pages/PlayMembersColumn.css'
import './ViewGroups.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase.mjs'

async function getGroups(userId) {
    const res = await fetch(`http://localhost:3001/api/getUserGroup/${encodeURIComponent(userId)}`);

    if (!res.ok) {
        console.log('Can not get user Groups')
        throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json();
    return data.groups;
};

export default function ViewGroups() {
    const navigate = useNavigate()
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
    }, [navigate])

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
                        <li key={group.id} className="play-members-row">
                            <div className="play-members-header">
                                <span className="play-members-name">{group.name}</span>
                                <span className='play-members-score'>{group.progress}</span>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};
