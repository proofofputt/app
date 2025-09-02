import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { apiListFundraisers } from '@/api';
import { format } from 'date-fns';
import './Fundraising.css';

const ProgressBar = ({ raised, goal }) => {
  const percentage = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
  const raisedAmount = raised.toFixed(2);
  const goalAmount = goal.toFixed(2);

  return (
    <div
      className="progress-bar-container"
      role="progressbar"
      aria-valuenow={raised}
      aria-valuemin="0"
      aria-valuemax={goal}
      aria-valuetext={`${raisedAmount} of ${goalAmount} raised`}
    >
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percentage}%` }}></div>
      </div>
      <div className="progress-text">
        Progress: ${raisedAmount} / ${goalAmount}
      </div>
    </div>
  );
};

const FundraisingPage = () => {
  const { playerData } = useAuth();
  const isSubscribed = playerData?.subscription_status === 'active';
  const [fundraisers, setFundraisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFundraisers = async () => {
    try {
      setLoading(true);
      const data = await apiListFundraisers();
      setFundraisers(data);
    } catch (err) {
      setError('Failed to load fundraising campaigns.');
      console.error(err);
    } finally {
      setLoading(false);
    }
    };
    fetchFundraisers();
  }, []);

  return (
    <div className="fundraising-page">
      <div className="page-header">
        <h2>Fundraising Campaigns</h2>
        {isSubscribed && (
          <Link to="/fundraisers/new" className="btn">
            Create A Fundraiser
          </Link>
        )}
      </div>

      <div className="fundraiser-list-container">
        <table className="fundraiser-table">
          <thead>
            <tr className="fundraiser-table-header grid-row">
              <th>Campaign</th>
              <th>Organizer</th>
              <th>Starts</th>
              <th>Ends</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center' }}>Loading campaigns...</td></tr>}
            {error && <tr><td colSpan="5" className="error-message" style={{ padding: '2rem', textAlign: 'center' }}>{error}</td></tr>}
            {!loading && !error && fundraisers.length === 0 && (
              <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', fontStyle: 'italic' }}>No active fundraising campaigns at the moment. Why not create one?</td></tr>
            )}
            {!loading && !error && fundraisers.map(f => (
              <React.Fragment key={f.fundraiser_id}>
                <tr className="fundraiser-table-row grid-row">
                  <td data-label="Campaign:">
                    <div className="fundraiser-name-cause">
                      <span className="fundraiser-name">{f.name}</span>
                      <span className="fundraiser-cause">For: {f.cause}</span>
                    </div>
                  </td>
                  <td data-label="Organizer:">
                    <Link to={`/player/${f.player_id}/stats`}>{f.player_name}</Link>
                  </td>
                  <td data-label="Starts:">{format(new Date(f.start_time), 'MMM d')}</td>
                  <td data-label="Ends:">{format(new Date(f.end_time), 'MMM d')}</td>
                  <td className="action-cell">
                    <Link to={`/fundraisers/${f.fundraiser_id}`}><button className="btn btn-yellow">View</button></Link>
                  </td>
                </tr>
                <tr className="fundraiser-progress-row">
                  <td colSpan="5">
                    <ProgressBar raised={f.amount_raised} goal={f.goal_amount} />
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FundraisingPage;
