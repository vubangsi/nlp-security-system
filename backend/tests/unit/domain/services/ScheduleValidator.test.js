const ScheduleValidator = require('../../../../src/domain/services/ScheduleValidator');
const ScheduledTask = require('../../../../src/domain/entities/ScheduledTask');
const ScheduleExpression = require('../../../../src/domain/valueObjects/ScheduleExpression');
const DayOfWeek = require('../../../../src/domain/valueObjects/DayOfWeek');
const Time = require('../../../../src/domain/valueObjects/Time');

describe('ScheduleValidator', () => {
  let validator;
  let validScheduledTask;

  beforeEach(() => {
    validator = new ScheduleValidator();
    
    const scheduleExpression = new ScheduleExpression(
      [new DayOfWeek(DayOfWeek.MONDAY)],
      new Time(9, 0),
      'UTC'
    );
    
    validScheduledTask = new ScheduledTask(
      'task-123',
      'user-456',
      scheduleExpression,
      ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
      { mode: 'away', zoneIds: [] }
    );
    validScheduledTask.activate();
  });

  describe('constructor', () => {
    test('should create validator with default options', () => {
      const defaultValidator = new ScheduleValidator();

      expect(defaultValidator.options.maxSchedulesPerUser).toBe(50);
      expect(defaultValidator.options.maxConflictToleranceMinutes).toBe(5);
      expect(defaultValidator.options.allowNightTimeScheduling).toBe(true);
      expect(defaultValidator.options.nightTimeStart.hour).toBe(22);
      expect(defaultValidator.options.nightTimeEnd.hour).toBe(6);
      expect(defaultValidator.options.minScheduleAdvanceMinutes).toBe(5);
      expect(defaultValidator.options.maxScheduleAdvanceDays).toBe(365);
      expect(defaultValidator.options.businessHoursOnly).toBe(false);
      expect(defaultValidator.options.allowWeekendScheduling).toBe(true);
    });

    test('should create validator with custom options', () => {
      const customValidator = new ScheduleValidator({
        maxSchedulesPerUser: 10,
        allowNightTimeScheduling: false,
        businessHoursOnly: true,
        allowWeekendScheduling: false
      });

      expect(customValidator.options.maxSchedulesPerUser).toBe(10);
      expect(customValidator.options.allowNightTimeScheduling).toBe(false);
      expect(customValidator.options.businessHoursOnly).toBe(true);
      expect(customValidator.options.allowWeekendScheduling).toBe(false);
    });
  });

  describe('validateNewSchedule', () => {
    test('should validate valid schedule', async () => {
      const result = await validator.validateNewSchedule(validScheduledTask);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate input parameter', async () => {
      await expect(validator.validateNewSchedule('invalid')).rejects.toThrow('scheduledTask must be a ScheduledTask instance');
    });

    test('should return validation results structure', async () => {
      const result = await validator.validateNewSchedule(validScheduledTask);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    test('should mark as invalid when errors exist', async () => {
      // Create invalid task with invalid next execution time
      const task = new ScheduledTask(
        'task-123',
        'user-456',
        validScheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      task.nextExecutionTime = null; // Force invalid next execution time

      const result = await validator.validateNewSchedule(task);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateScheduleUpdate', () => {
    test('should validate valid schedule update', async () => {
      const newScheduleExpression = new ScheduleExpression(
        [new DayOfWeek(DayOfWeek.TUESDAY)],
        new Time(10, 0),
        'UTC'
      );

      const result = await validator.validateScheduleUpdate(
        validScheduledTask,
        newScheduleExpression,
        []
      );

      expect(result.isValid).toBe(true);
    });

    test('should validate input parameters', async () => {
      const newScheduleExpression = new ScheduleExpression(
        [new DayOfWeek(DayOfWeek.TUESDAY)],
        new Time(10, 0),
        'UTC'
      );

      await expect(validator.validateScheduleUpdate('invalid', newScheduleExpression)).rejects.toThrow('scheduledTask must be a ScheduledTask instance');
      await expect(validator.validateScheduleUpdate(validScheduledTask, 'invalid')).rejects.toThrow('updatedScheduleExpression must be a ScheduleExpression instance');
    });

    test('should exclude current task from conflict checking', async () => {
      const existingSchedules = [validScheduledTask]; // Include the task being updated
      const newScheduleExpression = new ScheduleExpression(
        [new DayOfWeek(DayOfWeek.MONDAY)],
        new Time(9, 0), // Same time as original - would conflict if not excluded
        'UTC'
      );

      const result = await validator.validateScheduleUpdate(
        validScheduledTask,
        newScheduleExpression,
        existingSchedules
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('_validateBasicConstraints', () => {
    test('should validate valid basic constraints', async () => {
      const result = await validator.validateNewSchedule(validScheduledTask);

      expect(result.errors.filter(e => e.includes('Basic validation failed'))).toHaveLength(0);
    });

    test('should detect invalid schedule expression', async () => {
      // Mock isValid to return false
      const task = { ...validScheduledTask };
      task.scheduleExpression = {
        ...validScheduledTask.scheduleExpression,
        isValid: jest.fn().mockReturnValue(false)
      };

      const result = await validator.validateNewSchedule(task);

      expect(result.errors).toContain('Schedule expression is invalid');
    });

    test('should detect invalid action type', async () => {
      const task = { ...validScheduledTask };
      task.actionType = 'INVALID_ACTION';

      const result = await validator.validateNewSchedule(task);

      expect(result.errors).toContain('Invalid action type');
    });

    test('should validate ARM_SYSTEM parameters', async () => {
      const task = new ScheduledTask(
        'task-123',
        'user-456',
        validScheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'invalid' }
      );

      const result = await validator.validateNewSchedule(task);

      expect(result.errors).toContain('ARM_SYSTEM action requires valid mode (away or stay)');
    });

    test('should detect missing next execution time', async () => {
      const task = { ...validScheduledTask };
      task.nextExecutionTime = null;

      const result = await validator.validateNewSchedule(task);

      expect(result.errors).toContain('Cannot calculate next execution time from schedule');
    });
  });

  describe('_validateTimeConstraints', () => {
    test('should enforce minimum advance time', async () => {
      // Create task with next execution in the immediate future
      const now = new Date();
      const task = { ...validScheduledTask };
      task.nextExecutionTime = new Date(now.getTime() + 60000); // 1 minute from now

      const shortAdvanceValidator = new ScheduleValidator({
        minScheduleAdvanceMinutes: 5
      });

      const result = await shortAdvanceValidator.validateNewSchedule(task);

      expect(result.errors.some(e => e.includes('must be at least'))).toBe(true);
    });

    test('should enforce maximum advance time', async () => {
      const now = new Date();
      const task = { ...validScheduledTask };
      task.nextExecutionTime = new Date(now.getTime() + (400 * 24 * 60 * 60 * 1000)); // 400 days

      const result = await validator.validateNewSchedule(task);

      expect(result.errors.some(e => e.includes('cannot be more than'))).toBe(true);
    });

    test('should validate night time scheduling when disabled', async () => {
      const nightTimeValidator = new ScheduleValidator({
        allowNightTimeScheduling: false
      });

      const nightTask = new ScheduledTask(
        'task-123',
        'user-456',
        new ScheduleExpression(
          [new DayOfWeek(DayOfWeek.MONDAY)],
          new Time(23, 0), // 11 PM
          'UTC'
        ),
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );

      const result = await nightTimeValidator.validateNewSchedule(nightTask);

      expect(result.errors.some(e => e.includes('Night time scheduling'))).toBe(true);
    });

    test('should warn about night time scheduling when enabled', async () => {
      const nightTask = new ScheduledTask(
        'task-123',
        'user-456',
        new ScheduleExpression(
          [new DayOfWeek(DayOfWeek.MONDAY)],
          new Time(23, 0), // 11 PM
          'UTC'
        ),
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );

      const result = await validator.validateNewSchedule(nightTask);

      expect(result.warnings.some(w => w.includes('night time hours'))).toBe(true);
    });

    test('should enforce business hours only constraint', async () => {
      const businessHoursValidator = new ScheduleValidator({
        businessHoursOnly: true
      });

      const eveningTask = new ScheduledTask(
        'task-123',
        'user-456',
        new ScheduleExpression(
          [new DayOfWeek(DayOfWeek.MONDAY)],
          new Time(20, 0), // 8 PM
          'UTC'
        ),
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );

      const result = await businessHoursValidator.validateNewSchedule(eveningTask);

      expect(result.errors.some(e => e.includes('business hours'))).toBe(true);
    });

    test('should validate weekend scheduling when disabled', async () => {
      const noWeekendValidator = new ScheduleValidator({
        allowWeekendScheduling: false
      });

      const weekendTask = new ScheduledTask(
        'task-123',
        'user-456',
        new ScheduleExpression(
          [new DayOfWeek(DayOfWeek.SATURDAY)],
          new Time(9, 0),
          'UTC'
        ),
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );

      const result = await noWeekendValidator.validateNewSchedule(weekendTask);

      expect(result.errors.some(e => e.includes('Weekend scheduling'))).toBe(true);
    });
  });

  describe('_validateBusinessRules', () => {
    test('should warn about late night stay mode scheduling', async () => {
      const lateNightTask = new ScheduledTask(
        'task-123',
        'user-456',
        new ScheduleExpression(
          [new DayOfWeek(DayOfWeek.MONDAY)],
          new Time(23, 30), // 11:30 PM
          'UTC'
        ),
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'stay' }
      );

      const result = await validator.validateNewSchedule(lateNightTask);

      expect(result.warnings.some(w => w.includes('very late at night'))).toBe(true);
    });

    test('should warn about disarm outside morning hours', async () => {
      const afternoonDisarmTask = new ScheduledTask(
        'task-123',
        'user-456',
        new ScheduleExpression(
          [new DayOfWeek(DayOfWeek.MONDAY)],
          new Time(15, 0), // 3 PM
          'UTC'
        ),
        ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
        { zoneIds: [] }
      );

      const result = await validator.validateNewSchedule(afternoonDisarmTask);

      expect(result.warnings.some(w => w.includes('morning hours'))).toBe(true);
    });

    test('should not warn for disarm within morning hours', async () => {
      const morningDisarmTask = new ScheduledTask(
        'task-123',
        'user-456',
        new ScheduleExpression(
          [new DayOfWeek(DayOfWeek.MONDAY)],
          new Time(8, 0), // 8 AM
          'UTC'
        ),
        ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
        { zoneIds: [] }
      );

      const result = await validator.validateNewSchedule(morningDisarmTask);

      expect(result.warnings.some(w => w.includes('morning hours'))).toBe(false);
    });
  });

  describe('_validateUserLimits', () => {
    test('should enforce maximum schedules per user', async () => {
      const limitedValidator = new ScheduleValidator({
        maxSchedulesPerUser: 2
      });

      const existingSchedules = [
        { userId: 'user-456', status: ScheduledTask.STATUS.ACTIVE },
        { userId: 'user-456', status: ScheduledTask.STATUS.ACTIVE }
      ];

      const result = await limitedValidator.validateNewSchedule(validScheduledTask, existingSchedules);

      expect(result.errors.some(e => e.includes('maximum limit'))).toBe(true);
    });

    test('should warn when approaching limit', async () => {
      const limitedValidator = new ScheduleValidator({
        maxSchedulesPerUser: 5
      });

      const existingSchedules = Array(4).fill({
        userId: 'user-456',
        status: ScheduledTask.STATUS.ACTIVE
      });

      const result = await limitedValidator.validateNewSchedule(validScheduledTask, existingSchedules);

      expect(result.warnings.some(w => w.includes('approaching the schedule limit'))).toBe(true);
    });

    test('should not count inactive schedules toward limit', async () => {
      const limitedValidator = new ScheduleValidator({
        maxSchedulesPerUser: 2
      });

      const existingSchedules = [
        { userId: 'user-456', status: ScheduledTask.STATUS.COMPLETED },
        { userId: 'user-456', status: ScheduledTask.STATUS.CANCELLED },
        { userId: 'user-456', status: ScheduledTask.STATUS.ACTIVE }
      ];

      const result = await limitedValidator.validateNewSchedule(validScheduledTask, existingSchedules);

      expect(result.isValid).toBe(true);
    });

    test('should not count other users schedules toward limit', async () => {
      const limitedValidator = new ScheduleValidator({
        maxSchedulesPerUser: 1
      });

      const existingSchedules = [
        { userId: 'other-user', status: ScheduledTask.STATUS.ACTIVE }
      ];

      const result = await limitedValidator.validateNewSchedule(validScheduledTask, existingSchedules);

      expect(result.isValid).toBe(true);
    });
  });

  describe('_validateScheduleConflicts', () => {
    test('should detect time conflicts', async () => {
      const conflictingTask = new ScheduledTask(
        'existing-task',
        'user-456',
        new ScheduleExpression(
          [new DayOfWeek(DayOfWeek.MONDAY)],
          new Time(9, 3), // 3 minutes later
          'UTC'
        ),
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      conflictingTask.status = ScheduledTask.STATUS.ACTIVE;

      const result = await validator.validateNewSchedule(validScheduledTask, [conflictingTask]);

      expect(result.errors.some(e => e.includes('conflicts with'))).toBe(true);
    });

    test('should not detect conflicts for inactive schedules', async () => {
      const inactiveTask = new ScheduledTask(
        'inactive-task',
        'user-456',
        validScheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      inactiveTask.status = ScheduledTask.STATUS.COMPLETED;

      const result = await validator.validateNewSchedule(validScheduledTask, [inactiveTask]);

      expect(result.errors.some(e => e.includes('conflicts with'))).toBe(false);
    });

    test('should not detect conflicts between different users', async () => {
      const otherUserTask = new ScheduledTask(
        'other-task',
        'other-user',
        validScheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      otherUserTask.status = ScheduledTask.STATUS.ACTIVE;

      const result = await validator.validateNewSchedule(validScheduledTask, [otherUserTask]);

      expect(result.errors.some(e => e.includes('conflicts with'))).toBe(false);
    });

    test('should detect logical conflicts', async () => {
      const disarmTask = new ScheduledTask(
        'disarm-task',
        'user-456',
        new ScheduleExpression(
          [new DayOfWeek(DayOfWeek.MONDAY)],
          new Time(9, 15), // 15 minutes later
          'UTC'
        ),
        ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
        { zoneIds: [] }
      );
      disarmTask.status = ScheduledTask.STATUS.ACTIVE;

      const result = await validator.validateNewSchedule(validScheduledTask, [disarmTask]);

      expect(result.warnings.some(w => w.includes('logical conflict'))).toBe(true);
    });
  });

  describe('_validatePermissions', () => {
    test('should require user ID', async () => {
      const task = { ...validScheduledTask };
      task.userId = null;

      const result = await validator.validateNewSchedule(task);

      expect(result.errors).toContain('User ID is required for scheduled task');
    });

    test('should warn about system-wide actions', async () => {
      const systemWideTask = new ScheduledTask(
        'task-123',
        'user-456',
        validScheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away', zoneIds: [] } // Empty zoneIds = system-wide
      );

      const result = await validator.validateNewSchedule(systemWideTask);

      expect(result.warnings.some(w => w.includes('administrator privileges'))).toBe(true);
    });
  });

  describe('helper methods', () => {
    test('_isNightTime should detect night time correctly', () => {
      const nightTime = new Time(23, 0);
      const dayTime = new Time(12, 0);
      const earlyMorning = new Time(5, 0);

      expect(validator._isNightTime(nightTime)).toBe(true);
      expect(validator._isNightTime(dayTime)).toBe(false);
      expect(validator._isNightTime(earlyMorning)).toBe(true);
    });

    test('_isNightTime should handle night time spanning midnight', () => {
      const spanningValidator = new ScheduleValidator({
        nightTimeStart: new Time(22, 0), // 10 PM
        nightTimeEnd: new Time(6, 0)     // 6 AM
      });

      expect(spanningValidator._isNightTime(new Time(23, 0))).toBe(true);
      expect(spanningValidator._isNightTime(new Time(2, 0))).toBe(true);
      expect(spanningValidator._isNightTime(new Time(12, 0))).toBe(false);
    });

    test('_isBusinessHours should detect business hours correctly', () => {
      const businessTime = new Time(10, 0);
      const beforeBusiness = new Time(8, 0);
      const afterBusiness = new Time(18, 0);

      expect(validator._isBusinessHours(businessTime)).toBe(true);
      expect(validator._isBusinessHours(beforeBusiness)).toBe(false);
      expect(validator._isBusinessHours(afterBusiness)).toBe(false);
    });

    test('_findLogicalConflicts should find arm/disarm conflicts', () => {
      const armTask = validScheduledTask;
      const disarmTask = new ScheduledTask(
        'disarm-task',
        'user-456',
        new ScheduleExpression(
          [new DayOfWeek(DayOfWeek.MONDAY)],
          new Time(9, 20), // 20 minutes later
          'UTC'
        ),
        ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
        { zoneIds: [] }
      );
      disarmTask.status = ScheduledTask.STATUS.ACTIVE;

      const conflicts = validator._findLogicalConflicts(armTask, [disarmTask]);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]).toContain('too close to existing');
    });
  });

  describe('validateBulkSchedules', () => {
    test('should validate multiple schedules', async () => {
      const tasks = [
        validScheduledTask,
        new ScheduledTask(
          'task-2',
          'user-456',
          new ScheduleExpression(
            [new DayOfWeek(DayOfWeek.TUESDAY)],
            new Time(10, 0),
            'UTC'
          ),
          ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
          { zoneIds: [] }
        )
      ];

      const results = await validator.validateBulkSchedules(tasks);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result).toHaveProperty('taskId');
        expect(result).toHaveProperty('validation');
        expect(result.validation).toHaveProperty('isValid');
      });
    });

    test('should accumulate valid schedules for subsequent validation', async () => {
      const conflictingTasks = [
        validScheduledTask,
        new ScheduledTask(
          'conflicting-task',
          'user-456',
          validScheduledTask.scheduleExpression, // Same schedule
          ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
          { mode: 'away' }
        )
      ];

      const results = await validator.validateBulkSchedules(conflictingTasks);

      expect(results[0].validation.isValid).toBe(true);
      expect(results[1].validation.isValid).toBe(false);
      expect(results[1].validation.errors.some(e => e.includes('conflicts with'))).toBe(true);
    });
  });

  describe('getSuggestions', () => {
    test('should provide suggestions for common errors', () => {
      const validationResults = {
        errors: [
          'Schedule must be at least 5 minutes in the future',
          'Night time scheduling is not allowed',
          'Schedule conflicts with existing schedules',
          'User has reached the maximum limit',
          'Scheduling is only allowed during business hours'
        ]
      };

      const suggestions = validator.getSuggestions(validationResults);

      expect(suggestions).toContain('Try scheduling at least 5 minutes in the future');
      expect(suggestions).toContain('Consider scheduling during daytime hours (6 AM - 10 PM)');
      expect(suggestions).toContain('Choose a different time or modify existing conflicting schedules');
      expect(suggestions).toContain('Cancel some existing schedules or contact administrator for higher limits');
      expect(suggestions).toContain('Schedule during business hours (9 AM - 5 PM) if required by policy');
    });

    test('should handle empty errors', () => {
      const validationResults = { errors: [] };
      const suggestions = validator.getSuggestions(validationResults);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions).toHaveLength(0);
    });

    test('should handle unknown errors', () => {
      const validationResults = {
        errors: ['Unknown error message']
      };

      const suggestions = validator.getSuggestions(validationResults);

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle validation errors gracefully', async () => {
      // Create a task that will throw during validation
      const problematicTask = {
        ...validScheduledTask,
        scheduleExpression: {
          ...validScheduledTask.scheduleExpression,
          isValid: jest.fn().mockImplementation(() => {
            throw new Error('Validation error');
          })
        }
      };

      const result = await validator.validateNewSchedule(problematicTask);

      expect(result.errors.some(e => e.includes('Basic validation failed'))).toBe(true);
    });

    test('should handle missing next execution time', async () => {
      const taskWithoutExecution = { ...validScheduledTask };
      delete taskWithoutExecution.nextExecutionTime;

      const result = await validator.validateNewSchedule(taskWithoutExecution);

      expect(result.errors).toContain('Cannot calculate next execution time from schedule');
    });

    test('should handle custom validation options', async () => {
      const strictValidator = new ScheduleValidator({
        maxSchedulesPerUser: 1,
        minScheduleAdvanceMinutes: 60,
        allowNightTimeScheduling: false,
        businessHoursOnly: true,
        allowWeekendScheduling: false
      });

      // This should trigger multiple validation rules
      const result = await strictValidator.validateNewSchedule(validScheduledTask);

      // May have various errors depending on timing, but should not crash
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
    });
  });
});