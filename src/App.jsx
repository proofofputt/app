import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import DuelsPage from './components/DuelsPage';
import SettingsPage from './pages/SettingsPage';
import LeaguesPage from './pages/LeaguesPage';
import PlayerCareerPage from './pages/PlayerCareerPage';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
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
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/duels" element={<ProtectedRoute><DuelsPage /></ProtectedRoute>} />
          <Route path="/leagues" element={<ProtectedRoute><LeaguesPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/player/:playerId/stats" element={<ProtectedRoute><PlayerCareerPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
