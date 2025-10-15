import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import './NetworkingPreferencesPage.css';

const NetworkingPreferencesPage = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();

  const [networkingEnabled, setNetworkingEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const [preferences, setPreferences] = useState({
    locality: {
      country: '',
      state_province: '',
      city: '',
      postal_code: '',
      willing_to_travel: false,
      travel_radius_miles: ''
    },
    professional: {
      industry: '',
      role: '',
      company_size: '',
      years_experience: '',
      looking_for: []
    },
    sports: {
      handicap: '',
      years_playing_golf: '',
      home_course: '',
      play_frequency: '',
      interested_in: [],
      skill_level: ''
    },
    interests: {
      categories: [],
      goals: [],
      open_to_mentoring: false,
      seeking_mentor: false
    }
  });

  const [privacy, setPrivacy] = useState({
    discoverable: true,
    show_locality: true,
    show_professional: true,
    show_sports: true,
    show_interests: true
  });

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    // TODO: Implement API call to load preferences
    // For now, using placeholder data
    console.log('Loading networking preferences...');
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      // TODO: Implement API call to save preferences
      console.log('Saving preferences:', { networkingEnabled, preferences, privacy });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      showNotification('✅ Networking preferences saved successfully!', false);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      showNotification('❌ Failed to save preferences. Please try again.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckboxChange = (category, field, value) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: prev[category][field].includes(value)
          ? prev[category][field].filter(v => v !== value)
          : [...prev[category][field], value]
      }
    }));
  };

  const handleFieldChange = (category, field, value) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  return (
    <div className="networking-preferences-page">
      <div className="preferences-header">
        <h1>🤝 Networking Preferences</h1>
        <p className="header-description">
          Configure your networking profile to receive automated introductions to other players
          based on location, professional background, and interests.
        </p>
      </div>

      <div className="preferences-content">
        {/* Master Toggle */}
        <div className="preferences-section master-toggle-section">
          <label className="master-toggle">
            <input
              type="checkbox"
              checked={networkingEnabled}
              onChange={(e) => setNetworkingEnabled(e.target.checked)}
            />
            <span className="toggle-label">Enable Automated Introductions</span>
          </label>
          <p className="toggle-help">
            When enabled, we'll suggest connections with other players who share your location,
            professional interests, or golf preferences.
          </p>
        </div>

        {networkingEnabled && (
          <>
            {/* Locality Section */}
            <div className="preferences-section">
              <h2>📍 Locality</h2>
              <div className="section-description">
                Help us connect you with players in your area
              </div>

              <div className="form-group">
                <label>Country</label>
                <select
                  value={preferences.locality.country}
                  onChange={(e) => handleFieldChange('locality', 'country', e.target.value)}
                >
                  <option value="">Select Country</option>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Australia">Australia</option>
                  <option value="Ireland">Ireland</option>
                  <option value="New Zealand">New Zealand</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                  <option value="Spain">Spain</option>
                  <option value="Italy">Italy</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>State/Province</label>
                  <input
                    type="text"
                    value={preferences.locality.state_province}
                    onChange={(e) => handleFieldChange('locality', 'state_province', e.target.value)}
                    placeholder="e.g., California"
                  />
                </div>

                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    value={preferences.locality.city}
                    onChange={(e) => handleFieldChange('locality', 'city', e.target.value)}
                    placeholder="e.g., San Francisco"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={preferences.locality.willing_to_travel}
                    onChange={(e) => handleFieldChange('locality', 'willing_to_travel', e.target.checked)}
                  />
                  <span>Willing to travel for connections</span>
                </label>
              </div>

              {preferences.locality.willing_to_travel && (
                <div className="form-group">
                  <label>Travel Radius (miles)</label>
                  <input
                    type="number"
                    value={preferences.locality.travel_radius_miles}
                    onChange={(e) => handleFieldChange('locality', 'travel_radius_miles', e.target.value)}
                    placeholder="e.g., 50"
                  />
                </div>
              )}
            </div>

            {/* Professional Section */}
            <div className="preferences-section">
              <h2>💼 Professional</h2>
              <div className="section-description">
                Connect with players in your industry or profession
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Industry</label>
                  <select
                    value={preferences.professional.industry}
                    onChange={(e) => handleFieldChange('professional', 'industry', e.target.value)}
                  >
                    <option value="">Select Industry</option>
                    <option value="Technology">Technology</option>
                    <option value="Finance">Finance</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Consulting">Consulting</option>
                    <option value="Education">Education</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Retail">Retail</option>
                    <option value="Legal">Legal</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Role</label>
                  <input
                    type="text"
                    value={preferences.professional.role}
                    onChange={(e) => handleFieldChange('professional', 'role', e.target.value)}
                    placeholder="e.g., Software Engineer"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Company Size</label>
                  <select
                    value={preferences.professional.company_size}
                    onChange={(e) => handleFieldChange('professional', 'company_size', e.target.value)}
                  >
                    <option value="">Select Size</option>
                    <option value="startup">Startup (1-50)</option>
                    <option value="small">Small (51-200)</option>
                    <option value="medium">Medium (201-1000)</option>
                    <option value="large">Large (1001-10000)</option>
                    <option value="enterprise">Enterprise (10000+)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Years Experience</label>
                  <input
                    type="number"
                    value={preferences.professional.years_experience}
                    onChange={(e) => handleFieldChange('professional', 'years_experience', e.target.value)}
                    placeholder="e.g., 5"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Looking For (select all that apply)</label>
                <div className="checkbox-group">
                  {['networking', 'collaboration', 'mentorship', 'hiring', 'partnership'].map(option => (
                    <label key={option} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={preferences.professional.looking_for.includes(option)}
                        onChange={() => handleCheckboxChange('professional', 'looking_for', option)}
                      />
                      <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Sports/Golf Section */}
            <div className="preferences-section">
              <h2>⛳ Golf & Sports</h2>
              <div className="section-description">
                Find players with similar skill levels and interests
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Golf Handicap</label>
                  <input
                    type="number"
                    step="0.1"
                    value={preferences.sports.handicap}
                    onChange={(e) => handleFieldChange('sports', 'handicap', e.target.value)}
                    placeholder="e.g., 12.5"
                  />
                </div>

                <div className="form-group">
                  <label>Years Playing Golf</label>
                  <input
                    type="number"
                    value={preferences.sports.years_playing_golf}
                    onChange={(e) => handleFieldChange('sports', 'years_playing_golf', e.target.value)}
                    placeholder="e.g., 8"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Home Course</label>
                <input
                  type="text"
                  value={preferences.sports.home_course}
                  onChange={(e) => handleFieldChange('sports', 'home_course', e.target.value)}
                  placeholder="e.g., Pebble Beach Golf Links"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Play Frequency</label>
                  <select
                    value={preferences.sports.play_frequency}
                    onChange={(e) => handleFieldChange('sports', 'play_frequency', e.target.value)}
                  >
                    <option value="">Select Frequency</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">2-3 times per week</option>
                    <option value="monthly">Once a week</option>
                    <option value="occasional">Occasionally</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Skill Level</label>
                  <select
                    value={preferences.sports.skill_level}
                    onChange={(e) => handleFieldChange('sports', 'skill_level', e.target.value)}
                  >
                    <option value="">Select Level</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Interested In (select all that apply)</label>
                <div className="checkbox-group">
                  {['competitive', 'casual', 'coaching', 'equipment', 'travel'].map(option => (
                    <label key={option} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={preferences.sports.interested_in.includes(option)}
                        onChange={() => handleCheckboxChange('sports', 'interested_in', option)}
                      />
                      <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* General Interests Section */}
            <div className="preferences-section">
              <h2>🎯 Interests & Goals</h2>
              <div className="section-description">
                Share your interests to find like-minded players
              </div>

              <div className="form-group">
                <label>Interest Categories (select all that apply)</label>
                <div className="checkbox-group">
                  {['technology', 'entrepreneurship', 'finance', 'fitness', 'travel', 'philanthropy', 'arts', 'sports'].map(option => (
                    <label key={option} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={preferences.interests.categories.includes(option)}
                        onChange={() => handleCheckboxChange('interests', 'categories', option)}
                      />
                      <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Networking Goals (select all that apply)</label>
                <div className="checkbox-group">
                  {[
                    { value: 'business', label: 'Business Networking' },
                    { value: 'friendship', label: 'Social Connections' },
                    { value: 'mentorship', label: 'Mentorship' },
                    { value: 'collaboration', label: 'Collaboration' },
                    { value: 'golf_partners', label: 'Find Golf Partners' }
                  ].map(option => (
                    <label key={option.value} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={preferences.interests.goals.includes(option.value)}
                        onChange={() => handleCheckboxChange('interests', 'goals', option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={preferences.interests.open_to_mentoring}
                    onChange={(e) => handleFieldChange('interests', 'open_to_mentoring', e.target.checked)}
                  />
                  <span>Open to mentoring others</span>
                </label>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={preferences.interests.seeking_mentor}
                    onChange={(e) => handleFieldChange('interests', 'seeking_mentor', e.target.checked)}
                  />
                  <span>Seeking a mentor</span>
                </label>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="preferences-section privacy-section">
              <h2>🔒 Privacy Settings</h2>
              <div className="section-description">
                Control what information is visible in introduction suggestions
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={privacy.discoverable}
                    onChange={(e) => setPrivacy({ ...privacy, discoverable: e.target.checked })}
                  />
                  <span>Make my profile discoverable for introductions</span>
                </label>
              </div>

              <div className="form-group">
                <label>Show in introduction suggestions:</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={privacy.show_locality}
                      onChange={(e) => setPrivacy({ ...privacy, show_locality: e.target.checked })}
                    />
                    <span>Locality (city, state)</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={privacy.show_professional}
                      onChange={(e) => setPrivacy({ ...privacy, show_professional: e.target.checked })}
                    />
                    <span>Professional Info (industry, role)</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={privacy.show_sports}
                      onChange={(e) => setPrivacy({ ...privacy, show_sports: e.target.checked })}
                    />
                    <span>Golf Info (handicap, interests)</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={privacy.show_interests}
                      onChange={(e) => setPrivacy({ ...privacy, show_interests: e.target.checked })}
                    />
                    <span>General Interests</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="form-actions">
              <button
                className="btn btn-primary save-btn"
                onClick={handleSavePreferences}
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save Networking Preferences'}
              </button>
            </div>
          </>
        )}

        {!networkingEnabled && (
          <div className="disabled-state">
            <div className="disabled-icon">🔒</div>
            <h3>Networking Features Disabled</h3>
            <p>
              Enable automated introductions above to start connecting with other players
              who share your interests, location, and professional background.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkingPreferencesPage;
