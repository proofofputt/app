import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { PersistentNotificationProvider } from './context/PersistentNotificationContext';
import Dashboard from './components/Dashboard';
import DuelsPage from './components/DuelsPage';
import SettingsPage from './pages/SettingsPage';
import LeagueDetailPage from './components/LeagueDetailPage';
import LeaguesPage from './pages/LeaguesPage';
import SessionHistoryPage from './components/SessionHistoryPage';
import PlayerCareerPage from './pages/PlayerCareerPage';
import CoachPage from './components/CoachPage';
import PlayerVsPlayerPage from './pages/PlayerVsPlayerPage';
import NotificationsPage from './pages/NotificationsPage';
import ContactsPage from './pages/ContactsPage';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import './App.css';

const AppContent = () => {
  const location = useLocation();
  const { playerData, isLoading } = useAuth();

  if (isLoading) {
    return <p style={{ textAlign: 'center', padding: '2rem' }}>Loading...</p>;
  }

  return (
    <div className="App">
      {playerData && <Header />}
      <main className="container-fluid">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Root Route - Dashboard if authenticated, otherwise redirect to login */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/player/:playerId/sessions" element={<ProtectedRoute><SessionHistoryPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/duels" element={<ProtectedRoute><DuelsPage /></ProtectedRoute>} />
          <Route path="/player/:playerId/stats" element={<ProtectedRoute><PlayerCareerPage /></ProtectedRoute>} />
          <Route path="/leagues/:leagueId" element={<ProtectedRoute><LeagueDetailPage /></ProtectedRoute>} />
          <Route path="/leagues" element={<ProtectedRoute><LeaguesPage /></ProtectedRoute>} />
          <Route path="/coach" element={<ProtectedRoute><CoachPage /></ProtectedRoute>} />
          <Route path="/coach/:conversationId" element={<ProtectedRoute><CoachPage /></ProtectedRoute>} />
          <Route path="/players/:player1Id/vs/:player2Id" element={<ProtectedRoute><PlayerVsPlayerPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <PersistentNotificationProvider>
          <AppContent />
        </PersistentNotificationProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;