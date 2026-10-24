import { useNavigate } from 'react-router'
import './Dashboard.css'

export default function Dashboard() {

    const navigate = useNavigate();
    
    return (
        <div className="dashboard">
            {/* TODO: replace with the Play Now title SVG */}
            <h1 className="dashboard-title">Play Now</h1>

            <div className="dashboard-actions">
                <button className="dashboard-btn" onClick={() => navigate('/join')}>
                    join group
                </button>
                <button className="dashboard-btn" onClick={() => navigate('/groups')}>
                    create group
                </button>
            </div>
        </div>
    )
}
