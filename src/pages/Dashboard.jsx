import './Dashboard.css'

export default function Dashboard() {
    const handleJoinGroup = () => console.log('Join Group clicked')
    const handleCreateGroup = () => console.log('Create Group clicked')

    return (
        <div className="dashboard">
            {/* TODO: replace with the Play Now title SVG */}
            <h1 className="dashboard-title">Play Now</h1>

            <div className="dashboard-actions">
                <button className="dashboard-btn" onClick={handleJoinGroup}>
                    join group
                </button>
                <button className="dashboard-btn" onClick={handleCreateGroup}>
                    create group
                </button>
            </div>
        </div>
    )
}
