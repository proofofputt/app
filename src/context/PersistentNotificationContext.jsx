import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import {
  apiGetNotifications,
  apiGetUnreadNotificationsCount,
  apiMarkNotificationAsRead,
  apiMarkAllNotificationsAsRead,
  apiDeleteNotification,
} from '@/api.js';

const PersistentNotificationContext = createContext();

export const usePersistentNotifications = () => useContext(PersistentNotificationContext);

export const PersistentNotificationProvider = ({ children }) => {
  const { playerData } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUnreadCount = useCallback(async () => {
    if (!playerData) return;
    // DISABLED: Notifications API calls - using mock data for testing
    console.log("Notifications disabled - using mock unread count");
    setUnreadCount(0); // Mock: no unread notifications
  }, [playerData]);

  const fetchNotifications = useCallback(async (limit = 20, offset = 0) => {
    if (!playerData) return;
    setIsLoading(true);
    // DISABLED: Notifications API calls - using mock data for testing
    console.log("Notifications disabled - using mock notifications");
    setNotifications([]); // Mock: empty notifications array
    setUnreadCount(0);   // Mock: no unread notifications
    setIsLoading(false);
  }, [playerData]);

  useEffect(() => {
    // Fetch initial count for the header badge when player data is available
    if (playerData) {
      fetchUnreadCount();
    }
  }, [playerData, fetchUnreadCount]);

  const markAsRead = async (notificationId) => {
    // DISABLED: Notifications API calls - mock functionality
    console.log("Notifications disabled - mock markAsRead", notificationId);
    setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, read_status: true } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    // DISABLED: Notifications API calls - mock functionality  
    console.log("Notifications disabled - mock markAllAsRead");
    setNotifications(prev => prev.map(n => ({ ...n, read_status: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (notificationId) => {
    // DISABLED: Notifications API calls - mock functionality
    console.log("Notifications disabled - mock deleteNotification", notificationId);
    const notificationToDelete = notifications.find(n => n.id === notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (notificationToDelete && !notificationToDelete.read_status) {
        setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const value = { notifications, unreadCount, isLoading, error, fetchNotifications, markAsRead, markAllAsRead, deleteNotification, fetchUnreadCount };

  return (
    <PersistentNotificationContext.Provider value={value}>
      {children}
    </PersistentNotificationContext.Provider>
  );
};