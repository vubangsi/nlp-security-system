import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { setAuthData } from '../utils/auth';

const LoginPage = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiService.login(pin);
      const { token } = response;
      
      // Decode token to get user role (simple JWT decode)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userRole = payload.user.role;
      
      // Set authentication data and trigger state update
      setAuthData(token, userRole);

      // Auto-redirect to command interface for all users
      navigate('/command', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔐</div>
          <h2>Security Control System</h2>
          <p style={{ color: '#718096', marginBottom: '0' }}>
            Enter your PIN to access the system
          </p>
        </div>

        {error && <div className="error">❌ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="pin">PIN Code:</label>
            <input
              type="password"
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••"
              required
              maxLength="10"
              style={{
                textAlign: 'center',
                fontSize: '24px',
                letterSpacing: '4px',
                padding: '20px'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ width: '100%', fontSize: '18px', padding: '16px' }}
          >
            {loading ? '🔄 Authenticating...' : '🚀 Access System'}
          </button>
        </form>

        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'rgba(102, 126, 234, 0.1)',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: '600', color: '#4a5568' }}>
            🎯 Demo Credentials
          </p>
          <p style={{ margin: '5px 0', color: '#718096' }}>
            <strong>Admin PIN:</strong> 0000
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#a0aec0' }}>
            Add more users through the admin dashboard
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
