import React, { useState, useMemo } from 'react';
import ScheduleCard from './ScheduleCard';
import ScheduleStatus from './ScheduleStatus';

const ScheduleList = ({ 
  schedules = [], 
  loading = false, 
  error = null,
  onEdit,
  onDelete,
  onToggleActive,
  onExecuteNow,
  onBulkAction,
  userRole,
  compact = false
}) => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('nextExecution');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterAction, setFilterAction] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedules, setSelectedSchedules] = useState(new Set());

  // Filter and sort schedules
  const filteredAndSortedSchedules = useMemo(() => {
    let filtered = schedules.filter(schedule => {
      // Status filter
      if (filterStatus !== 'ALL' && schedule.status !== filterStatus) {
        return false;
      }
      
      // Action filter
      if (filterAction !== 'ALL' && schedule.actionType !== filterAction) {
        return false;
      }
      
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          schedule.name.toLowerCase().includes(searchLower) ||
          (schedule.description && schedule.description.toLowerCase().includes(searchLower)) ||
          schedule.actionType.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });

    // Sort schedules
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'actionType':
          aValue = a.actionType;
          bValue = b.actionType;
          break;
        case 'nextExecution':
          aValue = a.nextExecution ? new Date(a.nextExecution) : new Date('2099-12-31');
          bValue = b.nextExecution ? new Date(b.nextExecution) : new Date('2099-12-31');
          break;
        case 'lastExecution':
          aValue = a.lastExecution ? new Date(a.lastExecution) : new Date('1970-01-01');
          bValue = b.lastExecution ? new Date(b.lastExecution) : new Date('1970-01-01');
          break;
        case 'created':
          aValue = new Date(a.createdAt || a.created || '1970-01-01');
          bValue = new Date(b.createdAt || b.created || '1970-01-01');
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [schedules, filterStatus, filterAction, searchTerm, sortBy, sortOrder]);

  // Handle bulk selection
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedSchedules(new Set(filteredAndSortedSchedules.map(s => s.id)));
    } else {
      setSelectedSchedules(new Set());
    }
  };

  const handleSelectSchedule = (scheduleId, checked) => {
    const newSelected = new Set(selectedSchedules);
    if (checked) {
      newSelected.add(scheduleId);
    } else {
      newSelected.delete(scheduleId);
    }
    setSelectedSchedules(newSelected);
  };

  const handleBulkAction = async (action) => {
    if (selectedSchedules.size === 0) return;
    
    const scheduleIds = Array.from(selectedSchedules);
    await onBulkAction(action, scheduleIds);
    setSelectedSchedules(new Set());
  };

  // Get schedule statistics
  const getStats = () => {
    const total = schedules.length;
    const active = schedules.filter(s => s.status === 'ACTIVE').length;
    const paused = schedules.filter(s => s.status === 'PAUSED').length;
    const pending = schedules.filter(s => s.status === 'PENDING').length;
    
    return { total, active, paused, pending };
  };

  const stats = getStats();

  const containerStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    padding: compact ? '20px' : '30px'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: compact ? '20px' : '30px',
    flexWrap: 'wrap',
    gap: '20px'
  };

  const statsStyle = {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    marginBottom: '15px'
  };

  const statItemStyle = {
    fontSize: '14px',
    color: '#718096',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  };

  const controlsStyle = {
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
    flexWrap: 'wrap'
  };

  const searchStyle = {
    position: 'relative'
  };

  const searchInputStyle = {
    padding: '10px 40px 10px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '14px',
    minWidth: '200px',
    transition: 'all 0.3s ease'
  };

  const selectStyle = {
    padding: '10px 14px',
    border: '2px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '14px',
    background: 'white',
    cursor: 'pointer'
  };

  const viewToggleStyle = {
    display: 'flex',
    gap: '5px',
    background: 'rgba(247, 250, 252, 0.8)',
    padding: '4px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  };

  const getViewButtonStyle = (mode) => ({
    padding: '6px 12px',
    border: 'none',
    borderRadius: '6px',
    background: viewMode === mode ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
    color: viewMode === mode ? 'white' : '#4a5568',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s ease'
  });

  const bulkActionsStyle = {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    padding: '15px 20px',
    background: 'rgba(102, 126, 234, 0.05)',
    borderRadius: '10px',
    border: '1px solid rgba(102, 126, 234, 0.1)',
    marginBottom: '20px'
  };

  const bulkButtonStyle = {
    padding: '6px 12px',
    border: '1px solid #667eea',
    borderRadius: '6px',
    background: 'white',
    color: '#667eea',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  const listStyle = {
    display: viewMode === 'grid' ? 'grid' : 'block',
    gridTemplateColumns: compact 
      ? 'repeat(auto-fit, minmax(300px, 1fr))' 
      : 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: compact ? '15px' : '20px'
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <h3 style={{ marginBottom: '10px', color: '#4a5568' }}>Loading schedules...</h3>
          <p>Please wait while we fetch your scheduled tasks</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px', 
          background: 'rgba(254, 226, 226, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(254, 202, 202, 0.8)',
          color: '#c53030'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h3 style={{ marginBottom: '10px', color: '#c53030' }}>Error loading schedules</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ 
            color: '#2d3748', 
            marginBottom: '10px', 
            fontSize: compact ? '20px' : '28px', 
            fontWeight: '700' 
          }}>
            Scheduled Tasks
          </h2>
          
          <div style={statsStyle}>
            <div style={statItemStyle}>
              <span>📊</span> Total: <strong>{stats.total}</strong>
            </div>
            <div style={{ ...statItemStyle, color: '#38a169' }}>
              <span>✅</span> Active: <strong>{stats.active}</strong>
            </div>
            <div style={{ ...statItemStyle, color: '#d69e2e' }}>
              <span>⏸</span> Paused: <strong>{stats.paused}</strong>
            </div>
            <div style={{ ...statItemStyle, color: '#718096' }}>
              <span>⏳</span> Pending: <strong>{stats.pending}</strong>
            </div>
          </div>
        </div>

        <div style={controlsStyle}>
          {/* Search */}
          <div style={searchStyle}>
            <input
              type="text"
              placeholder="Search schedules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={searchInputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
              }}
            />
            <span style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#a0aec0',
              fontSize: '14px'
            }}>
              🔍
            </span>
          </div>

          {/* Filters */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={selectStyle}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={selectStyle}
          >
            <option value="ALL">All Actions</option>
            <option value="ARM">Arm System</option>
            <option value="DISARM">Disarm System</option>
            <option value="ARM_ZONE">Arm Zone</option>
            <option value="DISARM_ZONE">Disarm Zone</option>
          </select>

          {/* Sort */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split('-');
              setSortBy(by);
              setSortOrder(order);
            }}
            style={selectStyle}
          >
            <option value="nextExecution-asc">Next Execution ↑</option>
            <option value="nextExecution-desc">Next Execution ↓</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="status-asc">Status ↑</option>
            <option value="status-desc">Status ↓</option>
            <option value="created-desc">Newest First</option>
            <option value="created-asc">Oldest First</option>
          </select>

          {/* View Toggle */}
          {!compact && (
            <div style={viewToggleStyle}>
              <button
                style={getViewButtonStyle('grid')}
                onClick={() => setViewMode('grid')}
              >
                ⊞ Grid
              </button>
              <button
                style={getViewButtonStyle('list')}
                onClick={() => setViewMode('list')}
              >
                ☰ List
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedSchedules.size > 0 && (
        <div style={bulkActionsStyle}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#4a5568' }}>
            {selectedSchedules.size} schedule{selectedSchedules.size !== 1 ? 's' : ''} selected
          </span>
          
          <button
            style={bulkButtonStyle}
            onClick={() => handleBulkAction('activate')}
            onMouseEnter={(e) => {
              e.target.style.background = '#667eea';
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'white';
              e.target.style.color = '#667eea';
            }}
          >
            ▶️ Activate
          </button>
          
          <button
            style={bulkButtonStyle}
            onClick={() => handleBulkAction('pause')}
            onMouseEnter={(e) => {
              e.target.style.background = '#667eea';
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'white';
              e.target.style.color = '#667eea';
            }}
          >
            ⏸️ Pause
          </button>
          
          {userRole === 'admin' && (
            <button
              style={{ ...bulkButtonStyle, borderColor: '#e53e3e', color: '#e53e3e' }}
              onClick={() => handleBulkAction('delete')}
              onMouseEnter={(e) => {
                e.target.style.background = '#e53e3e';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'white';
                e.target.style.color = '#e53e3e';
              }}
            >
              🗑️ Delete
            </button>
          )}
          
          <button
            style={{ ...bulkButtonStyle, borderColor: '#718096', color: '#718096' }}
            onClick={() => setSelectedSchedules(new Set())}
            onMouseEnter={(e) => {
              e.target.style.background = '#718096';
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'white';
              e.target.style.color = '#718096';
            }}
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Select All */}
      {filteredAndSortedSchedules.length > 0 && (
        <div style={{ marginBottom: '15px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '14px', 
            color: '#4a5568',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={selectedSchedules.size === filteredAndSortedSchedules.length && filteredAndSortedSchedules.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#667eea' }}
            />
            Select all {filteredAndSortedSchedules.length} schedule{filteredAndSortedSchedules.length !== 1 ? 's' : ''}
          </label>
        </div>
      )}

      {/* Schedule List */}
      {filteredAndSortedSchedules.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px', 
          color: '#718096' 
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📅</div>
          <h3 style={{ marginBottom: '10px', color: '#4a5568' }}>
            {searchTerm || filterStatus !== 'ALL' || filterAction !== 'ALL' 
              ? 'No matching schedules' 
              : 'No schedules yet'
            }
          </h3>
          <p>
            {searchTerm || filterStatus !== 'ALL' || filterAction !== 'ALL'
              ? 'Try adjusting your search or filters'
              : 'Create your first scheduled task to get started'
            }
          </p>
        </div>
      ) : (
        <div style={listStyle}>
          {filteredAndSortedSchedules.map((schedule) => (
            <div key={schedule.id} style={{ position: 'relative' }}>
              {/* Selection Checkbox */}
              <div style={{
                position: 'absolute',
                top: '15px',
                left: '15px',
                zIndex: 10
              }}>
                <input
                  type="checkbox"
                  checked={selectedSchedules.has(schedule.id)}
                  onChange={(e) => handleSelectSchedule(schedule.id, e.target.checked)}
                  style={{ 
                    width: '16px', 
                    height: '16px', 
                    accentColor: '#667eea',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Schedule Card */}
              <div style={{ marginLeft: '30px' }}>
                <ScheduleCard
                  schedule={schedule}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleActive={onToggleActive}
                  onExecuteNow={onExecuteNow}
                  userRole={userRole}
                  compact={compact}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Summary */}
      {filteredAndSortedSchedules.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px',
          textAlign: 'center', 
          fontSize: '14px', 
          color: '#718096',
          background: 'rgba(247, 250, 252, 0.5)',
          borderRadius: '10px',
          border: '1px solid rgba(226, 232, 240, 0.5)'
        }}>
          Showing {filteredAndSortedSchedules.length} of {schedules.length} schedule{schedules.length !== 1 ? 's' : ''}
          {(searchTerm || filterStatus !== 'ALL' || filterAction !== 'ALL') && (
            <button
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                marginLeft: '10px',
                textDecoration: 'underline'
              }}
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('ALL');
                setFilterAction('ALL');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduleList;