const DayOfWeek = require('../valueObjects/DayOfWeek');
const Time = require('../valueObjects/Time');
const ScheduleExpression = require('../valueObjects/ScheduleExpression');

/**
 * ScheduleParser Domain Service
 * 
 * Parses natural language schedule commands into structured domain objects.
 * Handles various patterns like "weekdays at 9 PM", "Monday and weekends at 8 AM".
 */
class ScheduleParser {
  constructor() {
    // Precompiled regex patterns for efficiency
    this.patterns = {
      // Time patterns
      time12Hour: /(\d{1,2})\s*(AM|PM)/i,
      time12HourWithMinutes: /(\d{1,2}):(\d{2})\s*(AM|PM)/i,
      time24Hour: /(\d{1,2}):(\d{2})/,
      timeHourOnly: /(\d{1,2})\s*(?:o'?clock)?/i,
      
      // Day patterns
      specificDays: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi,
      dayCollections: /\b(weekdays?|weekends?|everyday|daily|all\s*days?)\b/gi,
      
      // Schedule command patterns
      scheduleCommand: /^(?:schedule|set up|create|add)?\s*(.+?)(?:\s+(?:schedule|task))?$/i,
      atTimePattern: /(.+?)\s+(?:at|@)\s+(.+)/i,
      
      // Action patterns
      armPattern: /\b(?:arm|activate|enable|turn\s+on)\b/i,
      disarmPattern: /\b(?:disarm|deactivate|disable|turn\s+off)\b/i,
      systemPattern: /\b(?:system|security|alarm)\b/i,
      modePattern: /\b(away|stay|home)\b/i
    };

    // Day name mappings for natural language
    this.dayMappings = {
      'mon': 'MONDAY', 'monday': 'MONDAY',
      'tue': 'TUESDAY', 'tuesday': 'TUESDAY',
      'wed': 'WEDNESDAY', 'wednesday': 'WEDNESDAY', 
      'thu': 'THURSDAY', 'thursday': 'THURSDAY',
      'fri': 'FRIDAY', 'friday': 'FRIDAY',
      'sat': 'SATURDAY', 'saturday': 'SATURDAY',
      'sun': 'SUNDAY', 'sunday': 'SUNDAY'
    };
  }

  /**
   * Main entry point for parsing schedule commands
   */
  parseScheduleCommand(command) {
    if (!command || typeof command !== 'string') {
      throw new Error('Command must be a non-empty string');
    }

    const normalizedCommand = command.trim().toLowerCase();
    
    // Extract the main schedule part (remove command prefixes)
    const scheduleMatch = normalizedCommand.match(this.patterns.scheduleCommand);
    const scheduleText = scheduleMatch ? scheduleMatch[1] : normalizedCommand;

    // Parse "at time" pattern
    const atTimeMatch = scheduleText.match(this.patterns.atTimePattern);
    
    if (!atTimeMatch) {
      throw new Error('Could not parse schedule format. Expected format: "[days] at [time]"');
    }

    const daysText = atTimeMatch[1].trim();
    const timeText = atTimeMatch[2].trim();

    // Parse days and time
    const days = this.extractDays(daysText);
    const time = this.extractTime(timeText);

    // Determine action type and parameters from the original command
    const actionInfo = this.parseActionType(command);

    return {
      scheduleExpression: new ScheduleExpression(days, time),
      actionType: actionInfo.actionType,
      actionParameters: actionInfo.actionParameters
    };
  }

  /**
   * Extracts days from natural language text
   */
  extractDays(daysText) {
    if (!daysText || typeof daysText !== 'string') {
      throw new Error('Days text must be a non-empty string');
    }

    const normalizedText = daysText.toLowerCase().trim();
    
    // Check for day collections first
    const collectionMatches = [...normalizedText.matchAll(this.patterns.dayCollections)];
    
    if (collectionMatches.length > 0) {
      let allDays = [];
      
      for (const match of collectionMatches) {
        const collection = match[1].toLowerCase();
        if (collection.includes('weekday')) {
          allDays = allDays.concat(DayOfWeek.WEEKDAYS.map(day => new DayOfWeek(day)));
        } else if (collection.includes('weekend')) {
          allDays = allDays.concat(DayOfWeek.WEEKENDS.map(day => new DayOfWeek(day)));
        } else if (collection.includes('everyday') || collection.includes('daily') || collection.includes('all')) {
          allDays = allDays.concat(DayOfWeek.ALL_DAYS.map(day => new DayOfWeek(day)));
        }
      }
      
      // Remove duplicates
      const uniqueDays = allDays.filter((day, index, self) => 
        index === self.findIndex(d => d.equals(day))
      );
      
      if (uniqueDays.length > 0) {
        return uniqueDays;
      }
    }

    // Extract specific days
    const dayMatches = [...normalizedText.matchAll(this.patterns.specificDays)];
    
    if (dayMatches.length === 0) {
      throw new Error(`Could not parse days from: "${daysText}". Expected days like "Monday", "weekdays", "weekends", etc.`);
    }

    const days = [];
    
    for (const match of dayMatches) {
      const dayName = match[1].toLowerCase();
      const mappedDay = this.dayMappings[dayName];
      
      if (mappedDay) {
        const dayOfWeek = new DayOfWeek(mappedDay);
        // Avoid duplicates
        if (!days.some(d => d.equals(dayOfWeek))) {
          days.push(dayOfWeek);
        }
      }
    }

    // Handle combinations like "Monday and Tuesday"
    if (normalizedText.includes(' and ') || normalizedText.includes(',')) {
      // Split on common separators and parse each part
      const parts = normalizedText.split(/\s+and\s+|,\s*/).map(part => part.trim());
      
      for (const part of parts) {
        const partMatches = [...part.matchAll(this.patterns.specificDays)];
        for (const match of partMatches) {
          const dayName = match[1].toLowerCase();
          const mappedDay = this.dayMappings[dayName];
          
          if (mappedDay) {
            const dayOfWeek = new DayOfWeek(mappedDay);
            if (!days.some(d => d.equals(dayOfWeek))) {
              days.push(dayOfWeek);
            }
          }
        }
      }
    }

    if (days.length === 0) {
      throw new Error(`Could not parse any valid days from: "${daysText}"`);
    }

    return days;
  }

  /**
   * Extracts time from natural language text
   */
  extractTime(timeText) {
    if (!timeText || typeof timeText !== 'string') {
      throw new Error('Time text must be a non-empty string');
    }

    const normalizedTime = timeText.trim().toUpperCase();

    // Try 12-hour format with minutes (e.g., "9:30 PM")
    let match = normalizedTime.match(this.patterns.time12HourWithMinutes);
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const meridiem = match[3];
      
      let finalHour = hour;
      if (meridiem === 'AM') {
        if (hour === 12) finalHour = 0; // 12 AM = 0:00
      } else { // PM
        if (hour !== 12) finalHour += 12; // 1 PM = 13:00, but 12 PM = 12:00
      }
      
      return new Time(finalHour, minute);
    }

    // Try 12-hour format without minutes (e.g., "9 PM")
    match = normalizedTime.match(this.patterns.time12Hour);
    if (match) {
      const hour = parseInt(match[1], 10);
      const meridiem = match[2];
      
      let finalHour = hour;
      if (meridiem === 'AM') {
        if (hour === 12) finalHour = 0; // 12 AM = 0:00
      } else { // PM
        if (hour !== 12) finalHour += 12; // 1 PM = 13:00, but 12 PM = 12:00
      }
      
      return new Time(finalHour, 0);
    }

    // Try 24-hour format (e.g., "21:30")
    match = normalizedTime.match(this.patterns.time24Hour);
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      return new Time(hour, minute);
    }

