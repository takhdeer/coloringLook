import './Dashboard.css'

export default function Dashboard() {
    const handleSignUp = () => console.log('Sign up clicked')
    const handleLogin = () => console.log('Login clicked')
    const handlePlay = () => console.log('Play clicked')
    const handleCreateLobby = () => console.log('Create Lobby clicked')

    return (
        <div className="dashboard">
            <h1>ColouringLook</h1>

            <div className="auth-buttons">
                <button onClick={handleSignUp}>Sign Up</button>
                <button onClick={handleLogin}>Login</button>
                <button onClick={handlePlay}>Play</button>
                <button onClick={handleCreateLobby}>Create Lobby</button>
            </div>
        </div>
    )
}