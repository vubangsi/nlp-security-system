import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { clearAuthData } from '../utils/auth';
import ScheduleManager from '../components/schedule/ScheduleManager';

const SchedulePage = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole');

  const handleLogout = () => {
    clearAuthData();
    navigate('/login', { replace: true });
  };

  return (
    <div className="container">
      <div className="header">
        <div className="nav">
          <h1>🔐 Security Control</h1>
          <div className="nav-links">
            <Link to="/command" className="nav-link">
              💬 Commands
            </Link>
            <Link to="/schedule" className="nav-link active">
              ⏰ Schedules
            </Link>
            {userRole === 'admin' && (
              <Link to="/dashboard" className="nav-link">
                📊 Dashboard
              </Link>
            )}
            <button onClick={handleLogout} className="btn btn-secondary">
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      <ScheduleManager />
    </div>
  );
};

export default SchedulePage;