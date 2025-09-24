const ScheduleExpression = require('../../../../src/domain/valueObjects/ScheduleExpression');
const DayOfWeek = require('../../../../src/domain/valueObjects/DayOfWeek');
const Time = require('../../../../src/domain/valueObjects/Time');

describe('ScheduleExpression', () => {
  let mondayWednesday;
  let morningTime;
  let eveningTime;

  beforeEach(() => {
    mondayWednesday = [
      new DayOfWeek(DayOfWeek.MONDAY),
      new DayOfWeek(DayOfWeek.WEDNESDAY)
    ];
    morningTime = new Time(9, 0);
    eveningTime = new Time(18, 30);
  });

  describe('constructor', () => {
    test('should create valid schedule expression', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      
      expect(schedule.daysOfWeek).toEqual(mondayWednesday);
      expect(schedule.time).toBe(morningTime);
      expect(schedule.timezone).toBe('UTC');
      expect(() => schedule.daysOfWeek = []).toThrow(); // Should be frozen
    });

    test('should default to UTC timezone', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      expect(schedule.timezone).toBe('UTC');
    });

    test('should validate daysOfWeek parameter', () => {
      expect(() => new ScheduleExpression(null, morningTime)).toThrow('daysOfWeek must be a non-empty array of DayOfWeek objects');
      expect(() => new ScheduleExpression([], morningTime)).toThrow('daysOfWeek must be a non-empty array of DayOfWeek objects');
      expect(() => new ScheduleExpression('invalid', morningTime)).toThrow('daysOfWeek must be a non-empty array of DayOfWeek objects');
      expect(() => new ScheduleExpression(['MONDAY'], morningTime)).toThrow('All elements in daysOfWeek must be DayOfWeek instances');
    });

    test('should validate time parameter', () => {
      expect(() => new ScheduleExpression(mondayWednesday, null)).toThrow('time must be a Time instance');
      expect(() => new ScheduleExpression(mondayWednesday, '09:00')).toThrow('time must be a Time instance');
    });

    test('should validate timezone parameter', () => {
      expect(() => new ScheduleExpression(mondayWednesday, morningTime, null)).toThrow('timezone must be a non-empty string');
      expect(() => new ScheduleExpression(mondayWednesday, morningTime, '')).toThrow('timezone must be a non-empty string');
      expect(() => new ScheduleExpression(mondayWednesday, morningTime, 123)).toThrow('timezone must be a non-empty string');
    });

    test('should create defensive copy of daysOfWeek', () => {
      const originalDays = [...mondayWednesday];
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      
      // Modifying original array should not affect schedule
      mondayWednesday.push(new DayOfWeek(DayOfWeek.FRIDAY));
      expect(schedule.daysOfWeek).toEqual(originalDays);
    });
  });

  describe('fromData', () => {
    test('should create from data with day strings and time string', () => {
      const data = {
        daysOfWeek: ['MONDAY', 'WEDNESDAY'],
        time: '09:00',
        timezone: 'UTC'
      };
      
      const schedule = ScheduleExpression.fromData(data);
      expect(schedule.daysOfWeek).toHaveLength(2);
      expect(schedule.daysOfWeek[0].value).toBe(DayOfWeek.MONDAY);
      expect(schedule.time.hour).toBe(9);
      expect(schedule.time.minute).toBe(0);
    });

    test('should create from data with DayOfWeek instances and Time instance', () => {
      const data = {
        daysOfWeek: mondayWednesday,
        time: morningTime,
        timezone: 'America/New_York'
      };
      
      const schedule = ScheduleExpression.fromData(data);
      expect(schedule.daysOfWeek).toEqual(mondayWednesday);
      expect(schedule.time).toBe(morningTime);
      expect(schedule.timezone).toBe('America/New_York');
    });

    test('should create from data with collection string', () => {
      const data = {
        daysOfWeek: 'WEEKDAYS',
        time: '17:30'
      };
      
      const schedule = ScheduleExpression.fromData(data);
      expect(schedule.daysOfWeek).toHaveLength(5);
      expect(schedule.time.hour).toBe(17);
      expect(schedule.time.minute).toBe(30);
      expect(schedule.timezone).toBe('UTC');
    });

    test('should create from data with time object', () => {
      const data = {
        daysOfWeek: ['MONDAY'],
        time: { hour: 14, minute: 30 }
      };
      
      const schedule = ScheduleExpression.fromData(data);
      expect(schedule.time.hour).toBe(14);
      expect(schedule.time.minute).toBe(30);
    });

    test('should validate input data', () => {
      expect(() => ScheduleExpression.fromData(null)).toThrow('Schedule data must be an object');
      expect(() => ScheduleExpression.fromData('invalid')).toThrow('Schedule data must be an object');
      
      expect(() => ScheduleExpression.fromData({
        daysOfWeek: 123,
        time: '09:00'
      })).toThrow('daysOfWeek must be an array or string');
      
      expect(() => ScheduleExpression.fromData({
        daysOfWeek: ['MONDAY'],
        time: 'invalid'
      })).toThrow(); // Time parsing error
    });
  });

  describe('getNextExecutionTime', () => {
    test('should calculate next execution for same day in future', () => {
      const schedule = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(15, 0));
      
      // Monday at 10:00 AM, schedule at 3:00 PM should return same day
      const monday10AM = new Date(2023, 11, 25, 10, 0); // December 25, 2023 is a Monday
      const nextExecution = schedule.getNextExecutionTime(monday10AM);
      
      expect(nextExecution.getDay()).toBe(1); // Monday
      expect(nextExecution.getHours()).toBe(15);
      expect(nextExecution.getMinutes()).toBe(0);
      expect(nextExecution.toDateString()).toBe(monday10AM.toDateString());
    });

    test('should calculate next execution for next occurrence of day', () => {
      const schedule = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(9, 0));
      
      // Monday at 10:00 AM, schedule at 9:00 AM should return next Monday
      const monday10AM = new Date(2023, 11, 25, 10, 0);
      const nextExecution = schedule.getNextExecutionTime(monday10AM);
      
      expect(nextExecution.getDay()).toBe(1); // Monday
      expect(nextExecution.getHours()).toBe(9);
      expect(nextExecution.getMinutes()).toBe(0);
      expect(nextExecution.getDate()).toBe(32); // January 1, 2024 (next Monday)
    });

    test('should calculate next execution for multiple days', () => {
      const schedule = new ScheduleExpression([
        new DayOfWeek(DayOfWeek.TUESDAY),
        new DayOfWeek(DayOfWeek.THURSDAY)
      ], new Time(14, 30));
      
      // Monday, should return Tuesday
      const monday = new Date(2023, 11, 25, 10, 0); // Monday
      const nextExecution = schedule.getNextExecutionTime(monday);
      
      expect(nextExecution.getDay()).toBe(2); // Tuesday
      expect(nextExecution.getHours()).toBe(14);
      expect(nextExecution.getMinutes()).toBe(30);
    });

    test('should validate fromDate parameter', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      
      expect(() => schedule.getNextExecutionTime('invalid')).toThrow('fromDate must be a Date instance');
      expect(() => schedule.getNextExecutionTime(null)).toThrow('fromDate must be a Date instance');
    });

    test('should handle edge case where search exceeds maximum days', () => {
      // This shouldn't happen with valid days, but test error handling
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      
      // Mock the search to always fail
      const originalIncludes = Array.prototype.includes;
      Array.prototype.includes = jest.fn().mockReturnValue(false);
      
      expect(() => schedule.getNextExecutionTime(new Date())).toThrow('Could not calculate next execution time');
      
      // Restore original method
      Array.prototype.includes = originalIncludes;
    });
  });

  describe('matchesDay', () => {
    test('should return true for matching days', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      
      const monday = new Date(2023, 11, 25); // Monday
      const wednesday = new Date(2023, 11, 27); // Wednesday
      const tuesday = new Date(2023, 11, 26); // Tuesday
      
      expect(schedule.matchesDay(monday)).toBe(true);
      expect(schedule.matchesDay(wednesday)).toBe(true);
      expect(schedule.matchesDay(tuesday)).toBe(false);
    });

    test('should validate date parameter', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      
      expect(() => schedule.matchesDay('invalid')).toThrow('date must be a Date instance');
      expect(() => schedule.matchesDay(null)).toThrow('date must be a Date instance');
    });
  });

  describe('shouldExecuteAt', () => {
    test('should return true when both day and time match', () => {
      const schedule = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(14, 30));
      
      const mondayAt1430 = new Date(2023, 11, 25, 14, 30); // Monday at 2:30 PM
      const mondayAt1500 = new Date(2023, 11, 25, 15, 0);  // Monday at 3:00 PM
      const tuesdayAt1430 = new Date(2023, 11, 26, 14, 30); // Tuesday at 2:30 PM
      
      expect(schedule.shouldExecuteAt(mondayAt1430)).toBe(true);
      expect(schedule.shouldExecuteAt(mondayAt1500)).toBe(false);
      expect(schedule.shouldExecuteAt(tuesdayAt1430)).toBe(false);
    });

    test('should validate date parameter', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      
      expect(() => schedule.shouldExecuteAt('invalid')).toThrow('date must be a Date instance');
    });
  });

  describe('getUpcomingExecutions', () => {
    test('should return upcoming executions within specified days', () => {
      const schedule = new ScheduleExpression([
        new DayOfWeek(DayOfWeek.MONDAY),
        new DayOfWeek(DayOfWeek.WEDNESDAY),
        new DayOfWeek(DayOfWeek.FRIDAY)
      ], new Time(9, 0));
      
      const startDate = new Date(2023, 11, 25, 10, 0); // Monday 10:00 AM (after 9:00 AM)
      const executions = schedule.getUpcomingExecutions(7, startDate);
      
      expect(executions.length).toBeGreaterThan(0);
      expect(executions.length).toBeLessThanOrEqual(3); // Max 3 in a week
      
      // All executions should be in the future
      executions.forEach(execution => {
        expect(execution.getTime()).toBeGreaterThan(startDate.getTime());
      });
      
      // Should be sorted
      for (let i = 1; i < executions.length; i++) {
        expect(executions[i].getTime()).toBeGreaterThan(executions[i-1].getTime());
      }
    });

    test('should handle default parameters', () => {
      const schedule = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(9, 0));
      const executions = schedule.getUpcomingExecutions();
      
      expect(Array.isArray(executions)).toBe(true);
    });

    test('should validate parameters', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      
      expect(() => schedule.getUpcomingExecutions(-1)).toThrow('days must be a positive number');
      expect(() => schedule.getUpcomingExecutions(0)).toThrow('days must be a positive number');
      expect(() => schedule.getUpcomingExecutions('invalid')).toThrow('days must be a positive number');
    });
  });

  describe('isValid', () => {
    test('should return true for valid schedules', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      expect(schedule.isValid()).toBe(true);
    });

    test('should return false for invalid schedules', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      
      // Mock getNextExecutionTime to throw error
      const originalMethod = schedule.getNextExecutionTime;
      schedule.getNextExecutionTime = jest.fn().mockImplementation(() => {
        throw new Error('Invalid schedule');
      });
      
      expect(schedule.isValid()).toBe(false);
      
      // Restore original method
      schedule.getNextExecutionTime = originalMethod;
    });
  });

  describe('getDescription', () => {
    test('should describe everyday schedule', () => {
      const everyday = DayOfWeek.ALL_DAYS.map(day => new DayOfWeek(day));
      const schedule = new ScheduleExpression(everyday, new Time(9, 30));
      
      expect(schedule.getDescription()).toBe('every day at 9:30 AM');
    });

    test('should describe weekdays schedule', () => {
      const weekdays = DayOfWeek.WEEKDAYS.map(day => new DayOfWeek(day));
      const schedule = new ScheduleExpression(weekdays, new Time(17, 0));
      
      expect(schedule.getDescription()).toBe('weekdays at 5 PM');
    });

    test('should describe weekends schedule', () => {
      const weekends = DayOfWeek.WEEKENDS.map(day => new DayOfWeek(day));
      const schedule = new ScheduleExpression(weekends, new Time(10, 0));
      
      expect(schedule.getDescription()).toBe('weekends at 10 AM');
    });

    test('should describe single day schedule', () => {
      const schedule = new ScheduleExpression([new DayOfWeek(DayOfWeek.FRIDAY)], new Time(15, 30));
      
      expect(schedule.getDescription()).toBe('every Friday at 3:30 PM');
    });

    test('should describe two-day schedule', () => {
      const schedule = new ScheduleExpression([
        new DayOfWeek(DayOfWeek.TUESDAY),
        new DayOfWeek(DayOfWeek.THURSDAY)
      ], new Time(8, 0));
      
      expect(schedule.getDescription()).toBe('Tuesday and Thursday at 8 AM');
    });

    test('should describe multi-day schedule', () => {
      const schedule = new ScheduleExpression([
        new DayOfWeek(DayOfWeek.MONDAY),
        new DayOfWeek(DayOfWeek.WEDNESDAY),
        new DayOfWeek(DayOfWeek.FRIDAY)
      ], new Time(12, 30));
      
      expect(schedule.getDescription()).toBe('Monday, Wednesday and Friday at 12:30 PM');
    });
  });

  describe('immutable modifications', () => {
    test('withDaysOfWeek should create new instance with different days', () => {
      const original = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      const newDays = [new DayOfWeek(DayOfWeek.FRIDAY)];
      const modified = original.withDaysOfWeek(newDays);
      
      expect(original.daysOfWeek).toEqual(mondayWednesday);
      expect(modified.daysOfWeek).toEqual(newDays);
      expect(modified.time).toBe(morningTime);
      expect(modified.timezone).toBe('UTC');
      expect(modified).not.toBe(original);
    });

    test('withTime should create new instance with different time', () => {
      const original = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      const modified = original.withTime(eveningTime);
      
      expect(original.time).toBe(morningTime);
      expect(modified.daysOfWeek).toEqual(mondayWednesday);
      expect(modified.time).toBe(eveningTime);
      expect(modified.timezone).toBe('UTC');
      expect(modified).not.toBe(original);
    });

    test('withTimezone should create new instance with different timezone', () => {
      const original = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      const modified = original.withTimezone('America/New_York');
      
      expect(original.timezone).toBe('UTC');
      expect(modified.daysOfWeek).toEqual(mondayWednesday);
      expect(modified.time).toBe(morningTime);
      expect(modified.timezone).toBe('America/New_York');
      expect(modified).not.toBe(original);
    });
  });

  describe('conflictsWith', () => {
    test('should detect conflicts with same day and similar time', () => {
      const schedule1 = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(9, 0));
      const schedule2 = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(9, 3));
      
      expect(schedule1.conflictsWith(schedule2, 5)).toBe(true);
      expect(schedule1.conflictsWith(schedule2, 2)).toBe(false);
    });

    test('should not detect conflicts with different days', () => {
      const schedule1 = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(9, 0));
      const schedule2 = new ScheduleExpression([new DayOfWeek(DayOfWeek.TUESDAY)], new Time(9, 0));
      
      expect(schedule1.conflictsWith(schedule2)).toBe(false);
    });

    test('should detect conflicts with overlapping days', () => {
      const schedule1 = new ScheduleExpression([
        new DayOfWeek(DayOfWeek.MONDAY),
        new DayOfWeek(DayOfWeek.WEDNESDAY)
      ], new Time(9, 0));
      
      const schedule2 = new ScheduleExpression([
        new DayOfWeek(DayOfWeek.WEDNESDAY),
        new DayOfWeek(DayOfWeek.FRIDAY)
      ], new Time(9, 2));
      
      expect(schedule1.conflictsWith(schedule2, 5)).toBe(true);
    });

    test('should validate input parameter', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime);
      
      expect(() => schedule.conflictsWith('invalid')).toThrow('otherSchedule must be a ScheduleExpression instance');
    });
  });

  describe('equals', () => {
    test('should return true for identical schedules', () => {
      const schedule1 = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      const schedule2 = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      
      expect(schedule1.equals(schedule2)).toBe(true);
    });

    test('should return false for different timezones', () => {
      const schedule1 = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      const schedule2 = new ScheduleExpression(mondayWednesday, morningTime, 'EST');
      
      expect(schedule1.equals(schedule2)).toBe(false);
    });

    test('should return false for different times', () => {
      const schedule1 = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      const schedule2 = new ScheduleExpression(mondayWednesday, eveningTime, 'UTC');
      
      expect(schedule1.equals(schedule2)).toBe(false);
    });

    test('should return false for different days', () => {
      const schedule1 = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      const schedule2 = new ScheduleExpression([new DayOfWeek(DayOfWeek.FRIDAY)], morningTime, 'UTC');
      
      expect(schedule1.equals(schedule2)).toBe(false);
    });

    test('should handle day order independence', () => {
      const days1 = [new DayOfWeek(DayOfWeek.MONDAY), new DayOfWeek(DayOfWeek.WEDNESDAY)];
      const days2 = [new DayOfWeek(DayOfWeek.WEDNESDAY), new DayOfWeek(DayOfWeek.MONDAY)];
      
      const schedule1 = new ScheduleExpression(days1, morningTime, 'UTC');
      const schedule2 = new ScheduleExpression(days2, morningTime, 'UTC');
      
      expect(schedule1.equals(schedule2)).toBe(true);
    });

    test('should return false for non-ScheduleExpression objects', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      
      expect(schedule.equals('invalid')).toBe(false);
      expect(schedule.equals(null)).toBe(false);
    });
  });

  describe('string representations', () => {
    test('toString should return description', () => {
      const schedule = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(9, 0));
      
      expect(schedule.toString()).toBe(schedule.getDescription());
    });

    test('toJSON should return proper structure', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime, 'America/New_York');
      const json = schedule.toJSON();
      
      expect(json).toEqual({
        daysOfWeek: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
        time: {
          hour: 9,
          minute: 0,
          formatted: '09:00'
        },
        timezone: 'America/New_York',
        description: schedule.getDescription()
      });
    });
  });

  describe('edge cases and boundary conditions', () => {
    test('should handle all seven days correctly', () => {
      const allDays = DayOfWeek.ALL_DAYS.map(day => new DayOfWeek(day));
      const schedule = new ScheduleExpression(allDays, new Time(12, 0));
      
      expect(schedule.daysOfWeek).toHaveLength(7);
      expect(schedule.isValid()).toBe(true);
    });

    test('should be immutable', () => {
      const schedule = new ScheduleExpression(mondayWednesday, morningTime, 'UTC');
      
      expect(() => {
        schedule.daysOfWeek = [];
      }).toThrow();
      
      expect(() => {
        schedule.time = eveningTime;
      }).toThrow();
      
      expect(() => {
        schedule.timezone = 'EST';
      }).toThrow();
    });

    test('should handle midnight and end of day times', () => {
      const midnightSchedule = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(0, 0));
      const endOfDaySchedule = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(23, 59));
      
      expect(midnightSchedule.isValid()).toBe(true);
      expect(endOfDaySchedule.isValid()).toBe(true);
    });

    test('should handle large number of days in upcoming executions', () => {
      const schedule = new ScheduleExpression([new DayOfWeek(DayOfWeek.MONDAY)], new Time(9, 0));
      const executions = schedule.getUpcomingExecutions(30);
      
      expect(executions.length).toBeLessThanOrEqual(5); // Max 5 Mondays in 30 days
    });
  });
});