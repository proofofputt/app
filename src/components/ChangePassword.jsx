import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext.jsx';

const ChangePassword = ({ onPasswordChanged }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { changePassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const { message } = await changePassword(oldPassword, newPassword);
      setSuccess(message);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Optionally call a parent callback after a short delay to show success message
      setTimeout(() => {
        if (onPasswordChanged) onPasswordChanged();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="change-password-form">
      <div className="form-group">
        <label htmlFor="oldPassword">Old Password</label>
        <input type="password" id="oldPassword" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="newPassword">New Password</label>
        <input type="password" id="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm New Password</label>
        <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </div>
      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}
      <button type="submit" className="btn" disabled={isLoading}>
        {isLoading ? 'Changing...' : 'Change Password'}
      </button>
    </form>
  );
};

export default ChangePassword;