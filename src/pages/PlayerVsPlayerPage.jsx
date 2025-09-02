import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash'; // You may need to add lodash: npm install lodash
import './PlayerVsPlayerPage.css';

const PlayerVsPlayerPage = () => {
  const [player1Query, setPlayer1Query] = useState('');
  const [player2Query, setPlayer2Query] = useState('');
  
  const [player1Results, setPlayer1Results] = useState([]);
  const [player2Results, setPlayer2Results] = useState([]);

  const [selectedPlayer1, setSelectedPlayer1] = useState(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState(null);

  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchPlayers = async (query, playerSetter) => {
    if (query.length < 2) {
      playerSetter([]);
      return;
    }
    try {
      const response = await fetch(`/api/players/search?q=${query}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      playerSetter(data);
    } catch (err) {
      console.error('Player search error:', err);
    }
  };

  const debouncedSearch = useCallback(debounce(searchPlayers, 300), []);

  useEffect(() => {
    debouncedSearch(player1Query, setPlayer1Results);
  }, [player1Query, debouncedSearch]);

  useEffect(() => {
    debouncedSearch(player2Query, setPlayer2Results);
  }, [player2Query, debouncedSearch]);

  useEffect(() => {
    const fetchComparison = async () => {
      if (selectedPlayer1 && selectedPlayer2) {
        setLoading(true);
        setError('');
        setComparisonData(null);
        try {
          const response = await fetch(`/api/compare?player1_id=${selectedPlayer1.player_id}&player2_id=${selectedPlayer2.player_id}`);
          if (!response.ok) throw new Error('Failed to fetch comparison data.');
          const data = await response.json();
          setComparisonData(data);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchComparison();
  }, [selectedPlayer1, selectedPlayer2]);

  const handleSelectPlayer = (player, playerNumber) => {
    if (playerNumber === 1) {
      setSelectedPlayer1(player);
      setPlayer1Query(player.name);
      setPlayer1Results([]);
    } else {
      setSelectedPlayer2(player);
      setPlayer2Query(player.name);
      setPlayer2Results([]);
    }
  };

  const renderPlayerCard = (playerStats) => (
    <div className="player-card">
      <h3>{playerStats.player_name}</h3>
      <div className="stat-item">
        <span className="stat-label">Total Makes</span>
        <span className="stat-value">{playerStats.sum_makes}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Best Streak</span>
        <span className="stat-value">{playerStats.high_best_streak}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Avg. Putts/Min</span>
        <span className="stat-value">{playerStats.avg_ppm.toFixed(2)}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Avg. Accuracy</span>
        <span className="stat-value">{playerStats.avg_accuracy.toFixed(2)}%</span>
      </div>
    </div>
  );

  return (
    <div className="pvp-page">
      <h2>Player vs. Player Comparison</h2>
      <div className="player-selection-area">
        <div className="player-search-container">
          <label htmlFor="player1">Player 1</label>
          <input 
            type="text"
            id="player1"
            value={player1Query}
            onChange={(e) => setPlayer1Query(e.target.value)}
            placeholder="Search for a player..."
            autoComplete="off"
          />
          {player1Results.length > 0 && (
            <div className="search-results">
              {player1Results.map(p => (
                <div key={p.player_id} className="search-result-item" onClick={() => handleSelectPlayer(p, 1)}>
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="player-search-container">
          <label htmlFor="player2">Player 2</label>
          <input 
            type="text"
            id="player2"
            value={player2Query}
            onChange={(e) => setPlayer2Query(e.target.value)}
            placeholder="Search for a player..."
            autoComplete="off"
          />
          {player2Results.length > 0 && (
            <div className="search-results">
              {player2Results.map(p => (
                <div key={p.player_id} className="search-result-item" onClick={() => handleSelectPlayer(p, 2)}>
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="pvp-loading">Loading Comparison...</div>}
      {error && <div className="pvp-error">{error}</div>}

      {comparisonData && (
        <div className="comparison-area">
          {renderPlayerCard(comparisonData.player1_stats)}
          <div className="h2h-results">
            <h4>Head-to-Head</h4>
            <div className="h2h-score">
              <span>{comparisonData.h2h.player1_wins} - {comparisonData.h2h.player2_wins}</span>
            </div>
            <span>({comparisonData.h2h.total_completed_duels} Duels)</span>
          </div>
          {renderPlayerCard(comparisonData.player2_stats)}
        </div>
      )}
    </div>
  );
};

export default PlayerVsPlayerPage;
