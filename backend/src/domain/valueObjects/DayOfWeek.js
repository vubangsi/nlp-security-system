/**
 * DayOfWeek Value Object
 * 
 * Represents a day of the week with type safety and utility methods.
 * Provides support for day collections like weekdays and weekends.
 */
class DayOfWeek {
  static MONDAY = 'MONDAY';
  static TUESDAY = 'TUESDAY';
  static WEDNESDAY = 'WEDNESDAY';
  static THURSDAY = 'THURSDAY';
  static FRIDAY = 'FRIDAY';
  static SATURDAY = 'SATURDAY';
  static SUNDAY = 'SUNDAY';

  static ALL_DAYS = [
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY
  ];

  static WEEKDAYS = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY
  ];

  static WEEKENDS = [
    DayOfWeek.SATURDAY,
    DayOfWeek.SUNDAY
  ];

  constructor(day) {
    if (!DayOfWeek.isValid(day)) {
      throw new Error(`Invalid day: ${day}. Must be one of: ${DayOfWeek.ALL_DAYS.join(', ')}`);
    }
    this.value = day;
    Object.freeze(this);
  }

  /**
   * Creates DayOfWeek from string input, supporting various formats
   */
  static fromString(input) {
    if (!input || typeof input !== 'string') {
      throw new Error('Day input must be a non-empty string');
    }

    const normalized = input.toUpperCase().trim();
    
    // Direct match
    if (DayOfWeek.ALL_DAYS.includes(normalized)) {
      return new DayOfWeek(normalized);
    }

    // Support abbreviated forms
    const abbreviations = {
      'MON': DayOfWeek.MONDAY,
      'TUE': DayOfWeek.TUESDAY,
      'WED': DayOfWeek.WEDNESDAY,
      'THU': DayOfWeek.THURSDAY,
      'FRI': DayOfWeek.FRIDAY,
      'SAT': DayOfWeek.SATURDAY,
      'SUN': DayOfWeek.SUNDAY
    };

    if (abbreviations[normalized]) {
      return new DayOfWeek(abbreviations[normalized]);
    }

    throw new Error(`Unrecognized day format: ${input}`);
  }

  /**
   * Expands day collections into individual days
   */
  static expandDayCollection(input) {
    if (!input || typeof input !== 'string') {
      throw new Error('Input must be a non-empty string');
    }

    const normalized = input.toUpperCase().trim();
    
    switch (normalized) {
      case 'WEEKDAYS':
        return DayOfWeek.WEEKDAYS.map(day => new DayOfWeek(day));
      case 'WEEKENDS':
        return DayOfWeek.WEEKENDS.map(day => new DayOfWeek(day));
      case 'EVERYDAY':
      case 'DAILY':
      case 'ALL':
        return DayOfWeek.ALL_DAYS.map(day => new DayOfWeek(day));
      default:
        return [DayOfWeek.fromString(input)];
    }
  }

  /**
   * Parses multiple days from comma-separated string or array
   */
  static parseMultipleDays(input) {
    if (Array.isArray(input)) {
      return input.flatMap(day => DayOfWeek.expandDayCollection(day));
    }

    if (typeof input === 'string') {
      // Handle "and" and comma separators
      const parts = input.split(/,|\sand\s/).map(part => part.trim()).filter(part => part.length > 0);
      return parts.flatMap(part => DayOfWeek.expandDayCollection(part));
    }

    throw new Error('Input must be a string or array of strings');
  }

  /**
   * Validates if a day value is valid
   */
  static isValid(day) {
    return DayOfWeek.ALL_DAYS.includes(day);
  }

  /**
   * Checks if this day is a weekday
   */
  isWeekday() {
    return DayOfWeek.WEEKDAYS.includes(this.value);
  }

  /**
   * Checks if this day is a weekend
   */
  isWeekend() {
    return DayOfWeek.WEEKENDS.includes(this.value);
  }

  /**
   * Gets the JavaScript Date day number (0 = Sunday, 1 = Monday, etc.)
   */
  toDateDayNumber() {
    const mapping = {
      [DayOfWeek.SUNDAY]: 0,
      [DayOfWeek.MONDAY]: 1,
      [DayOfWeek.TUESDAY]: 2,
      [DayOfWeek.WEDNESDAY]: 3,
      [DayOfWeek.THURSDAY]: 4,
      [DayOfWeek.FRIDAY]: 5,
      [DayOfWeek.SATURDAY]: 6
    };
    return mapping[this.value];
  }

  /**
   * Creates DayOfWeek from JavaScript Date day number
   */
  static fromDateDayNumber(dayNumber) {
    if (typeof dayNumber !== 'number' || dayNumber < 0 || dayNumber > 6) {
      throw new Error('Day number must be between 0 (Sunday) and 6 (Saturday)');
    }

    return new DayOfWeek(DayOfWeek.ALL_DAYS[dayNumber]);
  }

  /**
   * Gets display name for UI
   */
  getDisplayName() {
    const displayNames = {
      [DayOfWeek.MONDAY]: 'Monday',
      [DayOfWeek.TUESDAY]: 'Tuesday',
      [DayOfWeek.WEDNESDAY]: 'Wednesday',
      [DayOfWeek.THURSDAY]: 'Thursday',
      [DayOfWeek.FRIDAY]: 'Friday',
      [DayOfWeek.SATURDAY]: 'Saturday',
      [DayOfWeek.SUNDAY]: 'Sunday'
    };
    return displayNames[this.value];
  }

  /**
   * Gets abbreviated display name
   */
  getAbbreviation() {
    const abbreviations = {
      [DayOfWeek.MONDAY]: 'Mon',
      [DayOfWeek.TUESDAY]: 'Tue',
      [DayOfWeek.WEDNESDAY]: 'Wed',
      [DayOfWeek.THURSDAY]: 'Thu',
      [DayOfWeek.FRIDAY]: 'Fri',
      [DayOfWeek.SATURDAY]: 'Sat',
      [DayOfWeek.SUNDAY]: 'Sun'
    };
    return abbreviations[this.value];
  }

  /**
   * Equality comparison
   */
  equals(other) {
    return other instanceof DayOfWeek && other.value === this.value;
  }

  /**
   * String representation
   */
  toString() {
    return this.value;
  }

  /**
   * JSON serialization
   */
  toJSON() {
    return this.value;
  }
}

module.exports = DayOfWeek;