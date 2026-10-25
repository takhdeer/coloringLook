import '../pages/PlayMembersColumn.css'
import './ViewGroups.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

// Cover colours for the colouring books, handed out in list order so no two books share one
const COVER_COLORS = ['#f4a261', '#e76f51', '#2a9d8f', '#8ab17d', '#e9c46a', '#a28bd4', '#6fa8dc', '#f28fad']
const PETAL_COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#74c0fc']

// Past the fixed colours, step the hue by the golden angle so every extra book still gets a new colour
function coverColor(index) {
    if (index < COVER_COLORS.length) return COVER_COLORS[index]
    const hue = Math.round((index * 137.508) % 360)
    return `hsl(${hue}, 60%, 65%)`
}

// A colouring book whose flower gets one more petal coloured in for every 20% of progress
function ColoringBookIcon({ color, progress }) {
    const coloredPetals = Math.floor((Number(progress) || 0) / 20)

    return (
        <svg className="group-book-svg" viewBox="0 0 100 124" aria-hidden="true">
            {/* Pages peeking out from behind the cover */}
            <rect x="12" y="8" width="84" height="112" rx="6" fill="#fff" stroke="#111" strokeWidth="2.5" />
            <line x1="90" y1="14" x2="90" y2="114" stroke="#111" strokeWidth="1" opacity="0.4" />
            {/* Cover and spine */}
            <rect x="4" y="4" width="84" height="112" rx="6" fill={color} stroke="#111" strokeWidth="2.5" />
            <path d="M18 4 V116" stroke="#111" strokeWidth="2.5" />
            <path d="M11 14 V106" stroke="#111" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
            {/* Line-art panel on the cover */}
            <rect x="26" y="20" width="54" height="66" rx="4" fill="#fff" stroke="#111" strokeWidth="2" />
            <g transform="translate(53 50)">
                {PETAL_COLORS.map((petalColor, i) => (
                    <ellipse
                        key={petalColor}
                        cx="0"
                        cy="-12"
                        rx="7"
                        ry="11"
                        transform={`rotate(${i * 72})`}
                        fill={i < coloredPetals ? petalColor : '#fff'}
                        stroke="#111"
                        strokeWidth="1.8"
                    />
                ))}
                <circle r="6" fill={coloredPetals >= 5 ? '#ffd43b' : '#fff'} stroke="#111" strokeWidth="1.8" />
            </g>
            <path d="M53 62 V82 M53 74 q-8 -2 -10 -8 M53 72 q8 -2 10 -8" fill="none" stroke="#111" strokeWidth="1.8" strokeLinecap="round" />
            {/* Title lines */}
            <rect x="30" y="94" width="46" height="5" rx="2.5" fill="#fff" stroke="#111" strokeWidth="1.5" />
            <rect x="36" y="103" width="34" height="4" rx="2" fill="#fff" stroke="#111" strokeWidth="1.5" opacity="0.7" />
        </svg>
    )
}

const LABEL_MAX_FONT = 16
const LABEL_MIN_FONT = 8

// A book's name on one line, shrinking the font until it fits the book's width. A name that still
// doesn't fit at LABEL_MIN_FONT wraps onto more lines instead of being cut off.
function FitLabel({ text }) {
    const ref = useRef(null)
    const [fontSize, setFontSize] = useState(LABEL_MAX_FONT)

    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return

        const fit = () => {
            let size = LABEL_MAX_FONT
            el.style.whiteSpace = 'nowrap'
            el.style.fontSize = `${size}px`
            while (size > LABEL_MIN_FONT && el.scrollWidth > el.clientWidth) {
                size -= 0.5
                el.style.fontSize = `${size}px`
            }
            el.style.whiteSpace = ''
            setFontSize(size)
        }

        fit()
        // Fit again when the column resizes (window resize, layout switching to one column)
        const observer = new ResizeObserver(fit)
        observer.observe(el.parentElement)
        return () => observer.disconnect()
    }, [text])

    return (
        <span
            ref={ref}
            className={`group-book-label${fontSize <= LABEL_MIN_FONT ? ' is-wrapped' : ''}`}
            style={{ fontSize: `${fontSize}px` }}
        >
            {text}
        </span>
    )
}

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
                if (!cancelled) setErrorMessage('Could not load books')
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
            alert('Could not leave the book')
        }
    }

    return (
        <div className="heading">
            <div className='top-bar'>
            <h2 className="play-members-title">books</h2>
            <div className="dashboard-actions">
                <button className="dashboard-btn" onClick={() => navigate('/join')}>
                    join book
                </button>
                <button className="dashboard-btn" onClick={() => navigate('/groups')}>
                    create book
                </button>
            </div>
            </div>
            {loading ? (
                <p className="play-members-empty">loading...</p>
            ) : errorMessage ? (
                <p className="play-members-empty">{errorMessage}</p>
            ) : groups.length === 0 ? (
                <p className="play-members-empty">You are not in any books yet</p>
            ) : (
                <ul className="group-books">
                    {groups.map((group, index) => (
                        <li
                            key={group.id}
                            className={`group-book${openGroupId === group.id ? ' is-open' : ''}`}
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
                            <div className="group-book-cover">
                                <ColoringBookIcon color={coverColor(index)} progress={group.progress} />
                                <span className="group-book-progress">{group.progress}%</span>
                                <button
                                    type="button"
                                    className="group-leave-btn"
                                    onClick={(e) => handleLeave(e, group)}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    aria-label={`leave ${group.name}`}
                                    title="leave book"
                                >
                                    <img className="group-leave-icon" src={trashIcon} alt="" />
                                </button>
                            </div>
                            <FitLabel text={group.name} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
