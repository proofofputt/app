import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './LoginPage.css';

const SetupAccountPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [providerInfo, setProviderInfo] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    const provider = urlParams.get('provider');

    if (!token || !provider) {
      setError('Invalid setup request');
      return;
    }

    try {
      // Decode JWT to get user info
      const payload = JSON.parse(atob(token.split('.')[1]));
      setEmail(payload.email || '');
      setName(payload.name || '');
      setProviderInfo({
        provider,
        token,
        googleId: payload.googleId,
        picture: payload.picture,
        emailVerified: payload.emailVerified
      });
    } catch (err) {
      setError('Invalid token format');
    }
  }, [location]);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/complete-oauth-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setupToken: providerInfo.token,
          displayName: name,
          provider: providerInfo.provider
        })
      });

      const data = await response.json();

      if (data.success) {
        // Store auth token
        localStorage.setItem('authToken', data.token);

        setSuccess('Account created successfully!');

        // Redirect to dashboard
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        setError(data.message || 'Failed to create account');
      }
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Complete Your Account</h1>
          <p>Set up your Proof of Putt account</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {providerInfo && (
          <div className="info-message" style={{marginBottom: '20px', padding: '15px', background: 'var(--masters-green-light)', borderRadius: '8px'}}>
            <p style={{margin: 0}}>
              You signed in with <strong>{providerInfo.provider}</strong>, but don't have an account yet.
            </p>
            <p style={{margin: '10px 0 0 0'}}>
              Complete your profile to finish creating your account.
            </p>
          </div>
        )}

        <form onSubmit={handleCreateAccount} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              disabled
              style={{backgroundColor: '#f5f5f5'}}
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Display Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="name"
              placeholder="How should we call you?"
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading || !providerInfo || !name.trim()}
          >
            {isLoading ? 'Creating Account...' : 'Complete Setup'}
          </button>

          <div className="login-links">
            <button
              type="button"
              className="link-button"
              onClick={() => navigate('/login')}
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetupAccountPage;
