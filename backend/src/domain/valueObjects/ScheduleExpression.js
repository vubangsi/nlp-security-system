const DayOfWeek = require('./DayOfWeek');
const Time = require('./Time');

/**
 * ScheduleExpression Value Object
 * 
 * Encapsulates scheduling logic with support for days of the week,
 * specific times, and timezone handling. Calculates next execution times
 * and validates schedule patterns.
 */
class ScheduleExpression {
  constructor(daysOfWeek, time, timezone = 'UTC') {
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      throw new Error('daysOfWeek must be a non-empty array of DayOfWeek objects');
    }

    if (!daysOfWeek.every(day => day instanceof DayOfWeek)) {
      throw new Error('All elements in daysOfWeek must be DayOfWeek instances');
    }

    if (!(time instanceof Time)) {
      throw new Error('time must be a Time instance');
    }

    if (!timezone || typeof timezone !== 'string') {
      throw new Error('timezone must be a non-empty string');
    }

    this.daysOfWeek = [...daysOfWeek]; // Create a copy to prevent external modification
    this.time = time;
    this.timezone = timezone;
    Object.freeze(this);
  }

  /**
   * Creates ScheduleExpression from object data
   */
  static fromData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Schedule data must be an object');
    }

    const { daysOfWeek, time, timezone = 'UTC' } = data;

    // Parse days of week
    let parsedDays;
    if (Array.isArray(daysOfWeek)) {
      parsedDays = daysOfWeek.map(day => {
        if (typeof day === 'string') {
          return DayOfWeek.fromString(day);
        } else if (day instanceof DayOfWeek) {
          return day;
        } else {
          throw new Error('Invalid day format in daysOfWeek array');
        }
      });
    } else if (typeof daysOfWeek === 'string') {
      parsedDays = DayOfWeek.parseMultipleDays(daysOfWeek);
    } else {
      throw new Error('daysOfWeek must be an array or string');
    }

    // Parse time
    let parsedTime;
    if (time instanceof Time) {
      parsedTime = time;
    } else if (typeof time === 'string') {
      parsedTime = Time.fromString(time);
    } else if (typeof time === 'object' && time.hour !== undefined && time.minute !== undefined) {
      parsedTime = new Time(time.hour, time.minute);
    } else {
      throw new Error('time must be a Time instance, time string, or object with hour and minute');
    }

    return new ScheduleExpression(parsedDays, parsedTime, timezone);
  }

  /**
   * Calculates the next execution time from the given reference date
   */
  getNextExecutionTime(fromDate = new Date()) {
    if (!(fromDate instanceof Date)) {
      throw new Error('fromDate must be a Date instance');
    }

    const referenceDate = new Date(fromDate);
    
    // Get target days as JavaScript day numbers (0 = Sunday, 1 = Monday, etc.)
    const targetDayNumbers = this.daysOfWeek.map(day => day.toDateDayNumber()).sort();
    
    // Start from the current day and look for the next matching day
    let searchDate = new Date(referenceDate);
    const maxSearchDays = 8; // Search up to 8 days to handle edge cases
    
    for (let i = 0; i < maxSearchDays; i++) {
      const currentDayNumber = searchDate.getDay();
      
      if (targetDayNumbers.includes(currentDayNumber)) {
        // Found a matching day, now check if the time is in the future
        const executionDateTime = new Date(searchDate);
        executionDateTime.setHours(this.time.hour, this.time.minute, 0, 0);
        
        // If it's today and the time hasn't passed yet, or it's a future day
        if (executionDateTime > referenceDate) {
          return executionDateTime;
        }
      }
      
      // Move to the next day
      searchDate.setDate(searchDate.getDate() + 1);
    }
    
    // If we get here, something went wrong with the calculation
    throw new Error('Could not calculate next execution time');
  }

  /**
   * Checks if the given date matches this schedule pattern
   */
  matchesDay(date) {
    if (!(date instanceof Date)) {
      throw new Error('date must be a Date instance');
    }

    const dayNumber = date.getDay();
    const dayOfWeek = DayOfWeek.fromDateDayNumber(dayNumber);
    
    return this.daysOfWeek.some(scheduledDay => scheduledDay.equals(dayOfWeek));
  }

  /**
   * Checks if the schedule should execute at the given date and time
   */
  shouldExecuteAt(date) {
    if (!(date instanceof Date)) {
      throw new Error('date must be a Date instance');
    }

    // Check if the day matches
    if (!this.matchesDay(date)) {
      return false;
    }

    // Check if the time matches (within the same minute)
    const scheduleTime = Time.fromDate(date);
    return scheduleTime.equals(this.time);
  }

  /**
   * Gets all upcoming execution times within the specified number of days
   */
  getUpcomingExecutions(days = 7, fromDate = new Date()) {
    if (typeof days !== 'number' || days <= 0) {
      throw new Error('days must be a positive number');
    }

    const executions = [];
    let currentDate = new Date(fromDate);
    const endDate = new Date(fromDate);
    endDate.setDate(endDate.getDate() + days);

    while (currentDate <= endDate) {
      if (this.matchesDay(currentDate)) {
        const executionDateTime = new Date(currentDate);
        executionDateTime.setHours(this.time.hour, this.time.minute, 0, 0);
        
        if (executionDateTime > fromDate) {
          executions.push(new Date(executionDateTime));
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return executions.sort((a, b) => a - b);
  }

  /**
   * Validates the schedule expression for business rules
   */
  isValid() {
    try {
      // Basic validation - constructor already validates the components
      if (this.daysOfWeek.length === 0) {
        return false;
      }

      // Ensure we can calculate a next execution time
      this.getNextExecutionTime();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets a human-readable description of the schedule
   */
  getDescription() {
    // Group consecutive weekdays for better readability
    const dayNames = this.daysOfWeek.map(day => day.getDisplayName());
    
    let dayDescription;
    if (this.daysOfWeek.length === 7) {
      dayDescription = 'every day';
    } else if (this.daysOfWeek.length === 5 && 
               this.daysOfWeek.every(day => day.isWeekday())) {
      dayDescription = 'weekdays';
    } else if (this.daysOfWeek.length === 2 && 
               this.daysOfWeek.every(day => day.isWeekend())) {
      dayDescription = 'weekends';
    } else if (dayNames.length === 1) {
      dayDescription = `every ${dayNames[0]}`;
    } else if (dayNames.length === 2) {
      dayDescription = `${dayNames[0]} and ${dayNames[1]}`;
    } else {
      const lastDay = dayNames.pop();
      dayDescription = `${dayNames.join(', ')} and ${lastDay}`;
    }

    const timeDescription = this.time.format12Hour();
    return `${dayDescription} at ${timeDescription}`;
  }

  /**
   * Creates a copy with modified days of week
   */
  withDaysOfWeek(newDaysOfWeek) {
    return new ScheduleExpression(newDaysOfWeek, this.time, this.timezone);
  }

  /**
   * Creates a copy with modified time
   */
  withTime(newTime) {
    return new ScheduleExpression(this.daysOfWeek, newTime, this.timezone);
  }

  /**
   * Creates a copy with modified timezone
   */
  withTimezone(newTimezone) {
    return new ScheduleExpression(this.daysOfWeek, this.time, newTimezone);
  }

  /**
   * Checks if this schedule conflicts with another schedule
   * (same day and time within a reasonable window)
   */
  conflictsWith(otherSchedule, toleranceMinutes = 5) {
    if (!(otherSchedule instanceof ScheduleExpression)) {
      throw new Error('otherSchedule must be a ScheduleExpression instance');
    }

    // Check if any days overlap
    const hasOverlappingDays = this.daysOfWeek.some(thisDay =>
      otherSchedule.daysOfWeek.some(otherDay => thisDay.equals(otherDay))
    );

    if (!hasOverlappingDays) {
      return false;
    }

    // Check if times are within tolerance
    const timeDifference = Math.abs(this.time.differenceInMinutes(otherSchedule.time));
    return timeDifference <= toleranceMinutes;
  }

  /**
   * Equality comparison
   */
  equals(other) {
    if (!(other instanceof ScheduleExpression)) {
      return false;
    }

    if (this.timezone !== other.timezone || !this.time.equals(other.time)) {
      return false;
    }

    if (this.daysOfWeek.length !== other.daysOfWeek.length) {
      return false;
    }

    // Check if all days match (order doesn't matter)
    return this.daysOfWeek.every(thisDay =>
      other.daysOfWeek.some(otherDay => thisDay.equals(otherDay))
    );
  }

  /**
   * String representation
   */
  toString() {
    return this.getDescription();
  }

  /**
   * JSON serialization
   */
  toJSON() {
    return {
      daysOfWeek: this.daysOfWeek.map(day => day.toJSON()),
      time: this.time.toJSON(),
      timezone: this.timezone,
      description: this.getDescription()
    };
  }
}

module.exports = ScheduleExpression;