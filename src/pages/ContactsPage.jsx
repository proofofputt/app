import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { apiGetLeaderboard, apiGetFriends, apiToggleCoachAccess } from '../api';
import LeaderboardCard from '../components/LeaderboardCard';
import './ContactsPage.css';

const ContactsPage = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [friendsLeaderboardData, setFriendsLeaderboardData] = useState(null);
  const [friends, setFriends] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);

  // Load friends leaderboard data
  useEffect(() => {
    const fetchFriendsLeaderboards = async () => {
      if (!playerData?.player_id) return;
      
      try {
        const results = await Promise.allSettled([
          apiGetLeaderboard({ metric: 'total_makes', context_type: 'friends', player_id: playerData.player_id }),
          apiGetLeaderboard({ metric: 'best_streak', context_type: 'friends', player_id: playerData.player_id }),
          apiGetLeaderboard({ metric: 'makes_per_minute', context_type: 'friends', player_id: playerData.player_id }),
          apiGetLeaderboard({ metric: 'fastest_21_makes_seconds', context_type: 'friends', player_id: playerData.player_id }),
        ]);

        const [topMakesResult, topStreaksResult, topMpmResult, fastest21Result] = results;

        const newFriendsLeaderboardData = {
          top_makes: topMakesResult.status === 'fulfilled' ? topMakesResult.value?.leaderboard ?? [] : [],
          top_streaks: topStreaksResult.status === 'fulfilled' ? topStreaksResult.value?.leaderboard ?? [] : [],
          top_makes_per_minute: topMpmResult.status === 'fulfilled' ? topMpmResult.value?.leaderboard ?? [] : [],
          fastest_21: fastest21Result.status === 'fulfilled' ? fastest21Result.value?.leaderboard ?? [] : [],
        };
        setFriendsLeaderboardData(newFriendsLeaderboardData);
      } catch (error) {
        console.error("Could not fetch friends leaderboard data:", error);
      }
    };

    fetchFriendsLeaderboards();
  }, [playerData?.player_id]);

  // Load friends list
  useEffect(() => {
    const fetchFriends = async () => {
      if (!playerData?.player_id) return;

      setIsLoadingFriends(true);
      try {
        const data = await apiGetFriends('accepted', true);
        if (data.success) {
          setFriends(data.friends || []);
        }
      } catch (error) {
        console.error('Error fetching friends:', error);
        showNotification('Failed to load friends', true);
      } finally {
        setIsLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [playerData?.player_id]);

  const handleToggleCoachAccess = async (friendId, currentlyEnabled) => {
    try {
      const result = await apiToggleCoachAccess(friendId, !currentlyEnabled);
      if (result.success) {
        showNotification(
          currentlyEnabled ? 'Coach access revoked' : 'Coach access granted successfully'
        );
        // Refresh friends list to show updated status
        const data = await apiGetFriends('accepted', true);
        if (data.success) {
          setFriends(data.friends || []);
        }
      }
    } catch (error) {
      console.error('Error toggling coach access:', error);
      showNotification('Failed to update coach access', true);
    }
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      showNotification('Please enter a search term', true);
      return;
    }
    showNotification('Friend search feature coming soon!');
  };

  return (
    <div className="contacts-page">
      <div className="contacts-header">
        <h1>Contacts</h1>
        <p>Connect with friends and family to share your putting progress</p>
      </div>

      <div className="contacts-content">
        {/* Friends Leaderboard Section */}
        {friendsLeaderboardData && (
          <div className="friends-leaderboard-container">
            <div className="leaderboard-summary-bar">
              <h2>Friends Leaderboard</h2>
              <p>All-time high scores comparison with your friends</p>
            </div>
            <div className="leaderboard-grid">
              <LeaderboardCard title="Most Makes" leaders={friendsLeaderboardData?.top_makes} />
              <LeaderboardCard title="Best Streak" leaders={friendsLeaderboardData?.top_streaks} />
              <LeaderboardCard title="Makes/Min" leaders={friendsLeaderboardData?.top_makes_per_minute} />
              <LeaderboardCard title="Fastest 21" leaders={friendsLeaderboardData?.fastest_21} />
            </div>
          </div>
        )}

        <YourFriendsSection
          friends={friends}
          isLoading={isLoadingFriends}
          onToggleCoachAccess={handleToggleCoachAccess}
          navigate={navigate}
        />

        <FindFriendsSection
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          handleSearch={handleSearch}
        />
      </div>
    </div>
  );
};

const YourFriendsSection = ({ friends, isLoading, onToggleCoachAccess, navigate }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="friends-section">
      <div className="friends-lists">
        <div className="friends-list-section">
          <h3>Your Friends</h3>

          {isLoading ? (
            <div className="loading-state">
              <p>Loading friends...</p>
            </div>
          ) : friends.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p>No friends yet.</p>
              <p>When someone signs up with your referral code, they'll automatically become your friend!</p>
            </div>
          ) : (
            <div className="friends-list">
              {friends.map((friend) => (
                <div key={friend.player_id} className={`friend-card ${friend.is_referrer ? 'referrer-card' : ''}`}>
                  <div className="friend-header">
                    <div className="friend-info">
                      <h4>{friend.display_name}</h4>
                      {friend.is_referrer && (
                        <span className="referrer-badge">🌟 Your Referrer</span>
                      )}
                      {friend.friendship_source === 'referral' && !friend.is_referrer && (
                        <span className="friend-badge">Referred by you</span>
                      )}
                    </div>
                    <div className="friend-stats">
                      <span className="stat-item">{friend.total_sessions || 0} sessions</span>
                      <span className="stat-item">Last: {formatDate(friend.last_session_date)}</span>
                    </div>
                  </div>

                  <div className="friend-actions">
                    <div className="coach-access-section">
                      <div className="access-toggle">
                        <label>
                          <input
                            type="checkbox"
                            checked={friend.coach_access_granted.has_access}
                            onChange={() => onToggleCoachAccess(friend.player_id, friend.coach_access_granted.has_access)}
                          />
                          <span className="toggle-label">
                            Grant Coach Access (they can view your sessions)
                          </span>
                        </label>
                      </div>

                      {friend.coach_access_received.has_access && (
                        <div className="access-status">
                          <span className="status-indicator">✓ They granted you access</span>
                          <button
                            onClick={() => navigate(`/player/${friend.player_id}/sessions`)}
                            className="btn btn-sm btn-secondary"
                          >
                            View Their Sessions
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <ImportContactsButton />
        </div>
      </div>
    </div>
  );
};

const FindFriendsSection = ({ searchTerm, setSearchTerm, handleSearch }) => {
  return (
    <div className="find-friends-section">
      <div className="search-container">
        <div className="search-header">
          <h2>Find Friends</h2>
          <div className="privacy-info">
            <span className="privacy-icon">🔒</span>
            <span>Search by email, phone, or username. Only usernames are shown publicly.</span>
          </div>
        </div>

        <div className="search-box">
          <input
            type="text"
            placeholder="Search by email, phone, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="search-button">
            Search
          </button>
        </div>
      </div>
    </div>
  );
};

const ImportContactsButton = () => {
  const { showTemporaryNotification: showNotification } = useNotification();
  const [showImportModal, setShowImportModal] = useState(false);

  const handleImportContacts = () => {
    setShowImportModal(true);
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification(`✅ ${type} copied to clipboard!`, false);
    } catch (error) {
      showNotification(`❌ Failed to copy ${type}. Please copy manually.`, true);
    }
  };

  const platformGuides = {
    ios: {
      title: "📱 iPhone/iPad Contacts",
      description: "Select up to 5 close friends to check if they're on Proof of Putt",
      steps: [
        "Open Settings > [Your Name] > iCloud",
        "Make sure Contacts is turned on",
        "Go to icloud.com on your computer",
        "Sign in and click Contacts",
        "Select up to 5 close friends (hold Cmd/Ctrl to multi-select)",
        "Click the gear icon and choose 'Export vCard'",
        "Download and open the file to get their email addresses"
      ],
      note: "💡 Focus on friends who might already enjoy golf or competitive games. Quality over quantity!"
    },
    android: {
      title: "🤖 Android Contacts",
      description: "Find up to 5 friends through Google Contacts",
      steps: [
        "Open Google Contacts (contacts.google.com)",
        "Sign in with your Google account",
        "Browse your contacts list",
        "Select up to 5 close friends (use checkboxes)",
        "Click 'Export' and choose 'Google CSV' format",
        "Download and open the CSV file to get email addresses"
      ],
      note: "💡 Look for friends who might already be interested in golf or sports apps."
    },
    gmail: {
      title: "📧 Gmail Contacts",
      description: "Browse contacts to find existing Proof of Putt players",
      steps: [
        "Go to contacts.google.com",
        "Sign in with your Gmail account",
        "Browse your contacts list",
        "Pick up to 5 friends who might be golfers",
        "Note their email addresses",
        "Use the search box above to look them up one by one"
      ],
      link: "https://contacts.google.com",
      linkText: "Open Gmail Contacts"
    },
    outlook: {
      title: "📬 Outlook Contacts",
      description: "Select a few friends to check if they're already players",
      steps: [
        "Go to outlook.live.com and sign in",
        "Click the People icon (contacts)",
        "Browse your contacts list",
        "Select up to 5 friends who might enjoy golf",
        "Note their email addresses or phone numbers",
        "Use the search box above to find them on Proof of Putt"
      ],
      link: "https://outlook.live.com/people",
      linkText: "Open Outlook Contacts"
    }
  };

  return (
    <div className="import-contacts-section">
      <button
        onClick={handleImportContacts}
        className="btn btn-secondary import-contacts-btn"
      >
        🔍 Find Friends on Platform
      </button>
      
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content contact-import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 Find Friends Already on Proof of Putt</h3>
              <p>Choose your platform to check if your friends are already players. We recommend starting with <strong>5 contacts maximum</strong> to focus on quality connections:</p>
            </div>
            
            <div className="platform-guides">
              {Object.entries(platformGuides).map(([key, guide]) => (
                <div key={key} className="platform-guide">
                  <div className="platform-header">
                    <h4>{guide.title}</h4>
                    <p>{guide.description}</p>
                  </div>
                  
                  <div className="platform-steps">
                    <ol>
                      {guide.steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  
                  {guide.link && (
                    <div className="platform-action">
                      <a 
                        href={guide.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                      >
                        {guide.linkText}
                      </a>
                    </div>
                  )}
                  
                  <div className="platform-note">
                    <span className="note-icon">💡</span>
                    <span>{guide.note}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="import-help">
              <div className="help-section">
                <h4>🔍 Friend Discovery Process</h4>
                <p>The contact import helps you <strong>find existing players</strong> who are already on Proof of Putt:</p>
                <ul>
                  <li>📧 Export up to <strong>5 contacts at a time</strong> from your chosen platform</li>
                  <li>🔍 Use the search box above to look up their email addresses or phone numbers</li>
                  <li>✅ Connect with friends who are already playing</li>
                  <li>🎯 Optionally invite close friends who aren't on the platform yet</li>
                </ul>
              </div>
              
              <div className="help-section">
                <h4>📱 Responsible Contact Usage</h4>
                <p><strong>Why the 5-contact limit?</strong> We encourage finding existing players rather than mass invitations:</p>
                <ul>
                  <li>🎯 Focus on connecting with friends who already enjoy putting</li>
                  <li>🚫 Prevents spam and respects privacy</li>
                  <li>📊 Better success rate with targeted friend searches</li>
                  <li>🤝 Builds a quality community of engaged players</li>
                </ul>
                <button 
                  onClick={() => copyToClipboard('https://app.proofofputt.com', 'App link')}
                  className="btn btn-secondary btn-sm copy-link-btn"
                >
                  📋 Copy App Link to Share Manually
                </button>
              </div>
            </div>
            
            <div className="modal-actions">
              <button
                onClick={() => setShowImportModal(false)}
                className="btn btn-primary"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default ContactsPage;