    // Try hour only (assumes 24-hour if > 12, otherwise needs context)
    match = normalizedTime.match(this.patterns.timeHourOnly);
    if (match) {
      const hour = parseInt(match[1], 10);
      
      // If hour is clearly 24-hour format (> 12), use as-is
      if (hour > 12 && hour <= 23) {
        return new Time(hour, 0);
      }
      
      // If hour is <= 12, assume AM for early hours, PM for later
      // This is a heuristic and may not always be correct
      if (hour >= 1 && hour <= 12) {
        if (hour >= 1 && hour <= 7) {
          // Early hours (1-7) likely AM
          return new Time(hour === 12 ? 0 : hour, 0);
        } else {
          // Later hours (8-12) likely PM unless it's clearly stated as AM context
          return new Time(hour === 12 ? 12 : hour + 12, 0);
        }
      }
    }

    // Try to parse common time expressions
    const commonTimes = {
      'noon': new Time(12, 0),
      'midnight': new Time(0, 0),
      'morning': new Time(9, 0), // Default morning time
      'afternoon': new Time(14, 0), // Default afternoon time
      'evening': new Time(18, 0), // Default evening time
      'night': new Time(21, 0) // Default night time
    };

    const lowerTime = timeText.toLowerCase().trim();
    if (commonTimes[lowerTime]) {
      return commonTimes[lowerTime];
    }

