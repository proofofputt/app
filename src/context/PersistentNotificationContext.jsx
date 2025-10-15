import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
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

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const PersistentNotificationProvider = ({ children }) => {
  const { playerData } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

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

  // SSE connection management
  const connectSSE = useCallback(() => {
    if (!playerData) {
      console.log('[SSE] No player data, skipping connection');
      return;
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      console.warn('[SSE] No auth token available');
      return;
    }

    try {
      // EventSource doesn't support custom headers, so we pass token as query param
      const sseUrl = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;

      console.log('[SSE] Connecting to notification stream...');

      const eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        console.log('[SSE] Connected to notification stream');
        setIsConnected(true);
        setError('');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Received event:', data);

          if (data.type === 'notification') {
            // Add new notification to the list
            setNotifications(prev => [data.notification, ...prev]);
            setUnreadCount(prev => prev + 1);

            // Show browser notification if permitted
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(data.notification.title, {
                body: data.notification.message,
                icon: '/logo.png',
                tag: `notification-${data.notification.id}`
              });
            }
          } else if (data.type === 'connected') {
            console.log('[SSE] Connection confirmed for player:', data.playerId);
          }
        } catch (error) {
          console.error('[SSE] Error parsing message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        setIsConnected(false);
        eventSource.close();

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[SSE] Attempting to reconnect...');
          connectSSE();
        }, 5000);
      };

      eventSourceRef.current = eventSource;

    } catch (error) {
      console.error('[SSE] Failed to establish connection:', error);
      setIsConnected(false);
    }
  }, [playerData]);

  const disconnectSSE = useCallback(() => {
    console.log('[SSE] Disconnecting from notification stream');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('[Notifications] Permission:', permission);
      });
    }
  }, []);

  // Establish SSE connection when player logs in
  useEffect(() => {
    if (playerData) {
      console.log('[SSE] Player logged in, establishing SSE connection');
      connectSSE();
    } else {
      console.log('[SSE] Player logged out, disconnecting SSE');
      disconnectSSE();
    }

    // Cleanup on unmount
    return () => {
      disconnectSSE();
    };
  }, [playerData, connectSSE, disconnectSSE]);

  const value = {
    notifications,
    unreadCount,
    isLoading,
    error,
    isConnected,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchUnreadCount,
    connectSSE,
    disconnectSSE
  };

  return (
    <PersistentNotificationContext.Provider value={value}>
      {children}
    </PersistentNotificationContext.Provider>
  );
};