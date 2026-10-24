import '../buttons.css'
import './Dashboard.css'

export default function Dashboard() {
    const handleJoinGroup = () => console.log('Join Group clicked')
    const handleCreateGroup = () => console.log('Create Group clicked')

    return (
        <div className="dashboard">
            <h1>ColouringLook</h1>

            <div className="main-buttons">
                <button onClick={handleJoinGroup}>Join Group</button>
                <button onClick={handleCreateGroup}>Create Group</button>
            </div>
        </div>
    )
}
