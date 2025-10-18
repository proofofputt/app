import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import { apiAdminGetUsers } from '../api.js';
import './AdminUsersPage.css';

const AdminUsersPage = () => {
  const navigate = useNavigate();
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();

  // State for users list
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Filters and pagination
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    membership_tier: '',
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false
  });

  useEffect(() => {
    if (playerData?.player_id && playerData?.is_admin) {
      loadUsers();
    }
  }, [playerData?.player_id, playerData?.is_admin, filters, pagination.offset, search]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await apiAdminGetUsers(
        { ...filters, search },
        {
          limit: pagination.limit,
          offset: pagination.offset
        }
      );
      setUsers(response.users || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0,
        hasMore: response.pagination?.hasMore || false
      }));
    } catch (error) {
      console.error('Error loading users:', error);
      showNotification('Failed to load users', true);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    // Reset pagination when search changes
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // Reset pagination when filters change
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const handleSort = (column) => {
    if (filters.sort_by === column) {
      // Toggle sort order
      handleFilterChange('sort_order', filters.sort_order === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending
      setFilters(prev => ({ ...prev, sort_by: column, sort_order: 'desc' }));
    }
  };

  const getTierBadgeClass = (tier) => {
    const tierMap = {
      free: 'tier-free',
      regular: 'tier-regular',
      premium: 'tier-premium'
    };
    return tierMap[tier] || 'tier-free';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getSortIcon = (column) => {
    if (filters.sort_by !== column) {
      return '⇅';
    }
    return filters.sort_order === 'asc' ? '↑' : '↓';
  };

  // Redirect if not admin
  if (!playerData?.is_admin) {
    return (
      <div className="admin-users-page">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-users-page">
      <div className="page-header">
        <h1>User Registry</h1>
        <div className="stats-summary">
          <span className="stat-item">Total Users: <strong>{pagination.total}</strong></span>
        </div>
      </div>

      <div className="users-view">
        <div className="users-controls">
          <div className="search-group">
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by email, name, display name, or player ID..."
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <select
              value={filters.membership_tier}
              onChange={(e) => handleFilterChange('membership_tier', e.target.value)}
              className="filter-select"
            >
              <option value="">All Tiers</option>
              <option value="free">Free</option>
              <option value="regular">Regular</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>

        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('player_id')} className="sortable">
                  ID {getSortIcon('player_id')}
                </th>
                <th onClick={() => handleSort('email')} className="sortable">
                  Email {getSortIcon('email')}
                </th>
                <th onClick={() => handleSort('name')} className="sortable">
                  Name {getSortIcon('name')}
                </th>
                <th onClick={() => handleSort('display_name')} className="sortable">
                  Display Name {getSortIcon('display_name')}
                </th>
                <th onClick={() => handleSort('referred_by_display_name')} className="sortable">
                  Referred By {getSortIcon('referred_by_display_name')}
                </th>
                <th onClick={() => handleSort('membership_tier')} className="sortable">
                  Tier {getSortIcon('membership_tier')}
                </th>
                <th onClick={() => handleSort('total_sessions')} className="sortable">
                  Sessions {getSortIcon('total_sessions')}
                </th>
                <th onClick={() => handleSort('created_at')} className="sortable">
                  Signup Date {getSortIcon('created_at')}
                </th>
                <th onClick={() => handleSort('last_session_date')} className="sortable">
                  Last Session {getSortIcon('last_session_date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoadingUsers ? (
                <tr>
                  <td colSpan="9" className="loading-cell">Loading users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty-cell">No users found</td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.player_id} onClick={() => navigate(`/admin/users/${user.player_id}`)} className="clickable-row">
                    <td className="id-cell">{user.player_id}</td>
                    <td className="email-cell">{user.email}</td>
                    <td className="name-cell">
                      {user.first_name || user.last_name
                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                        : user.name || '—'}
                    </td>
                    <td className="display-name-cell">{user.display_name || '—'}</td>
                    <td className="referrer-cell">{user.referred_by_display_name || '—'}</td>
                    <td>
                      <span className={`tier-badge ${getTierBadgeClass(user.membership_tier)}`}>
                        {user.membership_tier || 'free'}
                      </span>
                    </td>
                    <td className="sessions-cell">{user.total_sessions || 0}</td>
                    <td className="date-cell">{formatDate(user.created_at)}</td>
                    <td className="date-cell">{formatDate(user.last_session_date)}</td>
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
    </div>
  );
};

export default AdminUsersPage;
