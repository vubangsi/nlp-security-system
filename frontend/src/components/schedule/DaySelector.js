import React from 'react';

const DaySelector = ({ selectedDays = [], onDaysChange, error }) => {
  const DAYS = [
    { key: 'monday', short: 'Mon', full: 'Monday' },
    { key: 'tuesday', short: 'Tue', full: 'Tuesday' },
    { key: 'wednesday', short: 'Wed', full: 'Wednesday' },
    { key: 'thursday', short: 'Thu', full: 'Thursday' },
    { key: 'friday', short: 'Fri', full: 'Friday' },
    { key: 'saturday', short: 'Sat', full: 'Saturday' },
    { key: 'sunday', short: 'Sun', full: 'Sunday' }
  ];

  const handleDayToggle = (dayKey) => {
    const newSelectedDays = selectedDays.includes(dayKey)
      ? selectedDays.filter(day => day !== dayKey)
      : [...selectedDays, dayKey];
    
    onDaysChange(newSelectedDays);
  };

  const handleShortcut = (shortcutType) => {
    let newDays = [];
    switch (shortcutType) {
      case 'weekdays':
        newDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        break;
      case 'weekends':
        newDays = ['saturday', 'sunday'];
        break;
      case 'everyday':
        newDays = DAYS.map(day => day.key);
        break;
      case 'clear':
        newDays = [];
        break;
      default:
        return;
    }
    onDaysChange(newDays);
  };

  const containerStyle = {
    marginBottom: '20px'
  };

  const shortcutsStyle = {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
    flexWrap: 'wrap'
  };

  const shortcutButtonStyle = {
    background: 'none',
    border: '1px solid #e2e8f0',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontWeight: '500',
    color: '#667eea'
  };

  const dayGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '8px',
    marginBottom: error ? '8px' : '0'
  };

  const getDayButtonStyle = (dayKey) => ({
    padding: '12px 8px',
    border: selectedDays.includes(dayKey) ? '2px solid #667eea' : '2px solid #e2e8f0',
    borderRadius: '12px',
    background: selectedDays.includes(dayKey) 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
      : 'white',
    color: selectedDays.includes(dayKey) ? 'white' : '#4a5568',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontSize: '12px',
    fontWeight: '600',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    minHeight: '60px'
  });

  const errorStyle = {
    color: '#c53030',
    fontSize: '14px',
    fontWeight: '500'
  };

  return (
    <div style={containerStyle}>
      <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#4a5568', fontSize: '14px' }}>
        Select Days
      </label>
      
      {/* Shortcuts */}
      <div style={shortcutsStyle}>
        <button
          type="button"
          style={shortcutButtonStyle}
          onClick={() => handleShortcut('weekdays')}
          onMouseEnter={(e) => {
            e.target.style.borderColor = '#667eea';
            e.target.style.background = 'rgba(102, 126, 234, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = '#e2e8f0';
            e.target.style.background = 'none';
          }}
        >
          Weekdays
        </button>
        <button
          type="button"
          style={shortcutButtonStyle}
          onClick={() => handleShortcut('weekends')}
          onMouseEnter={(e) => {
            e.target.style.borderColor = '#667eea';
            e.target.style.background = 'rgba(102, 126, 234, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = '#e2e8f0';
            e.target.style.background = 'none';
          }}
        >
          Weekends
        </button>
        <button
          type="button"
          style={shortcutButtonStyle}
          onClick={() => handleShortcut('everyday')}
          onMouseEnter={(e) => {
            e.target.style.borderColor = '#667eea';
            e.target.style.background = 'rgba(102, 126, 234, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = '#e2e8f0';
            e.target.style.background = 'none';
          }}
        >
          Every Day
        </button>
        <button
          type="button"
          style={shortcutButtonStyle}
          onClick={() => handleShortcut('clear')}
          onMouseEnter={(e) => {
            e.target.style.borderColor = '#e53e3e';
            e.target.style.background = 'rgba(229, 62, 62, 0.05)';
            e.target.style.color = '#e53e3e';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = '#e2e8f0';
            e.target.style.background = 'none';
            e.target.style.color = '#667eea';
          }}
        >
          Clear All
        </button>
      </div>

      {/* Day Grid */}
      <div style={dayGridStyle}>
        {DAYS.map((day) => (
          <button
            key={day.key}
            type="button"
            style={getDayButtonStyle(day.key)}
            onClick={() => handleDayToggle(day.key)}
            onMouseEnter={(e) => {
              if (!selectedDays.includes(day.key)) {
                e.target.style.borderColor = '#667eea';
                e.target.style.background = 'rgba(102, 126, 234, 0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedDays.includes(day.key)) {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.background = 'white';
              }
            }}
            aria-pressed={selectedDays.includes(day.key)}
            aria-label={`${day.full} ${selectedDays.includes(day.key) ? 'selected' : 'not selected'}`}
          >
            <span style={{ fontSize: '14px' }}>{day.short}</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>
              {day.key.charAt(0).toUpperCase()}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      {/* Selection Summary */}
      {selectedDays.length > 0 && (
        <div style={{ 
          marginTop: '10px', 
          fontSize: '12px', 
          color: '#718096',
          padding: '8px 12px',
          background: 'rgba(102, 126, 234, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(102, 126, 234, 0.1)'
        }}>
          Selected: {selectedDays.length === 7 ? 'Every day' : 
                    selectedDays.length === 5 && !selectedDays.includes('saturday') && !selectedDays.includes('sunday') ? 'Weekdays' :
                    selectedDays.length === 2 && selectedDays.includes('saturday') && selectedDays.includes('sunday') ? 'Weekends' :
                    selectedDays.map(day => DAYS.find(d => d.key === day)?.short).join(', ')
          }
        </div>
      )}
    </div>
  );
};

export default DaySelector;