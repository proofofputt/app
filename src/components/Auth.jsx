import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext.jsx';
import { apiForgotPassword } from '@/api.js';

function Auth() {
  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgotPassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const { login, register } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'register') {
        await register(email, password, username);
      } else if (mode === 'forgotPassword') {
        const response = await apiForgotPassword(email);
        setMessage(response.message || 'If an account with that email exists, a password reset link has been sent.');
        setEmail('');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setMessage('');
    setPassword('');
    setUsername('');
  };

  const renderFormContent = () => {
    if (mode === 'forgotPassword') {
      return (
        <>
          <h2>Reset Password</h2>
          <p className="form-hint">Enter your email address and we'll send you a link to reset your password.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </>
      );
    }

    return (
      <>
        <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {mode === 'login' && (
            <div className="forgot-password-link">
              <button type="button" onClick={() => switchMode('forgotPassword')} className="link-button">
                Forgot Password?
              </button>
            </div>
          )}
          <button type="submit" disabled={isLoading} style={{ width: '100%' }}>
            {isLoading ? 'Loading...' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>
      </>
    );
  };

  return (
    <div className="auth-container">
      {renderFormContent()}
      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        {mode === 'login' && (
          <>
            Don't have an account?{' '}
            <button onClick={() => switchMode('register')} className="link-button">
              Register
            </button>
          </>
        )}
        {mode === 'register' && (
          <>
            Already have an account?{' '}
            <button onClick={() => switchMode('login')} className="link-button">
              Login
            </button>
          </>
        )}
        {mode === 'forgotPassword' && (
          <>
            Remember your password?{' '}
            <button onClick={() => switchMode('login')} className="link-button">
              Login
            </button>
          </>
        )}
      </p>
    </div>
  );
}

export default Auth;
