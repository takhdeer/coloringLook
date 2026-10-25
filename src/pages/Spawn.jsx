import { useNavigate } from 'react-router'
import './Spawn.css'
import { useState } from 'react';
import { supabase } from '../lib/supabase.mjs'

export default function Spawn() {
    const [address, setAddress] = useState('')
    const [coords, setCoords] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [message, setMessage] = useState('')

    const navigate = useNavigate();

    const handleUseLocation = () => {
        if (!navigator.geolocation) {
            console.log('Geolocation is not supported by this browser')
            setMessage('Location is not supported by this browser')
            return
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                console.log(latitude, longitude)
                setCoords({ latitude, longitude })
                setMessage('Location found')
            },
            (error) => {
                console.log('Location error:', error.message)
                setMessage('Could not get your location')
            }
        )
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!coords) {
            setMessage('Use your location first')
            return
        }

        const { data: authData, error } = await supabase.auth.getUser()
        if (error || !authData.user) {
            console.log('No Signed-in user', error?.message)
            navigate('/login')
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/spawn', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ ...coords, userId: authData.user.id })
            });
            const data = await res.json()
            if (!res.ok) {
                setMessage(data.message || 'Server Error')
                return
            }
            setMessage('Spawn point set')
            // Only once it's saved: on an error, stay here so the message shows and they can try again
            navigate('/play')
        } catch (err) {
            console.log(err)
            setMessage('Server Error')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="dashboard">
            {/* TODO: replace with the Play Now title SVG */}
            <h1 className="dashboard-title">Play Now</h1>

            <form className="dashboard-actions" onSubmit={handleSubmit}>
                <label className='form-label'>Enter Spawn Point</label>
                <div className='spawn-input-row'>
                    <button
                        type='button'
                        className='login-btn'
                        onClick={handleUseLocation}>
                         {isSubmitting? 'Geting Location...': 'Get Location'}
                    </button>
                <button
                    type='submit'
                    className='login-btn'
                    disabled={isSubmitting}>
                        {isSubmitting ? `Setting Spawn...` : 'Set Spawn'}
                    </button>
                </div>
                {message ? <p className='spawn-message'>{message}</p> : null}
            </form>
        </div>
    )
}
