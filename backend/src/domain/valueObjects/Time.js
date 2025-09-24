/**
 * Time Value Object
 * 
 * Represents a time of day with validation and formatting capabilities.
 * Supports both 12-hour and 24-hour formats for parsing and display.
 */
class Time {
  constructor(hour, minute) {
    if (!Time.isValidHour(hour)) {
      throw new Error(`Invalid hour: ${hour}. Must be between 0 and 23`);
    }
    
    if (!Time.isValidMinute(minute)) {
      throw new Error(`Invalid minute: ${minute}. Must be between 0 and 59`);
    }

    this.hour = parseInt(hour, 10);
    this.minute = parseInt(minute, 10);
    Object.freeze(this);
  }

  /**
   * Creates Time from string input supporting various formats
   */
  static fromString(timeString) {
    if (!timeString || typeof timeString !== 'string') {
      throw new Error('Time string must be provided');
    }

    const input = timeString.trim().toUpperCase();
    
    // 24-hour format (HH:MM or H:MM)
    const time24Match = input.match(/^(\d{1,2}):(\d{2})$/);
    if (time24Match) {
      const hour = parseInt(time24Match[1], 10);
      const minute = parseInt(time24Match[2], 10);
      return new Time(hour, minute);
    }

    // 12-hour format with AM/PM
    const time12Match = input.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/) || 
                       input.match(/^(\d{1,2})\s*(AM|PM)$/);
    
    if (time12Match) {
      let hour = parseInt(time12Match[1], 10);
      const minute = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
      const meridiem = time12Match[time12Match[2] ? 3 : 2];

      // Convert 12-hour to 24-hour format
      if (meridiem === 'AM') {
        if (hour === 12) hour = 0; // 12 AM = 0:00
      } else { // PM
        if (hour !== 12) hour += 12; // 1 PM = 13:00, but 12 PM = 12:00
      }

      return new Time(hour, minute);
    }

    // Just hour number (assumes top of hour)
    const hourMatch = input.match(/^(\d{1,2})$/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1], 10);
      return new Time(hour, 0);
    }

    throw new Error(`Invalid time format: ${timeString}. Supported formats: HH:MM, H:MM AM/PM, H AM/PM`);
  }

  /**
   * Creates Time from current system time
   */
  static now() {
    const now = new Date();
    return new Time(now.getHours(), now.getMinutes());
  }

  /**
   * Creates Time from Date object
   */
  static fromDate(date) {
    if (!(date instanceof Date)) {
      throw new Error('Input must be a Date object');
    }
    return new Time(date.getHours(), date.getMinutes());
  }

  /**
   * Validates hour value
   */
  static isValidHour(hour) {
    const h = parseInt(hour, 10);
    return !isNaN(h) && h >= 0 && h <= 23;
  }

  /**
   * Validates minute value
   */
  static isValidMinute(minute) {
    const m = parseInt(minute, 10);
    return !isNaN(m) && m >= 0 && m <= 59;
  }

  /**
   * Formats time in 24-hour format (HH:MM)
   */
  format24Hour() {
    return `${this.hour.toString().padStart(2, '0')}:${this.minute.toString().padStart(2, '0')}`;
  }

  /**
   * Formats time in 12-hour format (H:MM AM/PM)
   */
  format12Hour() {
    let displayHour = this.hour;
    let meridiem = 'AM';

    if (this.hour === 0) {
      displayHour = 12; // 12 AM
    } else if (this.hour === 12) {
      meridiem = 'PM'; // 12 PM
    } else if (this.hour > 12) {
      displayHour = this.hour - 12;
      meridiem = 'PM';
    }

    const minuteStr = this.minute === 0 ? '' : `:${this.minute.toString().padStart(2, '0')}`;
    return `${displayHour}${minuteStr} ${meridiem}`;
  }

  /**
   * Default string representation (24-hour format)
   */
  toString() {
    return this.format24Hour();
  }

  /**
   * Gets total minutes since midnight
   */
  getTotalMinutes() {
    return this.hour * 60 + this.minute;
  }

  /**
   * Creates Time from total minutes since midnight
   */
  static fromTotalMinutes(totalMinutes) {
    if (typeof totalMinutes !== 'number' || totalMinutes < 0 || totalMinutes >= 1440) {
      throw new Error('Total minutes must be between 0 and 1439 (24 hours)');
    }

    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return new Time(hour, minute);
  }

  /**
   * Compares this time with another time
   * Returns: -1 if this < other, 0 if equal, 1 if this > other
   */
  compareTo(other) {
    if (!(other instanceof Time)) {
      throw new Error('Can only compare with another Time object');
    }

    const thisMinutes = this.getTotalMinutes();
    const otherMinutes = other.getTotalMinutes();

    if (thisMinutes < otherMinutes) return -1;
    if (thisMinutes > otherMinutes) return 1;
    return 0;
  }

  /**
   * Checks if this time is before another time
   */
  isBefore(other) {
    return this.compareTo(other) < 0;
  }

  /**
   * Checks if this time is after another time
   */
  isAfter(other) {
    return this.compareTo(other) > 0;
  }

  /**
   * Equality comparison
   */
  equals(other) {
    return other instanceof Time && 
           other.hour === this.hour && 
           other.minute === this.minute;
  }

  /**
   * Adds minutes to this time and returns new Time object
   */
  addMinutes(minutes) {
    const totalMinutes = this.getTotalMinutes() + minutes;
    const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440; // Handle negative and >24h
    return Time.fromTotalMinutes(normalizedMinutes);
  }

  /**
   * Subtracts minutes from this time and returns new Time object
   */
  subtractMinutes(minutes) {
    return this.addMinutes(-minutes);
  }

  /**
   * Calculates difference in minutes between this time and another
   */
  differenceInMinutes(other) {
    if (!(other instanceof Time)) {
      throw new Error('Can only calculate difference with another Time object');
    }
    return other.getTotalMinutes() - this.getTotalMinutes();
  }

  /**
   * Creates a new Time with the specified hour and minute
   */
  withHour(hour) {
    return new Time(hour, this.minute);
  }

  withMinute(minute) {
    return new Time(this.hour, minute);
  }

  /**
   * Checks if this time is within business hours (9 AM to 6 PM)
   */
  isBusinessHours() {
    const businessStart = new Time(9, 0);
    const businessEnd = new Time(18, 0);
    return !this.isBefore(businessStart) && this.isBefore(businessEnd);
  }

  /**
   * JSON serialization
   */
  toJSON() {
    return {
      hour: this.hour,
      minute: this.minute,
      formatted: this.format24Hour()
    };
  }
}

module.exports = Time;