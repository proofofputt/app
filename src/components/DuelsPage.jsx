import React, { useState, useEffect, useMemo } from 'react';
import { apiListDuels, apiRespondToDuel, apiSubmitSessionToDuel, apiStartSession } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useNavigate, Link } from 'react-router-dom';
import CreateDuelModal from './CreateDuelModal';
import DuelResults from './DuelResults';
import DuelHistoryStats from './DuelHistoryStats';
import SortButton from './SortButton';
import Pagination from './Pagination';
import './DuelsPage.css';

const DuelRow = ({ duel, onRespond, onSubmitSession, currentUserId }) => {
    const isCreator = duel.creator_id === currentUserId;
    const opponentName = isCreator ? duel.invited_player_name : duel.creator_name;
    const opponentId = isCreator ? duel.invited_player_id : duel.creator_id;
    const isInvitee = duel.invited_player_id === currentUserId;
    
    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'pending': return '#f59e0b';
            case 'active': return '#10b981';
            case 'completed': return '#6b7280';
            case 'declined': return '#ef4444';
            case 'expired': return '#9ca3af';
            default: return '#6b7280';
        }
    };

    const renderActions = () => {
        if (duel.status === 'pending' && isInvitee) {
            // User received this invitation - show Accept/Decline
            return (
                <div className="duel-actions">
                    <button 
                        onClick={() => onRespond(duel.duel_id, 'accepted')} 
                        className="btn btn-sm btn-success"
                    >
                        Accept
                    </button>
                    <button 
                        onClick={() => onRespond(duel.duel_id, 'declined')} 
                        className="btn btn-sm btn-secondary"
                    >
                        Decline
                    </button>
                </div>
            );
        }
        
        if (duel.status === 'pending' && isCreator) {
            // User sent this invitation - show waiting status
            return (
                <div className="waiting-response">
                    <span className="text-muted">Awaiting response...</span>
                </div>
            );
        }
        
        if (duel.status === 'active') {
            return (
                <button 
                    onClick={() => onSubmitSession(duel)} 
                    className="btn btn-sm btn-primary"
                >
                    Submit Session
                </button>
            );
        }
        
        if (duel.status === 'completed') {
            const winner = duel.winner_id === currentUserId ? 'You Won!' : 
                          duel.winner_id === duel.creator_id ? duel.creator_name :
                          duel.winner_id === duel.invited_player_id ? duel.invited_player_name : 'Draw';
            return <span className="winner-text">{winner}</span>;
        }
        
        return <span className="text-muted">—</span>;
    };

    return (
        <tr>
            <td>
                <Link to={`/players/${currentUserId}/vs/${opponentId}`} className="opponent-link">
                    {opponentName}
                </Link>
            </td>
            <td>
                <span 
                    className="status-badge" 
                    style={{backgroundColor: getStatusColor(duel.status)}}
                >
                    {duel.status.charAt(0).toUpperCase() + duel.status.slice(1)}
                </span>
            </td>
            <td>{formatDate(duel.created_at)}</td>
            <td>
                {duel.expires_at && duel.status === 'pending' ? (
                    <div className="expiration-box">
                        {formatDate(duel.expires_at)}
                    </div>
                ) : '—'}
            </td>
            <td>
                {duel.time_limit_minutes ? `${duel.time_limit_minutes} min` : '—'}
            </td>
            <td className="actions-cell">
                {renderActions()}
            </td>
        </tr>
    );
};


