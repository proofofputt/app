import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import './ClubsPage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const ClubsPage = () => {
  const { playerData, isAuthenticated } = useAuth();
  const { showTemporaryNotification } = useNotification();

  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Search filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Claim modal
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedClub, setSelectedClub] = useState(null);
  const [claimData, setClaimData] = useState({
    position: '',
    work_email: '',
    work_phone: '',
    verification_notes: '',
    message: '',
  });
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Fetch clubs
  const fetchClubs = async (resetOffset = false) => {
    try {
      setSearching(true);
      const currentOffset = resetOffset ? 0 : offset;

      const params = new URLSearchParams({
        limit,
        offset: currentOffset,
      });

      if (searchQuery) params.append('search', searchQuery);
      if (selectedState) params.append('state', selectedState);
      if (selectedCity) params.append('city', selectedCity);

      const response = await fetch(`${API_BASE_URL}/api/clubs/search?${params}`);
      const data = await response.json();

      if (data.success) {
        if (resetOffset) {
          setClubs(data.clubs);
          setOffset(0);
        } else {
          setClubs(prev => [...prev, ...data.clubs]);
        }
        setHasMore(data.pagination.hasMore);
        setTotalCount(data.pagination.total);
      } else {
        showTemporaryNotification(data.message || 'Failed to load clubs', true);
      }
    } catch (error) {
      console.error('Error fetching clubs:', error);
      showTemporaryNotification('Failed to load clubs', true);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  useEffect(() => {
    fetchClubs(true);
  }, [searchQuery, selectedState, selectedCity]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchClubs(true);
  };

  const loadMore = () => {
    setOffset(prev => prev + limit);
    fetchClubs(false);
  };

  const openClaimModal = (club) => {
    if (!isAuthenticated) {
      showTemporaryNotification('Please log in to claim a club', true);
      return;
    }
    setSelectedClub(club);
    setShowClaimModal(true);
    setClaimData({
      position: '',
      work_email: '',
      work_phone: '',
      verification_notes: '',
      message: '',
    });
  };

  const closeClaimModal = () => {
    setShowClaimModal(false);
    setSelectedClub(null);
  };

  const submitClaim = async (e) => {
    e.preventDefault();

    if (!selectedClub) return;

    if (!claimData.position || !claimData.work_email) {
      showTemporaryNotification('Position and work email are required', true);
      return;
    }

    try {
      setSubmittingClaim(true);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/clubs/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          club_id: selectedClub.club_id,
          ...claimData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showTemporaryNotification(data.message || 'Claim request submitted successfully!', false);
        closeClaimModal();
      } else {
        showTemporaryNotification(data.message || 'Failed to submit claim request', true);
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      showTemporaryNotification('Failed to submit claim request', true);
    } finally {
      setSubmittingClaim(false);
    }
  };

  if (loading) {
    return (
      <div className="clubs-page">
        <div className="loading-container">
          <p>Loading clubs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="clubs-page">
      <div className="clubs-header">
        <h1>Find Your Golf Club</h1>
        <p>Search for your club and claim it to manage leagues and players</p>
      </div>

      <div className="clubs-search">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search by name, city, or state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <input
            type="text"
            placeholder="State (e.g., CA)"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value.toUpperCase())}
            className="search-input state-input"
            maxLength={2}
          />
          <input
            type="text"
            placeholder="City"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="search-input city-input"
          />
          <button type="submit" className="search-button" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {totalCount > 0 && (
          <p className="results-count">
            Found {totalCount} club{totalCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="clubs-list">
        {clubs.length === 0 ? (
          <div className="no-results">
            <p>No clubs found matching your search.</p>
            <p>Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <>
            {clubs.map((club) => (
              <div key={club.club_id} className="club-card">
                <div className="club-info">
                  <h3>{club.name}</h3>
                  <p className="club-location">
                    {[club.address_city, club.address_state]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {club.phone && <p className="club-contact">📞 {club.phone}</p>}
                  {club.website && (
                    <p className="club-contact">
                      🌐 <a href={club.website} target="_blank" rel="noopener noreferrer">
                        {club.website}
                      </a>
                    </p>
                  )}
                  {club.rep_count > 0 && (
                    <p className="club-reps">
                      {club.rep_count} representative{club.rep_count !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="club-actions">
                  <button
                    onClick={() => openClaimModal(club)}
                    className="claim-button"
                    disabled={!isAuthenticated}
                  >
                    {isAuthenticated ? 'Claim This Club' : 'Login to Claim'}
                  </button>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="load-more-container">
                <button onClick={loadMore} className="load-more-button" disabled={searching}>
                  {searching ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Claim Modal */}
      {showClaimModal && selectedClub && (
        <div className="modal-overlay" onClick={closeClaimModal}>
          <div className="modal-content claim-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeClaimModal}>×</button>

            <h2>Claim {selectedClub.name}</h2>
            <p className="modal-subtitle">
              Request to become a representative for this club
            </p>

            <form onSubmit={submitClaim} className="claim-form">
              <div className="form-group">
                <label htmlFor="position">Position at Club *</label>
                <input
                  type="text"
                  id="position"
                  placeholder="e.g., General Manager, Head Professional, Owner"
                  value={claimData.position}
                  onChange={(e) => setClaimData({ ...claimData, position: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="work_email">Work Email *</label>
                <input
                  type="email"
                  id="work_email"
                  placeholder="your.name@clubname.com"
                  value={claimData.work_email}
                  onChange={(e) => setClaimData({ ...claimData, work_email: e.target.value })}
                  required
                />
                <small>Use your official club email address for verification</small>
              </div>

              <div className="form-group">
                <label htmlFor="work_phone">Work Phone</label>
                <input
                  type="tel"
                  id="work_phone"
                  placeholder="(555) 123-4567"
                  value={claimData.work_phone}
                  onChange={(e) => setClaimData({ ...claimData, work_phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="verification_notes">Additional Verification Info</label>
                <textarea
                  id="verification_notes"
                  placeholder="Any additional information to help verify your identity (e.g., employee ID, years at club, etc.)"
                  value={claimData.verification_notes}
                  onChange={(e) => setClaimData({ ...claimData, verification_notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Why do you want to claim this club?</label>
                <textarea
                  id="message"
                  placeholder="Tell us why you'd like to represent this club..."
                  value={claimData.message}
                  onChange={(e) => setClaimData({ ...claimData, message: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={closeClaimModal} className="cancel-button">
                  Cancel
                </button>
                <button type="submit" className="submit-button" disabled={submittingClaim}>
                  {submittingClaim ? 'Submitting...' : 'Submit Claim Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubsPage;