    throw new Error(`Could not parse time from: "${timeText}". Expected formats: "9 PM", "9:30 AM", "21:30", "noon", etc.`);
  }

  /**
   * Determines action type and parameters from command
   */
  parseActionType(command) {
    const normalizedCommand = command.toLowerCase();
    
    let actionType;
    let actionParameters = {};

    // Determine if it's arm or disarm
    const isArmCommand = this.patterns.armPattern.test(normalizedCommand);
    const isDisarmCommand = this.patterns.disarmPattern.test(normalizedCommand);

    if (isArmCommand && !isDisarmCommand) {
      actionType = 'ARM_SYSTEM';
      
      // Extract mode (away/stay/home)
      const modeMatch = normalizedCommand.match(this.patterns.modePattern);
      if (modeMatch) {
        let mode = modeMatch[1];
        // Map 'home' to 'stay' for consistency
        if (mode === 'home') mode = 'stay';
        actionParameters.mode = mode;
      } else {
        // Default to 'away' if no mode specified
        actionParameters.mode = 'away';
      }
      
      actionParameters.zoneIds = []; // TODO: Could parse zone specifications later
      
    } else if (isDisarmCommand && !isArmCommand) {
      actionType = 'DISARM_SYSTEM';
      actionParameters.zoneIds = []; // TODO: Could parse zone specifications later
      
    } else if (isArmCommand && isDisarmCommand) {
      throw new Error('Command contains both arm and disarm keywords. Please specify either arm or disarm.');
    } else {
      // Default to arm system if no clear action is specified
      actionType = 'ARM_SYSTEM';
      actionParameters.mode = 'away';
      actionParameters.zoneIds = [];
    }

    return {
      actionType,
      actionParameters
    };
  }

  /**
   * Validates that a schedule expression makes sense
   */
  validateParsedSchedule(scheduleExpression, actionType, actionParameters) {
    if (!(scheduleExpression instanceof ScheduleExpression)) {
      throw new Error('Invalid schedule expression');
    }

    if (!scheduleExpression.isValid()) {
      throw new Error('Schedule expression is not valid');
    }

    // Business rule validations could go here
    // For example: no scheduling during maintenance windows, etc.
    
    return true;
  }

  /**
   * Parses multiple schedule commands from text
   */
  parseMultipleCommands(commands) {
    if (!Array.isArray(commands)) {
      throw new Error('Commands must be an array');
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < commands.length; i++) {
      try {
        const result = this.parseScheduleCommand(commands[i]);
        results.push({ index: i, command: commands[i], ...result });
      } catch (error) {
        errors.push({ index: i, command: commands[i], error: error.message });
      }
    }

    return { results, errors };
  }

  /**
   * Gets suggestions for fixing parse errors
   */
  getSuggestions(command, error) {
    const suggestions = [];
    
    if (error.includes('Could not parse schedule format')) {
      suggestions.push('Use format like: "weekdays at 9 PM" or "Monday and Tuesday at 8:30 AM"');
    }
    
    if (error.includes('Could not parse days')) {
      suggestions.push('Try: "weekdays", "weekends", "Monday", "Monday and Tuesday", "everyday"');
    }
    
    if (error.includes('Could not parse time')) {
      suggestions.push('Try: "9 PM", "9:30 AM", "21:30", "noon", "midnight"');
    }
    
    if (error.includes('both arm and disarm')) {
      suggestions.push('Use either "arm system" or "disarm system", not both');
    }

    return suggestions;
  }
}

module.exports = ScheduleParser;