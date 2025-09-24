const DayOfWeek = require('../../../../src/domain/valueObjects/DayOfWeek');

describe('DayOfWeek', () => {
  describe('constructor', () => {
    test('should create valid day of week', () => {
      const day = new DayOfWeek(DayOfWeek.MONDAY);
      
      expect(day.value).toBe(DayOfWeek.MONDAY);
      
      // Test immutability - in non-strict mode, assignment fails silently
      const originalValue = day.value;
      day.value = DayOfWeek.TUESDAY;
      expect(day.value).toBe(originalValue); // Should remain unchanged
    });

    test('should reject invalid day', () => {
      expect(() => new DayOfWeek('INVALID')).toThrow('Invalid day: INVALID');
      expect(() => new DayOfWeek(null)).toThrow();
      expect(() => new DayOfWeek(undefined)).toThrow();
      expect(() => new DayOfWeek('')).toThrow();
    });
  });

  describe('fromString', () => {
    test('should parse full day names', () => {
      expect(DayOfWeek.fromString('MONDAY').value).toBe(DayOfWeek.MONDAY);
      expect(DayOfWeek.fromString('monday').value).toBe(DayOfWeek.MONDAY);
      expect(DayOfWeek.fromString('Monday').value).toBe(DayOfWeek.MONDAY);
      expect(DayOfWeek.fromString(' TUESDAY ').value).toBe(DayOfWeek.TUESDAY);
    });

    test('should parse abbreviated day names', () => {
      expect(DayOfWeek.fromString('MON').value).toBe(DayOfWeek.MONDAY);
      expect(DayOfWeek.fromString('tue').value).toBe(DayOfWeek.TUESDAY);
      expect(DayOfWeek.fromString('Wed').value).toBe(DayOfWeek.WEDNESDAY);
      expect(DayOfWeek.fromString('THU').value).toBe(DayOfWeek.THURSDAY);
      expect(DayOfWeek.fromString('fri').value).toBe(DayOfWeek.FRIDAY);
      expect(DayOfWeek.fromString('SAT').value).toBe(DayOfWeek.SATURDAY);
      expect(DayOfWeek.fromString('sun').value).toBe(DayOfWeek.SUNDAY);
    });

    test('should handle invalid input', () => {
      expect(() => DayOfWeek.fromString('')).toThrow('Day input must be a non-empty string');
      expect(() => DayOfWeek.fromString(null)).toThrow('Day input must be a non-empty string');
      expect(() => DayOfWeek.fromString(123)).toThrow('Day input must be a non-empty string');
      expect(() => DayOfWeek.fromString('INVALID')).toThrow('Unrecognized day format: INVALID');
    });
  });

  describe('expandDayCollection', () => {
    test('should expand weekdays collection', () => {
      const weekdays = DayOfWeek.expandDayCollection('WEEKDAYS');
      
      expect(weekdays).toHaveLength(5);
      expect(weekdays.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, 
        DayOfWeek.THURSDAY, DayOfWeek.FRIDAY
      ]);
    });

    test('should expand weekends collection', () => {
      const weekends = DayOfWeek.expandDayCollection('weekends');
      
      expect(weekends).toHaveLength(2);
      expect(weekends.map(d => d.value)).toEqual([DayOfWeek.SATURDAY, DayOfWeek.SUNDAY]);
    });

    test('should expand all days collection', () => {
      const allDays = DayOfWeek.expandDayCollection('EVERYDAY');
      expect(allDays).toHaveLength(7);
      
      const dailyDays = DayOfWeek.expandDayCollection('DAILY');
      expect(dailyDays).toHaveLength(7);
      
      const allKeyword = DayOfWeek.expandDayCollection('ALL');
      expect(allKeyword).toHaveLength(7);
    });

    test('should expand single day', () => {
      const singleDay = DayOfWeek.expandDayCollection('MONDAY');
      
      expect(singleDay).toHaveLength(1);
      expect(singleDay[0].value).toBe(DayOfWeek.MONDAY);
    });

    test('should handle invalid input', () => {
      expect(() => DayOfWeek.expandDayCollection('')).toThrow('Input must be a non-empty string');
      expect(() => DayOfWeek.expandDayCollection(null)).toThrow('Input must be a non-empty string');
    });
  });

  describe('parseMultipleDays', () => {
    test('should parse comma-separated days', () => {
      const days = DayOfWeek.parseMultipleDays('MONDAY, TUESDAY, WEDNESDAY');
      
      expect(days).toHaveLength(3);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY
      ]);
    });

    test('should parse "and" separated days', () => {
      const days = DayOfWeek.parseMultipleDays('MONDAY and TUESDAY and WEDNESDAY');
      
      expect(days).toHaveLength(3);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY
      ]);
    });

    test('should parse mixed separators', () => {
      const days = DayOfWeek.parseMultipleDays('MONDAY, TUESDAY and WEDNESDAY');
      
      expect(days).toHaveLength(3);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY
      ]);
    });

    test('should parse collections in mixed input', () => {
      const days = DayOfWeek.parseMultipleDays('WEEKDAYS, SATURDAY');
      
      expect(days).toHaveLength(6);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, 
        DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY
      ]);
    });

    test('should parse array input', () => {
      const days = DayOfWeek.parseMultipleDays(['MONDAY', 'WEEKENDS']);
      
      expect(days).toHaveLength(3);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY
      ]);
    });

    test('should handle invalid input', () => {
      expect(() => DayOfWeek.parseMultipleDays(123)).toThrow('Input must be a string or array of strings');
    });
  });

  describe('utility methods', () => {
    test('isWeekday should identify weekdays correctly', () => {
      expect(new DayOfWeek(DayOfWeek.MONDAY).isWeekday()).toBe(true);
      expect(new DayOfWeek(DayOfWeek.TUESDAY).isWeekday()).toBe(true);
      expect(new DayOfWeek(DayOfWeek.WEDNESDAY).isWeekday()).toBe(true);
      expect(new DayOfWeek(DayOfWeek.THURSDAY).isWeekday()).toBe(true);
      expect(new DayOfWeek(DayOfWeek.FRIDAY).isWeekday()).toBe(true);
      expect(new DayOfWeek(DayOfWeek.SATURDAY).isWeekday()).toBe(false);
      expect(new DayOfWeek(DayOfWeek.SUNDAY).isWeekday()).toBe(false);
    });

    test('isWeekend should identify weekends correctly', () => {
      expect(new DayOfWeek(DayOfWeek.SATURDAY).isWeekend()).toBe(true);
      expect(new DayOfWeek(DayOfWeek.SUNDAY).isWeekend()).toBe(true);
      expect(new DayOfWeek(DayOfWeek.MONDAY).isWeekend()).toBe(false);
      expect(new DayOfWeek(DayOfWeek.FRIDAY).isWeekend()).toBe(false);
    });
  });

  describe('date conversion', () => {
    test('toDateDayNumber should return correct JavaScript day numbers', () => {
      expect(new DayOfWeek(DayOfWeek.SUNDAY).toDateDayNumber()).toBe(0);
      expect(new DayOfWeek(DayOfWeek.MONDAY).toDateDayNumber()).toBe(1);
      expect(new DayOfWeek(DayOfWeek.TUESDAY).toDateDayNumber()).toBe(2);
      expect(new DayOfWeek(DayOfWeek.WEDNESDAY).toDateDayNumber()).toBe(3);
      expect(new DayOfWeek(DayOfWeek.THURSDAY).toDateDayNumber()).toBe(4);
      expect(new DayOfWeek(DayOfWeek.FRIDAY).toDateDayNumber()).toBe(5);
      expect(new DayOfWeek(DayOfWeek.SATURDAY).toDateDayNumber()).toBe(6);
    });

    test('fromDateDayNumber should create correct DayOfWeek instances', () => {
      expect(DayOfWeek.fromDateDayNumber(0).value).toBe(DayOfWeek.SUNDAY);
      expect(DayOfWeek.fromDateDayNumber(1).value).toBe(DayOfWeek.MONDAY);
      expect(DayOfWeek.fromDateDayNumber(6).value).toBe(DayOfWeek.SATURDAY);
    });

    test('fromDateDayNumber should validate input range', () => {
      expect(() => DayOfWeek.fromDateDayNumber(-1)).toThrow('Day number must be between 0 (Sunday) and 6 (Saturday)');
      expect(() => DayOfWeek.fromDateDayNumber(7)).toThrow('Day number must be between 0 (Sunday) and 6 (Saturday)');
      expect(() => DayOfWeek.fromDateDayNumber('invalid')).toThrow('Day number must be between 0 (Sunday) and 6 (Saturday)');
    });
  });

  describe('display methods', () => {
    test('getDisplayName should return proper display names', () => {
      expect(new DayOfWeek(DayOfWeek.MONDAY).getDisplayName()).toBe('Monday');
      expect(new DayOfWeek(DayOfWeek.SUNDAY).getDisplayName()).toBe('Sunday');
    });

    test('getAbbreviation should return proper abbreviations', () => {
      expect(new DayOfWeek(DayOfWeek.MONDAY).getAbbreviation()).toBe('Mon');
      expect(new DayOfWeek(DayOfWeek.WEDNESDAY).getAbbreviation()).toBe('Wed');
      expect(new DayOfWeek(DayOfWeek.SUNDAY).getAbbreviation()).toBe('Sun');
    });
  });

  describe('equality and serialization', () => {
    test('equals should work correctly', () => {
      const day1 = new DayOfWeek(DayOfWeek.MONDAY);
      const day2 = new DayOfWeek(DayOfWeek.MONDAY);
      const day3 = new DayOfWeek(DayOfWeek.TUESDAY);

      expect(day1.equals(day2)).toBe(true);
      expect(day1.equals(day3)).toBe(false);
      expect(day1.equals('MONDAY')).toBe(false);
      expect(day1.equals(null)).toBe(false);
    });

    test('toString should return day value', () => {
      const day = new DayOfWeek(DayOfWeek.FRIDAY);
      expect(day.toString()).toBe(DayOfWeek.FRIDAY);
    });

    test('toJSON should return day value', () => {
      const day = new DayOfWeek(DayOfWeek.SATURDAY);
      expect(day.toJSON()).toBe(DayOfWeek.SATURDAY);
    });
  });

  describe('edge cases and validation', () => {
    test('should handle empty strings in parsing', () => {
      expect(() => DayOfWeek.parseMultipleDays('MONDAY, , TUESDAY')).not.toThrow();
      const days = DayOfWeek.parseMultipleDays('MONDAY, , TUESDAY');
      expect(days).toHaveLength(2);
    });

    test('should be immutable', () => {
      const day = new DayOfWeek(DayOfWeek.MONDAY);
      
      // Test immutability - in non-strict mode, assignment fails silently
      const originalValue = day.value;
      day.value = DayOfWeek.TUESDAY;
      expect(day.value).toBe(originalValue); // Should remain unchanged
    });

    test('should validate static constants', () => {
      expect(DayOfWeek.ALL_DAYS).toHaveLength(7);
      expect(DayOfWeek.WEEKDAYS).toHaveLength(5);
      expect(DayOfWeek.WEEKENDS).toHaveLength(2);
      
      // Ensure all weekdays are valid
      DayOfWeek.WEEKDAYS.forEach(day => {
        expect(DayOfWeek.isValid(day)).toBe(true);
      });
      
      // Ensure all weekends are valid
      DayOfWeek.WEEKENDS.forEach(day => {
        expect(DayOfWeek.isValid(day)).toBe(true);
      });
    });
  });
});