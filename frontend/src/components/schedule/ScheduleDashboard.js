import React, { useState, useEffect } from 'react';
import ScheduleStatus from './ScheduleStatus';

const ScheduleDashboard = ({ 
  schedules = [], 
  statistics = null,
  upcomingSchedules = [],
  onQuickAction,
  loading = false 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getTimeUntilExecution = (executionTime) => {
    const now = new Date();
    const execution = new Date(executionTime);
    const diffMs = execution.getTime() - now.getTime();
    
    if (diffMs < 0) return { text: 'Overdue', color: '#e53e3e', urgent: true };
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 60) {
      return { 
        text: `${diffMinutes}m`, 
        color: diffMinutes <= 15 ? '#e53e3e' : diffMinutes <= 60 ? '#d69e2e' : '#667eea',
        urgent: diffMinutes <= 15
      };
    } else if (diffHours < 24) {
      return { 
        text: `${diffHours}h ${diffMinutes % 60}m`, 
        color: diffHours <= 2 ? '#d69e2e' : '#667eea',
        urgent: diffHours <= 2
      };
    } else {
      return { 
        text: `${diffDays}d ${diffHours % 24}h`, 
        color: '#667eea',
        urgent: false
      };
    }
  };

  const getScheduleStats = () => {
    if (statistics) return statistics;
    
    // Calculate from schedules if statistics not provided
    return {
      total: schedules.length,
      active: schedules.filter(s => s.status === 'ACTIVE').length,
      paused: schedules.filter(s => s.status === 'PAUSED').length,
      pending: schedules.filter(s => s.status === 'PENDING').length,
      completed: schedules.filter(s => s.status === 'COMPLETED').length,
      todayExecutions: schedules.filter(s => {
        if (!s.lastExecution) return false;
        const lastExec = new Date(s.lastExecution);
        const today = new Date();
        return lastExec.toDateString() === today.toDateString();
      }).length,
      successRate: schedules.length > 0 
        ? Math.round((schedules.filter(s => s.successCount > 0).length / schedules.length) * 100)
        : 0
    };
  };

  const stats = getScheduleStats();

  const containerStyle = {
    display: 'grid',
    gap: '25px',
    marginBottom: '30px'
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    transition: 'all 0.3s ease'
  };

  const cardHeaderStyle = {
    padding: '20px 25px 15px',
    borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
    background: 'rgba(247, 250, 252, 0.5)'
  };

  const cardBodyStyle = {
    padding: '25px'
  };

  const statsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '25px'
  };

  const statCardStyle = {
    ...cardStyle,
    textAlign: 'center'
  };

  const statIconStyle = {
    fontSize: '32px',
    marginBottom: '15px',
    display: 'block'
  };

  const statValueStyle = {
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '8px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  };

  const statLabelStyle = {
    fontSize: '14px',
    color: '#4a5568',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '600'
  };

  const upcomingListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  };

  const upcomingItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '15px',
    background: 'rgba(247, 250, 252, 0.8)',
    borderRadius: '12px',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    transition: 'all 0.2s ease'
  };

  const urgentItemStyle = {
    ...upcomingItemStyle,
    background: 'rgba(229, 62, 62, 0.05)',
    border: '1px solid rgba(229, 62, 62, 0.2)',
    animation: 'pulse 2s infinite'
  };

  const timeDisplayStyle = {
    minWidth: '80px',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: '14px',
    padding: '6px 12px',
    borderRadius: '8px',
    background: 'white',
    border: '1px solid rgba(226, 232, 240, 0.8)'
  };

  const scheduleInfoStyle = {
    flex: 1
  };

  const scheduleNameStyle = {
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '4px',
    fontSize: '16px'
  };

  const scheduleDetailsStyle = {
    fontSize: '13px',
    color: '#718096'
  };

  const quickActionsStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px'
  };

  const actionButtonStyle = {
    padding: '15px 20px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    textAlign: 'center'
  };

  const primaryActionStyle = {
    ...actionButtonStyle,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
  };

  const secondaryActionStyle = {
    ...actionButtonStyle,
    background: 'rgba(247, 250, 252, 0.8)',
    color: '#4a5568',
    border: '1px solid #e2e8f0'
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <h3 style={{ marginBottom: '10px', color: '#4a5568' }}>Loading dashboard...</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Statistics Overview */}
      <div style={statsGridStyle}>
        <div style={statCardStyle}>
          <div style={{ ...cardBodyStyle, padding: '30px 20px' }}>
            <span style={{ ...statIconStyle, color: '#667eea' }}>📊</span>
            <div style={statValueStyle}>{stats.total}</div>
            <div style={statLabelStyle}>Total Schedules</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={{ ...cardBodyStyle, padding: '30px 20px' }}>
            <span style={{ ...statIconStyle, color: '#38a169' }}>✅</span>
            <div style={{ ...statValueStyle, color: '#38a169' }}>{stats.active}</div>
            <div style={statLabelStyle}>Active</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={{ ...cardBodyStyle, padding: '30px 20px' }}>
            <span style={{ ...statIconStyle, color: '#d69e2e' }}>⏸</span>
            <div style={{ ...statValueStyle, color: '#d69e2e' }}>{stats.paused}</div>
            <div style={statLabelStyle}>Paused</div>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={{ ...cardBodyStyle, padding: '30px 20px' }}>
            <span style={{ ...statIconStyle, color: '#667eea' }}>🎯</span>
            <div style={{ ...statValueStyle, color: '#667eea' }}>{stats.successRate}%</div>
            <div style={statLabelStyle}>Success Rate</div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '25px'
      }}>
        {/* Upcoming Executions */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h3 style={{ 
              margin: 0, 
              color: '#2d3748', 
              fontSize: '20px', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              ⏰ Upcoming Executions
              <span style={{ 
                fontSize: '12px', 
                color: '#718096', 
                fontWeight: '500',
                background: 'rgba(102, 126, 234, 0.1)',
                padding: '4px 8px',
                borderRadius: '8px'
              }}>
                Next 24h
              </span>
            </h3>
          </div>
          <div style={cardBodyStyle}>
            {upcomingSchedules.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#718096', padding: '20px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>📅</div>
                <p>No upcoming executions in the next 24 hours</p>
              </div>
            ) : (
              <div style={upcomingListStyle}>
                {upcomingSchedules.slice(0, 5).map((schedule, index) => {
                  const timeInfo = getTimeUntilExecution(schedule.nextExecution);
                  
                  return (
                    <div 
                      key={schedule.id} 
                      style={timeInfo.urgent ? urgentItemStyle : upcomingItemStyle}
                    >
                      <div style={{
                        ...timeDisplayStyle,
                        color: timeInfo.color,
                        borderColor: timeInfo.color + '40'
                      }}>
                        {timeInfo.text}
                      </div>
                      
                      <div style={scheduleInfoStyle}>
                        <div style={scheduleNameStyle}>{schedule.name}</div>
                        <div style={scheduleDetailsStyle}>
                          {schedule.actionType === 'ARM' && '🔒 ARM'}
                          {schedule.actionType === 'DISARM' && '🔓 DISARM'}
                          {schedule.actionType === 'ARM_ZONE' && '🏠 ARM ZONE'}
                          {schedule.actionType === 'DISARM_ZONE' && '🏠 DISARM ZONE'}
                          {schedule.actionDetails?.mode && ` (${schedule.actionDetails.mode.toUpperCase()})`}
                          <span style={{ margin: '0 8px', opacity: 0.5 }}>•</span>
                          {new Date(schedule.nextExecution).toLocaleTimeString()}
                        </div>
                      </div>
                      
                      <ScheduleStatus status={schedule.status} size="small" showText={false} />
                    </div>
                  );
                })}
                
                {upcomingSchedules.length > 5 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '10px', 
                    color: '#718096', 
                    fontSize: '14px' 
                  }}>
                    +{upcomingSchedules.length - 5} more upcoming...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h3 style={{ 
              margin: 0, 
              color: '#2d3748', 
              fontSize: '20px', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              ⚡ Quick Actions
            </h3>
          </div>
          <div style={cardBodyStyle}>
            <div style={quickActionsStyle}>
              <button
                style={primaryActionStyle}
                onClick={() => onQuickAction('create')}
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

              <button
                style={secondaryActionStyle}
                onClick={() => onQuickAction('activateAll')}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(56, 161, 105, 0.1)';
                  e.target.style.borderColor = '#38a169';
                  e.target.style.color = '#38a169';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(247, 250, 252, 0.8)';
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.color = '#4a5568';
                }}
              >
                ▶️ Resume All
              </button>

              <button
                style={secondaryActionStyle}
                onClick={() => onQuickAction('pauseAll')}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(214, 158, 46, 0.1)';
                  e.target.style.borderColor = '#d69e2e';
                  e.target.style.color = '#d69e2e';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(247, 250, 252, 0.8)';
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.color = '#4a5568';
                }}
              >
                ⏸️ Pause All
              </button>

              <button
                style={secondaryActionStyle}
                onClick={() => onQuickAction('viewLogs')}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(102, 126, 234, 0.1)';
                  e.target.style.borderColor = '#667eea';
                  e.target.style.color = '#667eea';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(247, 250, 252, 0.8)';
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.color = '#4a5568';
                }}
              >
                📋 View Logs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {schedules.filter(s => s.lastExecution).length > 0 && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h3 style={{ 
              margin: 0, 
              color: '#2d3748', 
              fontSize: '20px', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              📈 Recent Activity
              <span style={{ 
                fontSize: '12px', 
                color: '#718096', 
                fontWeight: '500',
                background: 'rgba(102, 126, 234, 0.1)',
                padding: '4px 8px',
                borderRadius: '8px'
              }}>
                Last 24h
              </span>
            </h3>
          </div>
          <div style={cardBodyStyle}>
            <div style={upcomingListStyle}>
              {schedules
                .filter(s => s.lastExecution)
                .sort((a, b) => new Date(b.lastExecution) - new Date(a.lastExecution))
                .slice(0, 5)
                .map((schedule, index) => (
                  <div key={schedule.id} style={upcomingItemStyle}>
                    <div style={{
                      ...timeDisplayStyle,
                      color: schedule.lastExecutionSuccess ? '#38a169' : '#e53e3e'
                    }}>
                      {schedule.lastExecutionSuccess ? '✅' : '❌'}
                    </div>
                    
                    <div style={scheduleInfoStyle}>
                      <div style={scheduleNameStyle}>{schedule.name}</div>
                      <div style={scheduleDetailsStyle}>
                        Executed {new Date(schedule.lastExecution).toLocaleString()}
                        <span style={{ margin: '0 8px', opacity: 0.5 }}>•</span>
                        {schedule.lastExecutionSuccess ? 'Success' : 'Failed'}
                      </div>
                    </div>
                    
                    <ScheduleStatus status={schedule.status} size="small" showText={false} />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ScheduleDashboard;