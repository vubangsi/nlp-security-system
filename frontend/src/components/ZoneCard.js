import React, { useState } from 'react';

const ZoneCard = ({ zone, onArm, onDisarm, onEdit, onDelete, showControls = true, userRole = 'user' }) => {
  const [loading, setLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState(zone.defaultMode || 'home');

  const handleArm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onArm(zone.id, selectedMode);
    } finally {
      setLoading(false);
    }
  };

  const handleDisarm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onDisarm(zone.id);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    onEdit && onEdit(zone);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete zone "${zone.name}"?`)) {
      onDelete && onDelete(zone.id);
    }
  };

  const isArmed = zone.armed;
  const statusClass = isArmed ? 'armed' : 'disarmed';

  return (
    <div className={`zone-card ${statusClass}`}>
      <div className="zone-card-header">
        <div className="zone-icon-status">
          <span 
            className="zone-status-icon" 
            role="img" 
            aria-label={isArmed ? 'armed' : 'disarmed'}
          >
            {isArmed ? '🔒' : '🔓'}
          </span>
          <div className={`zone-status-indicator ${statusClass}`}></div>
        </div>
        
        <div className="zone-card-info">
          <h3 className="zone-name">{zone.name}</h3>
          <p className="zone-description">{zone.description || 'No description'}</p>
          {zone.location && (
            <p className="zone-location">
              <span role="img" aria-label="location">📍</span>
              {zone.location}
            </p>
          )}
        </div>

        {userRole === 'admin' && (
          <div className="zone-admin-controls">
            <button 
              className="btn-icon" 
              onClick={handleEdit}
              aria-label={`Edit zone ${zone.name}`}
              title="Edit Zone"
            >
              <span role="img" aria-label="edit">✏️</span>
            </button>
            <button 
              className="btn-icon btn-danger" 
              onClick={handleDelete}
              aria-label={`Delete zone ${zone.name}`}
              title="Delete Zone"
            >
              <span role="img" aria-label="delete">🗑️</span>
            </button>
          </div>
        )}
      </div>

      <div className="zone-card-status">
        <div className="zone-status-text">
          <span className={`status-badge ${statusClass}`}>
            {isArmed ? `ARMED (${zone.mode?.toUpperCase() || 'HOME'})` : 'DISARMED'}
          </span>
        </div>
        
        {zone.lastModified && (
          <div className="zone-timestamp">
            Last updated: {new Date(zone.lastModified).toLocaleString()}
            {zone.modifiedBy && ` by ${zone.modifiedBy}`}
          </div>
        )}
      </div>

      {zone.sensors && zone.sensors.length > 0 && (
        <div className="zone-sensors">
          <h4>Sensors ({zone.sensors.length})</h4>
          <div className="sensor-list">
            {zone.sensors.slice(0, 3).map((sensor, index) => (
              <span key={index} className="sensor-tag">
                {sensor.name || `Sensor ${index + 1}`}
              </span>
            ))}
            {zone.sensors.length > 3 && (
              <span className="sensor-tag more">+{zone.sensors.length - 3} more</span>
            )}
          </div>
        </div>
      )}

      {showControls && (
        <div className="zone-card-controls">
          {!isArmed ? (
            <div className="arm-controls">
              <div className="mode-selector">
                <label htmlFor={`mode-${zone.id}`} className="mode-label">
                  Arm Mode:
                </label>
                <select 
                  id={`mode-${zone.id}`}
                  value={selectedMode} 
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="mode-select"
                >
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                  <option value="night">Night</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <button 
                className="btn btn-arm" 
                onClick={handleArm}
                disabled={loading}
                aria-label={`Arm zone ${zone.name} in ${selectedMode} mode`}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner-sm"></span>
                    Arming...
                  </>
                ) : (
                  <>
                    <span role="img" aria-label="arm">🔒</span>
                    Arm Zone
                  </>
                )}
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-disarm" 
              onClick={handleDisarm}
              disabled={loading}
              aria-label={`Disarm zone ${zone.name}`}
            >
              {loading ? (
                <>
                  <span className="loading-spinner-sm"></span>
                  Disarming...
                </>
              ) : (
                <>
                  <span role="img" aria-label="disarm">🔓</span>
                  Disarm Zone
                </>
              )}
            </button>
          )}
        </div>
      )}

      {zone.parentZone && (
        <div className="zone-hierarchy-info">
          <span className="hierarchy-label">Parent:</span>
          <span className="parent-zone">{zone.parentZone}</span>
        </div>
      )}

      {zone.childZones && zone.childZones.length > 0 && (
        <div className="zone-hierarchy-info">
          <span className="hierarchy-label">Child zones:</span>
          <span className="child-zones">{zone.childZones.length}</span>
        </div>
      )}
    </div>
  );
};

export default ZoneCard;