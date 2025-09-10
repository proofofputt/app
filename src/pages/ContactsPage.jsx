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
          
          <ImportContactsButton />
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

const ImportContactsButton = () => {
  const { showTemporaryNotification: showNotification } = useNotification();
  const [showImportModal, setShowImportModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState(new Set());

  const handleImportContacts = async () => {
    try {
      // Request contacts access using the Contacts API (if supported)
      if ('contacts' in navigator && 'ContactsManager' in window) {
        const props = ['name', 'email', 'tel'];
        const opts = { multiple: true };
        
        const contactList = await navigator.contacts.select(props, opts);
        setContacts(contactList);
        setShowImportModal(true);
      } else {
        // Fallback for browsers that don't support the Contacts API
        showNotification('Contact import not supported on this device. Please add friends manually using the search above.', true);
      }
    } catch (error) {
      console.error('Failed to import contacts:', error);
      if (error.name === 'InvalidStateError') {
        showNotification('Contact access was cancelled.', true);
      } else {
        showNotification('Contact import not available on this device. Please add friends manually.', true);
      }
    }
  };

  const handleSelectContact = (contact, index) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedContacts(newSelected);
  };

  const handleSendInvites = () => {
    const selectedContactsList = contacts.filter((_, index) => selectedContacts.has(index));
    
    if (selectedContactsList.length === 0) {
      showNotification('Please select contacts to invite.', true);
      return;
    }

    // For now, just show a success message
    showNotification(`Invites sent to ${selectedContactsList.length} contact${selectedContactsList.length > 1 ? 's' : ''}! They'll receive an invitation to join Proof of Putt.`);
    setShowImportModal(false);
    setSelectedContacts(new Set());
  };

  return (
    <div className="import-contacts-section">
      <button
        onClick={handleImportContacts}
        className="btn btn-secondary import-contacts-btn"
      >
        📱 Import Contacts
      </button>
      
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Import Contacts</h3>
            <p>Select contacts to invite to Proof of Putt:</p>
            
            <div className="contacts-list">
              {contacts.map((contact, index) => (
                <div
                  key={index}
                  className={`contact-item ${selectedContacts.has(index) ? 'selected' : ''}`}
                  onClick={() => handleSelectContact(contact, index)}
                >
                  <div className="contact-info">
                    <div className="contact-name">{contact.name?.[0] || 'Unknown'}</div>
                    <div className="contact-details">
                      {contact.email?.[0] && <span>{contact.email[0]}</span>}
                      {contact.tel?.[0] && <span>{contact.tel[0]}</span>}
                    </div>
                  </div>
                  <div className="contact-checkbox">
                    {selectedContacts.has(index) ? '✓' : '○'}
                  </div>
                </div>
              ))}
            </div>
            
            {contacts.length === 0 && (
              <div className="empty-state">
                <p>No contacts available to import.</p>
              </div>
            )}
            
            <div className="modal-actions">
              <button
                onClick={() => setShowImportModal(false)}
                className="btn btn-tertiary"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvites}
                className="btn btn-primary"
                disabled={selectedContacts.size === 0}
              >
                Send Invites ({selectedContacts.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default ContactsPage;