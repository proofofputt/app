import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGetFundraiserDetails, apiStartSession } from '@/api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useNotification } from '@/context/NotificationContext.jsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PledgeModal from './PledgeModal.jsx';
import './FundraiserDetail.css';

const FundraiserDetailPage = () => {
  const { fundraiserId } = useParams();
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const [fundraiser, setFundraiser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);

  const fetchDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiGetFundraiserDetails(fundraiserId);
      setFundraiser(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch fundraiser details.');
    } finally {
      setIsLoading(false);
    }
  }, [fundraiserId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const processChartData = () => {
    if (!fundraiser || !fundraiser.sessions || fundraiser.sessions.length === 0) {
      return [{ putts: 0, amount: 0 }];
    }

    const totalPledgePerPutt = fundraiser.pledges.reduce((sum, pledge) => sum + pledge.amount_per_putt, 0);

    let cumulativePutts = 0;
    const chartData = [{ putts: 0, amount: 0 }];

    fundraiser.sessions.forEach(session => {
      cumulativePutts += session.total_makes;
      chartData.push({
        putts: cumulativePutts,
        amount: cumulativePutts * totalPledgePerPutt,
      });
    });

    return chartData;
  };

  const handleStartSession = async () => {
    if (!fundraiser || !playerData || isStartingSession) return;

    setIsStartingSession(true);
    try {
      await apiStartSession(playerData.player_id);
      showNotification('Session started! The tracker window should now be open.');
    } catch (err) {
      console.error("Error starting session:", err);
      showNotification(`Error: ${err.message}`, true);
    } finally {
      setIsStartingSession(false);
    }
  };

  const handlePledgeSuccess = () => {
    setShowPledgeModal(false);
    fetchDetails(); // Refresh data to show the new pledge
  };

  if (isLoading) return <p>Loading fundraiser details...</p>;
  if (error) return <p className="error-message">{error}</p>;
  if (!fundraiser) return <p>Fundraiser not found.</p>;

  const chartData = processChartData();
  const totalPledgePerPutt = fundraiser.pledges.reduce((sum, pledge) => sum + pledge.amount_per_putt, 0);
  
  // A user cannot pledge to their own fundraiser
  const canPledge = playerData && fundraiser && playerData.player_id !== fundraiser.player_id;

  return (
    <div className="fundraiser-detail-page">
      {showPledgeModal && <PledgeModal 
        fundraiserId={fundraiserId} 
        fundraiserName={fundraiser.name} 
        onClose={() => setShowPledgeModal(false)} 
        onPledgeSuccess={handlePledgeSuccess} />}

      <header className="fundraiser-detail-header">
        <h1>{fundraiser.name}</h1>
        <p className="fundraiser-cause">For: <strong>{fundraiser.cause}</strong></p>
        <p className="fundraiser-creator">
          Organized by: <Link to={`/player/${fundraiser.player_id}/stats`}>{fundraiser.player_name}</Link>
        </p>
        {fundraiser.description && <p className="fundraiser-description">{fundraiser.description}</p>}
      </header>

      <div className="fundraiser-stats-grid">
        <div className="stat-card"><h4>Amount Raised</h4><p className="stat-value">${fundraiser.amount_raised.toFixed(2)}</p></div>
        <div className="stat-card"><h4>Goal</h4><p className="stat-value">${fundraiser.goal_amount.toFixed(2)}</p></div>
        <div className="stat-card"><h4>Total Putts Made</h4><p className="stat-value">{fundraiser.total_putts_made}</p></div>
        <div className="stat-card"><h4>Total Pledged Per Putt</h4><p className="stat-value">${totalPledgePerPutt.toFixed(2)}</p></div>
      </div>

      <div className="card chart-card">
        <h3>Fundraising Progress</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="putts" name="Putts Made" label={{ value: 'Putts Made', position: 'insideBottom', offset: -5 }} /><YAxis label={{ value: 'Amount Raised ($)', angle: -90, position: 'insideLeft' }} /><Tooltip formatter={(value) => `$${value.toFixed(2)}`} /><Legend /><Line type="monotone" dataKey="amount" name="Amount Raised" stroke="#8884d8" activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="fundraiser-columns">
        <div className="card pledges-card">
          <h3>Top Pledges</h3>
          {fundraiser.pledges.length > 0 ? (
            <table className="pledges-table">
              <thead><tr><th>Pledger</th><th>Amount per Putt</th></tr></thead>
              <tbody>{fundraiser.pledges.map(pledge => (<tr key={pledge.pledge_id}><td>{pledge.pledger_name}</td><td>${pledge.amount_per_putt.toFixed(2)}</td></tr>))}</tbody>
            </table>
          ) : (<p>No pledges yet. Be the first!</p>)}
          {canPledge && (
            <div className="pledge-actions">
              <button className="btn" onClick={() => setShowPledgeModal(true)}>Pledge Now</button>
            </div>
          )}
        </div>

        <div className="card sessions-card">
          <h3>Putting Sessions During Campaign</h3>
          {fundraiser.sessions.length > 0 ? (
            <ul>{fundraiser.sessions.map(session => (<li key={session.session_id}><span>{new Date(session.start_time).toLocaleDateString()}</span><span>{session.total_makes} Makes</span><span>{Math.round(session.session_duration / 60)} min</span></li>))}</ul>
          ) : (<p>No putting sessions recorded during this campaign yet.</p>)}
          {playerData && fundraiser && playerData.player_id === fundraiser.player_id && (
            <div className="start-session-action">
              <button className="btn" onClick={handleStartSession} disabled={isStartingSession}>
                {isStartingSession ? 'Starting...' : 'Start Fundraising Session'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FundraiserDetailPage;