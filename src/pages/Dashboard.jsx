import '../buttons.css'
import './Dashboard.css'

export default function Dashboard() {
    const handlePlay = () => console.log('Play clicked')
    const handleCreateLobby = () => console.log('Create Lobby clicked')

    return (
        <div className="dashboard">
            <h1>ColouringLook</h1>

            <div className="main-buttons">
                <button onClick={handlePlay}>Play</button>
                <button onClick={handleCreateLobby}>Create Lobby</button>
            </div>
        </div>
    )
}
