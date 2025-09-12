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
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Handle OAuth callback and referral tracking on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    
    // Handle referral tracking first
    handleReferralTracking(urlParams);
    setReferralContext(getReferralContext(urlParams));
    
    // Then handle OAuth callback
    const oauthResult = handleOAuthCallback(urlParams);
    
    if (oauthResult.success && oauthResult.token) {
      // OAuth login successful
      localStorage.setItem('authToken', oauthResult.token);
      setSuccess(`Successfully logged in with ${oauthResult.provider}!`);
      
      // Clear stored referral since OAuth login doesn't need it
      clearStoredReferralSession();
      
      // Navigate to dashboard after a brief delay
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
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
    setSuccess(`Successfully logged in with ${provider}!`);
    // The token is already stored in localStorage by OAuthButton
    // Navigate to dashboard
    setTimeout(() => {
      navigate('/');
    }, 1500);
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
              <OAuthButton 
                provider="linkedin"
                onSuccess={handleOAuthSuccess}
                onError={handleOAuthError}
                disabled={isLoading}
              />
              <OAuthButton 
                provider="nostr"
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