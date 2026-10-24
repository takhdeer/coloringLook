import "./Signup.css";
import signUpTitle from "../assets/sign-up.svg";
import { useNavigate } from 'react-router';


function Signup() {
  const navigate = useNavigate();
  const handleLanding = () => navigate('/landing');
  const handleLogin = () => navigate('/dashboard');

  return (
    <div>

    <div className="signup-page">
      <button className="back-btn" onClick={handleLanding}>
        {"<"}
      </button>
      <div className="signup-card">

      <h1 className="signup-header">
        <img src={signUpTitle} alt="sign up!!" />
      </h1>

        <div className="username-form">
          <label htmlFor="username" className="form-label">username</label>
          <input type="username" className="form-control" id="username" placeholder="e.g. TheLegend27"/>
        </div>

        <div className="email-form">
          <label htmlFor="email" className="form-label">email</label>
          <input type="email" className="form-control" id="email" placeholder="name@example.com"/>
        </div>

        <div className="password-form">
          <label htmlFor="Password" className="form-label">super secret password</label>
          <input type="password" className="form-control" id="Password"/>
        </div>

        <div className="password-form">
          <label htmlFor="confirmPassword" className="form-label">super secret password again</label>
          <input type="password" className="form-control" id="confirmPassword"/>
        </div>

        <div className="submit">
          <button type="button" className="signup-btn" onClick={handleLogin}>sign up</button>
        </div>

      </div>
    </div>
    </div>
  );
}

export default Signup;
