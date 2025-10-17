
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import { apiUpdatePlayer, apiUpdatePlayerSocials, apiRedeemCoupon, apiRedeemGiftCode, apiCancelSubscription, apiUpdateNotificationPreferences } from '../api.js';
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
  const [associationForm, setAssociationForm] = useState({
    name: '',
    email: '',
    phone: '',
    comments: '',
    club_name: '',
    office_address: '',
    number_of_users: 50,
    onboarding_support: false,
    implementation_support: false,
    event_management: false
  });
  const [giftCodes, setGiftCodes] = useState([]);
  const [giftRecipients, setGiftRecipients] = useState({});
  const [showReferralsDashboard, setShowReferralsDashboard] = useState(false);
  const [referralStats, setReferralStats] = useState(null);

  useEffect(() => {
    const mockBundles = [
      { id: 1, name: '3-Pack', quantity: 3, price: 56.70, discount: 10 },
      { id: 2, name: '5-Pack', quantity: 5, price: 84, discount: 21 },
      { id: 3, name: '10-Pack', quantity: 10, price: 121, discount: 42 },
      { id: 4, name: '21-Pack', quantity: 21, price: 221, discount: 50 },
    ];
    setBundles(mockBundles);
  }, []);

  useEffect(() => {
    if (playerData && playerData.player_id) {
      fetchGiftCodes();
    }
  }, [playerData]);

  // Force refresh player data on settings page load to get latest referral_code
  useEffect(() => {
    const forceRefresh = async () => {
      console.log('[Settings] Checking if player data needs refresh...');
      if (playerData && !playerData.referral_code) {
        console.log('[Settings] No referral_code found, forcing data refresh...');
        try {
          await refreshData();
          console.log('[Settings] Player data refreshed');
        } catch (error) {
          console.error('[Settings] Failed to refresh player data:', error);
        }
      } else if (playerData?.referral_code) {
        console.log('[Settings] Referral code present:', playerData.referral_code);
      }
    };
    forceRefresh();
  }, []); // Run once on mount

  const fetchGiftCodes = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/subscriptions/gifts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setGiftCodes(data.giftCodes || []);
      }
    } catch (error) {
      console.error('Error fetching gift codes:', error);
    }
  };

  useEffect(() => {
    if (playerData) {
      setName(playerData.display_name || playerData.name || '');
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
      await apiUpdatePlayer(playerData.player_id, { display_name: name, phone, timezone });
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

    const code = couponCode.trim().toUpperCase();

    try {
      // Detect gift code format: exactly 7 alphanumeric characters
      const isGiftCode = /^[A-Z0-9]{7}$/.test(code);

      let response;
      if (isGiftCode) {
        console.log('[Redeem] Detected gift code format:', code);
        response = await apiRedeemGiftCode(code);
      } else {
        console.log('[Redeem] Detected coupon code format:', code);
        response = await apiRedeemCoupon(playerData.player_id, code);
      }

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
      // Use direct Zaprite payment links for both subscription types
      if (interval === 'annual') {
        window.location.href = 'https://pay.zaprite.com/pl_NC6B3oH3dJ';
        return;
      }

      if (interval === 'monthly') {
        window.location.href = 'https://pay.zaprite.com/pl_F32s4VbLaN';
        return;
      }

      showNotification('Invalid subscription type', true);
    } catch (error) {
      console.error('[Subscribe] Exception:', error);
      showNotification(`Error: ${error.message}`, true);
    }
  };

  const handlePurchase = async (bundleId) => {
    try {
      // Use pre-configured Zaprite payment links for each bundle
      const paymentLinks = {
        1: 'https://pay.zaprite.com/pl_5GiV3AIMVc',  // 3-Pack - $56.70
        2: 'https://pay.zaprite.com/pl_sLPDlcXmej',  // 5-Pack - $84
        3: 'https://pay.zaprite.com/pl_qwz5BPb1Th',  // 10-Pack - $121
        4: 'https://pay.zaprite.com/pl_c5uK0HOPlu'   // 21-Pack - $221
      };

      const paymentLink = paymentLinks[bundleId];

      if (!paymentLink) {
        showNotification('Invalid bundle selection', true);
        return;
      }

      console.log('Redirecting to Zaprite payment link for bundle:', bundleId);
      // Redirect directly to Zaprite hosted payment page
      window.location.href = paymentLink;

    } catch (error) {
      console.error('Purchase error:', error);
      showNotification(`An error occurred during purchase: ${error.message}`, true);
    }
  };

  const handleAssociationFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAssociationForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAssociationSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!associationForm.name.trim() || !associationForm.email.trim() || !associationForm.comments.trim()) {
      showNotification('Please fill in all required fields.', true);
      return;
    }

    if (!associationForm.number_of_users || associationForm.number_of_users < 1) {
      showNotification('Number of users must be at least 1.', true);
      return;
    }

    try {
      const response = await fetch('/api/subscriptions/association-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(associationForm),
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Thank you! We will contact you soon about association pricing.');
        setAssociationForm({
          name: '',
          email: '',
          phone: '',
          comments: '',
          club_name: '',
          office_address: '',
          number_of_users: 50
        });
      } else {
        showNotification(`Error: ${data.message}`, true);
      }
    } catch (error) {
      console.error('Association form error:', error);
      showNotification('An error occurred. Please try again.', true);
    }
  };

  const handleRecipientChange = (giftCodeId, value) => {
    setGiftRecipients(prev => ({ ...prev, [giftCodeId]: value }));
  };

  const handleSendGift = async (giftCode) => {
    const recipient = giftRecipients[giftCode.id];
    if (!recipient || !recipient.trim()) {
      showNotification('Please enter a phone number or email.', true);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/subscriptions/gifts/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          giftCodeId: giftCode.id,
          recipient: recipient
        })
      });

      const data = await response.json();
      if (data.success) {
        showNotification('Gift invitation sent successfully!');
        setGiftRecipients(prev => ({ ...prev, [giftCode.id]: '' }));
      } else {
        showNotification(`Error: ${data.message}`, true);
      }
    } catch (error) {
      console.error('Error sending gift:', error);
      showNotification('Failed to send gift invitation.', true);
    }
  };

  const toggleReferralsDashboard = async () => {
    if (!showReferralsDashboard && !referralStats) {
      // Fetch referral stats when opening dashboard for first time
      await fetchReferralStats();
    }
    setShowReferralsDashboard(!showReferralsDashboard);
  };

  const fetchReferralStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/referrals/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setReferralStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error);
      // Set empty stats on error to avoid infinite loading
      setReferralStats({
        totalInvites: 0,
        viewed: 0,
        rejected: 0,
        accountsCreated: 0,
        upgraded: 0,
        invites: []
      });
    }
  };

  const generateReferralLink = () => {
    console.log('[Referral] Generating link with playerData:', {
      hasReferralCode: !!playerData?.referral_code,
      referralCode: playerData?.referral_code,
      playerId: playerData?.player_id
    });

    if (!playerData?.referral_code) {
      console.warn('[Referral] No referral code found in playerData');
      return '';
    }

    const baseUrl = window.location.origin;
    const link = `${baseUrl}/register?ref=${playerData.referral_code}`;
    console.log('[Referral] Generated link:', link);
    return link;
  };

  const copyReferralLink = () => {
    const link = generateReferralLink();

    if (!link) {
      console.error('[Referral] Cannot copy - no link generated');
      showNotification('Unable to generate referral link. Please refresh the page.', true);
      return;
    }

    console.log('[Referral] Attempting to copy link to clipboard');
    navigator.clipboard.writeText(link).then(() => {
      console.log('[Referral] Link copied successfully');
      showNotification('Referral link copied to clipboard!');
    }).catch(err => {
      console.error('[Referral] Clipboard copy failed:', err);
      showNotification('Failed to copy link. Please try again.', true);
    });
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
              <label>Phone Number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" />
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
            <div className="form-group"><label>Telegram</label><input type="url" name="telegram_url" value={socials.telegram_url} onChange={handleSocialsChange} placeholder="https://t.me/yourusername" /></div>
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
                        <button onClick={handleCancelSubscription} className="btn btn-danger">Cancel Subscription</button>
                      </div>

                      {/* Free Year Invites Section */}
                      <div className="gift-invites-section">
                        <h4>Free Year Invites</h4>
                        <p className="gift-invites-intro">Share your free year subscriptions with friends or colleagues.</p>

                        {giftCodes.length > 0 ? (
                          giftCodes.map((giftCode) => (
                            <div key={giftCode.id} className="gift-invite-row">
                              <div className="gift-code-label">
                                <span className="gift-code-text">{giftCode.gift_code}</span>
                                {giftCode.is_redeemed && <span className="redeemed-badge">Redeemed</span>}
                              </div>
                              {!giftCode.is_redeemed && (
                                <div className="gift-send-form">
                                  <input
                                    type="text"
                                    value={giftRecipients[giftCode.id] || ''}
                                    onChange={(e) => handleRecipientChange(giftCode.id, e.target.value)}
                                    placeholder="Phone number or email"
                                    className="gift-recipient-input"
                                  />
                                  <button
                                    onClick={() => handleSendGift(giftCode)}
                                    className="btn btn-primary btn-sm"
                                  >
                                    Send
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="no-gift-codes">
                            <p>You don't have any gift codes yet.</p>
                          </div>
                        )}
                      </div>

                      <div className="coupon-section">
                        <form onSubmit={handleRedeemCoupon} className="coupon-form-inline">
                          <div className="coupon-form-group">
                            <label htmlFor="coupon-input">Have a Gift Code?</label>
                            <div className="coupon-form-input-row">
                              <input
                                id="coupon-input"
                                type="text"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                                placeholder="Enter Code"
                                className="coupon-input"
                              />
                              <button type="submit" className="btn btn-sm">Redeem</button>
                            </div>
                          </div>
                        </form>

                        <div className="referral-link-section">
                          <label>Your Referral Link</label>
                          <div className="referral-link-row">
                            <input
                              type="text"
                              value={generateReferralLink()}
                              readOnly
                              className="referral-link-input"
                            />
                            <button onClick={copyReferralLink} className="btn btn-sm">Copy Link</button>
                          </div>
                          <p className="referral-hint">Share this link with friends to earn rewards when they sign up!</p>
                        </div>

                        <div className="referrals-button-wrapper">
                          <button onClick={toggleReferralsDashboard} className="btn btn-secondary">
                            {showReferralsDashboard ? 'Hide' : 'Referrals Dashboard'}
                          </button>
                        </div>
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
                            <p className="bundle-quantity">Year Subscriptions</p>
                            <p className="bundle-price">${bundle.price.toFixed(2)}</p>
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
                  {/* Full Width: Upgrade Options Only */}
                  <div className="upgrade-column-full-width">
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
                        <div className="plan-savings">Full access ⛳</div>
                        <ul className="plan-features">
                          <li>✓ Full Session History</li>
                          <li>✓ Create leagues and duels</li>
                        </ul>
                        <button onClick={() => handleSubscribe('monthly')} className="btn btn-primary">Subscribe Monthly</button>
                      </div>

                      {/* Yearly Plan */}
                      <div className="plan-card featured">
                        <div className="plan-badge">Best Value</div>
                        <h5>Yearly</h5>
                        <div className="plan-price">
                          <span className="amount">$21</span>
                          <span className="period">/year</span>
                        </div>
                        <div className="plan-savings">Save $4.20 vs monthly!</div>
                        <ul className="plan-features">
                          <li>✓ Everything in Monthly</li>
                          <li>✓ Early adopters get lifetime subscription</li>
                        </ul>
                        <button onClick={() => handleSubscribe('annual')} className="btn btn-primary btn-featured">Subscribe Yearly</button>
                      </div>
                    </div>

                    <div className="coupon-section">
                      <form onSubmit={handleRedeemCoupon} className="coupon-form-inline">
                        <div className="coupon-form-group">
                          <label htmlFor="coupon-input-free">Have a Gift Code?</label>
                          <div className="coupon-form-input-row">
                            <input
                              id="coupon-input-free"
                              type="text"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value)}
                              placeholder="Enter Code"
                              className="coupon-input"
                            />
                            <button type="submit" className="btn btn-sm">Redeem</button>
                          </div>
                        </div>
                      </form>

                      <div className="referral-link-section">
                        <label>Your Referral Link</label>
                        <div className="referral-link-row">
                          <input
                            type="text"
                            value={generateReferralLink()}
                            readOnly
                            className="referral-link-input"
                          />
                          <button onClick={copyReferralLink} className="btn btn-sm">Copy Link</button>
                        </div>
                        <p className="referral-hint">Share this link with friends to earn rewards when they sign up!</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
          }
        })()}
      </div>

      {/* Referrals Dashboard */}
      {showReferralsDashboard && (
        <div className="settings-section full-width-section">
          <h3>Referrals Dashboard</h3>
          {referralStats ? (
            <div className="referrals-stats">
              <table className="stats-summary-table">
                <thead>
                  <tr>
                    <th>Total Invites Sent</th>
                    <th>Viewed Invites</th>
                    <th>Rejected/Declined</th>
                    <th>Accounts Created</th>
                    <th>Upgraded to Subscriber</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{referralStats.totalInvites || 0}</td>
                    <td>{referralStats.viewed || 0}</td>
                    <td>{referralStats.rejected || 0}</td>
                    <td>{referralStats.accountsCreated || 0}</td>
                    <td>{referralStats.upgraded || 0}</td>
                  </tr>
                </tbody>
              </table>

              {referralStats.invites && referralStats.invites.length > 0 ? (
                <div className="referrals-list">
                  <h4>Recent Invites</h4>
                  <table className="referrals-table">
                    <thead>
                      <tr>
                        <th>Recipient</th>
                        <th>Sent Date</th>
                        <th>Status</th>
                        <th>Viewed</th>
                        <th>Account Created</th>
                        <th>Subscriber</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralStats.invites.map((invite, index) => (
                        <tr key={index}>
                          <td>{invite.recipient}</td>
                          <td>{new Date(invite.sent_at).toLocaleDateString()}</td>
                          <td>
                            <span className={`status-badge status-${invite.status}`}>
                              {invite.status}
                            </span>
                          </td>
                          <td>{invite.viewed ? '✓' : '—'}</td>
                          <td>{invite.account_created ? '✓' : '—'}</td>
                          <td>{invite.is_subscriber ? '✓' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-referrals">
                  <p>No referrals yet. Share your gift codes above to invite friends!</p>

                  <div className="referral-link-section">
                    <label>Your Referral Link</label>
                    <div className="referral-link-row">
                      <input
                        type="text"
                        value={generateReferralLink()}
                        readOnly
                        className="referral-link-input"
                      />
                      <button onClick={copyReferralLink} className="btn btn-primary btn-sm">Copy Link</button>
                    </div>
                    <p className="referral-hint">Share this link with friends to earn rewards when they sign up!</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="loading-stats">
              <p>Loading referral statistics...</p>
            </div>
          )}
        </div>
      )}

      <div className="settings-section full-width-section">
        <h3>Association Pricing</h3>
        <p className="association-intro">Need subscriptions for your golf club, association, or enterprise? Contact us for custom pricing on bulk subscriptions.</p>

        <form onSubmit={handleAssociationSubmit} className="association-form association-form-two-col">
          <div className="form-col-left">
            <div className="form-group form-group-compact">
              <label htmlFor="assoc-name">Name <span className="required">*</span></label>
              <input
                id="assoc-name"
                type="text"
                name="name"
                value={associationForm.name}
                onChange={handleAssociationFormChange}
                required
                placeholder="Your full name"
              />
            </div>

            <div className="form-group form-group-compact">
              <label htmlFor="assoc-phone">Phone</label>
              <input
                id="assoc-phone"
                type="tel"
                name="phone"
                value={associationForm.phone}
                onChange={handleAssociationFormChange}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="form-group form-group-compact">
              <label htmlFor="assoc-email">Email <span className="required">*</span></label>
              <input
                id="assoc-email"
                type="email"
                name="email"
                value={associationForm.email}
                onChange={handleAssociationFormChange}
                required
                placeholder="your.email@example.com"
              />
            </div>

            <div className="form-group form-group-compact">
              <label htmlFor="assoc-club-name">Club / Enterprise Name</label>
              <input
                id="assoc-club-name"
                type="text"
                name="club_name"
                value={associationForm.club_name}
                onChange={handleAssociationFormChange}
                placeholder="Your organization name"
              />
            </div>

            <div className="form-group form-group-compact">
              <label htmlFor="assoc-address">Office Address</label>
              <input
                id="assoc-address"
                type="text"
                name="office_address"
                value={associationForm.office_address}
                onChange={handleAssociationFormChange}
                placeholder="123 Main St, City, State, ZIP"
              />
            </div>
          </div>

          <div className="form-col-right">
            <div className="form-group">
              <label htmlFor="assoc-comments">Comments / Requirements <span className="required">*</span></label>
              <textarea
                id="assoc-comments"
                name="comments"
                value={associationForm.comments}
                onChange={handleAssociationFormChange}
                required
                rows="6"
                placeholder="Tell us about your needs, timeline, and any specific requirements..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="assoc-users">Number of Users <span className="required">*</span></label>
              <input
                id="assoc-users"
                type="number"
                name="number_of_users"
                value={associationForm.number_of_users}
                onChange={handleAssociationFormChange}
                required
                min="1"
                placeholder="50"
              />
            </div>

            <div className="form-group">
              <label>Additional Services</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="onboarding_support"
                    checked={associationForm.onboarding_support}
                    onChange={handleAssociationFormChange}
                  />
                  <span>Onboarding Support For Community</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="implementation_support"
                    checked={associationForm.implementation_support}
                    onChange={handleAssociationFormChange}
                  />
                  <span>Implementation Support For Administration</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="event_management"
                    checked={associationForm.event_management}
                    onChange={handleAssociationFormChange}
                  />
                  <span>Event Management On Site</span>
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-large btn-send-orange">Send</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
