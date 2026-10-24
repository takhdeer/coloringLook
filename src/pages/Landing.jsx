import { useNavigate } from 'react-router'
import './Landing.css'

export default function Landing() {
    const navigate = useNavigate()

    // No real auth yet: both go straight to the dashboard
    const handleLogin = () => navigate('/dashboard')
    const handleSignUp = () => navigate('/dashboard')

    return (
        <div className="landing">
            {/* TODO: replace with the ColoringLook logo SVG */}
            <h1 className="landing-logo">ColoringLook</h1>

            <p className="landing-tagline">get out and color !!</p>

            <div className="landing-auth">
                <button className="landing-auth-btn" onClick={handleLogin}>
                    log in
                </button>
                <button className="landing-auth-btn" onClick={handleSignUp}>
                    sign up
                </button>
            </div>
        </div>
    )
}
