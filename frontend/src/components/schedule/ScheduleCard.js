import React, { useState } from 'react';
import ScheduleStatus from './ScheduleStatus';

const ScheduleCard = ({ 
  schedule, 
  onEdit, 
  onDelete, 
  onToggleActive, 
  onExecuteNow,
  userRole,
  compact = false 
}) => {
  const [isExecuting, setIsExecuting] = useState(false);

  const getDayAbbreviations = (days = []) => {
    const dayMap = {
      'monday': 'M',
      'tuesday': 'T',
      'wednesday': 'W',
      'thursday': 'T',
      'friday': 'F',
      'saturday': 'S',
      'sunday': 'S'
    };
    
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      .map(day => ({
        day,
        abbreviation: dayMap[day],
        isSelected: days.includes(day)
      }));
  };

  const getActionTypeDisplay = (actionType, actionDetails = {}) => {
    switch (actionType) {
      case 'ARM':
        return `🔒 ARM (${(actionDetails.mode || 'home').toUpperCase()})`;
      case 'DISARM':
        return '🔓 DISARM';
      case 'ARM_ZONE':
        return `🏠 ARM ZONE (${actionDetails.zoneId || 'N/A'})`;
      case 'DISARM_ZONE':
        return `🏠 DISARM ZONE (${actionDetails.zoneId || 'N/A'})`;
      default:
        return `⚙️ ${actionType}`;
    }
  };

  const getNextExecutionTime = (schedule) => {
    if (!schedule.nextExecution) return null;
    
    const nextTime = new Date(schedule.nextExecution);
    const now = new Date();
    const diffMs = nextTime.getTime() - now.getTime();
    
    if (diffMs < 0) return 'Overdue';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours < 1) {
      return `${diffMinutes}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ${diffHours % 24}h`;
    }
  };

  const handleExecuteNow = async () => {
    setIsExecuting(true);
    try {
      await onExecuteNow(schedule.id);
    } finally {
      setIsExecuting(false);
    }
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: compact ? '12px' : '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    marginBottom: compact ? '15px' : '20px'
  };

  const cardHeaderStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
    padding: compact ? '20px 20px 15px' : '25px 25px 20px'
  };

  const scheduleIconStyle = {
    fontSize: compact ? '24px' : '32px',
    minWidth: compact ? '32px' : '40px',
    textAlign: 'center'
  };

  const cardInfoStyle = {
    flex: 1
  };

  const scheduleNameStyle = {
    fontSize: compact ? '16px' : '20px',
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: '8px',
    margin: 0
  };

  const scheduleDescriptionStyle = {
    color: '#718096',
    fontSize: compact ? '13px' : '14px',
    marginBottom: '8px',
    lineHeight: '1.4'
  };

  const scheduleTimeStyle = {
    color: '#4a5568',
    fontSize: compact ? '13px' : '14px',
    fontWeight: '600',
    marginBottom: '8px'
  };

  const dayIndicatorsStyle = {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px'
  };

  const getDayIndicatorStyle = (isSelected) => ({
    width: compact ? '20px' : '24px',
    height: compact ? '20px' : '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: compact ? '10px' : '11px',
    fontWeight: '600',
    background: isSelected 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
      : '#f7fafc',
    color: isSelected ? 'white' : '#a0aec0',
    border: isSelected ? 'none' : '1px solid #e2e8f0'
  });

  const cardActionsStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  };

  const cardBodyStyle = {
    padding: compact ? '0 20px 15px' : '0 25px 20px'
  };

  const scheduleDetailsStyle = {
    display: 'grid',
    gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginBottom: '15px'
  };

  const detailItemStyle = {
    background: 'rgba(247, 250, 252, 0.8)',
    padding: compact ? '12px' : '15px',
    borderRadius: '10px',
    border: '1px solid rgba(226, 232, 240, 0.8)'
  };

  const detailLabelStyle = {
    fontSize: '11px',
    color: '#4a5568',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px'
  };

  const detailValueStyle = {
    fontSize: compact ? '13px' : '14px',
    color: '#2d3748',
    fontWeight: '600'
  };

  const actionButtonsStyle = {
    display: 'flex',
    gap: compact ? '8px' : '12px',
    flexWrap: 'wrap',
    paddingTop: '15px',
    borderTop: '1px solid rgba(226, 232, 240, 0.5)'
  };

  const getButtonStyle = (type = 'default') => {
    const baseStyle = {
      padding: compact ? '6px 12px' : '8px 16px',
      borderRadius: compact ? '6px' : '8px',
      fontSize: compact ? '11px' : '12px',
      fontWeight: '600',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    };

    switch (type) {
      case 'primary':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
        };
      case 'success':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #38a169 0%, #2f855a 100%)',
          color: 'white',
          boxShadow: '0 4px 15px rgba(56, 161, 105, 0.3)'
        };
      case 'danger':
        return {
          ...baseStyle,
          background: 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)',
          color: 'white',
          boxShadow: '0 4px 15px rgba(245, 101, 101, 0.3)'
        };
      case 'secondary':
        return {
          ...baseStyle,
          background: '#f7fafc',
          color: '#4a5568',
          border: '1px solid #e2e8f0'
        };
      default:
        return baseStyle;
    }
  };

  const nextExecution = getNextExecutionTime(schedule);
  const dayIndicators = getDayAbbreviations(schedule.days);

  return (
    <div 
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
      }}
    >
      {/* Header */}
      <div style={cardHeaderStyle}>
        <div style={scheduleIconStyle}>
          <span role="img" aria-label="schedule">
            {schedule.status === 'ACTIVE' ? '⏰' : '⏸️'}
          </span>
        </div>
        
        <div style={cardInfoStyle}>
          <h3 style={scheduleNameStyle}>{schedule.name}</h3>
          {schedule.description && (
            <p style={scheduleDescriptionStyle}>{schedule.description}</p>
          )}
          <div style={scheduleTimeStyle}>
            {getActionTypeDisplay(schedule.actionType, schedule.actionDetails)}
          </div>
          
          {/* Day Indicators */}
          <div style={dayIndicatorsStyle}>
            {dayIndicators.map((day, index) => (
              <div 
                key={day.day} 
                style={getDayIndicatorStyle(day.isSelected)}
                title={day.day.charAt(0).toUpperCase() + day.day.slice(1)}
              >
                {day.abbreviation}
              </div>
            ))}
          </div>
        </div>

        <div style={cardActionsStyle}>
          <ScheduleStatus status={schedule.status} size={compact ? 'small' : 'normal'} />
          {schedule.status === 'ACTIVE' && nextExecution && (
            <div style={{
              fontSize: compact ? '11px' : '12px',
              color: '#667eea',
              fontWeight: '600',
              background: 'rgba(102, 126, 234, 0.1)',
              padding: compact ? '4px 8px' : '6px 12px',
              borderRadius: compact ? '8px' : '10px',
              border: '1px solid rgba(102, 126, 234, 0.2)'
            }}>
              {nextExecution}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      {!compact && (
        <div style={cardBodyStyle}>
          <div style={scheduleDetailsStyle}>
            <div style={detailItemStyle}>
              <div style={detailLabelStyle}>Schedule Time</div>
              <div style={detailValueStyle}>{schedule.time}</div>
            </div>
            
            {schedule.nextExecution && (
              <div style={detailItemStyle}>
                <div style={detailLabelStyle}>Next Execution</div>
                <div style={detailValueStyle}>
                  {new Date(schedule.nextExecution).toLocaleString()}
                </div>
              </div>
            )}
            
            {schedule.lastExecution && (
              <div style={detailItemStyle}>
                <div style={detailLabelStyle}>Last Execution</div>
                <div style={detailValueStyle}>
                  {new Date(schedule.lastExecution).toLocaleString()}
                </div>
              </div>
            )}

            {schedule.executionCount !== undefined && (
              <div style={detailItemStyle}>
                <div style={detailLabelStyle}>Executions</div>
                <div style={detailValueStyle}>
                  {schedule.executionCount} 
                  {schedule.successCount !== undefined && (
                    <span style={{ color: '#38a169', marginLeft: '8px' }}>
                      ({schedule.successCount} successful)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={actionButtonsStyle}>
            <button
              style={getButtonStyle(schedule.status === 'ACTIVE' ? 'secondary' : 'success')}
              onClick={() => onToggleActive(schedule.id, schedule.status !== 'ACTIVE')}
            >
              {schedule.status === 'ACTIVE' ? '⏸️ Pause' : '▶️ Activate'}
            </button>

            <button
              style={getButtonStyle('primary')}
              onClick={handleExecuteNow}
              disabled={isExecuting}
            >
              {isExecuting ? '⏳ Running...' : '▶️ Run Now'}
            </button>

            <button
              style={getButtonStyle('secondary')}
              onClick={() => onEdit(schedule)}
            >
              ✏️ Edit
            </button>

            {userRole === 'admin' && (
              <button
                style={getButtonStyle('danger')}
                onClick={() => onDelete(schedule.id)}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(245, 101, 101, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 15px rgba(245, 101, 101, 0.3)';
                }}
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleCard;