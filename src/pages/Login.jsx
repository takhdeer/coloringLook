import "./Login.css";
import loginTitle from "../assets/login.svg";
import { useNavigate } from 'react-router';

function Login() {
  const navigate = useNavigate();
  const handleLanding = () => navigate('/landing');
  return (

    <div>


    <div className="login-page">
      <button className="back-btn" onClick={handleLanding}>
        {"<"}
      </button>

      <div className="login-card">

      <h1 className="login-header">
        <img src={loginTitle} alt="login" />
      </h1>

        <div className="email-form">
          <label htmlFor="email" className="form-label">email</label>
          <input type="email" className="form-control" id="email" placeholder="name@example.com"/>
        </div>

        <div className="password-form">
          <label htmlFor="Password" className="form-label">super secret password</label>
          <input type="password" className="form-control" id="Password"/>
        </div>

        <div className="submit">
          <button type="button" className="login-btn">log in</button>
        </div>

      </div>
    </div>
    </div>
  );
}

export default Login;
