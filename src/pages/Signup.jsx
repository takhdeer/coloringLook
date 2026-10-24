import { useState } from "react";
import { useNavigate } from "react-router";
import "./Signup.css";
import signUpTitle from "../assets/sign-up.svg";
import { supabase } from "../lib/supabase.mjs";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function Signup() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    setError("");
    setNotice("");

    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in every field.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password, // confirmPassword is never sent
        }),
      });
      const data = await res.json();

      if (res.status === 201) {
        if (data.session) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          if (sessionError) {
            setError("Account created, but we couldn't log you in. Try logging in.");
            return;
          }
          navigate("/dashboard");
        } else {
          setNotice("Account created! Check your email to confirm it, then log in.");
        }
      } else {
        setError(data.message || "Something went wrong.");
      }
    } catch (err) {
      console.error(err);
      setError("Can't reach the server. Is it running?");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <h1 className="signup-header">
          <img src={signUpTitle} alt="sign up!!" />
        </h1>

        <div className="username-form">
          <label htmlFor="username" className="form-label">username</label>
          <input
            type="text"
            className="form-control"
            id="username"
            placeholder="e.g. TheLegend27"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="email-form">
          <label htmlFor="email" className="form-label">email</label>
          <input
            type="email"
            className="form-control"
            id="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="password-form">
          <label htmlFor="Password" className="form-label">super secret password</label>
          <input
            type="password"
            className="form-control"
            id="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="password-form">
          <label htmlFor="confirmPassword" className="form-label">super secret password again</label>
          <input
            type="password"
            className="form-control"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && <p className="signup-error">{error}</p>}
        {notice && <p className="signup-notice">{notice}</p>}

        <div className="submit">
          <button
            type="button"
            className="signup-btn"
            onClick={handleSignUp}
            disabled={isSubmitting}
          >
            {isSubmitting ? "signing up..." : "sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Signup;