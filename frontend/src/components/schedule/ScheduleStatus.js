import React from 'react';

const ScheduleStatus = ({ status, size = 'normal', showText = true }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'ACTIVE':
        return {
          color: '#38a169',
          backgroundColor: 'rgba(56, 161, 105, 0.1)',
          icon: '✅',
          text: 'Active'
        };
      case 'PENDING':
        return {
          color: '#d69e2e',
          backgroundColor: 'rgba(214, 158, 46, 0.1)',
          icon: '⏳',
          text: 'Pending'
        };
      case 'COMPLETED':
        return {
          color: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          icon: '✓',
          text: 'Completed'
        };
      case 'CANCELLED':
        return {
          color: '#e53e3e',
          backgroundColor: 'rgba(229, 62, 62, 0.1)',
          icon: '❌',
          text: 'Cancelled'
        };
      case 'PAUSED':
        return {
          color: '#718096',
          backgroundColor: 'rgba(113, 128, 150, 0.1)',
          icon: '⏸',
          text: 'Paused'
        };
      case 'ERROR':
        return {
          color: '#c53030',
          backgroundColor: 'rgba(197, 48, 48, 0.1)',
          icon: '⚠️',
          text: 'Error'
        };
      default:
        return {
          color: '#a0aec0',
          backgroundColor: 'rgba(160, 174, 192, 0.1)',
          icon: '❓',
          text: 'Unknown'
        };
    }
  };

  const config = getStatusConfig(status);
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: isSmall ? '4px' : '6px',
    padding: isSmall ? '4px 8px' : isLarge ? '8px 16px' : '6px 12px',
    borderRadius: isSmall ? '12px' : isLarge ? '20px' : '16px',
    fontSize: isSmall ? '11px' : isLarge ? '14px' : '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: config.color,
    backgroundColor: config.backgroundColor,
    border: `1px solid ${config.color}20`,
    transition: 'all 0.2s ease'
  };

  const iconStyle = {
    fontSize: isSmall ? '10px' : isLarge ? '14px' : '12px'
  };

  return (
    <span className="schedule-status-badge" style={badgeStyle}>
      <span style={iconStyle} role="img" aria-label={config.text}>
        {config.icon}
      </span>
      {showText && <span>{config.text}</span>}
    </span>
  );
};

export default ScheduleStatus;