import React, { useEffect } from 'react';
import { usePersistentNotifications } from '@/context/PersistentNotificationContext.jsx';
import { Link } from 'react-router-dom';
import './NotificationsPage.css';

const NotificationsPage = () => {
  const { notifications, isLoading, error, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = usePersistentNotifications();

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
        <p>You have no new notifications.</p>
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