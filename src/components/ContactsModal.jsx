import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './ContactsModal.css';

const ContactsModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('friends');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Friends & Contacts</h2>
          <div className="modal-header-actions">
            <Link to="/friends" className="btn btn-small" onClick={onClose}>
              Open Full Friends Page
            </Link>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        
        <div className="modal-tabs">
          <button 
            className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            Friends List
          </button>
          <button 
            className={`tab-button ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            Friends Leaderboard
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'friends' && <FriendsTab onClose={onClose} />}
          {activeTab === 'leaderboard' && <LeaderboardTab onClose={onClose} />}
        </div>
      </div>
    </div>
  );
};

const FriendsTab = ({ onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="friends-tab">
      <div className="modal-upgrade-notice">
        <p>This is a preview of your friends list. For the full experience with private friend search, activity feeds, detailed leaderboards, and competition tracking:</p>
        <Link to="/friends" className="btn btn-primary" onClick={onClose}>
          Go to Full Friends Page
        </Link>
      </div>

      <div className="privacy-info">
        <h4>🔒 Privacy Notice</h4>
        <p>Find friends by email, phone, or username. Only usernames are shown publicly in leaderboards and activity feeds.</p>
      </div>

      <div className="friends-header">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search by email, phone, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button className="search-button">Search</button>
        </div>
      </div>

      <div className="friends-section">
        <h3>Your Friends</h3>
        <div className="friends-list">
          <div className="empty-state">
            <p>No friends added yet.</p>
            <p>Use the search above to find and add friends!</p>
          </div>
        </div>
      </div>

      <div className="friends-section">
        <h3>Friend Requests</h3>
        <div className="requests-list">
          <div className="empty-state">
            <p>No pending friend requests.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const LeaderboardTab = ({ onClose }) => {
  return (
    <div className="leaderboard-tab">
      <div className="modal-upgrade-notice">
        <p>Preview your friends leaderboard with basic rankings. For detailed stats, activity tracking, and competition analysis:</p>
        <Link to="/friends" className="btn btn-primary" onClick={onClose}>
          Go to Full Friends Page
        </Link>
      </div>

      <div className="leaderboard-header">
        <h3>Friends Leaderboard</h3>
        <div className="leaderboard-filters">
          <select className="filter-select">
            <option value="all-time">All Time</option>
            <option value="this-month">This Month</option>
            <option value="this-week">This Week</option>
          </select>
        </div>
      </div>

      <div className="leaderboard-list">
        <div className="empty-state">
          <p>Add friends to see the leaderboard!</p>
          <p>Compete with your friends and track your progress together.</p>
        </div>
      </div>
    </div>
  );
};

export default ContactsModal;