import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { usePersistentNotifications } from '@/context/PersistentNotificationContext.jsx';
import './ProfileDropdown.css';

const ProfileDropdown = () => {
  const { playerData, logout } = useAuth();
  const { unreadCount } = usePersistentNotifications();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  if (!playerData) return null;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <button className="profile-button" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle user menu">
        <span className="profile-name-header">{playerData.name}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <NavLink to={`/player/${playerData?.player_id}/stats`} className="dropdown-item" onClick={() => setIsOpen(false)}>
            My Stats
          </NavLink>
          <NavLink to="/settings" className="dropdown-item" onClick={() => setIsOpen(false)}>
            Settings
          </NavLink>
          <div className="dropdown-divider"></div>
          <NavLink to="/notifications" className={`dropdown-item ${unreadCount > 0 ? 'unread' : ''}`} onClick={() => setIsOpen(false)}>
            Notifications {unreadCount > 0 && `(${unreadCount})`}
          </NavLink>
          <div className="dropdown-divider"></div>
          <button onClick={handleLogout} className="dropdown-item">Logout</button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
