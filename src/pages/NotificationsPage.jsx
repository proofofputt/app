import React, { useEffect } from 'react';
import { usePersistentNotifications } from '../context/PersistentNotificationContext.jsx';
import { Link } from 'react-router-dom';
import './NotificationsPage.css';

const NotificationsPage = () => {
  const { notifications, isLoading, error, isConnected, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = usePersistentNotifications();

  useEffect(() => {
    fetchNotifications(); // Fetch notifications when component mounts
  }, [fetchNotifications]);

  const handleMarkAsRead = (id) => {
    markAsRead(id);
  };

  const handleDelete = (id) => {
    deleteNotification(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  if (isLoading) return <p>Loading notifications...</p>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <div className="notifications-page">
      <div className="page-header">
        <h2>Notifications</h2>
        {notifications.length > 0 && (
          <button onClick={handleMarkAllAsRead} className="btn btn-secondary btn-small">Mark All as Read</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h3 className="empty-state-title">All Caught Up!</h3>
          <p className="empty-state-subtitle">
            {isConnected ? (
              <>
                <span className="connection-badge live">🟢 Live</span>
                You'll receive instant notifications for all your activities
              </>
            ) : (
              'You have no new notifications at the moment'
            )}
          </p>

          <div className="notification-types">
            <h4>You'll be notified about:</h4>

            <div className="notification-type-grid">
              <div className="notification-type-card">
                <div className="type-icon">🎯</div>
                <div className="type-content">
                  <strong>Duel Challenges</strong>
                  <p>When someone challenges you to a duel</p>
                </div>
              </div>

              <div className="notification-type-card">
                <div className="type-icon">🏆</div>
                <div className="type-content">
                  <strong>Achievements</strong>
                  <p>Perfect sessions, streaks, and milestones</p>
                </div>
              </div>

              <div className="notification-type-card">
                <div className="type-icon">🏅</div>
                <div className="type-content">
                  <strong>League Updates</strong>
                  <p>Round results, invitations, and championships</p>
                </div>
              </div>

              <div className="notification-type-card">
                <div className="type-icon">⚔️</div>
                <div className="type-content">
                  <strong>Match Results</strong>
                  <p>Duel outcomes and competition standings</p>
                </div>
              </div>

              <div className="notification-type-card">
                <div className="type-icon">⏰</div>
                <div className="type-content">
                  <strong>Reminders</strong>
                  <p>Upcoming deadlines for duels and leagues</p>
                </div>
              </div>

              <div className="notification-type-card">
                <div className="type-icon">👥</div>
                <div className="type-content">
                  <strong>Social</strong>
                  <p>Friend requests and community updates</p>
                </div>
              </div>
            </div>
          </div>

          {!isConnected && (
            <div className="connection-warning">
              <span className="connection-badge offline">⚠️ Reconnecting...</span>
              <p>Real-time notifications will resume when connection is restored</p>
            </div>
          )}
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map(notification => (
            <div key={notification.id} className={`notification-item ${notification.read_status ? 'read' : 'unread'}`}>
              <div className="notification-content">
                <p>{notification.message}</p>
                <span className="notification-timestamp">{new Date(notification.created_at).toLocaleString()}</span>
              </div>
              <div className="notification-actions">
                {!notification.read_status && (
                  <button onClick={() => handleMarkAsRead(notification.id)} className="btn btn-tertiary btn-small">Mark Read</button>
                )}
                {notification.link_path && (
                  <Link to={notification.link_path} className="btn btn-secondary btn-small">View</Link>
                )}
                <button onClick={() => handleDelete(notification.id)} className="btn btn-danger btn-small">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;