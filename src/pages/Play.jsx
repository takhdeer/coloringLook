import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import './Play.css'
import logo from '../assets/coloringlook-logo.svg'
import PlayMembersColumn from './PlayMembersColumn'
import ViewGroups from '../components/ViewGroups'
import PlayPicture from './PlayPicture'
import PlayPictureGrid from './PlayPictureGrid'
import PlayCompleted from './PlayCompleted'

export default function Play() {
    const { groupId } = useParams()
    // Goes up each time a photo scores, so the grid reloads with the newly filled-in cells and the
    // group list with the new progress
    const [pictureVersion, setPictureVersion] = useState(0)
    const [searchParams] = useSearchParams()
    // TODO(progress): set this to true once the group's picture is complete. Until that's linked,
    // add ?completed=1 to the Play page's URL to preview the popup.
    const [showCompleted, setShowCompleted] = useState(searchParams.has('completed'))

    return (
        <div className="play">
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
                            paused={uploadPopupOpen}
                        />
                    </PlayPicture>
                </section>

                <PlayMembersColumn groupId={groupId} />
            </main>

            {showCompleted && (
                <PlayCompleted groupId={groupId} onClose={() => setShowCompleted(false)} />
            )}
        </div>
    )
}
