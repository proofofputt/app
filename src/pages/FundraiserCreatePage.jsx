import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './FundraiserCreatePage.css';

const FundraiserCreatePage = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const MAX_DESC_LENGTH = 500;

  const handleDescriptionChange = (e) => {
    if (e.target.value.length <= MAX_DESC_LENGTH) {
      setDescription(e.target.value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic Validation
    if (!title || !description || !goalAmount || !endDate) {
      setError('All fields are required.');
      return;
    }
    if (parseFloat(goalAmount) <= 0) {
      setError('Goal amount must be greater than zero.');
      return;
    }
    if (new Date(endDate) <= new Date()) {
      setError('End date must be in the future.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/fundraisers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include Authorization header if needed, e.g.:
          // 'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title,
          description,
          goal_amount: parseFloat(goalAmount),
          end_date: endDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create fundraiser.');
      }

      console.log('Fundraiser created successfully:', data);
      // Redirect to the new fundraiser's detail page
      navigate(`/fundraisers/${data.fundraiser_id}`);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fundraiser-create-page">
      <h2>Create a New Fundraiser</h2>
      <form onSubmit={handleSubmit} className="fundraiser-form">
        {error && <p className="fundraiser-form-error">{error}</p>}
        
        <div className="form-group">
          <label htmlFor="title">Fundraiser Title</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., New Equipment for the Club"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={handleDescriptionChange}
            placeholder="Tell everyone about your cause."
            required
          />
          <div className="char-counter">
            {description.length} / {MAX_DESC_LENGTH}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="goalAmount">Goal Amount ($)</label>
          <input
            type="number"
            id="goalAmount"
            value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value)}
            placeholder="e.g., 500"
            min="0.01"
            step="0.01"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="endDate">End Date</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="fundraiser-submit-btn" disabled={loading}>
          {loading ? 'Creating...' : 'Create Fundraiser'}
        </button>
      </form>
    </div>
  );
};

export default FundraiserCreatePage;
