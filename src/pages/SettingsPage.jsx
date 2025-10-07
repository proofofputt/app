
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import { apiUpdatePlayer, apiUpdatePlayerSocials, apiRedeemCoupon, apiCancelSubscription, apiUpdateNotificationPreferences } from '../api.js';
import ChangePassword from '../components/ChangePassword.jsx';
import './SettingsPage.css';

const SettingsPage = () => {
  const { playerData, refreshData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('');
  const [availableTimezones, setAvailableTimezones] = useState([]);
  const [socials, setSocials] = useState({
    x_url: '',
    tiktok_url: '',
    website_url: '',
    telegram_url: '',
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
  const [bundles, setBundles] = useState([]);

  useEffect(() => {
    const mockBundles = [
      { id: 1, name: '3-Pack', quantity: 3, price: 56.70, discount: 10 },
      { id: 2, name: '5-Pack', quantity: 5, price: 84, discount: 20 },
      { id: 3, name: '10-Pack', quantity: 10, price: 121, discount: 42 },
      { id: 4, name: '21-Pack', quantity: 21, price: 221, discount: 50 },
    ];
    setBundles(mockBundles);
  }, []);

  useEffect(() => {
    if (playerData) {
      setName(playerData.name || '');
      setPhone(playerData.phone || '');
      setTimezone(playerData.timezone || 'UTC');
      setSocials({
        x_url: playerData.x_url || '',
        tiktok_url: playerData.tiktok_url || '',
        website_url: playerData.website_url || '',
        telegram_url: playerData.telegram_url || '',
      });
      if (playerData.notification_preferences) {
        try {
          const prefs = JSON.parse(playerData.notification_preferences);
          setNotificationPreferences(prev => ({ ...prev, ...prefs }));
        } catch (e) {
          console.error("Failed to parse notification preferences:", e);
        }
      }
    }
  }, [playerData]);

  useEffect(() => {
    try {
      const timezones = Intl.supportedValuesOf('timeZone');
      setAvailableTimezones(timezones);
    } catch (error) {
      console.error("Intl.supportedValuesOf('timeZone') is not supported:", error);
      setAvailableTimezones(['UTC', 'America/New_York', 'Europe/London']);
    }
  }, []);

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiUpdatePlayer(playerData.player_id, { name, phone, timezone });
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
    setNotificationPreferences(prev => ({ ...prev, [key]: !prev[key] }));
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
      window.location.reload();
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

  const handleSubscribe = async (interval) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/subscriptions/create-zaprite-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ interval }),
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        // Redirect to Zaprite checkout
        window.location.href = data.checkoutUrl;
      } else {
        showNotification(`Error: ${data.error || 'Failed to create checkout'}`, true);
      }
    } catch (error) {
      console.error('Subscription error:', error);
      showNotification(`Error: ${error.message}`, true);
    }
  };

  const handlePurchase = async (bundleId) => {
    try {
      const response = await fetch('/api/subscriptions/bundles/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bundleId }),
      });

      if (response.ok) {
        showNotification('Purchase successful!');
      } else {
        const errorData = await response.json();
        showNotification(`Purchase failed: ${errorData.message}`, true);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      showNotification('An error occurred during purchase.', true);
    }
  };

  if (!playerData) {
    return <div className="settings-page"><div className="settings-section">Loading...</div></div>;
  }

  return (
    <div className="settings-page">
      <h2>Settings</h2>

      <div className="settings-grid">
        {/* Account Info, Socials, Security, Notifications... */}
      </div>

      <div className="settings-section full-width-section">
        <h3>Manage Subscription</h3>
        {(() => {
          switch (playerData.membership_tier) {
            case 'premium':
            case 'regular':
              return (
                <div className="subscription-layout">
                  {/* Left Column: Current Subscription */}
                  <div className="subscription-status-column">
                    <div className="subscription-status">
                      <p><strong>Status:</strong> <span className="status-badge status-active">Full Subscriber</span></p>
                      <p>Your current plan gives you access to all features.</p>

                      <div className="subscription-actions">
                        <Link to="/gifts" className="btn btn-secondary">My Gifts</Link>
                        <button onClick={handleCancelSubscription} className="btn btn-danger">Cancel Subscription</button>
                      </div>

                      <div className="coupon-section">
                        <form onSubmit={handleRedeemCoupon} className="coupon-form">
                          <label htmlFor="coupon-input">Have a Gift Code?</label>
                          <input
                            id="coupon-input"
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            placeholder="Enter Code"
                            className="coupon-input"
                          />
                          <button type="submit" className="btn">Redeem</button>
                        </form>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Bundle Options */}
                  <div className="bundles-column">
                    <h4>Share with Your Golf Community</h4>
                    <p className="bundles-subtitle">Purchase bundles to gift subscriptions to friends, club members, or students.</p>

                    <div className="bundles-grid">
                      {bundles.map((bundle) => (
                        <div key={bundle.id} className="bundle-card">
                          <div className="bundle-header">
                            <h5>{bundle.name}</h5>
                            <span className="bundle-discount">{bundle.discount}% OFF</span>
                          </div>
                          <div className="bundle-details">
                            <p className="bundle-quantity">{bundle.quantity} Year Subscriptions</p>
                            <p className="bundle-price">${bundle.price}</p>
                            <p className="bundle-unit-price">${(bundle.price / bundle.quantity).toFixed(2)}/each</p>
                          </div>
                          <button onClick={() => handlePurchase(bundle.id)} className="btn btn-primary">
                            Purchase Bundle
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            case 'free':
            default:
              return (
                <div className="subscription-layout">
                  {/* Left Column: Upgrade Options */}
                  <div className="upgrade-column">
                    <p className="tier-badge"><strong>Status:</strong> <span className="status-badge status-free">Free Tier</span></p>

                    <h4>Upgrade Your Account</h4>
                    <p className="upgrade-subtitle">Get full access to all features</p>

                    <div className="subscription-plans">
                      {/* Monthly Plan */}
                      <div className="plan-card">
                        <h5>Monthly</h5>
                        <div className="plan-price">
                          <span className="amount">$2.10</span>
                          <span className="period">/month</span>
                        </div>
                        <ul className="plan-features">
                          <li>✓ Session recording</li>
                          <li>✓ Competitive leagues</li>
                          <li>✓ 1v1 duels</li>
                          <li>✓ OTS certification</li>
                        </ul>
                        <button onClick={() => handleSubscribe('monthly')} className="btn btn-primary">Subscribe Monthly</button>
                      </div>

                      {/* Annual Plan */}
                      <div className="plan-card featured">
                        <div className="plan-badge">Best Value</div>
                        <h5>Annual</h5>
                        <div className="plan-price">
                          <span className="amount">$21</span>
                          <span className="period">/year</span>
                        </div>
                        <div className="plan-savings">Save $4.20 vs monthly!</div>
                        <ul className="plan-features">
                          <li>✓ Everything in Monthly</li>
                          <li>🎁 <strong>1 Free Year Gift Code</strong></li>
                          <li>✓ Share with a friend</li>
                        </ul>
                        <button onClick={() => handleSubscribe('annual')} className="btn btn-primary btn-featured">Subscribe Annually</button>
                      </div>
                    </div>

                    <div className="coupon-section">
                      <form onSubmit={handleRedeemCoupon} className="coupon-form">
                        <label htmlFor="coupon-input">Have a Gift Code?</label>
                        <input
                          id="coupon-input"
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          placeholder="Enter Code"
                          className="coupon-input"
                        />
                        <button type="submit" className="btn">Redeem</button>
                      </form>
                    </div>
                  </div>

                  {/* Right Column: Bundle Options */}
                  <div className="bundles-column">
                    <h4>Bulk Purchase Options</h4>
                    <p className="bundles-subtitle">Perfect for golf clubs, instructors, or groups</p>

                    <div className="bundles-grid">
                      {bundles.map((bundle) => (
                        <div key={bundle.id} className="bundle-card">
                          <div className="bundle-header">
                            <h5>{bundle.name}</h5>
                            <span className="bundle-discount">{bundle.discount}% OFF</span>
                          </div>
                          <div className="bundle-details">
                            <p className="bundle-quantity">{bundle.quantity} Year Subscriptions</p>
                            <p className="bundle-price">${bundle.price}</p>
                            <p className="bundle-unit-price">${(bundle.price / bundle.quantity).toFixed(2)}/each</p>
                          </div>
                          <button onClick={() => handlePurchase(bundle.id)} className="btn btn-primary">
                            Purchase Bundle
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
          }
        })()}
      </div>
    </div>
  );
};

export default SettingsPage;
