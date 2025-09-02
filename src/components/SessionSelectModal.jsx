import React, { useState, useEffect } from 'react';
import { apiGetSessions, apiSubmitSessionToDuel } from '../api';
import { useAuth } from '../context/AuthContext';


const SessionSelectModal = ({ duel, onClose, onSessionSubmitted }) => {
  const { playerData } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessionData = await apiGetSessions(playerData.player_id);
        setSessions(sessionData);
      } catch (err) {
        setError(err.message || 'Failed to load sessions.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [playerData.player_id]);

  const handleSubmit = async () => {
    if (!selectedSession) return;
    setIsLoading(true);
    setError('');
    try {
      await apiSubmitSessionToDuel(duel.duel_id, playerData.player_id, selectedSession.session_id);
      onSessionSubmitted();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit session.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Select Session for Duel</h2>
        {isLoading && <p>Loading sessions...</p>}
        {error && <p className="error-message">{error}</p>}
        <div className="session-list">
          {sessions.map(session => (
            <div
              key={session.session_id}
              className={`session-item ${selectedSession?.session_id === session.session_id ? 'selected' : ''}`}
              onClick={() => setSelectedSession(session)}
            >
              <p>Date: {new Date(session.start_time).toLocaleString()}</p>
              <p>Makes: {session.total_makes} / {session.total_putts}</p>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={isLoading}>Cancel</button>
          <button onClick={handleSubmit} disabled={!selectedSession || isLoading}>
            {isLoading ? 'Submitting...' : 'Submit Session'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionSelectModal;