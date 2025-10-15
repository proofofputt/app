import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const LinkAccountPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [providerInfo, setProviderInfo] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    const provider = urlParams.get('provider');

    if (!token || !provider) {
      setError('Invalid link request');
      return;
    }

    try {
      // Decode JWT to get email info (basic decode, not verification)
      const payload = JSON.parse(atob(token.split('.')[1]));
      setEmail(payload.email || '');
      setProviderInfo({
        provider,
        token,
        name: payload.name,
        action: payload.action
      });
    } catch (err) {
      setError('Invalid token format');
    }
  }, [location]);

  const handleLinkAccount = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // First, authenticate with password
      const loginResult = await login(email, password);

      if (!loginResult.success) {
        setError(loginResult.error || 'Invalid email or password');
        setIsLoading(false);
        return;
      }

      // Then link the OAuth account
      const response = await fetch('/api/auth/link-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginResult.token || localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          linkToken: providerInfo.token,
          provider: providerInfo.provider
        })
      });

      const data = await response.json();

      if (data.success) {
        // Successfully linked - redirect to dashboard
        navigate('/');
      } else {
        setError(data.message || 'Failed to link account');
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
          <h1>Link Your Account</h1>
          <p>An account already exists with this email</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {providerInfo && (
          <div className="info-message" style={{marginBottom: '20px', padding: '15px', background: 'var(--masters-green-light)', borderRadius: '8px'}}>
            <p style={{margin: 0}}>
              You tried to sign up with <strong>{providerInfo.provider}</strong>, but an account for <strong>{email}</strong> already exists.
            </p>
            <p style={{margin: '10px 0 0 0'}}>
              Sign in with your password to link your {providerInfo.provider} account.
            </p>
          </div>
        )}

        <form onSubmit={handleLinkAccount} className="login-form">
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
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
              placeholder="Enter your account password"
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading || !providerInfo}
          >
            {isLoading ? 'Linking Account...' : 'Sign In & Link Account'}
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

export default LinkAccountPage;
