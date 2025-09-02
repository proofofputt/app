import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { useNotification } from '@/context/NotificationContext.jsx';
import { usePersistentNotifications } from '@/context/PersistentNotificationContext.jsx';
import ProfileDropdown from './ProfileDropdown.jsx';

const Header = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const { unreadCount } = usePersistentNotifications();
  const isSubscribed = playerData?.subscription_status === 'active';
  const navigate = useNavigate();

  const handleProtectedLinkClick = (e) => {
    if (!isSubscribed) {
      e.preventDefault();
      showNotification("This feature requires a full subscription. Please upgrade to continue.", true);
      navigate('/settings');
    }
  };

  return (
    <header className="app-header">
      <Link to="/" className="logo-link"><img src="/POP.Proof_Of_Putt.Log.576.png" alt="Proof of Putt Logo" className="logo-img" /></Link>
      {playerData && (
        <nav>
          <NavLink to="/duels" className={({ isActive }) => `btn ${isActive ? 'active' : ''}`}>Duels</NavLink>
          <NavLink to="/leagues" className={({ isActive }) => `btn ${isActive ? 'active' : ''}`}>Leagues</NavLink>
          <NavLink to="/coach" className={({ isActive }) => `btn ${isActive ? 'active' : ''}`} onClick={handleProtectedLinkClick}>Coach</NavLink>
          
          <NavLink to="/" className={({ isActive }) => `btn ${isActive ? 'active' : ''}`} end>Dashboard</NavLink>
          <ProfileDropdown />
        </nav>
      )}
    </header>
  );
};

export default Header;
