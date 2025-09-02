import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGetPlayerVsPlayerDuels, apiGetPlayerVsPlayerLeaderboard, apiCreateDuel } from '@/api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useNotification } from '@/context/NotificationContext.jsx';
import './PlayerVsPlayerPage.css';

const PlayerVsPlayerPage = () => {
    const { player1Id, player2Id } = useParams();
    const { playerData } = useAuth();
    const { showTemporaryNotification: showNotification } = useNotification();
    const navigate = useNavigate();
    const isSubscribed = playerData?.subscription_status === 'active';

    const [leaderboard, setLeaderboard] = useState(null);
    const [duels, setDuels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isRematching, setIsRematching] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError('');
            try {
                const [leaderboardData, duelsData] = await Promise.all([
                    apiGetPlayerVsPlayerLeaderboard(player1Id, player2Id),
                    apiGetPlayerVsPlayerDuels(player1Id, player2Id)
                ]);
                setLeaderboard(leaderboardData);
                setDuels(duelsData);
            } catch (err) {
                setError(err.message || 'Failed to load head-to-head data.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [player1Id, player2Id]);

    const getWinnerName = (duel) => {
        if (duel.winner_id === null) return 'Draw';
        if (duel.winner_id === leaderboard.player1_id) return leaderboard.player1_name;
        if (duel.winner_id === leaderboard.player2_id) return leaderboard.player2_name;
        return 'N/A';
    };

    const handleRematch = async () => {
        if (!isSubscribed) {
            showNotification("Creating a duel requires a full subscription.", true);
            return;
        }

        // The duels are sorted by creation date descending from the API.
        const lastDuel = duels[0];
        if (!lastDuel) {
            showNotification("Cannot create a rematch without a previous duel.", true);
            return;
        }

        setIsRematching(true);
        try {
            const duelData = {
                creator_id: parseInt(player1Id),
                invited_player_id: parseInt(player2Id),
                // Use settings from the last duel for the rematch
                invitation_expiry_minutes: lastDuel.invitation_expiry_minutes,
                session_duration_limit_minutes: lastDuel.session_duration_limit_minutes,
            };
            await apiCreateDuel(duelData);
            showNotification(`Rematch challenge sent to ${leaderboard.player2_name}!`);
            navigate('/duels');
        } catch (err) {
            showNotification(err.message || 'Failed to send rematch challenge.', true);
        } finally {
            setIsRematching(false);
        }
    };

    if (isLoading) return <p className="loading-message">Loading head-to-head stats...</p>;
    if (error) return <p className="error-message">{error}</p>;
    if (!leaderboard) return <p>No data found for this matchup.</p>;

    const { player1_name, player2_name, player1_wins, player2_wins, total_completed_duels } = leaderboard;

    return (
        <div className="pvp-page">
            <header className="pvp-header">
                <h1>{player1_name}</h1>
                <div className="pvp-controls">
                    <div className="pvp-vs">vs</div>
                    {playerData && playerData.player_id === parseInt(player1Id) && (
                        <button onClick={handleRematch} className="btn btn-secondary btn-small" disabled={isRematching || duels.length === 0}>
                            {isRematching ? 'Sending...' : 'Rematch'}
                        </button>
                    )}
                </div>
                <h1>{player2_name}</h1>
            </header>

            <div className="pvp-summary-grid">
                <div className="pvp-summary-card"><h4>{player1_name}'s Wins</h4><p>{player1_wins}</p></div>
                <div className="pvp-summary-card total-duels"><h4>Total Duels</h4><p>{total_completed_duels}</p></div>
                <div className="pvp-summary-card"><h4>{player2_name}'s Wins</h4><p>{player2_wins}</p></div>
            </div>

            <div className="pvp-history">
                <h3>Duel History</h3>
                {duels.length > 0 ? (
                    <div className="duels-table-container">
                        <table className="duels-table">
                            <thead>
                                <tr><th>Date</th><th>Status</th><th>{player1_name}'s Score</th><th>{player2_name}'s Score</th><th>Winner</th></tr>
                            </thead>
                            <tbody>
                                {duels.map(duel => {
                                    const player1Score = duel.creator_id === leaderboard.player1_id ? duel.creator_makes : duel.invited_makes;
                                    const player2Score = duel.creator_id === leaderboard.player2_id ? duel.creator_makes : duel.invited_makes;
                                    const winnerName = getWinnerName(duel);
                                    return (
                                        <tr key={duel.duel_id}>
                                            <td>{new Date(duel.created_at).toLocaleDateString()}</td>
                                            <td><span className={`status-badge status-${duel.status}`}>{duel.status}</span></td>
                                            <td className="score-cell">{player1Score ?? '—'}</td>
                                            <td className="score-cell">{player2Score ?? '—'}</td>
                                            <td className={`winner-cell ${winnerName === 'Draw' ? 'draw' : ''}`}>{winnerName}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (<p>No past duels found between these players.</p>)}
            </div>
        </div>
    );
};

export default PlayerVsPlayerPage;