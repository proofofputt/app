import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import './AdminClubUpdatesPage.css';

const AdminClubUpdatesPage = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();

  const [updates, setUpdates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');

  // Pagination
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false
  });

  useEffect(() => {
    if (playerData?.player_id && playerData?.is_admin) {
      loadUpdates();
    }
  }, [playerData?.player_id, playerData?.is_admin, statusFilter, pagination.offset]);

  const loadUpdates = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const queryParams = new URLSearchParams({
        status: statusFilter,
        limit: pagination.limit,
        offset: pagination.offset
      });

      const response = await fetch(`/api/admin/club-updates/pending?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setUpdates(data.updates || []);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          hasMore: data.pagination.hasMore
        }));
      } else {
        showNotification('Failed to load updates', true);
      }
    } catch (error) {
      console.error('Error loading updates:', error);
      showNotification('Failed to load updates', true);
    } finally {
      setIsLoading(false);
    }
  };

  const approveUpdate = async (updateId) => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/club-updates/${updateId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: reviewNotes })
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Update approved successfully');
        setSelectedUpdate(null);
        setReviewNotes('');
        loadUpdates();
      } else {
        showNotification(data.message || 'Failed to approve update', true);
      }
    } catch (error) {
      console.error('Error approving update:', error);
      showNotification('Failed to approve update', true);
    } finally {
      setIsProcessing(false);
    }
  };

  const rejectUpdate = async (updateId) => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/club-updates/${updateId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: reviewNotes })
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Update rejected');
        setSelectedUpdate(null);
        setReviewNotes('');
        loadUpdates();
      } else {
        showNotification(data.message || 'Failed to reject update', true);
      }
    } catch (error) {
      console.error('Error rejecting update:', error);
      showNotification('Failed to reject update', true);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatFieldName = (fieldName) => {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  // Redirect if not admin
  if (!playerData?.is_admin) {
    return (
      <div className="admin-club-updates-page">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-club-updates-page">
      <div className="page-header">
        <h1>Club Data Updates</h1>
        <p className="page-description">
          Review and approve club information updates from HubSpot CRM
        </p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination(prev => ({ ...prev, offset: 0 }));
            }}
            className="filter-select"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="stats">
          <span className="stat-item">
            <strong>{pagination.total}</strong> {statusFilter} updates
          </span>
        </div>
      </div>

      {/* Updates List */}
      <div className="updates-container">
        {isLoading ? (
          <div className="loading-state">Loading updates...</div>
        ) : updates.length === 0 ? (
          <div className="empty-state">
            <h3>No {statusFilter} updates</h3>
            <p>All caught up!</p>
          </div>
        ) : (
          <div className="updates-list">
            {updates.map(update => (
              <div key={update.updateId} className="update-card">
                <div className="update-header">
                  <div className="club-info">
                    <h3>{update.clubName}</h3>
                    <span className="club-location">{update.clubLocation}</span>
                  </div>
                  <span className={`update-source source-${update.source}`}>
                    {update.source}
                  </span>
                </div>

                <div className="update-body">
                  <div className="field-info">
                    <label>Field:</label>
                    <span className="field-name">{formatFieldName(update.fieldName)}</span>
                  </div>

                  <div className="value-comparison">
                    <div className="value-box old-value">
                      <label>Current Value:</label>
                      <div className="value-content">{update.oldValue || <em>Empty</em>}</div>
                    </div>
                    <div className="arrow">→</div>
                    <div className="value-box new-value">
                      <label>New Value:</label>
                      <div className="value-content">{update.newValue || <em>Empty</em>}</div>
                    </div>
                  </div>

                  <div className="update-meta">
                    <span className="meta-item">
                      Submitted: {formatDate(update.createdAt)}
                    </span>
                    {update.sourceUserEmail && (
                      <span className="meta-item">
                        By: {update.sourceUserEmail}
                      </span>
                    )}
                  </div>

                  {update.status === 'pending' && (
                    <div className="update-actions">
                      <button
                        className="btn btn-approve"
                        onClick={() => setSelectedUpdate(update)}
                        disabled={isProcessing}
                      >
                        Review
                      </button>
                    </div>
                  )}

                  {update.status !== 'pending' && (
                    <div className="review-info">
                      <p><strong>Reviewed:</strong> {formatDate(update.reviewedAt)}</p>
                      {update.reviewedBy && (
                        <p><strong>By:</strong> {update.reviewedBy.name}</p>
                      )}
                      {update.reviewNotes && (
                        <p><strong>Notes:</strong> {update.reviewNotes}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
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
              Showing {pagination.offset + 1} - {Math.min(pagination.offset + updates.length, pagination.total)} of {pagination.total}
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

      {/* Review Modal */}
      {selectedUpdate && (
        <div className="modal-overlay" onClick={() => setSelectedUpdate(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Review Update</h3>

            <div className="modal-club-info">
              <h4>{selectedUpdate.clubName}</h4>
              <p>{selectedUpdate.clubLocation}</p>
            </div>

            <div className="modal-field-info">
              <label>Field:</label>
              <span className="field-name">{formatFieldName(selectedUpdate.fieldName)}</span>
            </div>

            <div className="modal-value-comparison">
              <div className="value-box">
                <label>Current:</label>
                <div>{selectedUpdate.oldValue || <em>Empty</em>}</div>
              </div>
              <div className="value-box highlight">
                <label>Proposed:</label>
                <div>{selectedUpdate.newValue || <em>Empty</em>}</div>
              </div>
            </div>

            <div className="form-group">
              <label>Review Notes (Optional):</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about this decision..."
                rows="3"
              />
            </div>

            <div className="button-group">
              <button
                className="btn btn-approve"
                onClick={() => approveUpdate(selectedUpdate.updateId)}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Approve & Apply'}
              </button>
              <button
                className="btn btn-reject"
                onClick={() => rejectUpdate(selectedUpdate.updateId)}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Reject'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedUpdate(null)}
                disabled={isProcessing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClubUpdatesPage;
