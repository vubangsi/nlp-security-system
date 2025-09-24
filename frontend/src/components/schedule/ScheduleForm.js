import React, { useState, useEffect } from 'react';
import DaySelector from './DaySelector';
import TimePicker from './TimePicker';

const ScheduleForm = ({ 
  schedule = null, 
  onSubmit, 
  onCancel, 
  loading = false,
  zones = []
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    actionType: 'ARM',
    actionDetails: { mode: 'home' },
    days: [],
    time: '8:00 AM',
    active: true
  });
  const [errors, setErrors] = useState({});
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (schedule) {
      setFormData({
        name: schedule.name || '',
        description: schedule.description || '',
        actionType: schedule.actionType || 'ARM',
        actionDetails: schedule.actionDetails || { mode: 'home' },
        days: schedule.days || [],
        time: schedule.time || '8:00 AM',
        active: schedule.active !== false
      });
    }
  }, [schedule]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Schedule name is required';
    }
    
    if (formData.days.length === 0) {
      newErrors.days = 'At least one day must be selected';
    }
    
    if (!formData.time) {
      newErrors.time = 'Time is required';
    }

    if (formData.actionType.includes('ZONE') && (!formData.actionDetails.zoneId)) {
      newErrors.zoneId = 'Zone selection is required for zone actions';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      await onSubmit(formData);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleActionDetailsChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      actionDetails: {
        ...prev.actionDetails,
        [field]: value
      }
    }));
  };

  const parseNaturalLanguage = () => {
    if (!naturalLanguageInput.trim()) return;

    const input = naturalLanguageInput.toLowerCase();
    const newFormData = { ...formData };

    // Parse action type
    if (input.includes('arm') && input.includes('zone')) {
      newFormData.actionType = 'ARM_ZONE';
    } else if (input.includes('disarm') && input.includes('zone')) {
      newFormData.actionType = 'DISARM_ZONE';
    } else if (input.includes('arm')) {
      newFormData.actionType = 'ARM';
    } else if (input.includes('disarm')) {
      newFormData.actionType = 'DISARM';
    }

    // Parse mode
    if (input.includes('away')) {
      newFormData.actionDetails.mode = 'away';
    } else if (input.includes('night')) {
      newFormData.actionDetails.mode = 'night';
    } else if (input.includes('home')) {
      newFormData.actionDetails.mode = 'home';
    }

    // Parse days
    const dayPatterns = {
      monday: ['monday', 'mon'],
      tuesday: ['tuesday', 'tue'],
      wednesday: ['wednesday', 'wed'],
      thursday: ['thursday', 'thu'],
      friday: ['friday', 'fri'],
      saturday: ['saturday', 'sat'],
      sunday: ['sunday', 'sun']
    };

    const detectedDays = [];
    Object.entries(dayPatterns).forEach(([day, patterns]) => {
      if (patterns.some(pattern => input.includes(pattern))) {
        detectedDays.push(day);
      }
    });

    if (input.includes('weekdays')) {
      detectedDays.push(...['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    }
    if (input.includes('weekends')) {
      detectedDays.push(...['saturday', 'sunday']);
    }
    if (input.includes('every day') || input.includes('daily')) {
      detectedDays.push(...['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    }

    if (detectedDays.length > 0) {
      newFormData.days = [...new Set(detectedDays)];
    }

    // Parse time (basic patterns)
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,
      /(\d{1,2})\s*(am|pm)/i,
      /(\d{1,2}):(\d{2})/
    ];

    for (const pattern of timePatterns) {
      const match = input.match(pattern);
      if (match) {
        if (match[3]) {
          // 12-hour format
          newFormData.time = `${match[1]}:${match[2] || '00'} ${match[3].toUpperCase()}`;
        } else if (match[2]) {
          // 24-hour format
          newFormData.time = `${match[1].padStart(2, '0')}:${match[2]}`;
        }
        break;
      }
    }

    setFormData(newFormData);
    setNaturalLanguageInput('');
  };

  const getActionTypeOptions = () => [
    { value: 'ARM', label: '🔒 Arm System' },
    { value: 'DISARM', label: '🔓 Disarm System' },
    { value: 'ARM_ZONE', label: '🏠 Arm Zone' },
    { value: 'DISARM_ZONE', label: '🏠 Disarm Zone' }
  ];

  const getModeOptions = () => [
    { value: 'home', label: 'Home Mode' },
    { value: 'away', label: 'Away Mode' },
    { value: 'night', label: 'Night Mode' }
  ];

  const containerStyle = {
    maxWidth: '800px',
    margin: '0 auto'
  };

  const formStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  };

  const headerStyle = {
    padding: '25px 30px 20px',
    borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
    background: 'rgba(247, 250, 252, 0.5)'
  };

  const bodyStyle = {
    padding: '30px'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '25px',
    marginBottom: '25px'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    background: 'rgba(255, 255, 255, 0.8)'
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer'
  };

  const textareaStyle = {
    ...inputStyle,
    minHeight: '80px',
    resize: 'vertical'
  };

  const errorStyle = {
    color: '#c53030',
    fontSize: '14px',
    fontWeight: '500',
    marginTop: '5px'
  };

  const buttonStyle = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    background: 'linear-gradient(135deg, #718096 0%, #4a5568 100%)',
    boxShadow: '0 4px 15px rgba(113, 128, 150, 0.3)'
  };

  const actionButtonsStyle = {
    display: 'flex',
    gap: '15px',
    justifyContent: 'flex-end',
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(226, 232, 240, 0.8)'
  };

  return (
    <div style={containerStyle}>
      <form style={formStyle} onSubmit={handleSubmit}>
        <div style={headerStyle}>
          <h2 style={{ 
            color: '#2d3748', 
            fontSize: '24px', 
            fontWeight: '700', 
            margin: '0 0 10px 0' 
          }}>
            {schedule ? 'Edit Schedule' : 'Create New Schedule'}
          </h2>
          <p style={{ color: '#718096', margin: 0 }}>
            Schedule automatic security system actions
          </p>
        </div>

        <div style={bodyStyle}>
          {/* Natural Language Input */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '10px', 
              fontWeight: '600', 
              color: '#4a5568', 
              fontSize: '14px' 
            }}>
              Natural Language Input (Optional)
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={naturalLanguageInput}
                onChange={(e) => setNaturalLanguageInput(e.target.value)}
                placeholder="e.g., 'Arm system every weekday at 8:00 AM in away mode'"
                style={{ ...inputStyle, flex: 1 }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                  e.target.style.background = 'white';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                }}
              />
              <button
                type="button"
                onClick={parseNaturalLanguage}
                style={{
                  ...buttonStyle,
                  padding: '12px 20px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
                }}
              >
                Parse
              </button>
            </div>
            <p style={{ 
              fontSize: '12px', 
              color: '#718096', 
              marginTop: '5px' 
            }}>
              Try: "Arm system weekdays at 9 PM away mode" or "Disarm every Sunday at 8 AM"
            </p>
          </div>

          {/* Basic Information */}
          <div style={gridStyle}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                color: '#4a5568', 
                fontSize: '14px' 
              }}>
                Schedule Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Morning Arm Schedule"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                  e.target.style.background = 'white';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                }}
              />
              {errors.name && <div style={errorStyle}>{errors.name}</div>}
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                color: '#4a5568', 
                fontSize: '14px' 
              }}>
                Action Type *
              </label>
              <select
                value={formData.actionType}
                onChange={(e) => handleInputChange('actionType', e.target.value)}
                style={selectStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                  e.target.style.background = 'white';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                }}
              >
                {getActionTypeOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Details */}
          {(formData.actionType === 'ARM' || formData.actionType === 'ARM_ZONE') && (
            <div style={{ marginBottom: '25px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                color: '#4a5568', 
                fontSize: '14px' 
              }}>
                Arm Mode
              </label>
              <select
                value={formData.actionDetails.mode}
                onChange={(e) => handleActionDetailsChange('mode', e.target.value)}
                style={{ ...selectStyle, maxWidth: '300px' }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                  e.target.style.background = 'white';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                }}
              >
                {getModeOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Zone Selection */}
          {(formData.actionType === 'ARM_ZONE' || formData.actionType === 'DISARM_ZONE') && (
            <div style={{ marginBottom: '25px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                color: '#4a5568', 
                fontSize: '14px' 
              }}>
                Target Zone *
              </label>
              <select
                value={formData.actionDetails.zoneId || ''}
                onChange={(e) => handleActionDetailsChange('zoneId', e.target.value)}
                style={{ ...selectStyle, maxWidth: '400px' }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                  e.target.style.background = 'white';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                }}
              >
                <option value="">Select a zone...</option>
                {zones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    🏠 {zone.name} {zone.location && `(${zone.location})`}
                  </option>
                ))}
              </select>
              {errors.zoneId && <div style={errorStyle}>{errors.zoneId}</div>}
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600', 
              color: '#4a5568', 
              fontSize: '14px' 
            }}>
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Brief description of this schedule..."
              style={textareaStyle}
              rows="3"
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                e.target.style.background = 'white';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
                e.target.style.background = 'rgba(255, 255, 255, 0.8)';
              }}
            />
          </div>

          {/* Schedule Configuration */}
          <div style={gridStyle}>
            <div>
              <DaySelector
                selectedDays={formData.days}
                onDaysChange={(days) => handleInputChange('days', days)}
                error={errors.days}
              />
            </div>
            
            <div>
              <TimePicker
                value={formData.time}
                onChange={(time) => handleInputChange('time', time)}
                format="12"
                error={errors.time}
              />
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <div style={{ marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 0'
              }}
            >
              {showAdvanced ? '▼' : '▶'} Advanced Options
            </button>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div style={{
              background: 'rgba(247, 250, 252, 0.8)',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              marginBottom: '25px'
            }}>
              <div>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  fontWeight: '600', 
                  color: '#4a5568', 
                  fontSize: '14px',
                  cursor: 'pointer' 
                }}>
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => handleInputChange('active', e.target.checked)}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: '#667eea'
                    }}
                  />
                  Activate schedule immediately after creation
                </label>
                <p style={{ 
                  fontSize: '12px', 
                  color: '#718096', 
                  marginTop: '5px', 
                  marginLeft: '26px' 
                }}>
                  If unchecked, the schedule will be created but remain paused
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={actionButtonsStyle}>
            <button
              type="button"
              onClick={onCancel}
              style={secondaryButtonStyle}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 6px 20px rgba(113, 128, 150, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(113, 128, 150, 0.3)';
              }}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                ...buttonStyle,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
                }
              }}
            >
              {loading ? '⏳ Saving...' : schedule ? 'Update Schedule' : 'Create Schedule'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ScheduleForm;