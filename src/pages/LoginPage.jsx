import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRegister, apiForgotPassword } from '../api';
import { useLocation, useNavigate } from 'react-router-dom';
import { handleOAuthCallback } from '../utils/oauth';
import { handleReferralTracking, getReferralContext, clearStoredReferralSession } from '../utils/referrals';
import OAuthButton from '../components/OAuthButton';
import './LoginPage.css';

const LoginPage = () => {
  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [referralContext, setReferralContext] = useState({ hasReferral: false });
  const { login, playerData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (playerData && playerData.player_id) {
      console.log('[LoginPage] User already authenticated, redirecting to dashboard');
      navigate('/', { replace: true });
    }
  }, [playerData, navigate]);

  // Handle OAuth callback and referral tracking on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);

    // Handle referral tracking first
    handleReferralTracking(urlParams);
    setReferralContext(getReferralContext(urlParams));

    // Then handle OAuth callback
    const oauthResult = handleOAuthCallback(urlParams);

    if (oauthResult.success && oauthResult.token) {
      // OAuth login successful - show loading state
      setIsLoading(true);
      console.log('[OAuth] Login successful, storing token');
      localStorage.setItem('authToken', oauthResult.token);

      // Clear stored referral since OAuth login doesn't need it
      clearStoredReferralSession();

      // Decode JWT to get player_id and fetch full player data
      const payload = JSON.parse(atob(oauthResult.token.split('.')[1]));
      console.log('[OAuth] Decoded payload:', payload);

      if (payload.playerId) {
        // Use same login pattern as regular login to fetch player data
        console.log(`[OAuth] Fetching player data for ID ${payload.playerId}`);
        fetch(`/api/player/${payload.playerId}/data`, {
          headers: {
            'Authorization': `Bearer ${oauthResult.token}`
          }
        })
          .then(res => {
            console.log(`[OAuth] Player data response status: ${res.status}`);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            return res.json();
          })
          .then(playerData => {
            console.log('[OAuth] Player data received:', playerData);
            if (playerData && playerData.player_id) {
              localStorage.setItem('playerData', JSON.stringify(playerData));
              console.log('[OAuth] Player data stored, navigating to dashboard');
              // Navigate immediately to dashboard
              navigate('/', { replace: true });
            } else {
              console.error('[OAuth] Invalid player data received');
              setIsLoading(false);
              setError('Authentication failed - invalid player data');
            }
          })
          .catch(error => {
            console.error('[OAuth] Failed to fetch player data:', error);
            setIsLoading(false);
            setError(`Authentication failed: ${error.message}`);
          });
      } else {
        console.error('[OAuth] No playerId in JWT payload');
        setIsLoading(false);
        setError('Authentication failed - invalid token');
      }

    } else if (oauthResult.error) {
      // OAuth login failed
      setError(`OAuth login failed: ${oauthResult.error}`);

      // Clean up URL parameters
      navigate('/login', { replace: true });
    }
  }, [location, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(email, password);
    
    if (!result.success) {
      setError(result.error || 'Login failed. Please try again.');
    }
    
    setIsLoading(false);
  };

  const handleOAuthSuccess = ({ token, provider }) => {
    // Set loading state to show spinner immediately
    setIsLoading(true);
    console.log(`[OAuth] Success callback received for ${provider}`);

    // The token is already stored in localStorage by OAuthButton
    // Now fetch player data before navigating
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('[OAuth] Decoded payload:', payload);

      if (payload.playerId) {
        console.log(`[OAuth] Fetching player data for ID ${payload.playerId}`);
        fetch(`/api/player/${payload.playerId}/data`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => {
            console.log(`[OAuth] Player data response status: ${res.status}`);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            return res.json();
          })
          .then(playerData => {
            console.log('[OAuth] Player data received:', playerData);
            if (playerData && playerData.player_id) {
              localStorage.setItem('playerData', JSON.stringify(playerData));
              console.log('[OAuth] Player data stored, navigating to dashboard');
              // Reload page to let AuthContext pick up the new data
              window.location.href = '/';
            } else {
              console.error('[OAuth] Invalid player data received');
              setIsLoading(false);
              setError('Authentication failed - invalid player data');
            }
          })
          .catch(error => {
            console.error('[OAuth] Failed to fetch player data:', error);
            setIsLoading(false);
            setError(`Authentication failed: ${error.message}`);
          });
      } else {
        console.error('[OAuth] No playerId in JWT payload');
        setIsLoading(false);
        setError('Authentication failed - invalid token');
      }
    } catch (error) {
      console.error('[OAuth] Failed to decode JWT:', error);
      setIsLoading(false);
      setError('Authentication failed - invalid token');
    }
  };

  const handleOAuthError = (errorMessage) => {
    setError(errorMessage);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      // Pass referral session ID if available
      const result = await apiRegister(
        name, 
        email, 
        password, 
        referralContext.sessionId,
        true // consent_contact_info - default to true for email registration
      );
      
      if (result) {
        // Clear referral session after successful registration
        clearStoredReferralSession();
        
        if (result.referral) {
          setSuccess(`Registration successful! You were referred by ${result.referral.referred_by}. Please sign in.`);
        } else {
          setSuccess('Registration successful! Please sign in.');
        }
        
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    }
    
    setIsLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await apiForgotPassword(email);
      
      if (result) {
        setSuccess('Password reset instructions have been sent to your email.');
        setMode('login');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    }
    
    setIsLoading(false);
  };

  // Show loading screen during OAuth processing
  if (isLoading && location.search.includes('oauth_success')) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="loading-container" style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p>Completing sign in...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Proof of Putt</h1>
          <p>
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'register' && 'Create a new account'}
            {mode === 'forgot' && 'Reset your password'}
          </p>
        </div>

        {/* Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="login-form">
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
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
              />
            </div>
            
            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="oauth-divider">
              <span className="oauth-divider-text">or</span>
            </div>

            <div className="oauth-buttons">
              <OAuthButton
                provider="google"
                onSuccess={handleOAuthSuccess}
                onError={handleOAuthError}
                disabled={isLoading}
              />
            </div>

            <div className="login-links">
              <button 
                type="button" 
                className="link-button"
                onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
              >
                Forgot Password?
              </button>
              <button 
                type="button" 
                className="link-button"
                onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* Registration Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="login-form">
            {error && <div className="error-message">{error}</div>}
            {referralContext.hasReferral && (
              <div className="success-message">
                🎯 You're joining via a referral link! You'll be connected with your referrer after registration.
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
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
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
            
            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>

            <div className="oauth-divider">
              <span className="oauth-divider-text">or</span>
            </div>

            <div className="oauth-buttons">
              <OAuthButton
                provider="google"
                mode="signup"
                onSuccess={handleOAuthSuccess}
                onError={handleOAuthError}
                disabled={isLoading}
              />
            </div>

            <div className="login-links">
              <button
                type="button"
                className="link-button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              >
                Already have an account? Sign In
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="login-form">
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            
            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Reset Email'}
            </button>

            <div className="login-links">
              <button 
                type="button" 
                className="link-button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;