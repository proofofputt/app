import React, { useState } from 'react';
import './ContactsModal.css';

const ContactsModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('friends');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Friends & Contacts</h2>
          <button className="modal-close" onClick={onClose}>×</button>
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
          {activeTab === 'friends' && <FriendsTab />}
          {activeTab === 'leaderboard' && <LeaderboardTab />}
        </div>
      </div>
    </div>
  );
};

const FriendsTab = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="friends-tab">
      <div className="friends-header">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search for players to add as friends..."
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

const LeaderboardTab = () => {
  return (
    <div className="leaderboard-tab">
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