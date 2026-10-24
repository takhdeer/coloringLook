import { useNavigate } from 'react-router'
import './Landing.css'

export default function Landing() {
    const navigate = useNavigate()

    const handleSignUp = () => navigate('/dashboard')
    const handleLogin = () => navigate('/dashboard')

    return (
        <div className="landing">
            <h1>ColouringLook</h1>

            <div className="auth-buttons">
                <button onClick={handleSignUp}>Sign Up</button>
                <button onClick={handleLogin}>Login</button>
            </div>
        </div>
    )
}