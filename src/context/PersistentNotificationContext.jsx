import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import {
  apiGetNotifications,
  apiGetUnreadNotificationsCount,
  apiMarkNotificationAsRead,
  apiMarkAllNotificationsAsRead,
  apiDeleteNotification,
} from '../api.js';

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

    try {
      const result = await apiGetUnreadNotificationsCount(playerData.player_id);
      setUnreadCount(result.unread_count || 0);
    } catch (error) {
      console.error('Failed to fetch unread notification count:', error);
      setUnreadCount(0);
    }
  }, [playerData]);

  const fetchNotifications = useCallback(async (limit = 20, offset = 0) => {
    if (!playerData) return;
    setIsLoading(true);
    setError('');

    try {
      const result = await apiGetNotifications(playerData.player_id);
      setNotifications(result.notifications || []);
      setUnreadCount(result.unread_count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setError('Failed to load notifications');
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [playerData]);

  useEffect(() => {
    // Fetch initial count for the header badge when player data is available
    if (playerData) {
      fetchUnreadCount();
    }
  }, [playerData, fetchUnreadCount]);

  const markAsRead = async (notificationId) => {
    if (!playerData) return;

    try {
      await apiMarkNotificationAsRead(playerData.player_id, notificationId);
      setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, read_status: true } : n)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      setError('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    if (!playerData) return;

    try {
      await apiMarkAllNotificationsAsRead(playerData.player_id);
      setNotifications(prev => prev.map(n => ({ ...n, read_status: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      setError('Failed to mark all notifications as read');
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!playerData) return;

    const notificationToDelete = notifications.find(n => n.id === notificationId);

    try {
      await apiDeleteNotification(playerData.player_id, notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notificationToDelete && !notificationToDelete.read_status) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      setError('Failed to delete notification');
    }
  };

  const value = { notifications, unreadCount, isLoading, error, fetchNotifications, markAsRead, markAllAsRead, deleteNotification, fetchUnreadCount };

  return (
    <PersistentNotificationContext.Provider value={value}>
      {children}
    </PersistentNotificationContext.Provider>
  );
};