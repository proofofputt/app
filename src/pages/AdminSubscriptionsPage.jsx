import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import './AdminSubscriptionsPage.css';

const AdminSubscriptionsPage = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();

  // State management
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoadingOrderDetail, setIsLoadingOrderDetail] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: ''
  });

  // Pagination
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false
  });

  // User history lookup
  const [userHistoryId, setUserHistoryId] = useState('');
  const [userHistory, setUserHistory] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Manual gift code generation
  const [showManualGenerate, setShowManualGenerate] = useState(false);
  const [manualGenerateForm, setManualGenerateForm] = useState({
    playerId: '',
    quantity: 1,
    bundleId: '',
    reason: '',
    orderId: ''
  });

  // Player search for manual generation
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showPlayerResults, setShowPlayerResults] = useState(false);

  useEffect(() => {
    if (playerData?.player_id && playerData?.is_admin) {
      loadOrders();
    }
  }, [playerData?.player_id, playerData?.is_admin, filters, pagination.offset]);

  const loadOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const token = localStorage.getItem('authToken');
      const queryParams = new URLSearchParams({
        status: filters.status,
        type: filters.type,
        search: filters.search,
        limit: pagination.limit,
        offset: pagination.offset
      });

      const response = await fetch(`/api/admin/subscriptions/orders?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setOrders(data.orders || []);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          hasMore: data.pagination.hasMore
        }));
      } else {
        showNotification('Failed to load orders', true);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      showNotification('Failed to load orders', true);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const loadOrderDetail = async (orderId) => {
    setIsLoadingOrderDetail(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/subscriptions/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSelectedOrder(data);
      } else {
        showNotification('Failed to load order details', true);
      }
    } catch (error) {
      console.error('Error loading order detail:', error);
      showNotification('Failed to load order details', true);
    } finally {
      setIsLoadingOrderDetail(false);
    }
  };

  const loadUserHistory = async () => {
    if (!userHistoryId.trim()) {
      showNotification('Please enter a user ID', true);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/subscriptions/users/${userHistoryId}/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setUserHistory(data);
      } else {
        showNotification(data.message || 'Failed to load user history', true);
      }
    } catch (error) {
      console.error('Error loading user history:', error);
      showNotification('Failed to load user history', true);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const searchPlayers = async (query) => {
    if (!query || query.trim().length < 2) {
      setPlayerSearchResults([]);
      setShowPlayerResults(false);
      return;
    }

    setIsSearchingPlayers(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/players/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setPlayerSearchResults(data.players || []);
        setShowPlayerResults(true);
      } else {
        showNotification(data.message || 'Failed to search players', true);
      }
    } catch (error) {
      console.error('Error searching players:', error);
      showNotification('Failed to search players', true);
    } finally {
      setIsSearchingPlayers(false);
    }
  };

  const selectPlayer = (player) => {
    setSelectedPlayer(player);
    setManualGenerateForm({ ...manualGenerateForm, playerId: player.playerId.toString() });
    setPlayerSearchQuery('');
    setPlayerSearchResults([]);
    setShowPlayerResults(false);
  };

  const handleManualGenerate = async (e) => {
    e.preventDefault();

    if (!manualGenerateForm.playerId || !manualGenerateForm.quantity || !manualGenerateForm.reason) {
      showNotification('Please fill in all required fields', true);
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/subscriptions/gift-codes/manual-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(manualGenerateForm)
      });

      const data = await response.json();

      if (data.success) {
        showNotification(data.message);
        setShowManualGenerate(false);
        setManualGenerateForm({
          playerId: '',
          quantity: 1,
          bundleId: '',
          reason: '',
          orderId: ''
        });
        setSelectedPlayer(null);
        setPlayerSearchQuery('');
        // Reload orders to show updated data
        loadOrders();
      } else {
        showNotification(data.message || 'Failed to generate gift codes', true);
      }
    } catch (error) {
      console.error('Error generating gift codes:', error);
      showNotification('Failed to generate gift codes', true);
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

  const formatAmount = (amount, currency = 'USD') => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Redirect if not admin
  if (!playerData?.is_admin) {
    return (
      <div className="admin-subscriptions-page">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-subscriptions-page">
      <div className="page-header">
        <h1>Admin Subscriptions Dashboard</h1>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowManualGenerate(!showManualGenerate)}
          >
            Send Codes
          </button>
        </div>
      </div>

      {/* Manual Gift Code Generation Modal */}
      {showManualGenerate && (
        <div className="modal-overlay" onClick={() => setShowManualGenerate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Send Codes</h3>
            <form onSubmit={handleManualGenerate}>
              <div className="form-group">
                <label>Search Player</label>
                <div className="player-search-container">
                  <input
                    type="text"
                    value={playerSearchQuery}
                    onChange={(e) => {
                      setPlayerSearchQuery(e.target.value);
                      searchPlayers(e.target.value);
                    }}
                    placeholder="Search by name, email, or player ID"
                    className="player-search-input"
                  />
                  {isSearchingPlayers && <span className="search-loading">Searching...</span>}
                  {showPlayerResults && playerSearchResults.length > 0 && (
                    <div className="player-search-results">
                      {playerSearchResults.map(player => (
                        <div
                          key={player.playerId}
                          className="player-search-result-item"
                          onClick={() => selectPlayer(player)}
                        >
                          <div className="player-result-name">{player.name}</div>
                          <div className="player-result-email">{player.email}</div>
                          <div className="player-result-id">ID: {player.playerId}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showPlayerResults && playerSearchResults.length === 0 && !isSearchingPlayers && (
                    <div className="player-search-results">
                      <div className="no-results">No players found</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Player ID *</label>
                <input
                  type="number"
                  value={manualGenerateForm.playerId}
                  onChange={(e) => setManualGenerateForm({...manualGenerateForm, playerId: e.target.value})}
                  required
                  disabled={!!selectedPlayer}
                />
                {selectedPlayer && (
                  <div className="selected-player-info">
                    <strong>Selected:</strong> {selectedPlayer.name} ({selectedPlayer.email})
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => {
                        setSelectedPlayer(null);
                        setManualGenerateForm({...manualGenerateForm, playerId: ''});
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={manualGenerateForm.quantity}
                  onChange={(e) => setManualGenerateForm({...manualGenerateForm, quantity: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Bundle ID</label>
                <input
                  type="number"
                  value={manualGenerateForm.bundleId}
                  onChange={(e) => setManualGenerateForm({...manualGenerateForm, bundleId: e.target.value})}
                  placeholder="Optional"
                />
              </div>

              <div className="form-group">
                <label>Order ID</label>
                <input
                  type="text"
                  value={manualGenerateForm.orderId}
                  onChange={(e) => setManualGenerateForm({...manualGenerateForm, orderId: e.target.value})}
                  placeholder="Optional - Link to specific order"
                />
              </div>

              <div className="form-group">
                <label>Reason *</label>
                <textarea
                  value={manualGenerateForm.reason}
                  onChange={(e) => setManualGenerateForm({...manualGenerateForm, reason: e.target.value})}
                  required
                  rows="3"
                  placeholder="Why are you manually generating these gift codes?"
                />
              </div>

              <div className="button-group">
                <button type="submit" className="btn btn-primary">Generate Codes</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowManualGenerate(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User History Lookup */}
      <div className="user-history-lookup">
        <h3>User Subscription History Lookup</h3>
        <div className="lookup-form">
          <input
            type="text"
            value={userHistoryId}
            onChange={(e) => setUserHistoryId(e.target.value)}
            placeholder="Enter Player ID, Email, or Name"
          />
          <button
            className="btn btn-primary"
            onClick={loadUserHistory}
            disabled={isLoadingHistory}
          >
            {isLoadingHistory ? 'Loading...' : 'Load History'}
          </button>
        </div>

        {userHistory && (
          <div className="user-history-card">
            <div className="user-history-header">
              <h4>
                {userHistory.player.displayName ? userHistory.player.displayName : (userHistory.player.name || 'Unknown User')}
              </h4>
              <span className="user-email">{userHistory.player.email}</span>
              <span className="user-player-id" style={{
                display: 'block',
                fontSize: '14px',
                color: '#666',
                marginTop: '4px',
                fontWeight: 'bold'
              }}>
                Player ID: {userHistory.player.playerId}
              </span>
            </div>

            <div className="history-summary">
              <div className="summary-stat">
                <span className="stat-label">Total Orders:</span>
                <span className="stat-value">{userHistory.summary.totalOrders}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Total Spent:</span>
                <span className="stat-value">{formatAmount(userHistory.summary.totalSpent)}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Gift Codes Owned:</span>
                <span className="stat-value">{userHistory.summary.giftCodesOwned}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Gift Codes Redeemed:</span>
                <span className="stat-value">{userHistory.summary.giftCodesRedeemed}</span>
              </div>
            </div>

            <div className="history-subscription">
              <h5>Current Subscription</h5>
              <p><strong>Status:</strong> {userHistory.subscription.status || 'None'}</p>
              <p><strong>Tier:</strong> {userHistory.subscription.tier || 'Free'}</p>
              <p><strong>Billing Cycle:</strong> {userHistory.subscription.billingCycle || 'N/A'}</p>
              {userHistory.subscription.currentPeriodEnd && (
                <p><strong>Expires:</strong> {formatDate(userHistory.subscription.currentPeriodEnd)}</p>
              )}
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setUserHistory(null)}
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Orders View */}
      {!selectedOrder ? (
        <div className="orders-view">
          <div className="orders-controls">
            <div className="filter-group">
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="filter-select"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>

              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="subscription">Subscriptions</option>
                <option value="bundle">Bundles</option>
              </select>

              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by name, email, or order ID"
                className="search-input"
              />
            </div>
          </div>

          <div className="orders-table">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Type</th>
                  <th>Player</th>
                  <th>Amount</th>
                  <th>Gift Codes</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingOrders ? (
                  <tr>
                    <td colSpan="7" className="loading-cell">Loading orders...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-cell">No orders found</td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.eventId} onClick={() => loadOrderDetail(order.orderId)} className="clickable-row">
                      <td>{order.orderId}</td>
                      <td>
                        <span className={`type-badge type-${order.orderType}`}>
                          {order.orderType === 'bundle' ? `Bundle (${order.bundleQuantity})` : 'Subscription'}
                        </span>
                      </td>
                      <td>
                        <div className="player-info">
                          <div>{order.playerName}</div>
                          <div className="player-email">{order.playerEmail}</div>
                        </div>
                      </td>
                      <td>{formatAmount(order.amount, order.currency)}</td>
                      <td>{order.giftCodesGenerated}</td>
                      <td>
                        <span className={`status-badge status-${order.processed ? 'processed' : 'pending'}`}>
                          {order.processed ? (order.error ? 'Error' : 'Processed') : 'Pending'}
                        </span>
                      </td>
                      <td>{formatDate(order.createdAt)}</td>
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
        /* Order Detail View */
        <div className="order-detail-view">
          <button className="btn btn-secondary back-button" onClick={() => setSelectedOrder(null)}>
            ← Back to All Orders
          </button>

          {isLoadingOrderDetail ? (
            <p>Loading order details...</p>
          ) : (
            <div className="order-detail-card">
              <div className="order-detail-header">
                <h2>Order: {selectedOrder.order.orderId}</h2>
                <span className={`status-badge status-${selectedOrder.order.processed ? 'processed' : 'pending'}`}>
                  {selectedOrder.order.processed ? 'Processed' : 'Pending'}
                </span>
              </div>

              <div className="detail-sections">
                <div className="detail-section">
                  <h3>Order Information</h3>
                  <p><strong>Amount:</strong> {formatAmount(selectedOrder.order.amount, selectedOrder.order.currency)}</p>
                  <p><strong>Payment Method:</strong> {selectedOrder.order.paymentMethod}</p>
                  <p><strong>Type:</strong> {selectedOrder.order.metadata.type || 'subscription'}</p>
                  {selectedOrder.order.metadata.bundleQuantity && (
                    <p><strong>Bundle Quantity:</strong> {selectedOrder.order.metadata.bundleQuantity}</p>
                  )}
                  <p><strong>Created:</strong> {formatDate(selectedOrder.order.createdAt)}</p>
                  <p><strong>Processed:</strong> {formatDate(selectedOrder.order.processedAt)}</p>
                  {selectedOrder.order.error && (
                    <p className="error-text"><strong>Error:</strong> {selectedOrder.order.error}</p>
                  )}
                </div>

                <div className="detail-section">
                  <h3>Customer Information</h3>
                  <p><strong>Player ID:</strong> {selectedOrder.customer.playerId}</p>
                  <p><strong>Name:</strong> {selectedOrder.customer.name}</p>
                  <p><strong>Email:</strong> {selectedOrder.customer.email}</p>
                  <p><strong>Membership:</strong> {selectedOrder.customer.membershipTier}</p>
                  <p><strong>Subscription Status:</strong> {selectedOrder.customer.subscriptionStatus || 'None'}</p>
                </div>

                {selectedOrder.giftCodes.length > 0 && (
                  <div className="detail-section full-width">
                    <h3>Gift Codes ({selectedOrder.giftCodesSummary.total})</h3>
                    <p className="gift-summary">
                      Redeemed: {selectedOrder.giftCodesSummary.redeemed} |
                      Pending: {selectedOrder.giftCodesSummary.pending}
                    </p>
                    <div className="gift-codes-list">
                      {selectedOrder.giftCodes.map(gc => (
                        <div key={gc.id} className="gift-code-item">
                          <span className="gift-code-text">{gc.code}</span>
                          {gc.isRedeemed ? (
                            <span className="redeemed-info">
                              Redeemed by {gc.redeemedBy.name} on {formatDate(gc.redeemedAt)}
                            </span>
                          ) : (
                            <span className="status-badge status-pending">Unredeemed</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptionsPage;
