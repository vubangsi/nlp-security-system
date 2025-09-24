const ScheduleParser = require('../../../../src/domain/services/ScheduleParser');
const ScheduleExpression = require('../../../../src/domain/valueObjects/ScheduleExpression');
const DayOfWeek = require('../../../../src/domain/valueObjects/DayOfWeek');
const Time = require('../../../../src/domain/valueObjects/Time');

describe('ScheduleParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ScheduleParser();
  });

  describe('parseScheduleCommand', () => {
    test('should parse basic schedule command', () => {
      const result = parser.parseScheduleCommand('weekdays at 9 PM');

      expect(result.scheduleExpression).toBeInstanceOf(ScheduleExpression);
      expect(result.scheduleExpression.daysOfWeek).toHaveLength(5);
      expect(result.scheduleExpression.time.hour).toBe(21);
      expect(result.scheduleExpression.time.minute).toBe(0);
      expect(result.actionType).toBe('ARM_SYSTEM');
      expect(result.actionParameters.mode).toBe('away');
    });

    test('should parse arm command with mode', () => {
      const result = parser.parseScheduleCommand('arm system in stay mode weekdays at 8:30 AM');

      expect(result.actionType).toBe('ARM_SYSTEM');
      expect(result.actionParameters.mode).toBe('stay');
      expect(result.scheduleExpression.time.hour).toBe(8);
      expect(result.scheduleExpression.time.minute).toBe(30);
    });

    test('should parse disarm command', () => {
      const result = parser.parseScheduleCommand('disarm system weekends at 10 AM');

      expect(result.actionType).toBe('DISARM_SYSTEM');
      expect(result.scheduleExpression.daysOfWeek).toHaveLength(2);
      expect(result.scheduleExpression.daysOfWeek.every(d => d.isWeekend())).toBe(true);
    });

    test('should parse schedule with command prefixes', () => {
      const commands = [
        'schedule weekdays at 9 PM',
        'set up weekdays at 9 PM',
        'create weekdays at 9 PM',
        'add weekdays at 9 PM'
      ];

      commands.forEach(command => {
        const result = parser.parseScheduleCommand(command);
        expect(result.scheduleExpression.daysOfWeek).toHaveLength(5);
        expect(result.scheduleExpression.time.hour).toBe(21);
      });
    });

    test('should validate input parameters', () => {
      expect(() => parser.parseScheduleCommand(null)).toThrow('Command must be a non-empty string');
      expect(() => parser.parseScheduleCommand('')).toThrow('Command must be a non-empty string');
      expect(() => parser.parseScheduleCommand(123)).toThrow('Command must be a non-empty string');
    });

    test('should handle invalid schedule format', () => {
      expect(() => parser.parseScheduleCommand('weekdays')).toThrow('Could not parse schedule format');
      expect(() => parser.parseScheduleCommand('random text')).toThrow('Could not parse schedule format');
    });

    test('should handle conflicting arm/disarm commands', () => {
      expect(() => parser.parseScheduleCommand('arm and disarm system weekdays at 9 PM')).toThrow('Command contains both arm and disarm keywords');
    });
  });

  describe('extractDays', () => {
    test('should extract weekdays', () => {
      const days = parser.extractDays('weekdays');

      expect(days).toHaveLength(5);
      expect(days.every(d => d.isWeekday())).toBe(true);
    });

    test('should extract weekends', () => {
      const days = parser.extractDays('weekends');

      expect(days).toHaveLength(2);
      expect(days.every(d => d.isWeekend())).toBe(true);
    });

    test('should extract everyday variations', () => {
      const variations = ['everyday', 'daily', 'all days'];

      variations.forEach(variation => {
        const days = parser.extractDays(variation);
        expect(days).toHaveLength(7);
      });
    });

    test('should extract specific days', () => {
      const days = parser.extractDays('Monday Wednesday Friday');

      expect(days).toHaveLength(3);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.FRIDAY
      ]);
    });

    test('should extract days with "and" separator', () => {
      const days = parser.extractDays('Monday and Tuesday and Wednesday');

      expect(days).toHaveLength(3);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY
      ]);
    });

    test('should extract days with comma separator', () => {
      const days = parser.extractDays('Monday, Tuesday, Wednesday');

      expect(days).toHaveLength(3);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY
      ]);
    });

    test('should handle abbreviated day names', () => {
      const days = parser.extractDays('Mon Tue Wed');

      expect(days).toHaveLength(3);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY
      ]);
    });

    test('should remove duplicate days', () => {
      const days = parser.extractDays('Monday Monday Tuesday Monday');

      expect(days).toHaveLength(2);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY
      ]);
    });

    test('should handle mixed collections and specific days', () => {
      const days = parser.extractDays('weekdays and Saturday');

      expect(days).toHaveLength(6);
      expect(days.some(d => d.value === DayOfWeek.SATURDAY)).toBe(true);
      expect(days.filter(d => d.isWeekday())).toHaveLength(5);
    });

    test('should validate input parameters', () => {
      expect(() => parser.extractDays(null)).toThrow('Days text must be a non-empty string');
      expect(() => parser.extractDays('')).toThrow('Days text must be a non-empty string');
      expect(() => parser.extractDays(123)).toThrow('Days text must be a non-empty string');
    });

    test('should handle invalid day names', () => {
      expect(() => parser.extractDays('invalid day name')).toThrow('Could not parse days from');
      expect(() => parser.extractDays('xyz')).toThrow('Could not parse any valid days from');
    });

    test('should handle case insensitivity', () => {
      const days = parser.extractDays('MONDAY tuesday WeDnEsDaY');

      expect(days).toHaveLength(3);
      expect(days.map(d => d.value)).toEqual([
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY
      ]);
    });
  });

  describe('extractTime', () => {
    test('should extract 12-hour format with minutes', () => {
      const time = parser.extractTime('9:30 PM');

      expect(time.hour).toBe(21);
      expect(time.minute).toBe(30);
    });

    test('should extract 12-hour format without minutes', () => {
      const time = parser.extractTime('9 PM');

      expect(time.hour).toBe(21);
      expect(time.minute).toBe(0);
    });

    test('should extract 24-hour format', () => {
      const time = parser.extractTime('21:30');

      expect(time.hour).toBe(21);
      expect(time.minute).toBe(30);
    });

    test('should handle 12 AM correctly', () => {
      const time = parser.extractTime('12 AM');

      expect(time.hour).toBe(0);
      expect(time.minute).toBe(0);
    });

    test('should handle 12 PM correctly', () => {
      const time = parser.extractTime('12 PM');

      expect(time.hour).toBe(12);
      expect(time.minute).toBe(0);
    });

    test('should handle noon and midnight', () => {
      const noon = parser.extractTime('noon');
      const midnight = parser.extractTime('midnight');

      expect(noon.hour).toBe(12);
      expect(noon.minute).toBe(0);
      expect(midnight.hour).toBe(0);
      expect(midnight.minute).toBe(0);
    });

    test('should handle common time expressions', () => {
      const times = {
        'morning': { hour: 9, minute: 0 },
        'afternoon': { hour: 14, minute: 0 },
        'evening': { hour: 18, minute: 0 },
        'night': { hour: 21, minute: 0 }
      };

      Object.entries(times).forEach(([expression, expected]) => {
        const time = parser.extractTime(expression);
        expect(time.hour).toBe(expected.hour);
        expect(time.minute).toBe(expected.minute);
      });
    });

    test('should handle hour-only format with heuristics', () => {
      // Early hours (1-7) assumed AM
      const early = parser.extractTime('7');
      expect(early.hour).toBe(7);

      // Later hours (8-11) assumed PM (8 becomes 20)
      const later = parser.extractTime('8');
      expect(later.hour).toBe(20);

      // 24-hour format hours (13-23) used as-is
      const twentyFour = parser.extractTime('15');
      expect(twentyFour.hour).toBe(15);
    });

    test('should handle case insensitivity', () => {
      const times = ['9 pm', '9 PM', '9 Pm', '9 pM'];

      times.forEach(timeStr => {
        const time = parser.extractTime(timeStr);
        expect(time.hour).toBe(21);
      });
    });

    test('should validate input parameters', () => {
      expect(() => parser.extractTime(null)).toThrow('Time text must be a non-empty string');
      expect(() => parser.extractTime('')).toThrow('Time text must be a non-empty string');
      expect(() => parser.extractTime(123)).toThrow('Time text must be a non-empty string');
    });

    test('should handle invalid time formats', () => {
      expect(() => parser.extractTime('invalid time')).toThrow('Could not parse time from');
      expect(() => parser.extractTime('25:00')).toThrow(); // Invalid hour in Time constructor
      expect(() => parser.extractTime('12:60 PM')).toThrow(); // Invalid minute in Time constructor
    });

    test('should handle edge time cases', () => {
      const times = [
        { input: '12:01 AM', expected: { hour: 0, minute: 1 } },
        { input: '12:59 AM', expected: { hour: 0, minute: 59 } },
        { input: '12:01 PM', expected: { hour: 12, minute: 1 } },
        { input: '12:59 PM', expected: { hour: 12, minute: 59 } },
        { input: '1 AM', expected: { hour: 1, minute: 0 } },
        { input: '11 PM', expected: { hour: 23, minute: 0 } }
      ];

      times.forEach(({ input, expected }) => {
        const time = parser.extractTime(input);
        expect(time.hour).toBe(expected.hour);
        expect(time.minute).toBe(expected.minute);
      });
    });
  });

  describe('parseActionType', () => {
    test('should parse arm commands', () => {
      const commands = [
        'arm system weekdays at 9 PM',
        'activate system weekdays at 9 PM',
        'enable security weekdays at 9 PM',
        'turn on alarm weekdays at 9 PM'
      ];

      commands.forEach(command => {
        const result = parser.parseActionType(command);
        expect(result.actionType).toBe('ARM_SYSTEM');
        expect(result.actionParameters.mode).toBe('away'); // default
      });
    });

    test('should parse disarm commands', () => {
      const commands = [
        'disarm system weekdays at 9 PM',
        'deactivate system weekdays at 9 PM',
        'disable security weekdays at 9 PM',
        'turn off alarm weekdays at 9 PM'
      ];

      commands.forEach(command => {
        const result = parser.parseActionType(command);
        expect(result.actionType).toBe('DISARM_SYSTEM');
        expect(result.actionParameters.zoneIds).toEqual([]);
      });
    });

    test('should parse arm modes', () => {
      const modes = {
        'arm system in away mode': 'away',
        'arm system in stay mode': 'stay',
        'arm system in home mode': 'stay' // home maps to stay
      };

      Object.entries(modes).forEach(([command, expectedMode]) => {
        const result = parser.parseActionType(command);
        expect(result.actionType).toBe('ARM_SYSTEM');
        expect(result.actionParameters.mode).toBe(expectedMode);
      });
    });

    test('should default to arm system when no clear action', () => {
      const result = parser.parseActionType('weekdays at 9 PM');

      expect(result.actionType).toBe('ARM_SYSTEM');
      expect(result.actionParameters.mode).toBe('away');
      expect(result.actionParameters.zoneIds).toEqual([]);
    });

    test('should handle conflicting commands', () => {
      expect(() => parser.parseActionType('arm and disarm system')).toThrow('Command contains both arm and disarm keywords');
    });

    test('should be case insensitive', () => {
      const result = parser.parseActionType('ARM SYSTEM IN STAY MODE');

      expect(result.actionType).toBe('ARM_SYSTEM');
      expect(result.actionParameters.mode).toBe('stay');
    });
  });

  describe('validateParsedSchedule', () => {
    test('should validate valid schedule', () => {
      const scheduleExpression = new ScheduleExpression(
        [new DayOfWeek(DayOfWeek.MONDAY)],
        new Time(9, 0)
      );

      expect(() => parser.validateParsedSchedule(
        scheduleExpression,
        'ARM_SYSTEM',
        { mode: 'away' }
      )).not.toThrow();

      expect(parser.validateParsedSchedule(
        scheduleExpression,
        'ARM_SYSTEM',
        { mode: 'away' }
      )).toBe(true);
    });

    test('should validate schedule expression type', () => {
      expect(() => parser.validateParsedSchedule(
        'invalid',
        'ARM_SYSTEM',
        { mode: 'away' }
      )).toThrow('Invalid schedule expression');
    });

    test('should validate schedule expression validity', () => {
      const scheduleExpression = new ScheduleExpression(
        [new DayOfWeek(DayOfWeek.MONDAY)],
        new Time(9, 0)
      );

      // Mock isValid to return false
      const originalIsValid = scheduleExpression.isValid;
      scheduleExpression.isValid = jest.fn().mockReturnValue(false);

      expect(() => parser.validateParsedSchedule(
        scheduleExpression,
        'ARM_SYSTEM',
        { mode: 'away' }
      )).toThrow('Schedule expression is not valid');

      // Restore original method
      scheduleExpression.isValid = originalIsValid;
    });
  });

  describe('parseMultipleCommands', () => {
    test('should parse multiple valid commands', () => {
      const commands = [
        'weekdays at 9 PM',
        'weekends at 10 AM',
        'disarm system Monday at 8 AM'
      ];

      const result = parser.parseMultipleCommands(commands);

      expect(result.results).toHaveLength(3);
      expect(result.errors).toHaveLength(0);

      result.results.forEach((res, index) => {
        expect(res.index).toBe(index);
        expect(res.command).toBe(commands[index]);
        expect(res.scheduleExpression).toBeInstanceOf(ScheduleExpression);
        expect(res.actionType).toBeDefined();
        expect(res.actionParameters).toBeDefined();
      });
    });

    test('should handle commands with errors', () => {
      const commands = [
        'weekdays at 9 PM', // valid
        'invalid command',  // invalid
        'weekends at 10 AM' // valid
      ];

      const result = parser.parseMultipleCommands(commands);

      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(1);

      expect(result.errors[0].index).toBe(1);
      expect(result.errors[0].command).toBe('invalid command');
      expect(result.errors[0].error).toBeDefined();
    });

    test('should validate input parameter', () => {
      expect(() => parser.parseMultipleCommands('not an array')).toThrow('Commands must be an array');
    });

    test('should handle empty array', () => {
      const result = parser.parseMultipleCommands([]);

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getSuggestions', () => {
    test('should provide suggestions for schedule format errors', () => {
      const suggestions = parser.getSuggestions('command', 'Could not parse schedule format');

      expect(suggestions).toContain('Use format like: "weekdays at 9 PM" or "Monday and Tuesday at 8:30 AM"');
    });

    test('should provide suggestions for day parsing errors', () => {
      const suggestions = parser.getSuggestions('command', 'Could not parse days');

      expect(suggestions).toContain('Try: "weekdays", "weekends", "Monday", "Monday and Tuesday", "everyday"');
    });

    test('should provide suggestions for time parsing errors', () => {
      const suggestions = parser.getSuggestions('command', 'Could not parse time');

      expect(suggestions).toContain('Try: "9 PM", "9:30 AM", "21:30", "noon", "midnight"');
    });

    test('should provide suggestions for conflicting commands', () => {
      const suggestions = parser.getSuggestions('command', 'both arm and disarm');

      expect(suggestions).toContain('Use either "arm system" or "disarm system", not both');
    });

    test('should handle unknown errors', () => {
      const suggestions = parser.getSuggestions('command', 'Unknown error message');

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('integration tests', () => {
    test('should parse complex schedule commands', () => {
      const commands = [
        'schedule arm system in stay mode Monday, Wednesday and Friday at 11:30 PM',
        'set up disarm security weekdays at 7 AM',
        'create activate alarm weekends at noon',
        'add turn off system everyday at midnight'
      ];

      commands.forEach(command => {
        expect(() => parser.parseScheduleCommand(command)).not.toThrow();
        
        const result = parser.parseScheduleCommand(command);
        expect(result.scheduleExpression).toBeInstanceOf(ScheduleExpression);
        expect(result.actionType).toMatch(/^(ARM_SYSTEM|DISARM_SYSTEM)$/);
        expect(result.actionParameters).toBeDefined();
      });
    });

    test('should handle edge cases in natural language parsing', () => {
      const edgeCases = [
        'weekday at 9pm',     // singular weekday
        'weekend at 10AM',    // no space before AM
        'mon tue at 8:00',    // abbreviated days without commas
        'everyday at 6 o\'clock' // alternative time format
      ];

      edgeCases.forEach(command => {
        expect(() => parser.parseScheduleCommand(command)).not.toThrow();
      });
    });

    test('should maintain consistency across similar patterns', () => {
      const patterns = [
        ['weekdays at 9 PM', 'weekdays at 21:00'],
        ['Monday at noon', 'Monday at 12 PM'],
        ['weekend at midnight', 'weekend at 12 AM']
      ];

      patterns.forEach(([pattern1, pattern2]) => {
        const result1 = parser.parseScheduleCommand(pattern1);
        const result2 = parser.parseScheduleCommand(pattern2);

        expect(result1.scheduleExpression.time.hour).toBe(result2.scheduleExpression.time.hour);
        expect(result1.scheduleExpression.time.minute).toBe(result2.scheduleExpression.time.minute);
      });
    });
  });

  describe('performance and regex patterns', () => {
    test('should have compiled regex patterns', () => {
      expect(parser.patterns).toBeDefined();
      expect(parser.patterns.time12Hour).toBeInstanceOf(RegExp);
      expect(parser.patterns.specificDays).toBeInstanceOf(RegExp);
      expect(parser.patterns.scheduleCommand).toBeInstanceOf(RegExp);
    });

    test('should handle repeated parsing efficiently', () => {
      const command = 'weekdays at 9 PM';
      
      // Parse the same command multiple times
      for (let i = 0; i < 100; i++) {
        const result = parser.parseScheduleCommand(command);
        expect(result.scheduleExpression.time.hour).toBe(21);
      }
    });

    test('should have proper day mappings', () => {
      expect(parser.dayMappings).toBeDefined();
      expect(parser.dayMappings.monday).toBe('MONDAY');
      expect(parser.dayMappings.tue).toBe('TUESDAY');
      
      // Ensure all days are mapped
      Object.values(parser.dayMappings).forEach(value => {
        expect(DayOfWeek.ALL_DAYS).toContain(value);
      });
    });
  });
});