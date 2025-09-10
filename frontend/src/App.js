import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import CommandPage from './pages/CommandPage';
import DashboardPage from './pages/DashboardPage';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole'));

  // Listen for storage changes to update authentication state
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
      setUserRole(localStorage.getItem('userRole'));
    };

    // Listen for storage events (from other tabs)
    window.addEventListener('storage', handleStorageChange);

    // Listen for custom events (from same tab)
    window.addEventListener('authChange', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authChange', handleStorageChange);
    };
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/login"
            element={!token ? <LoginPage /> : <Navigate to="/command" replace />}
          />
          <Route
            path="/command"
            element={token ? <CommandPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/dashboard"
            element={token && userRole === 'admin' ? <DashboardPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/"
            element={<Navigate to={token ? '/command' : '/login'} replace />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
