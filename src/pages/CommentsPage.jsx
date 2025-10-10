import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import {
  apiGetFeedbackThreads,
  apiGetFeedbackThread,
  apiCreateFeedbackThread,
  apiAddFeedbackMessage
} from '../api.js';
import './CommentsPage.css';

const CATEGORIES = [
  { value: 'general_feedback', label: 'General Feedback' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'page_issue', label: 'Page Issue' },
  { value: 'ui_ux', label: 'UI/UX Suggestion' },
  { value: 'performance', label: 'Performance Issue' },
  { value: 'support', label: 'Support Request' },
  { value: 'other', label: 'Other' }
];

const PAGE_LOCATIONS = [
  'Home Dashboard',
  'Duels',
  'Leagues',
  'Leaderboards',
  'Player Profile',
  'Session History',
  'Notifications',
  'Settings',
  'Login/Register',
  'Fundraisers',
  'Friends',
  'AI Coach',
  'Desktop App',
  'Other'
];

const FEATURE_AREAS = [
  'Navigation',
  'Session Recording',
  'Scoring System',
  'Invite System',
  'Leaderboard Filtering',
  'Notifications',
  'Authentication',
  'Payment Processing',
  'Real-time Updates',
  'Mobile Responsiveness',
  'Data Synchronization',
  'User Profile',
  'Social Features',
  'Competition Management',
  'Other'
];

