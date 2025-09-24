import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import ZoneList from './ZoneList';

const ZoneManagement = ({ userRole }) => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    parentZoneId: '',
    defaultMode: 'home',
    sensors: []
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    setLoading(true);
    try {
      const response = await apiService.getZones();
      setZones(response.zones || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load zones');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZone = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setFormLoading(true);
    try {
      await apiService.createZone({
        ...formData,
        parentZoneId: formData.parentZoneId || null
      });
      
      resetForm();
      setShowCreateForm(false);
      await loadZones();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create zone');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateZone = async (e) => {
    e.preventDefault();
    if (!editingZone || !formData.name.trim()) return;

    setFormLoading(true);
    try {
      await apiService.updateZone(editingZone.id, {
        ...formData,
        parentZoneId: formData.parentZoneId || null
      });
      
      resetForm();
      setEditingZone(null);
      await loadZones();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update zone');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteZone = async (zoneId) => {
    try {
      await apiService.deleteZone(zoneId);
      await loadZones();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete zone');
    }
  };

  const handleZoneArm = async (zoneId, mode) => {
    try {
      await apiService.armZone(zoneId, mode);
      await loadZones();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to arm zone');
    }
  };

  const handleZoneDisarm = async (zoneId) => {
    try {
      await apiService.disarmZone(zoneId);
      await loadZones();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disarm zone');
    }
  };

  const handleZoneEdit = (zone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name || '',
      description: zone.description || '',
      location: zone.location || '',
      parentZoneId: zone.parentZoneId || '',
      defaultMode: zone.defaultMode || 'home',
      sensors: zone.sensors || []
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      location: '',
      parentZoneId: '',
      defaultMode: 'home',
      sensors: []
    });
    setEditingZone(null);
    setError('');
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Get available parent zones (excluding current zone and its descendants)
  const getAvailableParentZones = () => {
    if (!editingZone) return zones;
    
    const excludeIds = new Set([editingZone.id]);
    
    // Add descendant zones to exclude list
    const addDescendants = (zoneId) => {
      zones.forEach(zone => {
        if (zone.parentZoneId === zoneId && !excludeIds.has(zone.id)) {
          excludeIds.add(zone.id);
          addDescendants(zone.id);
        }
      });
    };
    
    addDescendants(editingZone.id);
    
    return zones.filter(zone => !excludeIds.has(zone.id));
  };

  if (userRole !== 'admin') {
    return (
      <div className="zone-management-unauthorized">
        <div className="unauthorized-icon">
          <span role="img" aria-label="unauthorized">🔒</span>
        </div>
        <h3>Access Restricted</h3>
        <p>You need administrator privileges to manage zones.</p>
      </div>
    );
  }

  return (
    <div className="zone-management-container">
      {/* Header */}
      <div className="zone-management-header">
        <div className="header-content">
          <h2>Zone Management</h2>
          <p>Create, edit, and organize your security zones</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowCreateForm(true);
          }}
        >
          <span role="img" aria-label="add">➕</span>
          Create Zone
        </button>
      </div>

      {error && (
        <div className="error">
          <span role="img" aria-label="error">❌</span>
          {error}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingZone ? 'Edit Zone' : 'Create New Zone'}</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={editingZone ? handleUpdateZone : handleCreateZone}>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="zoneName">Zone Name *</label>
                  <input
                    type="text"
                    id="zoneName"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Living Room, Front Door"
                    required
                    maxLength={100}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="zoneLocation">Location</label>
                  <input
                    type="text"
                    id="zoneLocation"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="e.g., First Floor, Building A"
                    maxLength={200}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="parentZone">Parent Zone</label>
                  <select
                    id="parentZone"
                    value={formData.parentZoneId}
                    onChange={(e) => handleInputChange('parentZoneId', e.target.value)}
                  >
                    <option value="">No Parent (Root Zone)</option>
                    {getAvailableParentZones().map(zone => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="defaultMode">Default Arm Mode</label>
                  <select
                    id="defaultMode"
                    value={formData.defaultMode}
                    onChange={(e) => handleInputChange('defaultMode', e.target.value)}
                  >
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                    <option value="night">Night</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="zoneDescription">Description</label>
                <textarea
                  id="zoneDescription"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe this zone and its purpose..."
                  rows="3"
                  maxLength={500}
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={formLoading || !formData.name.trim()}
                >
                  {formLoading ? (
                    <>
                      <span className="loading-spinner-sm"></span>
                      {editingZone ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <span role="img" aria-label={editingZone ? 'update' : 'create'}>
                        {editingZone ? '💾' : '✅'}
                      </span>
                      {editingZone ? 'Update Zone' : 'Create Zone'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zone Statistics */}
      <div className="zone-stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <span role="img" aria-label="total zones">🏠</span>
          </div>
          <div className="stat-content">
            <h3>Total Zones</h3>
            <div className="stat-value">{zones.length}</div>
          </div>
        </div>

        <div className="stat-card armed">
          <div className="stat-icon">
            <span role="img" aria-label="armed zones">🔒</span>
          </div>
          <div className="stat-content">
            <h3>Armed Zones</h3>
            <div className="stat-value">{zones.filter(z => z.armed).length}</div>
          </div>
        </div>

        <div className="stat-card disarmed">
          <div className="stat-icon">
            <span role="img" aria-label="disarmed zones">🔓</span>
          </div>
          <div className="stat-content">
            <h3>Disarmed Zones</h3>
            <div className="stat-value">{zones.filter(z => !z.armed).length}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <span role="img" aria-label="root zones">🌳</span>
          </div>
          <div className="stat-content">
            <h3>Root Zones</h3>
            <div className="stat-value">{zones.filter(z => !z.parentZoneId).length}</div>
          </div>
        </div>
      </div>

      {/* Zone List */}
      <div className="zone-management-content">
        <ZoneList
          zones={zones}
          loading={loading}
          error={error}
          onZoneArm={handleZoneArm}
          onZoneDisarm={handleZoneDisarm}
          onZoneEdit={handleZoneEdit}
          onZoneDelete={handleDeleteZone}
          userRole={userRole}
          showHierarchy={true}
          viewMode="grid"
        />
      </div>

      {/* Import/Export Section */}
      <div className="zone-management-tools">
        <div className="tools-section">
          <h3>Zone Management Tools</h3>
          <div className="tool-buttons">
            <button className="btn btn-secondary">
              <span role="img" aria-label="export">📤</span>
              Export Zones
            </button>
            <button className="btn btn-secondary">
              <span role="img" aria-label="import">📥</span>
              Import Zones
            </button>
            <button 
              className="btn btn-secondary"
              onClick={loadZones}
              disabled={loading}
            >
              <span role="img" aria-label="refresh">🔄</span>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneManagement;