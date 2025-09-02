import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { useNotification } from '@/context/NotificationContext.jsx';
import { apiCreateFundraiser } from '@/api.js';
import './FundraiserCreatePage.css';

const FundraiserCreatePage = () => {
  const { playerData } = useAuth();
  const navigate = useNavigate();
  const { showTemporaryNotification: showNotification } = useNotification();

  const isSubscribed = playerData?.subscription_status === 'active';

  const [formData, setFormData] = useState({
    name: '',
    cause: '',
    description: '',
    goal_amount: '100.00',
    start_time: new Date().toISOString().slice(0, 16), // Default to now
    end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // Default to 1 week from now
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSubscribed) {
      showNotification('Creating a fundraiser requires a full subscription.', true);
      return;
    }

    if (new Date(formData.start_time) >= new Date(formData.end_time)) {
      showNotification('The end date must be after the start date.', true);
      return;
    }

    setIsLoading(true);
    try {
      const fundraiserData = {
        ...formData,
        creator_id: playerData.player_id,
        goal_amount: parseFloat(formData.goal_amount),
      };
      const newFundraiser = await apiCreateFundraiser(fundraiserData);
      showNotification('Fundraiser created successfully!');
      navigate(`/fundraisers/${newFundraiser.fundraiser_id}`);
    } catch (err) {
      showNotification(`Error: ${err.message}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSubscribed) {
    return (
      <div className="fundraiser-create-page">
        <div className="form-section">
          <h3>Create a Fundraiser</h3>
          <p>This feature is available to full subscribers.</p>
          <button onClick={() => navigate('/settings')} className="btn">Upgrade Your Subscription</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fundraiser-create-page">
      <div className="form-section">
        <h2>Create a New Fundraiser</h2>
        <p className="form-hint">Raise funds for a cause you care about. Supporters will be able to pledge an amount per putt you make during the campaign period.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label htmlFor="name">Fundraiser Name</label><input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g., Putting for Pups" /></div>
          <div className="form-group"><label htmlFor="cause">Cause</label><input type="text" id="cause" name="cause" value={formData.cause} onChange={handleChange} required placeholder="e.g., Local Animal Shelter" /></div>
          <div className="form-group"><label htmlFor="description">Description</label><textarea id="description" name="description" value={formData.description} onChange={handleChange} required rows="4" placeholder="Tell people about your fundraiser. Why is this cause important to you?"></textarea></div>
          <div className="form-group"><label htmlFor="goal_amount">Goal Amount ($)</label><input type="number" id="goal_amount" name="goal_amount" value={formData.goal_amount} onChange={handleChange} required min="1" step="0.01" /></div>
          <div className="form-grid"><div className="form-group"><label htmlFor="start_time">Start Date & Time</label><input type="datetime-local" id="start_time" name="start_time" value={formData.start_time} onChange={handleChange} required /></div><div className="form-group"><label htmlFor="end_time">End Date & Time</label><input type="datetime-local" id="end_time" name="end_time" value={formData.end_time} onChange={handleChange} required /></div></div>
          <button type="submit" className="btn" disabled={isLoading}>{isLoading ? 'Creating...' : 'Create Fundraiser'}</button>
        </form>
      </div>
    </div>
  );
};

export default FundraiserCreatePage;