const CommentsPage = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();

  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [showNewThreadForm, setShowNewThreadForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  // New thread form state
  const [newThread, setNewThread] = useState({
    subject: '',
    category: 'general_feedback',
    page_location: '',
    feature_area: '',
    initial_message: ''
  });

  // New message state
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (playerData?.player_id) {
      loadThreads();
    }
  }, [playerData?.player_id, filterStatus]);

  const loadThreads = async () => {
    setIsLoadingThreads(true);
    try {
      const status = filterStatus === 'all' ? null : filterStatus;
      const response = await apiGetFeedbackThreads(status);
      setThreads(response.threads || []);
    } catch (error) {
      console.error('Error loading feedback threads:', error);
      showNotification('Failed to load feedback threads', true);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const loadThread = async (threadId) => {
    setIsLoadingThread(true);
    try {
      const response = await apiGetFeedbackThread(threadId);
      setSelectedThread({
        ...response.thread,
        messages: response.messages || []
      });
    } catch (error) {
      console.error('Error loading thread:', error);
      showNotification('Failed to load conversation', true);
    } finally {
      setIsLoadingThread(false);
    }
  };

  const handleCreateThread = async (e) => {
    e.preventDefault();

    if (!newThread.subject.trim() || !newThread.initial_message.trim()) {
      showNotification('Please provide a subject and message', true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiCreateFeedbackThread(newThread);
      showNotification(response.message || 'Feedback submitted successfully!');
      setNewThread({
        subject: '',
        category: 'general_feedback',
        page_location: '',
        feature_area: '',
        initial_message: ''
      });
      setShowNewThreadForm(false);
      loadThreads(); // Refresh the list
    } catch (error) {
      console.error('Error creating feedback:', error);
      showNotification(error.message || 'Failed to submit feedback', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim()) {
      showNotification('Please enter a message', true);
      return;
    }

    setIsSubmitting(true);
    try {
      await apiAddFeedbackMessage(selectedThread.thread_id, newMessage);
      showNotification('Message added successfully');
      setNewMessage('');
      loadThread(selectedThread.thread_id); // Refresh the thread
    } catch (error) {
      console.error('Error adding message:', error);
      showNotification(error.message || 'Failed to add message', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThreadClick = (threadId) => {
    loadThread(threadId);
  };

  const handleBackToList = () => {
    setSelectedThread(null);
  };

  const getCategoryLabel = (value) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      open: 'status-open',
      in_progress: 'status-progress',
      resolved: 'status-resolved',
      closed: 'status-closed'
    };
    return statusMap[status] || 'status-open';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (!playerData) {
    return <div className="comments-page"><p>Loading...</p></div>;
  }

  return (
    <div className="comments-page">
      <div className="page-header">
        <h1>Comments & Feedback</h1>
        <p className="welcome-message">
          Welcome to Proof of Putt! We recently launched and your feedback is invaluable to us.
          Share your thoughts, report issues, or suggest new features below.
        </p>
      </div>

      {!selectedThread ? (
        <div className="threads-view">
          <div className="threads-header">
            <div className="filter-controls">
              <label>Filter by status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="status-filter"
              >
                <option value="all">All Conversations</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowNewThreadForm(!showNewThreadForm)}
            >
              {showNewThreadForm ? 'Cancel' : 'New Feedback'}
            </button>
          </div>

          {showNewThreadForm && (
            <div className="new-thread-form card">
              <h3>Submit New Feedback</h3>
              <form onSubmit={handleCreateThread}>
                <div className="form-group">
                  <label>Subject *</label>
                  <input
                    type="text"
                    value={newThread.subject}
                    onChange={(e) => setNewThread({ ...newThread, subject: e.target.value })}
                    placeholder="Brief description of your feedback"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      value={newThread.category}
                      onChange={(e) => setNewThread({ ...newThread, category: e.target.value })}
                      required
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Page/Area (Optional)</label>
                    <select
                      value={newThread.page_location}
                      onChange={(e) => setNewThread({ ...newThread, page_location: e.target.value })}
                    >
                      <option value="">Select a page...</option>
                      {PAGE_LOCATIONS.map(page => (
                        <option key={page} value={page}>{page}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Feature/Function (Optional)</label>
                    <select
                      value={newThread.feature_area}
                      onChange={(e) => setNewThread({ ...newThread, feature_area: e.target.value })}
                    >
                      <option value="">Select a feature...</option>
                      {FEATURE_AREAS.map(feature => (
                        <option key={feature} value={feature}>{feature}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Your Feedback *</label>
                  <textarea
                    value={newThread.initial_message}
                    onChange={(e) => setNewThread({ ...newThread, initial_message: e.target.value })}
                    placeholder="Please provide detailed information about your feedback, bug report, or feature request..."
                    rows="6"
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </form>
            </div>
          )}

          <div className="threads-list">
            {isLoadingThreads ? (
              <p>Loading conversations...</p>
            ) : threads.length === 0 ? (
              <div className="empty-state">
                <p>No feedback threads yet.</p>
                <p>Click "New Feedback" to start a conversation!</p>
              </div>
            ) : (
              threads.map(thread => (
                <div
                  key={thread.thread_id}
                  className="thread-item card"
                  onClick={() => handleThreadClick(thread.thread_id)}
                >
                  <div className="thread-header">
                    <h3>{thread.subject}</h3>
                    <span className={`status-badge ${getStatusBadgeClass(thread.status)}`}>
                      {thread.status}
                    </span>
                  </div>
                  <div className="thread-meta">
                    <span className="category-badge">{getCategoryLabel(thread.category)}</span>
                    {thread.page_location && (
                      <span className="meta-item">📍 {thread.page_location}</span>
                    )}
                    {thread.feature_area && (
                      <span className="meta-item">⚙️ {thread.feature_area}</span>
                    )}
                  </div>
                  <div className="thread-footer">
                    <span className="message-count">{thread.message_count} message{thread.message_count !== 1 ? 's' : ''}</span>
                    <span className="thread-date">
                      {thread.last_message_at ? 'Last reply: ' + formatDate(thread.last_message_at) : formatDate(thread.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="thread-view">
          <button className="btn btn-secondary back-button" onClick={handleBackToList}>
            ← Back to All Conversations
          </button>

          <div className="thread-detail card">
            {isLoadingThread ? (
              <p>Loading conversation...</p>
            ) : (
              <>
                <div className="thread-detail-header">
                  <div className="thread-title-section">
                    <h2>{selectedThread.subject}</h2>
                    <div className="thread-badges">
                      <span className={`status-badge ${getStatusBadgeClass(selectedThread.status)}`}>
                        {selectedThread.status}
                      </span>
                      <span className="category-badge">{getCategoryLabel(selectedThread.category)}</span>
                    </div>
                  </div>
                  <div className="thread-meta-info">
                    {selectedThread.page_location && <p>📍 Page: {selectedThread.page_location}</p>}
                    {selectedThread.feature_area && <p>⚙️ Feature: {selectedThread.feature_area}</p>}
                    <p>Started: {formatDate(selectedThread.created_at)}</p>
                    {selectedThread.closed_at && <p>Closed: {formatDate(selectedThread.closed_at)}</p>}
                  </div>
                </div>

                <div className="messages-container">
                  {selectedThread.messages.map((message, index) => (
                    <div
                      key={message.message_id}
                      className={`message ${message.is_admin_response ? 'admin-message' : 'user-message'}`}
                    >
                      <div className="message-header">
                        <strong>{message.is_admin_response ? 'Proof of Putt Team' : message.author_name || 'You'}</strong>
                        <span className="message-date">{formatDate(message.created_at)}</span>
                      </div>
                      <div className="message-text">{message.message_text}</div>
                      {message.edited_at && (
                        <div className="message-edited">Edited {formatDate(message.edited_at)}</div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedThread.status !== 'closed' && (
                  <form onSubmit={handleAddMessage} className="reply-form">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Add a reply to this conversation..."
                      rows="4"
                    />
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Sending...' : 'Send Reply'}
                    </button>
                  </form>
                )}

                {selectedThread.status === 'closed' && (
                  <div className="thread-closed-notice">
                    This conversation has been closed. If you have additional feedback, please start a new conversation.
                  </div>
                )}

                {selectedThread.admin_notes && (
                  <div className="admin-notes">
                    <strong>Resolution Notes:</strong>
                    <p>{selectedThread.admin_notes}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentsPage;
