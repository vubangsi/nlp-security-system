import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { clearAuthData } from '../utils/auth';

const CommandPage = () => {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState([]);
  const [systemState, setSystemState] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole');

  useEffect(() => {
    // Load command history from localStorage
    const savedHistory = localStorage.getItem('commandHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    // Load system state
    fetchSystemState();
  }, []);

  const fetchSystemState = async (forceRefresh = false) => {
    try {
      const response = await apiService.getSystemState();
      if (forceRefresh || JSON.stringify(response.systemState) !== JSON.stringify(systemState)) {
        setSystemState(response.systemState);
      }
    } catch (err) {
      console.error('Failed to fetch system state:', err);
    }
  };

  const saveToHistory = (command, result) => {
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      command,
      result,
    };
    
    const newHistory = [newEntry, ...history].slice(0, 10); // Keep last 10 commands
    setHistory(newHistory);
    localStorage.setItem('commandHistory', JSON.stringify(newHistory));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await apiService.sendCommand(command);
      saveToHistory(command, result);
      setCommand('');
      setLastResult(result);
      setSuccess(result.result?.message || 'Command executed successfully');

      // Refresh system state after command with a small delay to ensure backend processing is complete
      setTimeout(async () => {
        await fetchSystemState(true); // Force refresh
      }, 100);
    } catch (err) {
      setError(err.response?.data?.message || 'Command failed');
      setLastResult({ error: err.response?.data?.message || 'Command failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthData();
    navigate('/login', { replace: true });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('commandHistory');
  };

  return (
    <div className="container">
      <div className="header">
        <div className="nav">
          <h1>🔐 Security Control</h1>
          <div className="nav-links">
            <Link to="/command" className="nav-link active">
              💬 Commands
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

      {/* System Status */}
      {systemState && (
        <div className="system-status" key={systemState.lastModified}>
          <div className="status-item">
            <h3>🛡️ System Status</h3>
            <div className={`status-value ${systemState.armed ? 'status-armed' : 'status-disarmed'}`}>
              {systemState.armed ? 'ARMED' : 'DISARMED'}
            </div>
          </div>
          <div className="status-item">
            <h3>🏠 Mode</h3>
            <div className="status-value">
              {systemState.mode?.toUpperCase() || 'N/A'}
            </div>
          </div>
          <div className="status-item">
            <h3>⏰ Last Updated</h3>
            <div className="status-value" style={{ fontSize: '16px' }}>
              {new Date(systemState.lastModified).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="command-interface-grid">
        {/* Left Column - Command Input */}
        <div className="command-input-column">
          <div className="card">
            <h2>🤖 Natural Language Commands</h2>
            <p style={{ marginBottom: '25px', color: '#718096' }}>
              Enter commands in natural language to control the security system
            </p>

            {error && <div className="error">❌ {error}</div>}
            {success && <div className="success">✅ {success}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="command">Command:</label>
                <textarea
                  id="command"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g., 'sesame close', 'sesame open', or 'add user John with pin 1234'"
                  required
                  rows="3"
                  style={{
                    width: '100%',
                    fontSize: '16px',
                    padding: '16px 20px',
                    resize: 'vertical',
                    minHeight: '80px'
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn"
                disabled={loading}
                style={{ width: '100%', fontSize: '18px', padding: '16px' }}
              >
                {loading ? '⏳ Processing...' : '🚀 Send Command'}
              </button>
            </form>

            <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
              <p><strong>💡 Example commands:</strong></p>
              <ul style={{ textAlign: 'left', paddingLeft: '20px', lineHeight: '1.6' }}>
                <li>"sesame close" (arm system)</li>
                <li>"sesame open" (disarm system)</li>
                <li>"arm the system in away mode"</li>
                <li>"disarm the system"</li>
                <li>"add user Alice with pin 5678"</li>
                <li>"list all users"</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column - Command Result */}
        <div className="command-result-column">
          <div className="card">
            <h2>📋 Command Result</h2>

            {lastResult ? (
              <div className="result-display">
                <div className="result-header">
                  <span className="result-status">
                    {lastResult.success ? '✅ Success' : '❌ Error'}
                  </span>
                  <span className="result-time">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>

                <div className="result-content">
                  {lastResult.error ? (
                    <div className="result-error">
                      <strong>Error:</strong> {lastResult.error}
                    </div>
                  ) : (
                    <>
                      {lastResult.command && (
                        <div className="result-field">
                          <strong>Command:</strong> {lastResult.command}
                        </div>
                      )}

                      {lastResult.intent && (
                        <div className="result-field">
                          <strong>Intent:</strong> {lastResult.intent}
                        </div>
                      )}

                      {lastResult.result && (
                        <div className="result-field">
                          <strong>Result:</strong>
                          <pre className="result-json">
                            {JSON.stringify(lastResult.result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {lastResult.interpretation && (
                        <div className="result-field">
                          <strong>Interpretation:</strong>
                          <pre className="result-json">
                            {JSON.stringify(lastResult.interpretation, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="result-placeholder">
                <div style={{ textAlign: 'center', color: '#a0aec0', padding: '40px 20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
                  <p>Send a command to see the result here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="card card-wide">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Command History</h3>
            <button onClick={clearHistory} className="btn btn-secondary" style={{ fontSize: '14px', padding: '8px 16px' }}>
              Clear History
            </button>
          </div>
          
          <div className="command-history">
            {history.map((entry) => (
              <div key={entry.id} className="command-item">
                <div className="timestamp">{entry.timestamp}</div>
                <div className="command">Command: {entry.command}</div>
                <div className="result">
                  Result: {JSON.stringify(entry.result, null, 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandPage;
