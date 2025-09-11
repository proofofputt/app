import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './RegisterPage.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  // Extract parameters from URL
  const inviteType = searchParams.get('invite'); // 'duel' or 'league'
  const prefilledEmail = searchParams.get('email');
  const prefilledPhone = searchParams.get('phone');
  const referrerId = searchParams.get('referrer_id');
  const leagueName = searchParams.get('league');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: prefilledEmail || '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [referrerInfo, setReferrerInfo] = useState(null);

  // Fetch referrer information
  useEffect(() => {
    if (referrerId) {
      const fetchReferrer = async () => {
        try {
          const response = await fetch(`/api/player/${referrerId}/data`);
          if (response.ok) {
            const data = await response.json();
            setReferrerInfo({
              name: data.player?.name || 'Someone',
              id: referrerId
            });
          }
        } catch (error) {
          console.error('Failed to fetch referrer info:', error);
        }
      };
      fetchReferrer();
    }
  }, [referrerId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('All fields are required');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          referrer_id: referrerId
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Registration successful
        console.log('Registration successful:', data);
        
        // Auto-login the user
        if (data.token) {
          localStorage.setItem('authToken', data.token);
          await login(data.token);
          
          // Show success message if they were referred
          if (data.referral) {
            // Could show a welcome modal or notification here
            console.log(`Welcome! You were referred by ${data.referral.referred_by}`);
          }
          
          // Redirect to dashboard
          navigate('/', { replace: true });
        }
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <h1>🏌️ Join Proof of Putt</h1>
          
          {/* Invitation Context */}
          {inviteType === 'duel' && referrerInfo && (
            <div className="invitation-context duel-invitation">
              <p><strong>{referrerInfo.name}</strong> challenged you to a putting duel!</p>
              <p className="invitation-subtitle">Create your account to accept the challenge</p>
            </div>
          )}
          
          {inviteType === 'league' && leagueName && referrerInfo && (
            <div className="invitation-context league-invitation">
              <p><strong>{referrerInfo.name}</strong> invited you to join "{leagueName}"</p>
              <p className="invitation-subtitle">Create your account to join the league</p>
            </div>
          )}
          
          {!inviteType && (
            <p className="welcome-text">
              AI-powered golf training with computer vision tracking
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="name">Display Name / Username</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name or username"
              required
              autoComplete="name"
            />
            <small className="form-help">
              This is how other players will see you in competitions
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
              autoComplete="email"
              readOnly={!!prefilledEmail}
            />
            {prefilledEmail && (
              <small className="form-help prefilled">
                ✓ Email pre-filled from invitation
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password (min 6 characters)"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
            />
          </div>

          <button 
            type="submit" 
            className="register-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 
             inviteType === 'duel' ? 'Accept Challenge & Create Account' :
             inviteType === 'league' ? 'Join League & Create Account' :
             'Create Account'}
          </button>

          <div className="login-link">
            <p>Already have an account? <a href="/login">Sign in here</a></p>
          </div>
        </form>

        {/* Next Steps Preview */}
        <div className="next-steps-preview">
          <h3>🚀 What's Next?</h3>
          <ul>
            <li>📱 Download the desktop app for CV tracking</li>
            <li>🎯 Start practicing and recording your sessions</li>
            {inviteType === 'duel' && <li>⚔️ Complete your duel challenge</li>}
            {inviteType === 'league' && <li>🏆 Participate in league rounds</li>}
            <li>📊 View detailed analytics and improve your game</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;