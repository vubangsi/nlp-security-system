const ScheduleCreated = require('../../../../src/domain/events/ScheduleCreated');
const DomainEvent = require('../../../../src/domain/events/DomainEvent');
const ScheduledTask = require('../../../../src/domain/entities/ScheduledTask');
const ScheduleExpression = require('../../../../src/domain/valueObjects/ScheduleExpression');
const DayOfWeek = require('../../../../src/domain/valueObjects/DayOfWeek');
const Time = require('../../../../src/domain/valueObjects/Time');

describe('ScheduleCreated', () => {
  let scheduledTask;
  let scheduleCreatedEvent;

  beforeEach(() => {
    const scheduleExpression = new ScheduleExpression(
      [new DayOfWeek(DayOfWeek.MONDAY), new DayOfWeek(DayOfWeek.WEDNESDAY)],
      new Time(9, 0),
      'UTC'
    );

    scheduledTask = new ScheduledTask(
      'task-123',
      'user-456',
      scheduleExpression,
      ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
      { mode: 'away', zoneIds: ['zone1', 'zone2'] }
    );

    scheduleCreatedEvent = new ScheduleCreated(scheduledTask);
  });

  describe('constructor', () => {
    test('should create event with required data', () => {
      expect(scheduleCreatedEvent).toBeInstanceOf(DomainEvent);
      expect(scheduleCreatedEvent).toBeInstanceOf(ScheduleCreated);
      expect(scheduleCreatedEvent.eventType).toBe('ScheduleCreated');
      expect(scheduleCreatedEvent.aggregateId).toBe('task-123');
      expect(scheduleCreatedEvent.timestamp).toBeInstanceOf(Date);
      expect(scheduleCreatedEvent.eventId).toBeDefined();
    });

    test('should store scheduled task information', () => {
      expect(scheduleCreatedEvent.scheduledTaskId).toBe('task-123');
      expect(scheduleCreatedEvent.userId).toBe('user-456');
      expect(scheduleCreatedEvent.actionType).toBe(ScheduledTask.ACTION_TYPE.ARM_SYSTEM);
      expect(scheduleCreatedEvent.actionParameters).toEqual({
        mode: 'away',
        zoneIds: ['zone1', 'zone2']
      });
      expect(scheduleCreatedEvent.nextExecutionTime).toBe(scheduledTask.nextExecutionTime);
      expect(scheduleCreatedEvent.description).toBe(scheduledTask.getDescription());
    });

    test('should store data in event data property', () => {
      expect(scheduleCreatedEvent.data.userId).toBe('user-456');
      expect(scheduleCreatedEvent.data.actionType).toBe(ScheduledTask.ACTION_TYPE.ARM_SYSTEM);
      expect(scheduleCreatedEvent.data.actionParameters).toEqual({
        mode: 'away',
        zoneIds: ['zone1', 'zone2']
      });
      expect(scheduleCreatedEvent.data.scheduleExpression).toEqual(scheduledTask.scheduleExpression.toJSON());
      expect(scheduleCreatedEvent.data.nextExecutionTime).toBe(scheduledTask.nextExecutionTime);
      expect(scheduleCreatedEvent.data.status).toBe(scheduledTask.status);
      expect(scheduleCreatedEvent.data.description).toBe(scheduledTask.getDescription());
    });

    test('should validate scheduledTask parameter', () => {
      expect(() => new ScheduleCreated(null)).toThrow('scheduledTask is required');
      expect(() => new ScheduleCreated(undefined)).toThrow('scheduledTask is required');
    });

    test('should create defensive copy of action parameters', () => {
      const originalParams = scheduledTask.actionParameters;
      originalParams.mode = 'stay'; // Modify original
      
      expect(scheduleCreatedEvent.actionParameters.mode).toBe('away'); // Should remain unchanged
    });
  });

  describe('getScheduleDescription', () => {
    test('should return schedule description', () => {
      const description = scheduleCreatedEvent.getScheduleDescription();
      
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description).toBe(scheduledTask.getDescription());
    });
  });

  describe('isSystemWideSchedule', () => {
    test('should return false when zones are specified', () => {
      expect(scheduleCreatedEvent.isSystemWideSchedule()).toBe(false);
    });

    test('should return true when no zones are specified', () => {
      const systemWideTask = new ScheduledTask(
        'system-task',
        'user-456',
        scheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away', zoneIds: [] }
      );

      const systemWideEvent = new ScheduleCreated(systemWideTask);
      
      expect(systemWideEvent.isSystemWideSchedule()).toBe(true);
    });

    test('should return true when zoneIds is undefined', () => {
      const systemWideTask = new ScheduledTask(
        'system-task',
        'user-456',
        scheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
        {} // No zoneIds property
      );

      const systemWideEvent = new ScheduleCreated(systemWideTask);
      
      expect(systemWideEvent.isSystemWideSchedule()).toBe(true);
    });
  });

  describe('getAffectedZones', () => {
    test('should return zones when specified', () => {
      const affectedZones = scheduleCreatedEvent.getAffectedZones();
      
      expect(affectedZones).toEqual(['zone1', 'zone2']);
    });

    test('should return empty array when no zones specified', () => {
      const systemWideTask = new ScheduledTask(
        'system-task',
        'user-456',
        scheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away', zoneIds: [] }
      );

      const systemWideEvent = new ScheduleCreated(systemWideTask);
      
      expect(systemWideEvent.getAffectedZones()).toEqual([]);
    });

    test('should return empty array when zoneIds is undefined', () => {
      const systemWideTask = new ScheduledTask(
        'system-task',
        'user-456',
        scheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
        {} // No zoneIds property
      );

      const systemWideEvent = new ScheduleCreated(systemWideTask);
      
      expect(systemWideEvent.getAffectedZones()).toEqual([]);
    });
  });

  describe('getScheduleMode', () => {
    test('should return mode for ARM_SYSTEM actions', () => {
      expect(scheduleCreatedEvent.getScheduleMode()).toBe('away');
    });

    test('should return null for DISARM_SYSTEM actions', () => {
      const disarmTask = new ScheduledTask(
        'disarm-task',
        'user-456',
        scheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
        { zoneIds: ['zone1'] }
      );

      const disarmEvent = new ScheduleCreated(disarmTask);
      
      expect(disarmEvent.getScheduleMode()).toBeNull();
    });

    test('should return null when mode is not specified', () => {
      const taskWithoutMode = new ScheduledTask(
        'task-no-mode',
        'user-456',
        scheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { zoneIds: [] } // No mode property
      );

      const eventWithoutMode = new ScheduleCreated(taskWithoutMode);
      
      expect(eventWithoutMode.getScheduleMode()).toBeNull();
    });
  });

  describe('toJSON', () => {
    test('should serialize event with all required data', () => {
      const json = scheduleCreatedEvent.toJSON();
      
      // Check base event properties
      expect(json.eventType).toBe('ScheduleCreated');
      expect(json.aggregateId).toBe('task-123');
      expect(json.timestamp).toBeInstanceOf(Date);
      expect(json.eventId).toBeDefined();
      
      // Check schedule-specific properties
      expect(json.scheduledTaskId).toBe('task-123');
      expect(json.userId).toBe('user-456');
      expect(json.actionType).toBe(ScheduledTask.ACTION_TYPE.ARM_SYSTEM);
      expect(json.actionParameters).toEqual({
        mode: 'away',
        zoneIds: ['zone1', 'zone2']
      });
      expect(json.nextExecutionTime).toBe(scheduledTask.nextExecutionTime);
      expect(json.description).toBe(scheduledTask.getDescription());
      expect(json.isSystemWide).toBe(false);
      expect(json.affectedZones).toEqual(['zone1', 'zone2']);
    });

    test('should include computed properties in JSON', () => {
      const json = scheduleCreatedEvent.toJSON();
      
      expect(json.isSystemWide).toBe(scheduleCreatedEvent.isSystemWideSchedule());
      expect(json.affectedZones).toEqual(scheduleCreatedEvent.getAffectedZones());
    });

    test('should handle system-wide schedule in JSON', () => {
      const systemWideTask = new ScheduledTask(
        'system-task',
        'user-456',
        scheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away', zoneIds: [] }
      );

      const systemWideEvent = new ScheduleCreated(systemWideTask);
      const json = systemWideEvent.toJSON();
      
      expect(json.isSystemWide).toBe(true);
      expect(json.affectedZones).toEqual([]);
    });
  });

  describe('event inheritance', () => {
    test('should extend DomainEvent correctly', () => {
      expect(scheduleCreatedEvent).toBeInstanceOf(DomainEvent);
      expect(scheduleCreatedEvent.eventType).toBe('ScheduleCreated');
      expect(scheduleCreatedEvent.aggregateId).toBe(scheduledTask.id);
      expect(scheduleCreatedEvent.timestamp).toBeInstanceOf(Date);
      expect(scheduleCreatedEvent.eventId).toBeDefined();
    });

    test('should have unique event ID', () => {
      const anotherEvent = new ScheduleCreated(scheduledTask);
      
      expect(scheduleCreatedEvent.eventId).not.toBe(anotherEvent.eventId);
    });

    test('should have different timestamps for different events', async () => {
      const firstEvent = scheduleCreatedEvent;
      
      // Wait a small amount to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const secondEvent = new ScheduleCreated(scheduledTask);
      
      expect(secondEvent.timestamp.getTime()).toBeGreaterThan(firstEvent.timestamp.getTime());
    });
  });

  describe('edge cases and validation', () => {
    test('should handle schedule task with minimal data', () => {
      const minimalTask = new ScheduledTask(
        'minimal-task',
        'user-456',
        scheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
        {}
      );

      expect(() => new ScheduleCreated(minimalTask)).not.toThrow();
      
      const event = new ScheduleCreated(minimalTask);
      expect(event.actionType).toBe(ScheduledTask.ACTION_TYPE.DISARM_SYSTEM);
      expect(event.getScheduleMode()).toBeNull();
      expect(event.getAffectedZones()).toEqual([]);
      expect(event.isSystemWideSchedule()).toBe(true);
    });

    test('should handle schedule task with null zoneIds', () => {
      const taskWithNullZones = new ScheduledTask(
        'null-zones-task',
        'user-456',
        scheduledTask.scheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'stay', zoneIds: null }
      );

      const event = new ScheduleCreated(taskWithNullZones);
      
      expect(event.isSystemWideSchedule()).toBe(true);
      expect(event.getAffectedZones()).toEqual([]);
    });

    test('should handle different action types', () => {
      const actionTypes = [
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        ScheduledTask.ACTION_TYPE.DISARM_SYSTEM
      ];

      actionTypes.forEach(actionType => {
        const task = new ScheduledTask(
          `task-${actionType}`,
          'user-456',
          scheduledTask.scheduleExpression,
          actionType,
          actionType === ScheduledTask.ACTION_TYPE.ARM_SYSTEM 
            ? { mode: 'away', zoneIds: [] }
            : { zoneIds: [] }
        );

        expect(() => new ScheduleCreated(task)).not.toThrow();
        
        const event = new ScheduleCreated(task);
        expect(event.actionType).toBe(actionType);
      });
    });

    test('should maintain data integrity after creation', () => {
      const originalTaskId = scheduledTask.id;
      const originalUserId = scheduledTask.userId;
      const originalActionType = scheduledTask.actionType;
      
      // Create event
      const event = new ScheduleCreated(scheduledTask);
      
      // Verify event data matches original
      expect(event.scheduledTaskId).toBe(originalTaskId);
      expect(event.userId).toBe(originalUserId);
      expect(event.actionType).toBe(originalActionType);
      
      // Verify data consistency
      expect(event.data.userId).toBe(originalUserId);
      expect(event.data.actionType).toBe(originalActionType);
    });
  });
});