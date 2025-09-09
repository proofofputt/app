import React, { useState, useEffect, useMemo } from 'react';
import { apiListDuels, apiRespondToDuel, apiSubmitSessionToDuel, apiStartSession } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useNavigate, Link } from 'react-router-dom';
import CreateDuelModal from './CreateDuelModal';
import DuelResults from './DuelResults';
import SortButton from './SortButton';
import Pagination from './Pagination';
import './DuelsPage.css';

const DuelRow = ({ duel, onRespond, onSubmitSession, onRematch, currentUserId, isActiveSection, isCompletedSection }) => {
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
                    title="Copy parameters to paste into desktop app"
                >
                    Copy Parameters
                </button>
            );
        }
        
        if (duel.status === 'completed') {
            return (
                <button 
                    onClick={() => onRematch(duel)} 
                    className="btn btn-sm btn-secondary"
                    title="Challenge this opponent to a rematch"
                >
                    Rematch
                </button>
            );
        }
        
        return <span className="text-muted">—</span>;
    };

    // Calculate scores based on user perspective
    const yourScore = isCreator ? (duel.creator_score || 0) : (duel.invited_player_score || 0);
    const opponentScore = isCreator ? (duel.invited_player_score || 0) : (duel.creator_score || 0);

    return (
        <tr>
            <td data-cell="opponent">
                <Link to={`/players/${currentUserId}/vs/${opponentId}`} className="opponent-link">
                    {opponentName}
                </Link>
            </td>
            {isActiveSection ? (
                <>
                    <td className="score-cell">
                        <span className="score-badge your-score">{yourScore}</span>
                    </td>
                    <td className="score-cell">
                        <span className="score-badge opponent-score">{opponentScore}</span>
                    </td>
                    <td>
                        {duel.expires_at ? (
                            <div className="expiration-box">
                                {formatDate(duel.expires_at)}
                            </div>
                        ) : '—'}
                    </td>
                </>
            ) : isCompletedSection ? (
                <>
                    <td className="score-cell" data-cell="your-score">
                        <span className="score-badge your-score">{yourScore}</span>
                    </td>
                    <td className="score-cell" data-cell="opponent-score">
                        <span className="score-badge opponent-score">{opponentScore}</span>
                    </td>
                    <td data-cell="result">
                        <span 
                            className="status-badge" 
                            style={{backgroundColor: getStatusColor(duel.status)}}
                        >
                            {duel.winner_id === currentUserId ? 'Won' : duel.winner_id === null ? 'Draw' : 'Lost'}
                        </span>
                    </td>
                    <td data-cell="completed">{formatDate(duel.completed_at || duel.created_at)}</td>
                </>
            ) : (
                <>
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
                </>
            )}
            {!isCompletedSection && (
                <td>
                    {duel.time_limit_minutes ? `${duel.time_limit_minutes} min` : '—'}
                </td>
            )}
            <td className="actions-cell" data-cell="actions">
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
    const [rematchData, setRematchData] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 9;

    const fetchDuels = async () => {
        if (!playerData?.player_id) return;
        setIsLoading(true);
        setError('');
        try {
            const response = await apiListDuels(playerData.player_id);
            // Handle the API response structure - it returns { duels: [...] }
            const duelsData = response?.duels || response || [];
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
            console.log('[DuelsPage] Generating duel parameters:', {
                player_id: playerData.player_id,
                duel_id: duel.duel_id,
                time_limit: duel.time_limit_minutes
            });
            
            // Generate parameter string for manual entry
            const parameters = [
                `duel=${duel.duel_id}`,
                duel.time_limit_minutes ? `time_limit=${duel.time_limit_minutes}` : null,
                'scoring=total_makes'
            ].filter(Boolean).join(',');
            
            // Copy to clipboard
            try {
                await navigator.clipboard.writeText(parameters);
                showNotification(
                    `✅ Parameters copied to clipboard: "${parameters}". Paste this into the desktop app's parameter input field.`,
                    false
                );
            } catch (clipboardErr) {
                // Fallback for browsers that don't support clipboard API
                console.warn('Clipboard API not available, showing parameter string:', clipboardErr);
                
                // Create a temporary textarea to select and copy
                const textarea = document.createElement('textarea');
                textarea.value = parameters;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                
                try {
                    document.execCommand('copy');
                    showNotification(
                        `✅ Parameters copied: "${parameters}". Paste this into the desktop app's parameter input field.`,
                        false
                    );
                } catch (copyErr) {
                    // Final fallback - show the parameters for manual copying
                    showNotification(
                        `📋 Copy these parameters manually: "${parameters}". Paste them into the desktop app's parameter input field.`,
                        false
                    );
                } finally {
                    document.body.removeChild(textarea);
                }
            }
            
        } catch (err) {
            console.error('[DuelsPage] Failed to generate duel parameters:', err);
            showNotification('❌ Failed to generate parameters. Please try again.', true);
        }
    };

    const onDuelCreated = () => {
        setShowCreateModal(false);
        setRematchData(null); // Clear rematch data when modal closes
        fetchDuels();
    };

    const handleRematch = (duel) => {
        const isCreator = duel.creator_id === playerData.player_id;
        const opponent = {
            player_id: isCreator ? duel.invited_player_id : duel.creator_id,
            name: isCreator ? duel.invited_player_name : duel.creator_name
        };
        
        const rematchInfo = {
            opponent: opponent,
            duration: duel.time_limit_minutes || 5,
            expiration: 72 // Default to 72 hours for rematch
        };
        
        setRematchData(rematchInfo);
        setShowCreateModal(true);
        showNotification(`Setting up rematch with ${opponent.name}`);
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
                                    data-col="opponent"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleSort('opponent_name')}
                                >
                                    Opponent {sortConfig.key === 'opponent_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                {title === 'Active Duels' ? (
                                    <>
                                        <th data-col="your-score">Your Score</th>
                                        <th data-col="opponent-score">Opponent Score</th>
                                        <th>Expires</th>
                                        <th>Time Limit</th>
                                        <th data-col="actions">Actions</th>
                                    </>
                                ) : title === 'Completed Duels' ? (
                                    <>
                                        <th data-col="your-score">Your Score</th>
                                        <th data-col="opponent-score">Opponent Score</th>
                                        <th 
                                            data-col="result"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => handleSort('status')}
                                        >
                                            Result {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                        </th>
                                        <th 
                                            data-col="completed"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => handleSort('completed_at')}
                                        >
                                            Date {sortConfig.key === 'completed_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                        </th>
                                        <th data-col="actions">Actions</th>
                                    </>
                                ) : (
                                    <>
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
                                            Created {sortConfig.key === 'created_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                        </th>
                                        <th>Expires</th>
                                        <th>Time Limit</th>
                                        <th data-col="actions">Actions</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {duelList.map(duel => (
                                <DuelRow
                                    key={duel.duel_id}
                                    duel={duel}
                                    onRespond={handleRespond}
                                    onSubmitSession={handleSubmitSession}
                                    onRematch={handleRematch}
                                    currentUserId={playerData.player_id}
                                    isActiveSection={title === 'Active Duels'}
                                    isCompletedSection={title === 'Completed Duels'}
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
                    onClose={() => {
                        setShowCreateModal(false);
                        setRematchData(null); // Clear rematch data when modal closes
                    }} 
                    onDuelCreated={onDuelCreated}
                    rematchData={rematchData}
                />
            )}
            


            {renderDuelCategory('Invitations Received', categorizedDuels.pendingReceived)}
            {renderDuelCategory('Invitations Sent', categorizedDuels.pendingSent)}
            {renderDuelCategory('Active Duels', categorizedDuels.active)}
            {renderDuelCategory('Completed Duels', categorizedDuels.completed)}
            </div>
        </div>
    );
};

export default DuelsPage;