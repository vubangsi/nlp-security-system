import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { clearAuthData } from '../utils/auth';

const DashboardPage = () => {
  const [users, setUsers] = useState([]);
  const [systemState, setSystemState] = useState({ armed: false, mode: null });
  const [eventLogs, setEventLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load users
      const usersResponse = await apiService.listUsers();
      setUsers(usersResponse.users || []);

      // Load system state
      const systemStateResponse = await apiService.getSystemState();
      setSystemState(systemStateResponse.systemState || { armed: false, mode: null });

      // Load event logs
      const eventLogsResponse = await apiService.getEventLogs(50);
      setEventLogs(eventLogsResponse.eventLogs || []);

    } catch (err) {
      console.error('Dashboard data loading error:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserPin.trim()) return;

    setAddingUser(true);
    setError('');

    try {
      await apiService.addUser(newUserName, newUserPin);
      setNewUserName('');
      setNewUserPin('');
      await loadDashboardData(); // Reload users
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  };

  const handleLogout = () => {
    clearAuthData();
    navigate('/login', { replace: true });
  };

  const clearEventLogs = async () => {
    try {
      await apiService.clearEventLogs();
      setEventLogs([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear event logs');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <div className="nav">
          <h1>🔐 Security Control</h1>
          <div className="nav-links">
            <Link to="/command" className="nav-link">
              💬 Commands
            </Link>
            <Link to="/dashboard" className="nav-link active">
              📊 Dashboard
            </Link>
            <button onClick={handleLogout} className="btn btn-secondary">
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* System Status */}
      <div className="system-status">
        <div className="status-item">
          <h3>System Status</h3>
          <div className={`status-value ${systemState.armed ? 'status-armed' : 'status-disarmed'}`}>
            {systemState.armed ? 'ARMED' : 'DISARMED'}
          </div>
          {systemState.armed && systemState.mode && (
            <div style={{ fontSize: '14px', marginTop: '5px' }}>
              Mode: {systemState.mode.toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="status-item">
          <h3>Total Users</h3>
          <div className="status-value">{users?.length || 0}</div>
        </div>

        <div className="status-item">
          <h3>Event Logs</h3>
          <div className="status-value">{eventLogs?.length || 0}</div>
        </div>
      </div>

      {/* Add User Form */}
      <div className="card">
        <h3>Add New User</h3>
        <form onSubmit={handleAddUser}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="userName">Name:</label>
              <input
                type="text"
                id="userName"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Enter user name"
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="userPin">PIN:</label>
              <input
                type="password"
                id="userPin"
                value={newUserPin}
                onChange={(e) => setNewUserPin(e.target.value)}
                placeholder="Enter PIN"
                required
                maxLength="10"
              />
            </div>
            <button type="submit" className="btn" disabled={addingUser}>
              {addingUser ? 'Adding...' : 'Add User'}
            </button>
          </div>
        </form>
      </div>

      {/* Users List */}
      <div className="card card-wide">
        <h3>Users</h3>
        {!users || users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.role}</td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Event Logs */}
      <div className="card card-wide">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Event Logs</h3>
          {eventLogs && eventLogs.length > 0 && (
            <button onClick={clearEventLogs} className="btn btn-secondary" style={{ fontSize: '14px', padding: '8px 16px' }}>
              Clear Logs
            </button>
          )}
        </div>

        {!eventLogs || eventLogs.length === 0 ? (
          <p>No event logs available.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Details</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {eventLogs.slice(0, 50).map((log, index) => (
                <tr key={log.id || index}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.eventType}</td>
                  <td>{log.details}</td>
                  <td>{log.userId || 'System'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
