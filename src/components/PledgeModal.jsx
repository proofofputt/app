import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext.jsx';
import { useNotification } from '@/context/NotificationContext.jsx';
import { apiCreatePledge } from '@/api.js';
import './PledgeModal.css';

const PledgeModal = ({ fundraiserId, fundraiserName, onClose, onPledgeSuccess }) => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const [amountPerPutt, setAmountPerPutt] = useState('0.10');
  const [maxDonation, setMaxDonation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const pledgeData = {
        pledger_player_id: playerData.player_id,
        amount_per_putt: parseFloat(amountPerPutt),
        max_donation: maxDonation ? parseFloat(maxDonation) : null,
      };
      await apiCreatePledge(fundraiserId, pledgeData);
      showNotification('Pledge made successfully! Thank you for your support.');
      onPledgeSuccess();
    } catch (err) {
      showNotification(`Error: ${err.message}`, true);
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content pledge-modal">
        <div className="modal-header">
          <h3>Pledge to "{fundraiserName}"</h3>
          <button onClick={onClose} className="modal-close-btn">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <p>You are pledging a certain amount for every putt the fundraiser creator makes during the campaign.</p>
          <div className="form-group">
            <label htmlFor="amount_per_putt">Amount per Putt ($)</label>
            <input type="number" id="amount_per_putt" name="amount_per_putt" value={amountPerPutt} onChange={(e) => setAmountPerPutt(e.target.value)} required min="0.01" step="0.01" />
          </div>
          <div className="form-group">
            <label htmlFor="max_donation">Maximum Donation (Optional)</label>
            <input type="number" id="max_donation" name="max_donation" value={maxDonation} onChange={(e) => setMaxDonation(e.target.value)} min="1" step="0.01" placeholder="e.g., 50.00" />
            <p className="form-hint">Set a cap on your total donation, regardless of how many putts are made.</p>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-tertiary">Cancel</button>
            <button type="submit" className="btn" disabled={isLoading}>
              {isLoading ? 'Pledging...' : 'Confirm Pledge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PledgeModal;