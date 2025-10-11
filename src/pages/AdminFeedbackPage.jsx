import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import {
  apiAdminGetAllFeedback,
  apiAdminUpdateThread,
  apiAdminBulkUpdateThreads,
  apiAdminGetFeedbackStats,
  apiAdminRespondToThread,
  apiGetFeedbackThread
} from '../api.js';
import './AdminFeedbackPage.css';

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

const AdminFeedbackPage = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();

  // State for threads list
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  // Filters and pagination
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: ''
  });
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false
  });

  // Statistics
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(true);

  // Thread management
  const [adminResponse, setAdminResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState([]);

  // Update forms
  const [editingThread, setEditingThread] = useState(null);

  useEffect(() => {
    if (playerData?.player_id && playerData?.is_admin) {
      loadThreads();
      loadStats();
    }
  }, [playerData?.player_id, playerData?.is_admin, filters, pagination.offset]);

  const loadThreads = async () => {
    setIsLoadingThreads(true);
    try {
      const response = await apiAdminGetAllFeedback(filters, {
        limit: pagination.limit,
        offset: pagination.offset
      });
      setThreads(response.threads || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0,
        hasMore: response.pagination?.hasMore || false
      }));
    } catch (error) {
      console.error('Error loading admin feedback:', error);
      showNotification('Failed to load feedback threads', true);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiAdminGetFeedbackStats();
      setStats(response.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
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

  const handleUpdateThread = async (threadId, updates) => {
    try {
      await apiAdminUpdateThread(threadId, updates);
      showNotification('Thread updated successfully');
      loadThreads();
      if (selectedThread?.thread_id === threadId) {
        loadThread(threadId);
      }
      loadStats();
      setEditingThread(null);
    } catch (error) {
      console.error('Error updating thread:', error);
      showNotification(error.message || 'Failed to update thread', true);
    }
  };

  const handleBulkUpdate = async (updates) => {
    if (selectedThreadIds.length === 0) {
      showNotification('Please select at least one thread', true);
      return;
    }

    try {
      await apiAdminBulkUpdateThreads(selectedThreadIds, updates);
      showNotification(`Successfully updated ${selectedThreadIds.length} thread(s)`);
      setSelectedThreadIds([]);
      loadThreads();
      loadStats();
    } catch (error) {
      console.error('Error bulk updating threads:', error);
      showNotification(error.message || 'Failed to bulk update', true);
    }
  };

  const handleAdminResponse = async (e) => {
    e.preventDefault();

    if (!adminResponse.trim()) {
      showNotification('Please enter a response', true);
      return;
    }

    setIsSubmitting(true);
    try {
      await apiAdminRespondToThread(selectedThread.thread_id, adminResponse, true);
      showNotification('Response sent successfully');
      setAdminResponse('');
      loadThread(selectedThread.thread_id);
      loadThreads();
      loadStats();
    } catch (error) {
      console.error('Error sending response:', error);
      showNotification(error.message || 'Failed to send response', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleThreadSelection = (threadId) => {
    setSelectedThreadIds(prev =>
      prev.includes(threadId)
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  };

  const toggleAllThreads = () => {
    if (selectedThreadIds.length === threads.length) {
      setSelectedThreadIds([]);
    } else {
      setSelectedThreadIds(threads.map(t => t.thread_id));
    }
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

  const getPriorityBadgeClass = (priority) => {
    const priorityMap = {
      critical: 'priority-critical',
      high: 'priority-high',
      normal: 'priority-normal',
      low: 'priority-low'
    };
    return priorityMap[priority] || 'priority-normal';
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

  // Redirect if not admin
  if (!playerData?.is_admin) {
    return (
      <div className="admin-feedback-page">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-feedback-page">
      <div className="page-header">
        <h1>Admin Feedback Dashboard</h1>
        <button
          className="btn btn-secondary"
          onClick={() => setShowStats(!showStats)}
        >
          {showStats ? 'Hide' : 'Show'} Statistics
        </button>
      </div>

      {showStats && stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>By Status</h3>
            <div className="stat-items">
              {stats.by_status.map(item => (
                <div key={item.status} className="stat-item">
                  <span className={`status-badge ${getStatusBadgeClass(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="stat-value">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-card">
            <h3>By Priority</h3>
            <div className="stat-items">
              {stats.by_priority.map(item => (
                <div key={item.priority} className="stat-item">
                  <span className={`priority-badge ${getPriorityBadgeClass(item.priority)}`}>
                    {item.priority}
                  </span>
                  <span className="stat-value">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-card">
            <h3>Response Time</h3>
            <div className="stat-items">
              <div className="stat-item">
                <span>Average:</span>
                <span className="stat-value">{stats.response_time.average_hours.toFixed(1)}h</span>
              </div>
              <div className="stat-item">
                <span>Median:</span>
                <span className="stat-value">{stats.response_time.median_hours.toFixed(1)}h</span>
              </div>
            </div>
          </div>

          <div className="stat-card attention">
            <h3>Needs Attention</h3>
            <div className="stat-items">
              <div className="stat-item">
                <span>Unanswered:</span>
                <span className="stat-value highlight">{stats.needs_attention}</span>
              </div>
              <div className="stat-item">
                <span>High Priority Open:</span>
                <span className="stat-value highlight">{stats.high_priority_open}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedThread ? (
        <div className="threads-view">
          <div className="threads-controls">
            <div className="filter-group">
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="filter-select"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="filter-select"
              >
                <option value="">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>

              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="filter-select"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {selectedThreadIds.length > 0 && (
              <div className="bulk-actions">
                <span>{selectedThreadIds.length} selected</span>
                <button
                  className="btn btn-sm"
                  onClick={() => handleBulkUpdate({ status: 'in_progress' })}
                >
                  Mark In Progress
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => handleBulkUpdate({ status: 'resolved' })}
                >
                  Mark Resolved
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => handleBulkUpdate({ priority: 'high' })}
                >
                  Set High Priority
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setSelectedThreadIds([])}
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>

          <div className="threads-table">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedThreadIds.length === threads.length && threads.length > 0}
                      onChange={toggleAllThreads}
                    />
                  </th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Player</th>
                  <th>Messages</th>
                  <th>Created</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingThreads ? (
                  <tr>
                    <td colSpan="9" className="loading-cell">Loading threads...</td>
                  </tr>
                ) : threads.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="empty-cell">No threads found</td>
                  </tr>
                ) : (
                  threads.map(thread => (
                    <tr
                      key={thread.thread_id}
                      className={selectedThreadIds.includes(thread.thread_id) ? 'selected' : ''}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedThreadIds.includes(thread.thread_id)}
                          onChange={() => toggleThreadSelection(thread.thread_id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>
                        <span className={`priority-badge ${getPriorityBadgeClass(thread.priority)}`}>
                          {thread.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(thread.status)}`}>
                          {thread.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="thread-link"
                          onClick={() => loadThread(thread.thread_id)}
                        >
                          {thread.subject}
                        </button>
                      </td>
                      <td>
                        <span className="category-badge">{getCategoryLabel(thread.category)}</span>
                      </td>
                      <td>
                        <div className="player-info">
                          <div>{thread.player_name}</div>
                          <div className="player-email">{thread.player_email}</div>
                        </div>
                      </td>
                      <td className="message-count-cell">
                        {thread.user_message_count} / {thread.admin_response_count}
                      </td>
                      <td className="date-cell">{formatDate(thread.created_at)}</td>
                      <td className="date-cell">{formatDate(thread.updated_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.total > pagination.limit && (
            <div className="pagination-controls">
              <button
                className="btn btn-secondary"
                onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                disabled={pagination.offset === 0}
              >
                Previous
              </button>
              <span className="pagination-info">
                Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={!pagination.hasMore}
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="thread-detail-view">
          <button className="btn btn-secondary back-button" onClick={() => setSelectedThread(null)}>
            ← Back to All Threads
          </button>

          <div className="thread-detail card">
            {isLoadingThread ? (
              <p>Loading thread...</p>
            ) : (
              <>
                <div className="thread-detail-header">
                  <div className="thread-title-section">
                    <h2>{selectedThread.subject}</h2>
                    <div className="thread-badges">
                      <span className={`priority-badge ${getPriorityBadgeClass(selectedThread.priority)}`}>
                        {selectedThread.priority}
                      </span>
                      <span className={`status-badge ${getStatusBadgeClass(selectedThread.status)}`}>
                        {selectedThread.status}
                      </span>
                      <span className="category-badge">{getCategoryLabel(selectedThread.category)}</span>
                    </div>
                  </div>

                  <div className="thread-meta-info">
                    <p><strong>Player:</strong> {selectedThread.player_name} ({selectedThread.player_email})</p>
                    {selectedThread.page_location && <p><strong>Page:</strong> {selectedThread.page_location}</p>}
                    {selectedThread.feature_area && <p><strong>Feature:</strong> {selectedThread.feature_area}</p>}
                    <p><strong>Created:</strong> {formatDate(selectedThread.created_at)}</p>
                    <p><strong>Updated:</strong> {formatDate(selectedThread.updated_at)}</p>
                    {selectedThread.closed_at && <p><strong>Closed:</strong> {formatDate(selectedThread.closed_at)}</p>}
                  </div>

                  <div className="thread-admin-controls">
                    {editingThread?.thread_id === selectedThread.thread_id ? (
                      <div className="edit-form">
                        <div className="form-row">
                          <div className="form-group">
                            <label>Status</label>
                            <select
                              value={editingThread.status}
                              onChange={(e) => setEditingThread({ ...editingThread, status: e.target.value })}
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Priority</label>
                            <select
                              value={editingThread.priority}
                              onChange={(e) => setEditingThread({ ...editingThread, priority: e.target.value })}
                            >
                              <option value="low">Low</option>
                              <option value="normal">Normal</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Admin Notes</label>
                          <textarea
                            value={editingThread.admin_notes || ''}
                            onChange={(e) => setEditingThread({ ...editingThread, admin_notes: e.target.value })}
                            rows="3"
                            placeholder="Internal notes about resolution..."
                          />
                        </div>

                        <div className="button-group">
                          <button
                            className="btn btn-primary"
                            onClick={() => handleUpdateThread(editingThread.thread_id, {
                              status: editingThread.status,
                              priority: editingThread.priority,
                              admin_notes: editingThread.admin_notes
                            })}
                          >
                            Save Changes
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => setEditingThread(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        onClick={() => setEditingThread({
                          thread_id: selectedThread.thread_id,
                          status: selectedThread.status,
                          priority: selectedThread.priority,
                          admin_notes: selectedThread.admin_notes || ''
                        })}
                      >
                        Edit Thread
                      </button>
                    )}
                  </div>
                </div>

                <div className="messages-container">
                  {selectedThread.messages.map((message) => (
                    <div
                      key={message.message_id}
                      className={`message ${message.is_admin_response ? 'admin-message' : 'user-message'}`}
                    >
                      <div className="message-header">
                        <strong>{message.is_admin_response ? 'Admin Response' : message.author_name}</strong>
                        <span className="message-date">{formatDate(message.created_at)}</span>
                      </div>
                      <div className="message-text">{message.message_text}</div>
                      {message.edited_at && (
                        <div className="message-edited">Edited {formatDate(message.edited_at)}</div>
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAdminResponse} className="admin-reply-form">
                  <h3>Admin Response</h3>
                  <textarea
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    placeholder="Type your response to the user..."
                    rows="6"
                  />
                  <div className="form-footer">
                    <p className="note">This response will be sent to the user via email and displayed in their conversation.</p>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Sending...' : 'Send Response'}
                    </button>
                  </div>
                </form>

                {selectedThread.admin_notes && (
                  <div className="admin-notes-display">
                    <strong>Admin Notes:</strong>
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

export default AdminFeedbackPage;
