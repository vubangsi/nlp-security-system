const ScheduledTask = require('../../../../src/domain/entities/ScheduledTask');
const ScheduleExpression = require('../../../../src/domain/valueObjects/ScheduleExpression');
const DayOfWeek = require('../../../../src/domain/valueObjects/DayOfWeek');
const Time = require('../../../../src/domain/valueObjects/Time');

describe('ScheduledTask', () => {
  let validScheduleExpression;
  let validId;
  let validUserId;

  beforeEach(() => {
    validScheduleExpression = new ScheduleExpression(
      [new DayOfWeek(DayOfWeek.MONDAY), new DayOfWeek(DayOfWeek.WEDNESDAY)],
      new Time(9, 0),
      'UTC'
    );
    validId = 'task-123';
    validUserId = 'user-456';
  });

  describe('constructor', () => {
    test('should create valid scheduled task', () => {
      const task = new ScheduledTask(
        validId,
        validUserId,
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away', zoneIds: [] }
      );

      expect(task.id).toBe(validId);
      expect(task.userId).toBe(validUserId);
      expect(task.scheduleExpression).toBe(validScheduleExpression);
      expect(task.actionType).toBe(ScheduledTask.ACTION_TYPE.ARM_SYSTEM);
      expect(task.actionParameters).toEqual({ mode: 'away', zoneIds: [] });
      expect(task.status).toBe(ScheduledTask.STATUS.PENDING);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.executionCount).toBe(0);
      expect(task.failureCount).toBe(0);
      expect(task.lastError).toBeNull();
      expect(task.nextExecutionTime).toBeDefined();
    });

    test('should validate id parameter', () => {
      expect(() => new ScheduledTask(
        null, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      )).toThrow('id must be a non-empty string');

      expect(() => new ScheduledTask(
        '', validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      )).toThrow('id must be a non-empty string');

      expect(() => new ScheduledTask(
        123, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      )).toThrow('id must be a non-empty string');
    });

    test('should validate userId parameter', () => {
      expect(() => new ScheduledTask(
        validId, null, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      )).toThrow('userId must be a non-empty string');

      expect(() => new ScheduledTask(
        validId, '', validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      )).toThrow('userId must be a non-empty string');
    });

    test('should validate scheduleExpression parameter', () => {
      expect(() => new ScheduledTask(
        validId, validUserId, null, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      )).toThrow('scheduleExpression must be a ScheduleExpression instance');

      expect(() => new ScheduledTask(
        validId, validUserId, 'invalid', ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      )).toThrow('scheduleExpression must be a ScheduleExpression instance');
    });

    test('should validate actionType parameter', () => {
      expect(() => new ScheduledTask(
        validId, validUserId, validScheduleExpression, 'INVALID_ACTION', { mode: 'away' }
      )).toThrow('actionType must be one of: ARM_SYSTEM, DISARM_SYSTEM');

      expect(() => new ScheduledTask(
        validId, validUserId, validScheduleExpression, null, { mode: 'away' }
      )).toThrow('actionType must be one of: ARM_SYSTEM, DISARM_SYSTEM');
    });

    test('should validate actionParameters parameter', () => {
      expect(() => new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, null
      )).toThrow('actionParameters must be an object');

      expect(() => new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, 'invalid'
      )).toThrow('actionParameters must be an object');
    });

    test('should create defensive copy of actionParameters', () => {
      const originalParams = { mode: 'away', zoneIds: [] };
      const task = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, originalParams
      );

      originalParams.mode = 'stay';
      expect(task.actionParameters.mode).toBe('away');
    });
  });

  describe('static factory methods', () => {
    test('createArmSystemTask should create ARM_SYSTEM task', () => {
      const task = ScheduledTask.createArmSystemTask(validId, validUserId, validScheduleExpression, 'stay', ['zone1']);

      expect(task.actionType).toBe(ScheduledTask.ACTION_TYPE.ARM_SYSTEM);
      expect(task.actionParameters).toEqual({ mode: 'stay', zoneIds: ['zone1'] });
    });

    test('createArmSystemTask should default to away mode and empty zones', () => {
      const task = ScheduledTask.createArmSystemTask(validId, validUserId, validScheduleExpression);

      expect(task.actionParameters).toEqual({ mode: 'away', zoneIds: [] });
    });

    test('createArmSystemTask should validate mode parameter', () => {
      expect(() => ScheduledTask.createArmSystemTask(
        validId, validUserId, validScheduleExpression, 'invalid'
      )).toThrow('mode must be "away" or "stay"');
    });

    test('createArmSystemTask should handle non-array zoneIds', () => {
      const task = ScheduledTask.createArmSystemTask(validId, validUserId, validScheduleExpression, 'away', 'not-array');

      expect(task.actionParameters.zoneIds).toEqual([]);
    });

    test('createDisarmSystemTask should create DISARM_SYSTEM task', () => {
      const task = ScheduledTask.createDisarmSystemTask(validId, validUserId, validScheduleExpression, ['zone1', 'zone2']);

      expect(task.actionType).toBe(ScheduledTask.ACTION_TYPE.DISARM_SYSTEM);
      expect(task.actionParameters).toEqual({ zoneIds: ['zone1', 'zone2'] });
    });

    test('createDisarmSystemTask should default to empty zones', () => {
      const task = ScheduledTask.createDisarmSystemTask(validId, validUserId, validScheduleExpression);

      expect(task.actionParameters).toEqual({ zoneIds: [] });
    });
  });

  describe('action parameter validation', () => {
    test('should validate ARM_SYSTEM parameters', () => {
      expect(() => new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, {}
      )).toThrow('ARM_SYSTEM requires mode to be "away" or "stay"');

      expect(() => new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'invalid' }
      )).toThrow('ARM_SYSTEM requires mode to be "away" or "stay"');

      expect(() => new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away', zoneIds: 'not-array' }
      )).toThrow('zoneIds must be an array when provided');
    });

    test('should validate DISARM_SYSTEM parameters', () => {
      expect(() => new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.DISARM_SYSTEM, { zoneIds: 'not-array' }
      )).toThrow('zoneIds must be an array when provided');

      // Should not throw for valid or missing zoneIds
      expect(() => new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.DISARM_SYSTEM, {}
      )).not.toThrow();

      expect(() => new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.DISARM_SYSTEM, { zoneIds: ['zone1'] }
      )).not.toThrow();
    });
  });

  describe('lifecycle methods', () => {
    let task;

    beforeEach(() => {
      task = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      );
    });

    test('activate should change status to ACTIVE', () => {
      task.activate();

      expect(task.status).toBe(ScheduledTask.STATUS.ACTIVE);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(task.nextExecutionTime).toBeDefined();
    });

    test('activate should not allow activation of cancelled task', () => {
      task.cancel();

      expect(() => task.activate()).toThrow('Cannot activate a cancelled task');
    });

    test('activate should not allow activation of completed task', () => {
      task.complete();

      expect(() => task.activate()).toThrow('Cannot activate a completed task');
    });

    test('complete should mark task as completed', () => {
      const executionTime = new Date();
      task.complete(executionTime);

      expect(task.status).toBe(ScheduledTask.STATUS.COMPLETED);
      expect(task.lastExecutionTime).toEqual(executionTime);
      expect(task.executionCount).toBe(1);
      expect(task.nextExecutionTime).toBeNull();
    });

    test('complete should not allow completion of cancelled task', () => {
      task.cancel();

      expect(() => task.complete()).toThrow('Cannot complete a cancelled task');
    });

    test('cancel should mark task as cancelled', () => {
      task.cancel('User requested cancellation');

      expect(task.status).toBe(ScheduledTask.STATUS.CANCELLED);
      expect(task.nextExecutionTime).toBeNull();
      expect(task.lastError).toBe('User requested cancellation');
    });

    test('cancel should not allow cancellation of completed task', () => {
      task.complete();

      expect(() => task.cancel()).toThrow('Cannot cancel a completed task');
    });
  });

  describe('execution tracking', () => {
    let task;

    beforeEach(() => {
      task = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      );
      task.activate();
    });

    test('markExecutionFailed should record failure', () => {
      const error = new Error('Execution failed');
      const executionTime = new Date();

      task.markExecutionFailed(error, executionTime);

      expect(task.status).toBe(ScheduledTask.STATUS.FAILED);
      expect(task.lastError).toBe('Execution failed');
      expect(task.lastExecutionTime).toEqual(executionTime);
      expect(task.executionCount).toBe(1);
      expect(task.failureCount).toBe(1);
      expect(task.nextExecutionTime).toBeNull();
    });

    test('markExecutionFailed should handle string error', () => {
      task.markExecutionFailed('String error message');

      expect(task.lastError).toBe('String error message');
    });

    test('markExecutionFailed should handle unknown error type', () => {
      task.markExecutionFailed({ unknown: 'object' });

      expect(task.lastError).toBe('Unknown execution error');
    });

    test('recordSuccessfulExecution should update execution stats', () => {
      const executionTime = new Date();

      task.recordSuccessfulExecution(executionTime);

      expect(task.lastExecutionTime).toEqual(executionTime);
      expect(task.executionCount).toBe(1);
      expect(task.failureCount).toBe(0);
      expect(task.lastError).toBeNull();
      expect(task.status).toBe(ScheduledTask.STATUS.ACTIVE); // Recurring task
      expect(task.nextExecutionTime).toBeDefined();
    });

    test('recordSuccessfulExecution should complete one-time tasks', () => {
      // Mock _isRecurringTask to return false
      const originalMethod = task._isRecurringTask;
      task._isRecurringTask = jest.fn().mockReturnValue(false);

      task.recordSuccessfulExecution();

      expect(task.status).toBe(ScheduledTask.STATUS.COMPLETED);

      // Restore original method
      task._isRecurringTask = originalMethod;
    });
  });

  describe('schedule updates', () => {
    let task;

    beforeEach(() => {
      task = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      );
    });

    test('updateSchedule should update schedule expression', () => {
      const newSchedule = new ScheduleExpression(
        [new DayOfWeek(DayOfWeek.FRIDAY)],
        new Time(17, 0),
        'UTC'
      );

      task.updateSchedule(newSchedule);

      expect(task.scheduleExpression).toBe(newSchedule);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    test('updateSchedule should validate input', () => {
      expect(() => task.updateSchedule('invalid')).toThrow('newScheduleExpression must be a ScheduleExpression instance');
    });

    test('updateSchedule should not allow update of completed task', () => {
      task.complete();

      expect(() => task.updateSchedule(validScheduleExpression)).toThrow('Cannot update schedule of a completed task');
    });

    test('updateSchedule should not allow update of cancelled task', () => {
      task.cancel();

      expect(() => task.updateSchedule(validScheduleExpression)).toThrow('Cannot update schedule of a cancelled task');
    });

    test('updateActionParameters should update action parameters', () => {
      const newParams = { mode: 'stay', zoneIds: ['zone1'] };

      task.updateActionParameters(newParams);

      expect(task.actionParameters).toEqual(newParams);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    test('updateActionParameters should validate parameters', () => {
      expect(() => task.updateActionParameters(null)).toThrow('newParameters must be an object');
      expect(() => task.updateActionParameters({ mode: 'invalid' })).toThrow('ARM_SYSTEM requires mode to be "away" or "stay"');
    });
  });

  describe('execution readiness', () => {
    let task;

    beforeEach(() => {
      task = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      );
      task.activate();
    });

    test('isReadyForExecution should return true when ready', () => {
      // Mock next execution time to be in the past
      task.nextExecutionTime = new Date(Date.now() - 60000); // 1 minute ago

      expect(task.isReadyForExecution()).toBe(true);
    });

    test('isReadyForExecution should return false when not active', () => {
      task.cancel();

      expect(task.isReadyForExecution()).toBe(false);
    });

    test('isReadyForExecution should return false when time not reached', () => {
      // Mock next execution time to be in the future
      task.nextExecutionTime = new Date(Date.now() + 60000); // 1 minute from now

      expect(task.isReadyForExecution()).toBe(false);
    });

    test('isReadyForExecution should return false when no next execution time', () => {
      task.nextExecutionTime = null;

      expect(task.isReadyForExecution()).toBe(false);
    });

    test('isOverdue should identify overdue tasks', () => {
      // Set execution time 10 minutes in the past
      task.nextExecutionTime = new Date(Date.now() - 10 * 60000);

      expect(task.isOverdue()).toBe(true);
      expect(task.isOverdue(new Date(), 15)).toBe(false); // Within tolerance
    });

    test('isOverdue should return false for non-ready tasks', () => {
      task.nextExecutionTime = new Date(Date.now() + 60000);

      expect(task.isOverdue()).toBe(false);
    });
  });

  describe('utility methods', () => {
    let task;

    beforeEach(() => {
      task = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away', zoneIds: ['zone1'] }
      );
      task.activate();
    });

    test('getUpcomingExecutions should return upcoming execution times', () => {
      const executions = task.getUpcomingExecutions(7);

      expect(Array.isArray(executions)).toBe(true);
      expect(executions.length).toBeGreaterThan(0);
    });

    test('getUpcomingExecutions should return empty array for inactive tasks', () => {
      task.cancel();

      const executions = task.getUpcomingExecutions(7);

      expect(executions).toEqual([]);
    });

    test('getDescription should return meaningful description', () => {
      const description = task.getDescription();

      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description).toContain('Arm zones in away mode');
    });

    test('getDescription should handle disarm action', () => {
      const disarmTask = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.DISARM_SYSTEM, { zoneIds: [] }
      );

      const description = disarmTask.getDescription();

      expect(description).toContain('Disarm system');
    });

    test('canBeExecutedBy should check user permissions', () => {
      expect(task.canBeExecutedBy(validUserId)).toBe(true);
      expect(task.canBeExecutedBy('different-user')).toBe(false);
    });

    test('getExecutionStats should return execution statistics', () => {
      task.recordSuccessfulExecution();
      task.markExecutionFailed('Test error');

      const stats = task.getExecutionStats();

      expect(stats).toEqual({
        executionCount: 2,
        failureCount: 1,
        successCount: 1,
        successRate: 0.5,
        lastExecutionTime: task.lastExecutionTime,
        lastError: task.lastError
      });
    });

    test('getExecutionStats should handle zero executions', () => {
      const stats = task.getExecutionStats();

      expect(stats.successRate).toBe(0);
    });
  });

  describe('serialization', () => {
    let task;

    beforeEach(() => {
      task = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      );
    });

    test('toJSON should return complete task data', () => {
      const json = task.toJSON();

      expect(json).toEqual({
        id: task.id,
        userId: task.userId,
        scheduleExpression: task.scheduleExpression.toJSON(),
        actionType: task.actionType,
        actionParameters: task.actionParameters,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        nextExecutionTime: task.nextExecutionTime,
        lastExecutionTime: task.lastExecutionTime,
        executionCount: task.executionCount,
        failureCount: task.failureCount,
        lastError: task.lastError,
        description: task.getDescription(),
        executionStats: task.getExecutionStats()
      });
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle schedule expression calculation errors', () => {
      const task = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      );

      // Mock schedule expression to throw error
      const originalMethod = task.scheduleExpression.getNextExecutionTime;
      task.scheduleExpression.getNextExecutionTime = jest.fn().mockImplementation(() => {
        throw new Error('Schedule calculation failed');
      });

      // Force recalculation
      task._updateNextExecution();

      expect(task.nextExecutionTime).toBeNull();
      expect(task.lastError).toContain('Failed to calculate next execution time');

      // Restore original method
      task.scheduleExpression.getNextExecutionTime = originalMethod;
    });

    test('should handle private method _isRecurringTask', () => {
      const task = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      );

      expect(task._isRecurringTask()).toBe(true);
    });

    test('should handle action descriptions for unknown actions', () => {
      const task = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'away' }
      );

      // Mock unknown action type
      task.actionType = 'UNKNOWN_ACTION';
      const description = task._getActionDescription();

      expect(description).toBe('Execute action');
    });

    test('should handle different zone configurations in descriptions', () => {
      const armTaskWithZones = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.ARM_SYSTEM, { mode: 'stay', zoneIds: ['zone1', 'zone2'] }
      );

      const disarmTaskWithZones = new ScheduledTask(
        validId, validUserId, validScheduleExpression, ScheduledTask.ACTION_TYPE.DISARM_SYSTEM, { zoneIds: ['zone1'] }
      );

      expect(armTaskWithZones._getActionDescription()).toBe('Arm zones in stay mode');
      expect(disarmTaskWithZones._getActionDescription()).toBe('Disarm specified zones');
    });
  });

  describe('constants and enums', () => {
    test('should have correct status constants', () => {
      expect(ScheduledTask.STATUS.PENDING).toBe('PENDING');
      expect(ScheduledTask.STATUS.ACTIVE).toBe('ACTIVE');
      expect(ScheduledTask.STATUS.COMPLETED).toBe('COMPLETED');
      expect(ScheduledTask.STATUS.CANCELLED).toBe('CANCELLED');
      expect(ScheduledTask.STATUS.FAILED).toBe('FAILED');
    });

    test('should have correct action type constants', () => {
      expect(ScheduledTask.ACTION_TYPE.ARM_SYSTEM).toBe('ARM_SYSTEM');
      expect(ScheduledTask.ACTION_TYPE.DISARM_SYSTEM).toBe('DISARM_SYSTEM');
    });
  });
});