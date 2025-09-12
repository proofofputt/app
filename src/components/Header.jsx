import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ProfileDropdown from './ProfileDropdown.jsx';

const Header = () => {
  const { playerData } = useAuth();

  return (
    <header className="app-header">
      <Link to="/" className="logo-link"><img src="/POP.Proof_Of_Putt.Log.576.png" alt="Proof of Putt Logo" className="logo-img" /></Link>
      {playerData && (
        <nav>
          <NavLink to="/duels" className={({ isActive }) => `btn ${isActive ? 'active' : ''}`}>Duels</NavLink>
          <NavLink to="/leagues" className={({ isActive }) => `btn ${isActive ? 'active' : ''}`}>Leagues</NavLink>
          
          <NavLink to="/" className={({ isActive }) => `btn ${isActive ? 'active' : ''}`} end>Dashboard</NavLink>
          <ProfileDropdown />
        </nav>
      )}
    </header>
  );
};

export default Header;
