import React from 'react';

const SortButton = ({ sortKey, sortConfig, handleSort }) => {
  const isActive = sortConfig.key === sortKey;
  const directionIcon = sortConfig.direction === 'ascending' ? '▲' : '▼';

  return (
    <button onClick={() => handleSort(sortKey)} className={`sort-button ${isActive ? 'active' : ''}`}>
      {isActive ? directionIcon : '↕'}
    </button>
  );
};

export default SortButton;