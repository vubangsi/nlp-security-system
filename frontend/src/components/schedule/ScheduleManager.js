import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import scheduleService from '../../services/scheduleService';
import { apiService } from '../../services/apiService';
import ScheduleDashboard from './ScheduleDashboard';
import ScheduleList from './ScheduleList';
import ScheduleForm from './ScheduleForm';

const ScheduleManager = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [schedules, setSchedules] = useState([]);
  const [zones, setZones] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [upcomingSchedules, setUpcomingSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);
  
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole');

  // Fetch all data
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');

    try {
      const [schedulesRes, zonesRes, statisticsRes, upcomingRes] = await Promise.allSettled([
        scheduleService.getSchedules(),
        apiService.getZones().catch(() => ({ zones: [] })),
        scheduleService.getStatistics().catch(() => null),
        scheduleService.getUpcoming(1).catch(() => ({ schedules: [] }))
      ]);

      // Handle schedules
      if (schedulesRes.status === 'fulfilled') {
        setSchedules(schedulesRes.value.schedules || []);
      } else {
        console.error('Failed to fetch schedules:', schedulesRes.reason);
        setError('Failed to load schedules');
      }

      // Handle zones
      if (zonesRes.status === 'fulfilled') {
        setZones(zonesRes.value.zones || []);
      }

      // Handle statistics
      if (statisticsRes.status === 'fulfilled') {
        setStatistics(statisticsRes.value);
      }

      // Handle upcoming schedules
      if (upcomingRes.status === 'fulfilled') {
        setUpcomingSchedules(upcomingRes.value.schedules || []);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load schedule data');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Setup polling for real-time updates
  useEffect(() => {
    fetchData();

    // Set up polling every 5 seconds for real-time updates
    const interval = setInterval(() => {
      fetchData(false); // Don't show loading spinner for background updates
    }, 5000);

    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchData]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  // Handle schedule creation
  const handleCreateSchedule = async (scheduleData) => {
    try {
      setLoading(true);
      await scheduleService.createSchedule(scheduleData);
      setSuccess('Schedule created successfully');
      setShowForm(false);
      await fetchData(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create schedule');
      throw err; // Re-throw to let form handle it
    } finally {
      setLoading(false);
    }
  };

  // Handle schedule editing
  const handleEditSchedule = async (scheduleData) => {
    if (!editingSchedule) return;

    try {
      setLoading(true);
      await scheduleService.updateSchedule(editingSchedule.id, scheduleData);
      setSuccess('Schedule updated successfully');
      setShowForm(false);
      setEditingSchedule(null);
      await fetchData(false);
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update schedule');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Handle schedule deletion
  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await scheduleService.deleteSchedule(scheduleId);
      setSuccess('Schedule deleted successfully');
      await fetchData(false);
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  };

  // Handle toggle schedule active/inactive
  const handleToggleActive = async (scheduleId, active) => {
    try {
      await scheduleService.toggleSchedule(scheduleId, active);
      setSuccess(`Schedule ${active ? 'activated' : 'paused'} successfully`);
      await fetchData(false);
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || `Failed to ${active ? 'activate' : 'pause'} schedule`);
    }
  };

  // Handle manual execution
  const handleExecuteNow = async (scheduleId) => {
    try {
      await scheduleService.executeNow(scheduleId);
      setSuccess('Schedule executed successfully');
      await fetchData(false);
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to execute schedule');
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action, scheduleIds) => {
    if (!window.confirm(`Are you sure you want to ${action} ${scheduleIds.length} schedule(s)?`)) {
      return;
    }

    try {
      setLoading(true);
      await scheduleService.bulkOperations(action, { ids: scheduleIds });
      setSuccess(`Bulk ${action} completed successfully`);
      await fetchData(false);
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || `Failed to perform bulk ${action}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle quick actions from dashboard
  const handleQuickAction = async (action) => {
    switch (action) {
      case 'create':
        setEditingSchedule(null);
        setShowForm(true);
        break;
      case 'activateAll':
        const pausedSchedules = schedules.filter(s => s.status === 'PAUSED').map(s => s.id);
        if (pausedSchedules.length > 0) {
          await handleBulkAction('activate', pausedSchedules);
        } else {
          setError('No paused schedules to activate');
        }
        break;
      case 'pauseAll':
        const activeSchedules = schedules.filter(s => s.status === 'ACTIVE').map(s => s.id);
        if (activeSchedules.length > 0) {
          await handleBulkAction('pause', activeSchedules);
        } else {
          setError('No active schedules to pause');
        }
        break;
      case 'viewLogs':
        // Navigate to logs or show logs modal
        setActiveTab('list'); // For now, switch to list view
        break;
      default:
        break;
    }
  };

  // Handle edit button click
  const handleEditClick = (schedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  // Handle form cancel
  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSchedule(null);
  };

  // Handle form submission
  const handleFormSubmit = async (scheduleData) => {
    if (editingSchedule) {
      await handleEditSchedule(scheduleData);
    } else {
      await handleCreateSchedule(scheduleData);
    }
  };

  const containerStyle = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px'
  };

  const headerStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    padding: '20px 30px',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    marginBottom: '30px',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  };

  const navStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px'
  };

  const titleStyle = {
    color: '#2c3e50',
    fontSize: '28px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  };

  const navLinksStyle = {
    display: 'flex',
    gap: '15px',
    alignItems: 'center'
  };

  const tabsStyle = {
    display: 'flex',
    gap: '5px',
    background: 'rgba(247, 250, 252, 0.8)',
    padding: '8px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  };

  const getTabButtonStyle = (tabName) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    border: 'none',
    borderRadius: '8px',
    background: activeTab === tabName 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
      : 'transparent',
    color: activeTab === tabName ? 'white' : '#718096',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontSize: '14px',
    fontWeight: '500'
  });

  const createButtonStyle = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const alertStyle = {
    padding: '16px 20px',
    borderRadius: '12px',
    marginBottom: '20px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  };

  const errorAlertStyle = {
    ...alertStyle,
    background: 'rgba(254, 226, 226, 0.9)',
    color: '#c53030',
    border: '1px solid rgba(254, 202, 202, 0.8)'
  };

  const successAlertStyle = {
    ...alertStyle,
    background: 'rgba(240, 253, 244, 0.9)',
    color: '#38a169',
    border: '1px solid rgba(154, 230, 180, 0.8)'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={navStyle}>
          <h1 style={titleStyle}>
            ⏰ Schedule Manager
          </h1>

          <div style={navLinksStyle}>
            <div style={tabsStyle}>
              <button
                style={getTabButtonStyle('dashboard')}
                onClick={() => setActiveTab('dashboard')}
                onMouseEnter={(e) => {
                  if (activeTab !== 'dashboard') {
                    e.target.style.background = 'rgba(102, 126, 234, 0.1)';
                    e.target.style.color = '#667eea';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'dashboard') {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#718096';
                  }
                }}
              >
                📊 Dashboard
              </button>
              
              <button
                style={getTabButtonStyle('list')}
                onClick={() => setActiveTab('list')}
                onMouseEnter={(e) => {
                  if (activeTab !== 'list') {
                    e.target.style.background = 'rgba(102, 126, 234, 0.1)';
                    e.target.style.color = '#667eea';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'list') {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#718096';
                  }
                }}
              >
                📋 All Schedules
              </button>
            </div>

            <button
              style={createButtonStyle}
              onClick={() => {
                setEditingSchedule(null);
                setShowForm(true);
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
              }}
            >
              ➕ New Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div style={errorAlertStyle}>
          <span>❌</span>
          {error}
          <button
            onClick={() => setError('')}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#c53030',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <div style={successAlertStyle}>
          <span>✅</span>
          {success}
          <button
            onClick={() => setSuccess('')}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#38a169',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <ScheduleForm
              schedule={editingSchedule}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              loading={loading}
              zones={zones}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ 
        animation: 'fadeIn 0.3s ease-in-out' 
      }}>
        {activeTab === 'dashboard' && (
          <ScheduleDashboard
            schedules={schedules}
            statistics={statistics}
            upcomingSchedules={upcomingSchedules}
            onQuickAction={handleQuickAction}
            loading={loading}
          />
        )}

        {activeTab === 'list' && (
          <ScheduleList
            schedules={schedules}
            loading={loading}
            error={error}
            onEdit={handleEditClick}
            onDelete={handleDeleteSchedule}
            onToggleActive={handleToggleActive}
            onExecuteNow={handleExecuteNow}
            onBulkAction={handleBulkAction}
            userRole={userRole}
          />
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ScheduleManager;