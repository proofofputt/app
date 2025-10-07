import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { handleReferralTracking, getReferralContext, clearStoredReferralSession } from '../utils/referrals';
import { handleOAuthCallback } from '../utils/oauth';
import { apiRegister } from '../api';
import OAuthButton from '../components/OAuthButton';
import './RegisterPage.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { login } = useAuth();

  // Extract parameters from URL
  const inviteType = searchParams.get('invite'); // 'duel' or 'league'
  const prefilledEmail = searchParams.get('email');
  const prefilledPhone = searchParams.get('phone');
  const referrerId = searchParams.get('referrer_id'); // Legacy support
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
  const [referralContext, setReferralContext] = useState({ hasReferral: false });

  // Handle OAuth callback and referral tracking on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);

    // Handle referral tracking first
    handleReferralTracking(urlParams);
    setReferralContext(getReferralContext(urlParams));

    // Then handle OAuth callback
    const oauthResult = handleOAuthCallback(urlParams);

    if (oauthResult.success && oauthResult.token) {
      // OAuth registration/login successful
      setIsLoading(true);
      console.log('[OAuth] Registration/Login successful, storing token');
      localStorage.setItem('authToken', oauthResult.token);

      // Clear stored referral since OAuth doesn't need it
      clearStoredReferralSession();

      // Decode JWT to get player_id and fetch full player data
      const payload = JSON.parse(atob(oauthResult.token.split('.')[1]));
      console.log('[OAuth] Decoded payload:', payload);

      if (payload.playerId) {
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
      // OAuth failed
      setError(`OAuth registration failed: ${oauthResult.error}`);
      navigate('/register', { replace: true });
    }
  }, [location, navigate]);

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

  const handleOAuthSuccess = ({ token, provider }) => {
    setIsLoading(true);
    console.log(`[OAuth v2.0] Success callback received for ${provider}`);

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
      // Use the enhanced referral system first, fall back to legacy
      const result = await apiRegister(
        formData.name,
        formData.email,
        formData.password,
        referralContext.sessionId || null,
        true // consent_contact_info - default to true for email registration
      );

      if (result) {
        // Clear referral session after successful registration
        clearStoredReferralSession();
        
        // Registration successful
        console.log('Registration successful:', result);
        
        // Auto-login the user
        if (result.token) {
          localStorage.setItem('authToken', result.token);
          await login(result.token);
          
          // Show success message if they were referred
          if (result.referral) {
            // Could show a welcome modal or notification here
            console.log(`Welcome! You were referred by ${result.referral.referred_by}`);
          }
          
          // Redirect to dashboard
          navigate('/', { replace: true });
        }
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Network error. Please try again.');
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
          
          {!inviteType && !referralContext.hasReferral && (
            <p className="welcome-text">
              AI-powered golf training with computer vision tracking
            </p>
          )}
          
          {referralContext.hasReferral && !inviteType && (
            <div className="invitation-context referral-invitation">
              <p>🎯 You're joining via a referral link!</p>
              <p className="invitation-subtitle">You'll be connected with your referrer after registration</p>
            </div>
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