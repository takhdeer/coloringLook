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
                    <ViewGroups />
                </section>

                <section className="play-col play-main">
                    <PlayPicture groupId={groupId}>
                        <PlayPictureGrid groupId={groupId} />
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
