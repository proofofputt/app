import React from 'react';

const formatValue = (title, value) => {
  if (value === null || value === undefined) return 'N/A';
  
  const isTime = title === 'Fastest 21';
  
  if (typeof value === 'number' && value % 1 !== 0) {
    return `${value.toFixed(2)}${isTime ? 's' : ''}`;
  }
  
  return `${value}${isTime ? 's' : ''}`;
};

const LeaderboardCard = ({ title, leaders }) => {
  // Ensure there are always 3 leaders to display, filling empty slots with "Unclaimed".
  const displayLeaders = [...(leaders || [])];
  while (displayLeaders.length < 3) {
    displayLeaders.push({ name: 'Unclaimed', value: null });
  }

  return (
    <div className="leaderboard-card">
      <h3>{title}</h3>
      <ol>
        {displayLeaders.map((leader, index) => (
          <li key={index} className={leader.name === 'Unclaimed' ? 'unclaimed' : ''}>
            <span className="leader-name">{leader.name}</span>
            <span className="leader-value">{leader.name === 'Unclaimed' ? '—' : formatValue(title, leader.value)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default LeaderboardCard;