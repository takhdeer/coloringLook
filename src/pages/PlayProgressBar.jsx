import './PlayProgressBar.css'

// The group's progress (0-100), floating over the bottom of the main column
export default function PlayProgressBar({ progress }) {
    const value = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)))

    return (
        <div
            className="play-progress"
            role="progressbar"
            aria-label="picture progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
        >
            <div className="play-progress-fill" style={{ width: `${value}%` }} />
            <span className="play-progress-label">{value}%</span>
        </div>
    )
}
