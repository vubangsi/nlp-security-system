import React, { useState, useEffect } from 'react';

const TimePicker = ({ value = '12:00', onChange, format = '12', error }) => {
  const [time, setTime] = useState(value);
  const [period, setPeriod] = useState('AM');

  useEffect(() => {
    // Parse the initial value
    if (value) {
      const [timeStr, periodStr] = value.includes(' ') ? value.split(' ') : [value, ''];
      setTime(timeStr);
      if (periodStr && format === '12') {
        setPeriod(periodStr);
      }
    }
  }, [value, format]);

  const generateTimeOptions = () => {
    const options = [];
    
    if (format === '24') {
      // 24-hour format
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const hourStr = hour.toString().padStart(2, '0');
          const minuteStr = minute.toString().padStart(2, '0');
          options.push(`${hourStr}:${minuteStr}`);
        }
      }
    } else {
      // 12-hour format
      for (let hour = 1; hour <= 12; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const hourStr = hour.toString();
          const minuteStr = minute.toString().padStart(2, '0');
          options.push(`${hourStr}:${minuteStr}`);
        }
      }
    }
    
    return options;
  };

  const handleTimeChange = (newTime) => {
    setTime(newTime);
    const finalTime = format === '12' ? `${newTime} ${period}` : newTime;
    onChange(finalTime);
  };

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    const finalTime = `${time} ${newPeriod}`;
    onChange(finalTime);
  };

  const getQuickTimeOptions = () => {
    if (format === '12') {
      return [
        { label: 'Morning', value: '8:00 AM' },
        { label: 'Noon', value: '12:00 PM' },
        { label: 'Afternoon', value: '3:00 PM' },
        { label: 'Evening', value: '6:00 PM' },
        { label: 'Night', value: '10:00 PM' },
        { label: 'Midnight', value: '12:00 AM' }
      ];
    } else {
      return [
        { label: 'Morning', value: '08:00' },
        { label: 'Noon', value: '12:00' },
        { label: 'Afternoon', value: '15:00' },
        { label: 'Evening', value: '18:00' },
        { label: 'Night', value: '22:00' },
        { label: 'Midnight', value: '00:00' }
      ];
    }
  };

  const containerStyle = {
    marginBottom: '20px'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '10px',
    fontWeight: '600',
    color: '#4a5568',
    fontSize: '14px'
  };

  const quickTimesStyle = {
    display: 'flex',
    gap: '8px',
    marginBottom: '15px',
    flexWrap: 'wrap'
  };

  const quickButtonStyle = {
    background: 'none',
    border: '1px solid #e2e8f0',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontWeight: '500',
    color: '#667eea'
  };

  const timeInputContainerStyle = {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: error ? '8px' : '0'
  };

  const selectStyle = {
    padding: '10px 12px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    background: 'white',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  };

  const periodButtonsStyle = {
    display: 'flex',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    overflow: 'hidden'
  };

  const getPeriodButtonStyle = (currentPeriod) => ({
    padding: '10px 16px',
    border: 'none',
    background: period === currentPeriod 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
      : 'white',
    color: period === currentPeriod ? 'white' : '#4a5568',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease'
  });

  const errorStyle = {
    color: '#c53030',
    fontSize: '14px',
    fontWeight: '500'
  };

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>
        Time {format === '12' ? '(12-hour)' : '(24-hour)'}
      </label>
      
      {/* Quick Time Options */}
      <div style={quickTimesStyle}>
        {getQuickTimeOptions().map((option) => (
          <button
            key={option.label}
            type="button"
            style={quickButtonStyle}
            onClick={() => onChange(option.value)}
            onMouseEnter={(e) => {
              e.target.style.borderColor = '#667eea';
              e.target.style.background = 'rgba(102, 126, 234, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.background = 'none';
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Time Input */}
      <div style={timeInputContainerStyle}>
        <select
          value={time}
          onChange={(e) => handleTimeChange(e.target.value)}
          style={selectStyle}
          onFocus={(e) => {
            e.target.style.borderColor = '#667eea';
            e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#e2e8f0';
            e.target.style.boxShadow = 'none';
          }}
        >
          {generateTimeOptions().map((timeOption) => (
            <option key={timeOption} value={timeOption}>
              {timeOption}
            </option>
          ))}
        </select>

        {format === '12' && (
          <div style={periodButtonsStyle}>
            <button
              type="button"
              style={getPeriodButtonStyle('AM')}
              onClick={() => handlePeriodChange('AM')}
            >
              AM
            </button>
            <button
              type="button"
              style={getPeriodButtonStyle('PM')}
              onClick={() => handlePeriodChange('PM')}
            >
              PM
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      {/* Current Selection Display */}
      <div style={{ 
        marginTop: '8px', 
        fontSize: '12px', 
        color: '#718096',
        padding: '6px 10px',
        background: 'rgba(102, 126, 234, 0.05)',
        borderRadius: '6px',
        border: '1px solid rgba(102, 126, 234, 0.1)'
      }}>
        Selected: {format === '12' ? `${time} ${period}` : time}
      </div>
    </div>
  );
};

export default TimePicker;