import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ContactsModal from './ContactsModal';
import './Dashboard.css';

const Dashboard = () => {
  const { playerData, logout } = useAuth();
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Proof of Putt</h1>
          <div className="header-actions">
            <span className="welcome-text">Welcome, {playerData?.name}!</span>
            <button 
              onClick={() => setIsContactsModalOpen(true)}
              className="btn btn-secondary"
              title="View and manage friends & contacts"
            >
              CONTACTS
            </button>
            <button 
              onClick={logout}
              className="btn btn-outline"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h2>Session Tracking</h2>
            <p>Track your putting sessions and monitor your progress.</p>
            <div className="card-stats">
              <div className="stat-item">
                <span className="stat-value">0</span>
                <span className="stat-label">Total Sessions</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">0%</span>
                <span className="stat-label">Make Percentage</span>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <h2>Leaderboards</h2>
            <p>See how you rank against other players.</p>
            <div className="card-content">
              <div className="leaderboard-preview">
                <p>Join competitions to see your ranking!</p>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <h2>Friends & Social</h2>
            <p>Connect with other players and track their progress.</p>
            <div className="card-content">
              <button 
                onClick={() => setIsContactsModalOpen(true)}
                className="btn btn-primary"
              >
                Manage Friends
              </button>
            </div>
          </div>

          <div className="dashboard-card">
            <h2>Recent Activity</h2>
            <p>Your latest putting sessions and achievements.</p>
            <div className="card-content">
              <p className="no-activity">No recent activity to display.</p>
            </div>
          </div>
        </div>
      </main>

      {isContactsModalOpen && (
        <ContactsModal 
          isOpen={isContactsModalOpen}
          onClose={() => setIsContactsModalOpen(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;