const DuelsPage = () => {
    const { playerData } = useAuth();
    const { showTemporaryNotification: showNotification } = useNotification();
    const navigate = useNavigate();
    const [duels, setDuels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 9;

    const fetchDuels = async () => {
        if (!playerData?.player_id) return;
        setIsLoading(true);
        setError('');
        try {
            const response = await apiListDuels(playerData.player_id);
            console.log('[DuelsPage] Raw API response:', response);
            
            // Handle the API response structure - it returns { duels: [...] }
            const duelsData = response?.duels || response || [];
            console.log('[DuelsPage] Processed duels data:', duelsData);
            
            // Debug: Check if time limits are present in the data
            if (Array.isArray(duelsData) && duelsData.length > 0) {
                console.log('[DuelsPage] Sample duel data for time limit debugging:', {
                    settings: duelsData[0].settings,
                    settingsKeys: duelsData[0].settings ? Object.keys(duelsData[0].settings) : null,
                    settingsStringified: JSON.stringify(duelsData[0].settings),
                    rules: duelsData[0].rules,
                    rulesKeys: duelsData[0].rules ? Object.keys(duelsData[0].rules) : null,
                    time_limit_minutes: duelsData[0].time_limit_minutes,
                    duel_id: duelsData[0].duel_id
                });
            }
            
            setDuels(Array.isArray(duelsData) ? duelsData : []);
        } catch (err) {
            console.error('[DuelsPage] Error fetching duels:', err);
            setError(err.message || 'Failed to load duels.');
            showNotification(err.message || 'Failed to load duels.', true);
            setDuels([]); // Ensure duels is always an array
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDuels();
    }, [playerData]);

    const handleRespond = async (duelId, response) => {
        try {
            await apiRespondToDuel(duelId, playerData.player_id, response);
            showNotification(`Duel invitation ${response}.`);
            fetchDuels();
        } catch (err) {
            console.error(err);
            showNotification(err.message || 'Failed to respond to duel.', true);
        }
    };

    const handleSubmitSession = async (duel) => {
        try {
            console.log('[DuelsPage] Starting duel session:', {
                player_id: playerData.player_id,
                duel_id: duel.duel_id,
                time_limit: duel.time_limit_minutes
            });
            
            const response = await apiStartSession(playerData.player_id, duel.duel_id);
            
            if (response && response.success && response.deep_link_url) {
                // Open the deep link to launch the desktop app with duel session
                window.location.href = response.deep_link_url;
                
                showNotification(
                    `Starting duel session with ${duel.time_limit_minutes ? duel.time_limit_minutes + ' minute' : 'no'} time limit. Desktop app should launch automatically.`,
                    false
                );
            } else {
                throw new Error(response?.message || 'Failed to start duel session');
            }
        } catch (err) {
            console.error('[DuelsPage] Failed to start duel session:', err);
            
            // Enhanced error handling with desktop login guidance
            let errorMessage = 'Failed to start duel session.';
            
            if (err.message.includes('Authentication required') || err.message.includes('access denied')) {
                errorMessage = 'Session start failed due to authentication issues. Please ensure you are logged into the same account on both the web app and desktop app, then try again.';
            } else if (err.message.includes('not found') || err.message.includes('500')) {
                errorMessage = 'Unable to start session. Please make sure you are logged into the desktop app with the same account, then try again. If the issue persists, try restarting the desktop app.';
            } else if (err.message.includes('network') || err.message.includes('fetch')) {
                errorMessage = 'Network error starting session. Please check your connection and try again.';
            } else {
                errorMessage = `${err.message || 'Failed to start duel session'} Please ensure the desktop app is installed and you are logged in with the same account.`;
            }
            
            showNotification(errorMessage, true);
        }
    };

    const onDuelCreated = () => {
        setShowCreateModal(false);
        fetchDuels();
    };


    // Process duels data without circular dependencies
    const categorizedDuels = useMemo(() => {
        let sortableItems = Array.isArray(duels) ? [...duels] : [];
        
        // Apply sorting
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;
                
                // Handle special sorting cases
                if (sortConfig.key === 'opponent_name') {
                    // Sort by opponent name based on current user perspective
                    aValue = a.creator_id === currentPlayerId ? a.invited_player_name : a.creator_name;
                    bValue = b.creator_id === currentPlayerId ? b.invited_player_name : b.creator_name;
                } else {
                    aValue = a[sortConfig.key];
                    bValue = b[sortConfig.key];
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        
        // Categorize duels with better separation of sent vs received
        const currentPlayerId = playerData?.player_id;
        
        const categories = {
            pendingReceived: sortableItems.filter(d => d.status === 'pending' && d.invited_player_id === currentPlayerId),
            pendingSent: sortableItems.filter(d => d.status === 'pending' && d.creator_id === currentPlayerId),
            active: sortableItems.filter(d => d.status === 'active'),
            completed: sortableItems.filter(d => ['completed', 'expired', 'declined'].includes(d.status)),
        };
        
        console.log('[DuelsPage] Categorized duels:', {
            pendingReceived: categories.pendingReceived.length,
            pendingSent: categories.pendingSent.length, 
            active: categories.active.length,
            completed: categories.completed.length,
            currentPlayerId
        });
        
        return categories;
    }, [duels, sortConfig, playerData?.player_id]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const renderDuelCategory = (title, duelList) => {
        if (duelList.length === 0) {
            return (
                <div className="duel-category-section">
                    <h3 className="duel-category-title">{title}</h3>
                    <div className="empty-state">
                        <p>No duels in this category.</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="duel-category-section">
                <h3 className="duel-category-title">{title}</h3>
                <div className="duels-table-container">
                    <table className="table duels-table">
                        <thead>
                            <tr>
                                <th 
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleSort('opponent_name')}
                                >
                                    Opponent {sortConfig.key === 'opponent_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th 
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleSort('status')}
                                >
                                    Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th 
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleSort('created_at')}
                                >
                                    Date Created {sortConfig.key === 'created_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th>Expires</th>
                                <th>Time Limit</th>
                                <th className="actions-header">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {duelList.map(duel => (
                                <DuelRow
                                    key={duel.duel_id}
                                    duel={duel}
                                    onRespond={handleRespond}
                                    onSubmitSession={handleSubmitSession}
                                    currentUserId={playerData.player_id}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="duels-page">
                <div className="container">
                    <div className="loading-state">
                        <h2>Loading Duels...</h2>
                        <div className="loading-spinner"></div>
                    </div>
                </div>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="duels-page">
                <div className="container">
                    <div className="error-state">
                        <h2>Unable to Load Duels</h2>
                        <p className="error-message">{error}</p>
                        <button onClick={fetchDuels} className="btn btn-primary">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="duels-page">
            <div className="container">
                <div className="page-header">
                <h1>Duels</h1>
                <button 
                    onClick={() => setShowCreateModal(true)} 
                    className="btn btn-primary"
                >
                    + Create Duel
                </button>
            </div>

            {showCreateModal && (
                <CreateDuelModal 
                    onClose={() => setShowCreateModal(false)} 
                    onDuelCreated={onDuelCreated} 
                />
            )}
            

            <DuelHistoryStats 
                duels={duels} 
                currentUserId={playerData.player_id} 
                playerData={playerData} 
            />

            {renderDuelCategory('Invitations Received', categorizedDuels.pendingReceived)}
            {renderDuelCategory('Invitations Sent', categorizedDuels.pendingSent)}
            {renderDuelCategory('Active Duels', categorizedDuels.active)}
            {renderDuelCategory('Completed & Past Duels', categorizedDuels.completed)}
            </div>
        </div>
    );
};

export default DuelsPage;