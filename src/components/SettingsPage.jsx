import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { useNotification } from '@/context/NotificationContext.jsx';
import { apiUpdatePlayer, apiUpdatePlayerSocials, apiRedeemCoupon, apiCancelSubscription, apiUpdateNotificationPreferences } from '@/api.js';
import ChangePassword from './ChangePassword.jsx'; // Assuming this component exists and handles its own state
import './SettingsPage.css';

const SettingsPage = () => {
  const { playerData, refreshData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [availableTimezones, setAvailableTimezones] = useState([]);
  const [socials, setSocials] = useState({
    x_url: '',
    tiktok_url: '',
    website_url: '',
  });
  const [couponCode, setCouponCode] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState({
    duel_requests: true,
    duel_updates: true,
    league_invites: true,
    league_updates: true,
    fundraiser_updates: true,
    product_updates: true,
  });

  useEffect(() => {
    if (playerData) {
      setName(playerData.name || '');
      setTimezone(playerData.timezone || 'UTC');
      setSocials({
        x_url: playerData.x_url || '',
        tiktok_url: playerData.tiktok_url || '',
        website_url: playerData.website_url || '',
      });
      if (playerData.notification_preferences) {
        try {
          const prefs = JSON.parse(playerData.notification_preferences);
          // Merge with defaults to ensure all keys are present
          setNotificationPreferences(prev => ({ ...prev, ...prefs }));
        } catch (e) {
          console.error("Failed to parse notification preferences:", e);
        }
      }
    }
  }, [playerData]);

  useEffect(() => {
    // Populate timezones when component mounts
    try {
      const timezones = Intl.supportedValuesOf('timeZone');
      setAvailableTimezones(timezones);
    } catch (error) {
      console.error("Intl.supportedValuesOf('timeZone') is not supported:", error);
      // Fallback to a hardcoded list or show an error message
      setAvailableTimezones(['UTC', 'America/New_York', 'Europe/London']); // Example fallback
    }
  }, []); // Empty dependency array means this runs once on mount

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiUpdatePlayer(playerData.player_id, { name, timezone });
      showNotification('Account info updated successfully!');
      await refreshData();
    } catch (err) {
      showNotification(`Error: ${err.message}`, true);
    }
  };

  const handleSocialsSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiUpdatePlayerSocials(playerData.player_id, socials);
      showNotification('Social links updated successfully!');
      await refreshData();
    } catch (err) {
      showNotification(`Error: ${err.message}`, true);
    }
  };

  const handleSocialsChange = (e) => {
    const { name, value } = e.target;
    setSocials(prev => ({ ...prev, [name]: value }));
  };

  const handlePreferenceToggle = (key) => {
    setNotificationPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePreferencesSave = async () => {
    try {
      await apiUpdateNotificationPreferences(playerData.player_id, notificationPreferences);
      showNotification('Notification preferences saved!');
      await refreshData();
    } catch (err) {
      showNotification(`Error: ${err.message}`, true);
    }
  };

  const handleRedeemCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) {
      showNotification('Please enter a coupon code.', true);
      return;
    }
    try {
      const response = await apiRedeemCoupon(playerData.player_id, couponCode.trim());
      showNotification(response.message);
      setCouponCode('');
      await refreshData(); // Refresh after clearing state
    } catch (err) {
      showNotification(`Error: ${err.message}`, true);
    }
  };

  const handleCancelSubscription = async () => {
    if (window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features.')) {
      try {
        const response = await apiCancelSubscription(playerData.player_id);
        showNotification(response.message);
        await refreshData();
      } catch (err) {
        showNotification(`Error: ${err.message}`, true);
      }
    }
  };

  if (!playerData) {
    return <div className="settings-page"><div className="settings-section">Loading...</div></div>;
  }

  return (
    <div className="settings-page">
      <h2>Settings</h2>

      <div className="settings-grid">
        <div className="settings-section">
          <h3>Account Information</h3>
          <form onSubmit={handleInfoSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={playerData.email} disabled />
            </div>
            <div className="form-group">
              <label>Display Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="form-control">
                {availableTimezones.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
              <p className="form-hint">Select your local timezone.</p>
            </div>
            <button type="submit" className="btn">Save Account Info</button>
          </form>
        </div>

        <div className="settings-section">
          <h3>Social Links</h3>
          <form onSubmit={handleSocialsSubmit}>
            <div className="form-group"><label>X (Twitter)</label><input type="url" name="x_url" value={socials.x_url} onChange={handleSocialsChange} placeholder="https://x.com/yourprofile" /></div>
            <div className="form-group"><label>TikTok</label><input type="url" name="tiktok_url" value={socials.tiktok_url} onChange={handleSocialsChange} placeholder="https://tiktok.com/@yourprofile" /></div>
            <div className="form-group"><label>Website</label><input type="url" name="website_url" value={socials.website_url} onChange={handleSocialsChange} placeholder="https://yourwebsite.com" /></div>
            <button type="submit" className="btn">Save Social Links</button>
          </form>
        </div>

        <div className="settings-section">
          <h3>Security</h3>
          <ChangePassword />
        </div>

        <div className="settings-section">
          <h3>Email Notifications</h3>
          <div className="notification-toggles">
            <label><input type="checkbox" checked={notificationPreferences.duel_requests} onChange={() => handlePreferenceToggle('duel_requests')} /> Duel Requests</label>
            <label><input type="checkbox" checked={notificationPreferences.duel_updates} onChange={() => handlePreferenceToggle('duel_updates')} /> Duel Results & Updates</label>
            <label><input type="checkbox" checked={notificationPreferences.league_invites} onChange={() => handlePreferenceToggle('league_invites')} /> League Invites</label>
            <label><input type="checkbox" checked={notificationPreferences.league_updates} onChange={() => handlePreferenceToggle('league_updates')} /> League Results & Updates</label>
            <label><input type="checkbox" checked={notificationPreferences.fundraiser_updates} onChange={() => handlePreferenceToggle('fundraiser_updates')} /> Fundraiser Updates</label>
            <label><input type="checkbox" checked={notificationPreferences.product_updates} onChange={() => handlePreferenceToggle('product_updates')} /> Product News & Updates</label>
          </div>
          <button onClick={handlePreferencesSave} className="btn">Save Preferences</button>
        </div>
      </div>

      <div className="settings-section full-width-section">
        <h3>Manage Subscription</h3>
        {playerData.subscription_status === 'active' ? (
          <div className="subscription-status">
            <p><strong>Status:</strong> <span className="status-badge status-active">Full Subscriber</span></p>
            <button onClick={handleCancelSubscription} className="btn btn-danger">Cancel My Subscription</button>
          </div>
        ) : (
          <div className="upgrade-section">
            <p><strong>Status:</strong> <span className="status-badge status-free">Free Tier</span></p>
            <p>Upgrade to a full subscription to unlock all features and take your game to the next level.</p>
            <div className="features-grid">
              <div className="feature-card free-tier">
                <h3>Free Tier</h3>
                <ul>
                  <li>✓ Camera Calibration & Session Recording</li>
                  <li>✓ View Your Most Recent Session</li>
                  <li>✓ Participate in Duels</li>
                  <li>✓ Join & Compete in Leagues</li>
                </ul>
              </div>
              <div className="feature-card subscriber-tier">
                <h3>Full Subscriber</h3>
                <ul>
                  <li>✓ All Free Features</li>
                  <li>✓ Full Session History & Analysis</li>
                  <li>✓ Access to In-depth Career Stats</li>
                  <li>✓ AI-Powered Coach</li>
                  <li>✓ Create Leagues & Duels</li>
                  <li>✓ Create Fundraisers</li>
                </ul>
              </div>
            </div>
            <div className="upgrade-action">
              <form onSubmit={handleRedeemCoupon} className="coupon-form">
                <label htmlFor="coupon-input">Have an Early Access Code?</label>
                <input id="coupon-input" type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Enter Code" className="coupon-input" />
                <button type="submit" className="btn">Redeem</button>
              </form>
              <div className="upgrade-options">
                <span className="or-divider">OR</span>
                {/* This link should come from your Zaprite product settings */}
                <a href="https://zaprite.com/p/proofofputt/subscription-link" target="_blank" rel="noopener noreferrer" className="btn">
                  Upgrade to Full Subscription ($2.10/mo)
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;