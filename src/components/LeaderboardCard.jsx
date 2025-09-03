import React from 'react';
import { Link } from 'react-router-dom';

const LeaderboardCard = ({ title, leaders = [] }) => {
  // Ensure we always have an array of 3 for the podium display
  const displayLeaders = [...leaders];
  while (displayLeaders.length < 3) {
    displayLeaders.push({ is_unclaimed: true });
  }

  return (
    <div className="leaderboard-card">
      <h3>{title}</h3>
      <ol>
        {displayLeaders.slice(0, 3).map((leader, index) => (
          <li key={index} className={leader.is_unclaimed ? 'unclaimed' : ''}>
            {leader.is_unclaimed ? (
              <>
                <span className="leader-name">Unclaimed</span>
                <span className="leader-value">—</span>
              </>
            ) : (
              <>
                <span className="leader-name"><Link to={`/player/${leader.player_id}/stats`}>{leader.player_name}</Link></span>
                <span className="leader-value">{leader.value}</span>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};

export default LeaderboardCard;