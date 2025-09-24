import React from 'react';

const ZoneStatus = ({ zones, loading, error, onZoneAction }) => {
  if (loading) {
    return (
      <div className="zone-status loading">
        <div className="loading-spinner"></div>
        <div className="status-text">Loading zone status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="zone-status error">
        <div className="status-indicator error">
          <span className="status-icon" role="img" aria-label="warning">⚠️</span>
        </div>
        <div className="status-text">Error: {error}</div>
      </div>
    );
  }

  if (!zones || zones.length === 0) {
    return (
      <div className="zone-status empty">
        <div className="status-indicator empty">
          <span className="status-icon" role="img" aria-label="empty">📍</span>
        </div>
        <div className="status-text">No zones configured</div>
      </div>
    );
  }

  const armedZones = zones.filter(zone => zone.armed);
  const disarmedZones = zones.filter(zone => !zone.armed);

  return (
    <div className="zone-status-container">
      <div className="zone-summary-grid">
        <div className="zone-summary-item">
          <h3>Total Zones</h3>
          <div className="zone-count">{zones.length}</div>
        </div>
        <div className="zone-summary-item armed">
          <h3>Armed Zones</h3>
          <div className="zone-count">{armedZones.length}</div>
        </div>
        <div className="zone-summary-item disarmed">
          <h3>Disarmed Zones</h3>
          <div className="zone-count">{disarmedZones.length}</div>
        </div>
      </div>

      <div className="zone-quick-status">
        {zones.slice(0, 4).map((zone) => (
          <div 
            key={zone.id} 
            className={`zone-quick-card ${zone.armed ? 'armed' : 'disarmed'}`}
            role="button"
            tabIndex={0}
            aria-label={`Zone ${zone.name}: ${zone.armed ? 'Armed' : 'Disarmed'}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onZoneAction && onZoneAction(zone.id, zone.armed ? 'disarm' : 'arm');
              }
            }}
            onClick={() => onZoneAction && onZoneAction(zone.id, zone.armed ? 'disarm' : 'arm')}
          >
            <div className="zone-icon">
              <span role="img" aria-label={zone.armed ? 'locked' : 'unlocked'}>
                {zone.armed ? '🔒' : '🔓'}
              </span>
            </div>
            <div className="zone-info">
              <div className="zone-name">{zone.name}</div>
              <div className="zone-status-text">
                {zone.armed ? `Armed (${zone.mode || 'home'})` : 'Disarmed'}
              </div>
              {zone.lastModified && (
                <div className="zone-timestamp">
                  {new Date(zone.lastModified).toLocaleTimeString()}
                </div>
              )}
            </div>
            <div className="zone-action-button">
              <span className="action-text">
                {zone.armed ? 'Disarm' : 'Arm'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {zones.length > 4 && (
        <div className="zone-status-footer">
          <span className="more-zones-text">
            +{zones.length - 4} more zones
          </span>
        </div>
      )}
    </div>
  );
};

export default ZoneStatus;