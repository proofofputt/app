import React from 'react';
import './Pagination.css';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="pagination-controls">
      <button onClick={handlePrevious} disabled={currentPage === 1} className="btn btn-secondary">&laquo; Previous</button>
      <span>Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
      <button onClick={handleNext} disabled={currentPage === totalPages} className="btn btn-secondary">Next &raquo;</button>
    </div>
  );
};

export default Pagination;