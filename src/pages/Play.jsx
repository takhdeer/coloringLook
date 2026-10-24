import { useParams } from 'react-router'
import './Play.css'
import logo from '../assets/coloringlook-logo.svg'
import PlayMembersColumn from './PlayMembersColumn'
import PlayPicture from './PlayPicture'

export default function Play() {
    const { groupId } = useParams()

    return (
        <div className="play">
            <h1 className="play-logo">
                <img src={logo} alt="ColoringLook" />
            </h1>

            <main className="play-columns">
                {/* TODO: left column content */}
                <section className="play-col play-side" />

                <section className="play-col play-main">
                    <PlayPicture />
                </section>

                <PlayMembersColumn groupId={groupId} />
            </main>
        </div>
    )
}