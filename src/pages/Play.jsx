import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import './Play.css'
import logo from '../assets/coloringlook-logo.svg'
import PlayMembersColumn from './PlayMembersColumn'
import ViewGroups from '../components/ViewGroups'
import PlayPicture from './PlayPicture'
import PlayPictureGrid from './PlayPictureGrid'
import PlayCompleted from './PlayCompleted'
import PlayProgressBar from './PlayProgressBar'

// Remembers per group that the player closed the "completed!" popup, so a finished group doesn't
// pop it up on every visit. Storage can be unavailable (private windows); then it may show again.
const dismissKey = (groupId) => `coloringlook:completed-closed:${groupId}`
function wasDismissed(groupId) {
    try { return localStorage.getItem(dismissKey(groupId)) === '1' } catch { return false }
}
function rememberDismissed(groupId) {
    try { localStorage.setItem(dismissKey(groupId), '1') } catch { /* it may show again */ }
}

export default function Play() {
    const { groupId } = useParams()
    // Goes up each time a photo scores, so the grid reloads with the newly filled-in cells and the
    // group list with the new progress
    const [pictureVersion, setPictureVersion] = useState(0)
    const [searchParams] = useSearchParams()
    // The "completed!" popup opens once the group's progress reaches 100 (only a fully filled-in
    // picture is 100). Add ?completed=1 to the Play page's URL to preview it any time.
    // It's tied to the group it opened for, so switching groups in the left panel closes it.
    const [completedGroup, setCompletedGroup] = useState(searchParams.has('completed') ? groupId : null)
    // While the upload's confirm/result popup is open, "completed!" waits, so the player first sees
    // the points for the photo that finished the picture, then the celebration. The picture also
    // holds back its highlighter animation until it closes.
    const [uploadPopupOpen, setUploadPopupOpen] = useState(false)
    // It also waits for the highlighter to finish painting the newly filled-in cells, so the player
    // sees the picture complete before the popup covers it
    const [pictureAnimating, setPictureAnimating] = useState(false)
    const showCompleted = Boolean(groupId) && completedGroup === groupId && !uploadPopupOpen && !pictureAnimating
    // Latest progress for the progress bar, kept with the group it belongs to so switching groups
    // doesn't flash the old group's value
    const [progressFor, setProgressFor] = useState({ groupId: null, value: 0 })
    const showProgress = Boolean(groupId) && progressFor.groupId === groupId

    // Called with the group's progress whenever the picture loads: when the page opens and after
    // every scored photo, so it catches both a finished group and the photo that finishes it
    const handleProgress = (progress) => {
        setProgressFor({ groupId, value: progress })
        if (progress >= 100 && !wasDismissed(groupId)) setCompletedGroup(groupId)
    }

    const closeCompleted = () => {
        rememberDismissed(groupId)
        setCompletedGroup(null)
    }

    // Testing shortcuts (dev builds only): fill in the whole picture, or all of it but a few cells of
    // one colour (leaveOne), then reload it so the highlighter paints the new cells in and, when
    // it's finished, the "completed!" popup follows
    const [autoCompleting, setAutoCompleting] = useState(false)
    const handleAutoComplete = async (leaveOne) => {
        setAutoCompleting(true)
        try {
            const res = await fetch(`/api/completeGroup/${groupId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leaveOne }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.log('Could not complete the picture', data.message || res.status)
                return
            }
            // So the popup shows even if it was closed for this group before
            try { localStorage.removeItem(dismissKey(groupId)) } catch { /* it may not show */ }
            setPictureVersion((v) => v + 1)
        } catch (err) {
            console.log(err)
        } finally {
            setAutoCompleting(false)
        }
    }

    return (
        <div className="play">
            {import.meta.env.DEV && groupId && (
                <div className="play-dev-tools">
                    <button
                        type="button"
                        className="play-dev-btn"
                        onClick={() => handleAutoComplete(false)}
                        disabled={autoCompleting}
                    >
                        auto complete
                    </button>
                    <button
                        type="button"
                        className="play-dev-btn"
                        onClick={() => handleAutoComplete(true)}
                        disabled={autoCompleting}
                    >
                        almost complete
                    </button>
                </div>
            )}

            <h1 className="play-logo">
                <img src={logo} alt="ColoringLook" />
            </h1>

            <main className="play-columns">
                {/* TODO: left column content */}
                <section className="play-col play-side">
                    <ViewGroups refreshKey={pictureVersion} />
                </section>

                <section className="play-col play-main">
                    <PlayPicture
                        groupId={groupId}
                        onScored={() => setPictureVersion((v) => v + 1)}
                        onPopupChange={setUploadPopupOpen}
                    >
                        <PlayPictureGrid
                            groupId={groupId}
                            refreshKey={pictureVersion}
                            onProgress={handleProgress}
                            onAnimatingChange={setPictureAnimating}
                            paused={uploadPopupOpen}
                        />
                    </PlayPicture>

                    {showProgress && <PlayProgressBar progress={progressFor.value} />}
                </section>

                <PlayMembersColumn
                    groupId={groupId}
                    onReassigned={() => setPictureVersion((v) => v + 1)}
                />
            </main>

            {showCompleted && (
                <PlayCompleted groupId={groupId} onClose={closeCompleted} />
            )}
        </div>
    )
}
