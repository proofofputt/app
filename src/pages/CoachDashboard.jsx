import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { apiGetMyStudents } from '../api';
import './CoachDashboard.css';

const CoachDashboard = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'inactive'
  const [sortBy, setSortBy] = useState('last_session'); // 'last_session', 'total_sessions', 'name'

  useEffect(() => {
    const fetchStudents = async () => {
      if (!playerData?.player_id) return;

      setIsLoading(true);
      try {
        const data = await apiGetMyStudents('active');
        if (data.success) {
          setStudents(data.students || []);
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        showNotification('Failed to load students', true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, [playerData?.player_id]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isActiveStudent = (lastSessionDate) => {
    if (!lastSessionDate) return false;
    const date = new Date(lastSessionDate);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    return diffDays <= 7; // Active if practiced within last 7 days
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    if (filterStatus === 'active') return isActiveStudent(student.last_session_date);
    if (filterStatus === 'inactive') return !isActiveStudent(student.last_session_date);
    return true; // 'all'
  });

  // Sort students
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortBy === 'last_session') {
      const dateA = a.last_session_date ? new Date(a.last_session_date) : new Date(0);
      const dateB = b.last_session_date ? new Date(b.last_session_date) : new Date(0);
      return dateB - dateA; // Most recent first
    }
    if (sortBy === 'total_sessions') {
      return (b.total_sessions || 0) - (a.total_sessions || 0); // Highest first
    }
    if (sortBy === 'name') {
      return (a.display_name || '').localeCompare(b.display_name || '');
    }
    return 0;
  });

  const activeCount = students.filter(s => isActiveStudent(s.last_session_date)).length;
  const inactiveCount = students.length - activeCount;

  return (
    <div className="coach-dashboard">
      <div className="coach-header">
        <h1>Coach Dashboard</h1>
        <p>View and track students who have granted you access to their sessions</p>
      </div>

      <div className="coach-content">
        {/* Summary Stats */}
        <div className="coach-stats-summary">
          <div className="stat-card">
            <div className="stat-value">{students.length}</div>
            <div className="stat-label">Total Students</div>
          </div>
          <div className="stat-card active">
            <div className="stat-value">{activeCount}</div>
            <div className="stat-label">Active This Week</div>
          </div>
          <div className="stat-card inactive">
            <div className="stat-value">{inactiveCount}</div>
            <div className="stat-label">Inactive</div>
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="coach-controls">
          <div className="filter-group">
            <label>Filter:</label>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All ({students.length})
              </button>
              <button
                className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
                onClick={() => setFilterStatus('active')}
              >
                Active ({activeCount})
              </button>
              <button
                className={`filter-btn ${filterStatus === 'inactive' ? 'active' : ''}`}
                onClick={() => setFilterStatus('inactive')}
              >
                Inactive ({inactiveCount})
              </button>
            </div>
          </div>

          <div className="sort-group">
            <label>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="last_session">Last Session</option>
              <option value="total_sessions">Total Sessions</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* Students List */}
        <div className="students-section">
          {isLoading ? (
            <div className="loading-state">
              <p>Loading students...</p>
            </div>
          ) : sortedStudents.length === 0 ? (
            <div className="empty-state">
              {students.length === 0 ? (
                <>
                  <div className="empty-icon">🎓</div>
                  <h3>No Students Yet</h3>
                  <p>When players grant you coach access, they'll appear here.</p>
                  <p>Ask your students to visit their Contacts page and grant you access.</p>
                </>
              ) : (
                <>
                  <div className="empty-icon">🔍</div>
                  <h3>No {filterStatus} students found</h3>
                  <p>Try changing your filter settings.</p>
                </>
              )}
            </div>
          ) : (
            <div className="students-list">
              {sortedStudents.map((student) => (
                <div
                  key={student.player_id}
                  className={`student-card ${isActiveStudent(student.last_session_date) ? 'active-student' : 'inactive-student'}`}
                >
                  <div className="student-header">
                    <div className="student-info">
                      <h3>{student.display_name}</h3>
                      {isActiveStudent(student.last_session_date) ? (
                        <span className="status-badge active">🟢 Active</span>
                      ) : (
                        <span className="status-badge inactive">⚫ Inactive</span>
                      )}
                    </div>
                    <div className="student-actions">
                      <button
                        onClick={() => navigate(`/player/${student.player_id}/sessions`)}
                        className="btn btn-primary btn-sm"
                      >
                        View Sessions
                      </button>
                    </div>
                  </div>

                  <div className="student-stats">
                    <div className="stat-item">
                      <span className="stat-icon">📊</span>
                      <div className="stat-content">
                        <div className="stat-number">{student.total_sessions || 0}</div>
                        <div className="stat-description">Total Sessions</div>
                      </div>
                    </div>

                    <div className="stat-item">
                      <span className="stat-icon">📅</span>
                      <div className="stat-content">
                        <div className="stat-number">{formatDate(student.last_session_date)}</div>
                        <div className="stat-description">Last Session</div>
                      </div>
                    </div>

                    <div className="stat-item">
                      <span className="stat-icon">🎯</span>
                      <div className="stat-content">
                        <div className="stat-number">{student.access_level || 'full_sessions'}</div>
                        <div className="stat-description">Access Level</div>
                      </div>
                    </div>

                    <div className="stat-item">
                      <span className="stat-icon">✅</span>
                      <div className="stat-content">
                        <div className="stat-number">{formatDate(student.granted_at)}</div>
                        <div className="stat-description">Access Granted</div>
                      </div>
                    </div>
                  </div>

                  {student.notes && (
                    <div className="student-notes">
                      <span className="notes-icon">📝</span>
                      <span className="notes-text">{student.notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        {students.length === 0 && !isLoading && (
          <div className="coach-help-section">
            <h3>How to Get Students</h3>
            <div className="help-steps">
              <div className="help-step">
                <span className="step-number">1</span>
                <div className="step-content">
                  <h4>Share Your Profile</h4>
                  <p>Ask students to add you as a friend on the Contacts page</p>
                </div>
              </div>
              <div className="help-step">
                <span className="step-number">2</span>
                <div className="step-content">
                  <h4>Request Access</h4>
                  <p>Students can grant you coach access from their Contacts page</p>
                </div>
              </div>
              <div className="help-step">
                <span className="step-number">3</span>
                <div className="step-content">
                  <h4>Track Progress</h4>
                  <p>Once granted, you can view their full session history and performance data</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachDashboard;
