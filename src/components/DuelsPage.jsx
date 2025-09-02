import React, { useState, useEffect, useMemo } from 'react';
import { apiListDuels, apiRespondToDuel, apiSubmitSessionToDuel } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useNavigate, Link } from 'react-router-dom';
import CreateDuelModal from './CreateDuelModal';
import SessionSelectModal from './SessionSelectModal';
import SortButton from './SortButton';
import Pagination from './Pagination';
import './DuelsPage.css';

const DuelCard = ({ duel, onRespond, onSubmitSession, currentUserId }) => {
    const isCreator = duel.creator_id === currentUserId;
    const opponentName = isCreator ? duel.invited_player_name : duel.creator_name;
    const opponentId = isCreator ? duel.invited_player_id : duel.creator_id;
    const isInvitee = duel.invited_player_id === currentUserId;

    return (
        <div className="duel-card">
            <div className="duel-card-header">
                <h4>vs <Link to={`/players/${currentUserId}/vs/${opponentId}`}>{opponentName}</Link></h4>
                <span className={`status-badge status-${duel.status}`}>{duel.status}</span>
            </div>
            <div className="duel-card-body">
                <p><strong>Created:</strong> {new Date(duel.created_at).toLocaleDateString()}</p>
                {duel.status === 'completed' && (
                    <p><strong>Winner:</strong> {duel.winner_id === currentUserId ? 'You' : (duel.winner_id ? (duel.winner_id === duel.creator_id ? duel.creator_name : duel.invited_player_name) : 'N/A')}</p>
                )}
            </div>
            <div className="duel-card-actions">
                {duel.status === 'pending' && isInvitee && (
                    <>
                        <button onClick={() => onRespond(duel.duel_id, 'accepted')} className="btn-accept">Accept</button>
                        <button onClick={() => onRespond(duel.duel_id, 'declined')} className="btn-decline">Decline</button>
                    </>
                )}
                {duel.status === 'active' && (
                     <button onClick={() => onSubmitSession(duel)} className="btn-submit">Submit Session</button>
                )}
            </div>
        </div>
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
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [selectedDuel, setSelectedDuel] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 9;

    const fetchDuels = async () => {
        if (!playerData?.player_id) return;
        setIsLoading(true);
        try {
            const data = await apiListDuels(playerData.player_id);
            setDuels(data || []);
        } catch (err) {
            setError(err.message || 'Failed to load duels.');
            showNotification(err.message || 'Failed to load duels.', true);
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

    const handleSubmitSession = (duel) => {
        setSelectedDuel(duel);
        setShowSessionModal(true);
    };

    const onDuelCreated = () => {
        setShowCreateModal(false);
        fetchDuels();
    };

    const onSessionSubmitted = () => {
        setShowSessionModal(false);
        fetchDuels();
    };

    const sortedDuels = useMemo(() => {
        let sortableItems = [...duels];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [duels, sortConfig]);

    const categorizedDuels = {
        pending: sortedDuels.filter(d => d.status === 'pending' && d.invited_player_id === playerData.player_id),
        active: sortedDuels.filter(d => d.status === 'active'),
        completed: sortedDuels.filter(d => ['completed', 'expired', 'declined'].includes(d.status)),
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const renderDuelCategory = (title, duelList, categoryKey) => {
        const paginatedDuels = duelList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        if (duelList.length === 0) {
            return (
                <div className="duels-section">
                    <h3>{title}</h3>
                    <p className="no-duels-message">No duels in this category.</p>
                </div>
            );
        }

        return (
            <div className="duels-section">
                <div className="duels-section-header">
                    <h3>{title}</h3>
                    <div className="sort-options">
                        <SortButton label="Date" sortKey="created_at" sortConfig={sortConfig} onSort={handleSort} />
                        <SortButton label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                    </div>
                </div>
                <div className="duels-grid">
                    {paginatedDuels.map(duel => (
                        <DuelCard
                            key={duel.duel_id}
                            duel={duel}
                            onRespond={handleRespond}
                            onSubmitSession={handleSubmitSession}
                            currentUserId={playerData.player_id}
                        />
                    ))}
                </div>
                <Pagination
                    currentPage={currentPage}
                    totalItems={duelList.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                />
            </div>
        );
    };

    if (isLoading) return <p style={{ textAlign: 'center', padding: '2rem' }}>Loading duels...</p>;
    if (error) return <p className="error-message" style={{ textAlign: 'center', padding: '2rem' }}>{error}</p>;

    return (
        <div className="duels-page">
            <div className="duels-header">
                <h1>Duels</h1>
                <button onClick={() => setShowCreateModal(true)} className="create-duel-btn">+ Create Duel</button>
            </div>

            {showCreateModal && <CreateDuelModal onClose={() => setShowCreateModal(false)} onDuelCreated={onDuelCreated} />}
            {showSessionModal && <SessionSelectModal duel={selectedDuel} onClose={() => setShowSessionModal(false)} onSessionSubmitted={onSessionSubmitted} />}

            {renderDuelCategory('Pending Invitations', categorizedDuels.pending, 'pending')}
            {renderDuelCategory('Active Duels', categorizedDuels.active, 'active')}
            {renderDuelCategory('Completed & Past Duels', categorizedDuels.completed, 'completed')}
        </div>
    );
};

export default DuelsPage;
