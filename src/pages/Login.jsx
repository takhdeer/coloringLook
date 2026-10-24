import "./Login.css";
import loginTitle from "../assets/login.svg";
import { useNavigate } from 'react-router';
import { useState } from "react";
import { supabase } from "../lib/supabase.mjs";

function Login() {
  const [email, setEmail] = useState('');
  const [password ,setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const navigate = useNavigate();


  const handleLanding = () => navigate('/landing');

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMessage('')

    if (!email || !password) {
      setErrorMessage('Email and password are required')
      return
    }

    setIsSubmitting(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const res = await fetch('http://localhost:3001/api/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email, password}),
          signal: controller.signal
      });

      const data = await res.json();

      if (res.status === 403) {
        setErrorMessage(data.message || 'Confirm email, please check inbox')
        return
      }

      if (!res.ok) {
        setErrorMessage(data.detail || data.message || 'Login failed')
        return
      }

      if (data.access_token && data.refresh_token) {
        const { error } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
        });

        if (error) {
            console.log('Could not set session', error)
            setErrorMessage('Could not save session')
            return
        }
      }

      navigate('/dashboard')
    } catch (err) {
      console.error(err)
      setErrorMessage(err.name === 'AbortError' ? 'Login timed out' : 'Could not reach the server')
    } finally {
      clearTimeout(timeout)
      setIsSubmitting(false)
    }
  }
  return (

    <div>
    <div className="login-page">
      <button className="back-btn" onClick={handleLanding}>
        {"<"}
      </button>

      <form className="login-card" onSubmit={handleSubmit}>

      <h1 className="login-header">
        <img src={loginTitle} alt="login" />
      </h1>

        <div className="email-form">
          <label 
            htmlFor="email" 
            className="form-label">
              email
            </label>
          <input 
            type="email" 
            className="form-control" 
            id="email" 
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}/>
        </div>

        <div className="password-form">
          <label 
            htmlFor="Password" 
            className="form-label">
              super secret password
            </label>
          <input 
            type="password" 
            className="form-control" 
            id="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}/>
        </div>

        {errorMessage ? <p className="login-error">{errorMessage}</p> : null}

        <div className="submit">
          <button 
            type="submit" 
            className="login-btn"
            disabled={isSubmitting}>
              {isSubmitting ? 'logging in...' : 'log in'}
            </button>
        </div>
      </form>
    </div>
    </div>
  );
}

export default Login;
