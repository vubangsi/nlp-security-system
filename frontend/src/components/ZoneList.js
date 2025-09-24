import React, { useState, useEffect } from 'react';
import ZoneCard from './ZoneCard';
import ZoneHierarchy from './ZoneHierarchy';

const ZoneList = ({ 
  zones, 
  loading, 
  error, 
  onZoneArm, 
  onZoneDisarm, 
  onZoneEdit, 
  onZoneDelete,
  userRole = 'user',
  showHierarchy = false,
  viewMode = 'grid' // 'grid', 'list', 'hierarchy'
}) => {
  const [filteredZones, setFilteredZones] = useState(zones);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'armed', 'disarmed'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'status', 'lastModified'

  useEffect(() => {
    let filtered = [...(zones || [])];

    // Apply status filter
    if (filterStatus === 'armed') {
      filtered = filtered.filter(zone => zone.armed);
    } else if (filterStatus === 'disarmed') {
      filtered = filtered.filter(zone => !zone.armed);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(zone => 
        zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        zone.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        zone.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'status':
          if (a.armed === b.armed) return a.name.localeCompare(b.name);
          return a.armed ? -1 : 1;
        case 'lastModified':
          return new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredZones(filtered);
  }, [zones, filterStatus, searchTerm, sortBy]);

  if (loading) {
    return (
      <div className="zone-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading zones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="zone-list-error">
        <div className="error-icon">
          <span role="img" aria-label="error">⚠️</span>
        </div>
        <p>Error loading zones: {error}</p>
      </div>
    );
  }

  if (!zones || zones.length === 0) {
    return (
      <div className="zone-list-empty">
        <div className="empty-icon">
          <span role="img" aria-label="empty">📍</span>
        </div>
        <h3>No Zones Configured</h3>
        <p>Get started by creating your first security zone.</p>
      </div>
    );
  }

  const armedCount = zones.filter(zone => zone.armed).length;
  const disarmedCount = zones.filter(zone => !zone.armed).length;

  return (
    <div className="zone-list-container">
      {/* Zone List Header */}
      <div className="zone-list-header">
        <div className="zone-stats">
          <h2>Security Zones</h2>
          <div className="zone-counts">
            <span className="zone-count-item">
              Total: <strong>{zones.length}</strong>
            </span>
            <span className="zone-count-item armed">
              Armed: <strong>{armedCount}</strong>
            </span>
            <span className="zone-count-item disarmed">
              Disarmed: <strong>{disarmedCount}</strong>
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="zone-list-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search zones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              aria-label="Search zones"
            />
            <span className="search-icon" role="img" aria-label="search">🔍</span>
          </div>

          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
            aria-label="Filter by status"
          >
            <option value="all">All Zones</option>
            <option value="armed">Armed Only</option>
            <option value="disarmed">Disarmed Only</option>
          </select>

          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
            aria-label="Sort zones by"
          >
            <option value="name">Sort by Name</option>
            <option value="status">Sort by Status</option>
            <option value="lastModified">Sort by Last Modified</option>
          </select>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="view-mode-toggle">
        <button 
          className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => viewMode !== 'grid' && window.location.reload()} // Simple implementation
          aria-label="Grid view"
        >
          <span role="img" aria-label="grid">⊞</span>
          Grid
        </button>
        <button 
          className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => viewMode !== 'list' && window.location.reload()} // Simple implementation
          aria-label="List view"
        >
          <span role="img" aria-label="list">☰</span>
          List
        </button>
        {showHierarchy && (
          <button 
            className={`view-btn ${viewMode === 'hierarchy' ? 'active' : ''}`}
            onClick={() => viewMode !== 'hierarchy' && window.location.reload()} // Simple implementation
            aria-label="Hierarchy view"
          >
            <span role="img" aria-label="hierarchy">🌳</span>
            Hierarchy
          </button>
        )}
      </div>

      {/* Zone Content */}
      {viewMode === 'hierarchy' && showHierarchy ? (
        <ZoneHierarchy 
          zones={filteredZones}
          onZoneArm={onZoneArm}
          onZoneDisarm={onZoneDisarm}
          onZoneEdit={onZoneEdit}
          onZoneDelete={onZoneDelete}
          userRole={userRole}
        />
      ) : (
        <>
          {/* Results Info */}
          <div className="zone-list-info">
            <p>
              Showing {filteredZones.length} of {zones.length} zones
              {searchTerm && ` matching "${searchTerm}"`}
              {filterStatus !== 'all' && ` (${filterStatus} only)`}
            </p>
          </div>

          {/* Zone Grid/List */}
          <div className={`zone-list ${viewMode}`}>
            {filteredZones.length === 0 ? (
              <div className="no-results">
                <p>No zones match your current filters.</p>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('all');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              filteredZones.map((zone) => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  onArm={onZoneArm}
                  onDisarm={onZoneDisarm}
                  onEdit={onZoneEdit}
                  onDelete={onZoneDelete}
                  userRole={userRole}
                  showControls={true}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Quick Actions for Admin */}
      {userRole === 'admin' && zones.length > 0 && (
        <div className="zone-list-quick-actions">
          <h3>Quick Actions</h3>
          <div className="quick-action-buttons">
            <button 
              className="btn btn-arm-all"
              onClick={() => {
                filteredZones.filter(z => !z.armed).forEach(zone => {
                  onZoneArm(zone.id, 'away');
                });
              }}
              disabled={filteredZones.every(z => z.armed)}
            >
              <span role="img" aria-label="arm all">🔒</span>
              Arm All Disarmed
            </button>
            <button 
              className="btn btn-disarm-all"
              onClick={() => {
                filteredZones.filter(z => z.armed).forEach(zone => {
                  onZoneDisarm(zone.id);
                });
              }}
              disabled={filteredZones.every(z => !z.armed)}
            >
              <span role="img" aria-label="disarm all">🔓</span>
              Disarm All Armed
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZoneList;