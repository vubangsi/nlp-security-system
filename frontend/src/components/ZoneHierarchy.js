import React, { useState, useEffect } from 'react';

const ZoneHierarchy = ({ 
  zones, 
  onZoneArm, 
  onZoneDisarm, 
  onZoneEdit, 
  onZoneDelete, 
  userRole = 'user' 
}) => {
  const [hierarchyTree, setHierarchyTree] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Build hierarchy tree structure
  useEffect(() => {
    if (!zones || zones.length === 0) {
      setHierarchyTree([]);
      return;
    }

    // Create a map for quick lookup
    const zoneMap = new Map();
    zones.forEach(zone => {
      zoneMap.set(zone.id, { ...zone, children: [] });
    });

    // Build the tree structure
    const roots = [];
    zones.forEach(zone => {
      const zoneNode = zoneMap.get(zone.id);
      if (zone.parentZoneId && zoneMap.has(zone.parentZoneId)) {
        // Add to parent's children
        zoneMap.get(zone.parentZoneId).children.push(zoneNode);
      } else {
        // Root level zone
        roots.push(zoneNode);
      }
    });

    setHierarchyTree(roots);
    
    // Auto-expand first level by default
    const firstLevelIds = new Set(roots.map(zone => zone.id));
    setExpandedNodes(firstLevelIds);
  }, [zones]);

  const toggleExpanded = (zoneId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(zoneId)) {
      newExpanded.delete(zoneId);
    } else {
      newExpanded.add(zoneId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleZoneAction = async (zoneId, action, mode = 'home') => {
    try {
      if (action === 'arm') {
        await onZoneArm(zoneId, mode);
      } else if (action === 'disarm') {
        await onZoneDisarm(zoneId);
      }
    } catch (error) {
      console.error(`Failed to ${action} zone:`, error);
    }
  };

  const ZoneNode = ({ zone, level = 0 }) => {
    const hasChildren = zone.children && zone.children.length > 0;
    const isExpanded = expandedNodes.has(zone.id);
    const isArmed = zone.armed;

    return (
      <div className="zone-hierarchy-node" style={{ marginLeft: `${level * 20}px` }}>
        <div className={`zone-node-content ${isArmed ? 'armed' : 'disarmed'}`}>
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button 
              className="expand-button"
              onClick={() => toggleExpanded(zone.id)}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${zone.name}`}
              aria-expanded={isExpanded}
            >
              <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                ▶
              </span>
            </button>
          )}

          {/* Zone Status Icon */}
          <div className="zone-status-icon">
            <span role="img" aria-label={isArmed ? 'armed' : 'disarmed'}>
              {isArmed ? '🔒' : '🔓'}
            </span>
          </div>

          {/* Zone Information */}
          <div className="zone-node-info">
            <div className="zone-node-header">
              <h4 className="zone-node-name">{zone.name}</h4>
              <span className={`zone-status-badge ${isArmed ? 'armed' : 'disarmed'}`}>
                {isArmed ? `ARMED (${zone.mode?.toUpperCase() || 'HOME'})` : 'DISARMED'}
              </span>
            </div>

            {zone.description && (
              <p className="zone-node-description">{zone.description}</p>
            )}

            {zone.location && (
              <p className="zone-node-location">
                <span role="img" aria-label="location">📍</span>
                {zone.location}
              </p>
            )}

            <div className="zone-node-stats">
              {zone.sensors && (
                <span className="zone-stat">
                  <span role="img" aria-label="sensors">📡</span>
                  {zone.sensors.length} sensors
                </span>
              )}
              {hasChildren && (
                <span className="zone-stat">
                  <span role="img" aria-label="child zones">🏠</span>
                  {zone.children.length} child zones
                </span>
              )}
              {zone.lastModified && (
                <span className="zone-stat timestamp">
                  Updated: {new Date(zone.lastModified).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Zone Controls */}
          <div className="zone-node-controls">
            {!isArmed ? (
              <div className="arm-controls-compact">
                <select 
                  className="mode-select-sm"
                  defaultValue="home"
                  onChange={(e) => handleZoneAction(zone.id, 'arm', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Choose mode...</option>
                  <option value="home">Arm Home</option>
                  <option value="away">Arm Away</option>
                  <option value="night">Arm Night</option>
                </select>
              </div>
            ) : (
              <button 
                className="btn btn-sm btn-disarm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoneAction(zone.id, 'disarm');
                }}
                aria-label={`Disarm ${zone.name}`}
              >
                <span role="img" aria-label="disarm">🔓</span>
                Disarm
              </button>
            )}

            {/* Admin Controls */}
            {userRole === 'admin' && (
              <div className="admin-controls-compact">
                <button 
                  className="btn-icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoneEdit && onZoneEdit(zone);
                  }}
                  aria-label={`Edit ${zone.name}`}
                  title="Edit Zone"
                >
                  <span role="img" aria-label="edit">✏️</span>
                </button>
                <button 
                  className="btn-icon-sm btn-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete zone "${zone.name}" and all its child zones?`)) {
                      onZoneDelete && onZoneDelete(zone.id);
                    }
                  }}
                  aria-label={`Delete ${zone.name}`}
                  title="Delete Zone"
                >
                  <span role="img" aria-label="delete">🗑️</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Child Zones */}
        {hasChildren && isExpanded && (
          <div className="zone-children">
            {zone.children.map((childZone) => (
              <ZoneNode 
                key={childZone.id} 
                zone={childZone} 
                level={level + 1} 
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!zones || zones.length === 0) {
    return (
      <div className="zone-hierarchy-empty">
        <div className="empty-icon">
          <span role="img" aria-label="empty">🌳</span>
        </div>
        <h3>No Zone Hierarchy</h3>
        <p>Create zones and organize them in a hierarchy to see the tree view.</p>
      </div>
    );
  }

  if (hierarchyTree.length === 0) {
    return (
      <div className="zone-hierarchy-loading">
        <div className="loading-spinner"></div>
        <p>Building zone hierarchy...</p>
      </div>
    );
  }

  return (
    <div className="zone-hierarchy-container">
      <div className="zone-hierarchy-header">
        <h3>Zone Hierarchy</h3>
        <div className="hierarchy-controls">
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setExpandedNodes(new Set(zones.map(z => z.id)))}
          >
            Expand All
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setExpandedNodes(new Set())}
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="zone-hierarchy-tree" role="tree">
        {hierarchyTree.map((rootZone) => (
          <ZoneNode 
            key={rootZone.id} 
            zone={rootZone} 
            level={0} 
          />
        ))}
      </div>

      <div className="zone-hierarchy-legend">
        <h4>Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span role="img" aria-label="armed">🔒</span>
            Armed Zone
          </div>
          <div className="legend-item">
            <span role="img" aria-label="disarmed">🔓</span>
            Disarmed Zone
          </div>
          <div className="legend-item">
            <span role="img" aria-label="sensors">📡</span>
            Sensors
          </div>
          <div className="legend-item">
            <span role="img" aria-label="child zones">🏠</span>
            Child Zones
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneHierarchy;