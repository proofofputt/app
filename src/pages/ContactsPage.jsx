import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import './ContactsPage.css';

const ContactsPage = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');

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
        <h1>Friends & Contacts</h1>
        <p>Connect with friends and family to share your putting progress</p>
      </div>

      <div className="contacts-content">
        <FriendsSection 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          handleSearch={handleSearch}
        />
      </div>
    </div>
  );
};

const FriendsSection = ({ searchTerm, setSearchTerm, handleSearch }) => {
  return (
    <div className="friends-section">
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

      <div className="friends-lists">
        <div className="friends-list-section">
          <h3>Your Friends</h3>
          <div className="friends-list">
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p>No friends added yet.</p>
              <p>Use the search above to find and connect with other players!</p>
            </div>
          </div>
        </div>

        <div className="friends-list-section">
          <h3>Friend Requests</h3>
          <div className="requests-list">
            <div className="empty-state">
              <div className="empty-icon">📮</div>
              <p>No pending friend requests.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default ContactsPage;