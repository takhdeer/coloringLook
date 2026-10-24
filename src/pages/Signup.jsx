import "./Signup.css";

function Signup() {
  return (
    <div className="signup-page">

      <div className="signup-card">

      <h1 className="signup-header">SIGN UP!!!</h1>

        <div className="email-form">
          <label htmlFor="email" className="form-label">email</label>
          <input type="email" className="form-control" id="email" placeholder="name@example.com"/>
        </div>

        <div className="password-form">
          <label htmlFor="Password" className="form-label">super secret password</label>
          <input type="password" className="form-control" id="Password"/>
        </div>

        <div className="password-form">
          <label htmlFor="confirmPassword" className="form-label">confirm password</label>
          <input type="password" className="form-control" id="confirmPassword"/>
        </div>

        <div className="submit">
          <button type="button" className="btn btn-primary">sign up</button>


        </div>

      </div>
    </div>
  );
}

export default Signup;