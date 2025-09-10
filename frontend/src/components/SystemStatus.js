import React from 'react';

const SystemStatus = ({ systemState, loading, error }) => {
  if (loading) {
    return (
      <div className="system-status loading">
        <div className="status-indicator">
          <div className="loading-spinner"></div>
        </div>
        <div className="status-text">Loading system status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="system-status error">
        <div className="status-indicator error">
          <span className="status-icon">⚠️</span>
        </div>
        <div className="status-text">Error: {error}</div>
      </div>
    );
  }

  if (!systemState) {
    return (
      <div className="system-status unknown">
        <div className="status-indicator unknown">
          <span className="status-icon">❓</span>
        </div>
        <div className="status-text">System status unknown</div>
      </div>
    );
  }

  const isArmed = systemState.armed;
  const mode = systemState.mode;
  const statusClass = isArmed ? 'armed' : 'disarmed';
  const statusIcon = isArmed ? '🔒' : '🔓';
  const statusText = isArmed ? `Armed (${mode})` : 'Disarmed';

  return (
    <div className={`system-status ${statusClass}`}>
      <div className={`status-indicator ${statusClass}`}>
        <span className="status-icon">{statusIcon}</span>
      </div>
      <div className="status-text">{statusText}</div>
      {systemState.lastModified && (
        <div className="status-details">
          Last modified: {new Date(systemState.lastModified).toLocaleString()}
          {systemState.modifiedBy && ` by ${systemState.modifiedBy}`}
        </div>
      )}
    </div>
  );
};

export default SystemStatus;
