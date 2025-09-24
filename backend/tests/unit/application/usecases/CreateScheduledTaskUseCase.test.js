const CreateScheduledTaskUseCase = require('../../../../src/application/useCases/CreateScheduledTaskUseCase');
const ScheduledTask = require('../../../../src/domain/entities/ScheduledTask');
const ScheduleExpression = require('../../../../src/domain/valueObjects/ScheduleExpression');
const DayOfWeek = require('../../../../src/domain/valueObjects/DayOfWeek');
const Time = require('../../../../src/domain/valueObjects/Time');
const ScheduleCreated = require('../../../../src/domain/events/ScheduleCreated');
const EventLog = require('../../../../src/domain/entities/EventLog');

describe('CreateScheduledTaskUseCase', () => {
  let useCase;
  let mockScheduledTaskRepository;
  let mockScheduleValidator;
  let mockEventLogRepository;
  let mockEventBus;
  let mockUserRepository;
  let validScheduleExpression;

  beforeEach(() => {
    // Create mocks
    mockScheduledTaskRepository = {
      save: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue([])
    };

    mockScheduleValidator = {
      validateNewSchedule: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
      getSuggestions: jest.fn().mockReturnValue([]),
      options: { maxSchedulesPerUser: 50 }
    };

    mockEventLogRepository = {
      save: jest.fn().mockResolvedValue()
    };

    mockEventBus = {
      publish: jest.fn()
    };

    mockUserRepository = {
      findById: jest.fn().mockResolvedValue({ 
        id: 'user-123', 
        permissions: ['CREATE_SCHEDULES'], 
        role: 'user' 
      })
    };

    // Create valid schedule expression
    validScheduleExpression = new ScheduleExpression(
      [new DayOfWeek(DayOfWeek.MONDAY)],
      new Time(9, 0),
      'UTC'
    );

    // Create use case
    useCase = new CreateScheduledTaskUseCase(
      mockScheduledTaskRepository,
      mockScheduleValidator,
      mockEventLogRepository,
      mockEventBus,
      mockUserRepository
    );
  });

  describe('execute', () => {
    test('should create ARM_SYSTEM scheduled task successfully', async () => {
      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away', zoneIds: ['zone1'] },
        userId: 'user-123'
      };

      const mockSavedTask = new ScheduledTask(
        'task-123',
        'user-123',
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away', zoneIds: ['zone1'] }
      );
      mockSavedTask.activate();

      mockScheduledTaskRepository.save.mockResolvedValue(mockSavedTask);

      const result = await useCase.execute(params);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully created scheduled arm system task');
      expect(result.data.schedule).toBeDefined();
      expect(result.data.scheduleId).toBeDefined();
      expect(result.data.nextExecution).toBeDefined();
      expect(result.data.description).toBeDefined();
      expect(result.data.upcomingExecutions).toBeDefined();

      expect(mockScheduledTaskRepository.save).toHaveBeenCalled();
      expect(mockEventLogRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(ScheduleCreated));
    });

    test('should create DISARM_SYSTEM scheduled task successfully', async () => {
      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
        actionParameters: { zoneIds: [] },
        userId: 'user-123'
      };

      const mockSavedTask = new ScheduledTask(
        'task-123',
        'user-123',
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
        { zoneIds: [] }
      );

      mockScheduledTaskRepository.save.mockResolvedValue(mockSavedTask);

      const result = await useCase.execute(params);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully created scheduled disarm system task');
    });

    test('should validate required parameters', async () => {
      // Test missing scheduleExpression
      let result = await useCase.execute({
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        userId: 'user-123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Schedule expression is required');

      // Test missing actionType
      result = await useCase.execute({
        scheduleExpression: validScheduleExpression,
        userId: 'user-123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Action type is required');

      // Test missing userId
      result = await useCase.execute({
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    test('should validate user permissions', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'nonexistent-user'
      };

      const result = await useCase.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    test('should validate user has scheduling permissions', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'user-123',
        permissions: [], // No CREATE_SCHEDULES permission
        role: 'user'
      });

      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      const result = await useCase.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient permissions');
    });

    test('should require admin permissions for system-wide actions', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'user-123',
        permissions: ['CREATE_SCHEDULES'],
        role: 'user' // Not admin
      });

      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away', zoneIds: [] }, // System-wide
        userId: 'user-123'
      };

      const result = await useCase.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Admin permissions required');
    });

    test('should handle invalid action type', async () => {
      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: 'INVALID_ACTION',
        userId: 'user-123'
      };

      const result = await useCase.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid action type');
      expect(result.details.allowedValues).toEqual(Object.values(ScheduledTask.ACTION_TYPE));
    });

    test('should handle business rule validation failures', async () => {
      mockScheduleValidator.validateNewSchedule.mockResolvedValue({
        isValid: false,
        errors: ['Schedule conflicts with existing task'],
        warnings: []
      });

      mockScheduleValidator.getSuggestions.mockReturnValue(['Choose a different time']);

      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      const result = await useCase.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Schedule validation failed');
      expect(result.details.errors).toContain('Schedule conflicts with existing task');
      expect(result.details.suggestions).toContain('Choose a different time');
    });

    test('should include validation warnings in successful response', async () => {
      mockScheduleValidator.validateNewSchedule.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: ['Schedule is set for night time hours']
      });

      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      const mockSavedTask = new ScheduledTask(
        'task-123',
        'user-123',
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      mockScheduledTaskRepository.save.mockResolvedValue(mockSavedTask);

      const result = await useCase.execute(params);

      expect(result.success).toBe(true);
      expect(result.data.warnings).toContain('Schedule is set for night time hours');
    });

    test('should skip validation when skipValidation option is true', async () => {
      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      const options = { skipValidation: true };

      const mockSavedTask = new ScheduledTask(
        'task-123',
        'user-123',
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      mockScheduledTaskRepository.save.mockResolvedValue(mockSavedTask);

      const result = await useCase.execute(params, options);

      expect(result.success).toBe(true);
      expect(mockScheduleValidator.validateNewSchedule).not.toHaveBeenCalled();
    });

    test('should not auto-activate when autoActivate is false', async () => {
      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      const options = { autoActivate: false };

      const mockSavedTask = new ScheduledTask(
        'task-123',
        'user-123',
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      mockScheduledTaskRepository.save.mockResolvedValue(mockSavedTask);

      const result = await useCase.execute(params, options);

      expect(result.success).toBe(true);
      expect(mockSavedTask.status).toBe(ScheduledTask.STATUS.PENDING);
    });

    test('should handle repository save errors', async () => {
      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      mockScheduledTaskRepository.save.mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('An unexpected error occurred while creating the scheduled task');
    });

    test('should handle entity creation errors', async () => {
      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'invalid_mode' }, // Invalid mode
        userId: 'user-123'
      };

      const result = await useCase.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create scheduled task');
    });

    test('should work without userRepository (no permission validation)', async () => {
      const useCaseWithoutUserRepo = new CreateScheduledTaskUseCase(
        mockScheduledTaskRepository,
        mockScheduleValidator,
        mockEventLogRepository,
        mockEventBus
      );

      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      const mockSavedTask = new ScheduledTask(
        'task-123',
        'user-123',
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      mockScheduledTaskRepository.save.mockResolvedValue(mockSavedTask);

      const result = await useCaseWithoutUserRepo.execute(params);

      expect(result.success).toBe(true);
    });
  });

  describe('executeBatch', () => {
    test('should create multiple scheduled tasks successfully', async () => {
      const scheduleRequests = [
        {
          scheduleExpression: validScheduleExpression,
          actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
          actionParameters: { mode: 'away' }
        },
        {
          scheduleExpression: validScheduleExpression,
          actionType: ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
          actionParameters: { zoneIds: [] }
        }
      ];

      const mockTasks = scheduleRequests.map((req, i) => {
        const task = new ScheduledTask(
          `task-${i}`,
          'user-123',
          req.scheduleExpression,
          req.actionType,
          req.actionParameters
        );
        task.activate();
        return task;
      });

      mockScheduledTaskRepository.save
        .mockResolvedValueOnce(mockTasks[0])
        .mockResolvedValueOnce(mockTasks[1]);

      const result = await useCase.executeBatch(scheduleRequests, 'user-123');

      expect(result.success).toBe(true);
      expect(result.totalRequested).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.schedules).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle mixed success and failure in batch', async () => {
      const scheduleRequests = [
        {
          scheduleExpression: validScheduleExpression,
          actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
          actionParameters: { mode: 'away' }
        },
        {
          scheduleExpression: validScheduleExpression,
          actionType: 'INVALID_ACTION', // This will fail
          actionParameters: {}
        }
      ];

      const mockTask = new ScheduledTask(
        'task-0',
        'user-123',
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      mockTask.activate();

      mockScheduledTaskRepository.save.mockResolvedValueOnce(mockTask);

      const result = await useCase.executeBatch(scheduleRequests, 'user-123');

      expect(result.success).toBe(false); // Overall failure due to partial success
      expect(result.totalRequested).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.schedules).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
    });

    test('should validate batch input parameters', async () => {
      // Test empty array
      let result = await useCase.executeBatch([], 'user-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be empty');

      // Test non-array input
      result = await useCase.executeBatch('not-array', 'user-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('array is required');
    });
  });

  describe('executeFromTemplate', () => {
    test('should return error for unimplemented templates', async () => {
      const result = await useCase.executeFromTemplate('daily_arm', {}, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Schedule templates not yet implemented');
    });

    test('should handle template conversion errors', async () => {
      // Mock the private method to throw an error
      const originalMethod = useCase._convertTemplateToSchedule;
      useCase._convertTemplateToSchedule = jest.fn().mockRejectedValue(new Error('Template error'));

      const result = await useCase.executeFromTemplate('daily_arm', {}, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create schedule from template');

      // Restore original method
      useCase._convertTemplateToSchedule = originalMethod;
    });
  });

  describe('getUserScheduleQuota', () => {
    test('should return quota information', async () => {
      const activeSchedules = Array(5).fill({
        userId: 'user-123',
        status: ScheduledTask.STATUS.ACTIVE
      });

      const inactiveSchedules = Array(2).fill({
        userId: 'user-123',
        status: ScheduledTask.STATUS.COMPLETED
      });

      mockScheduledTaskRepository.findByUserId.mockResolvedValue([
        ...activeSchedules,
        ...inactiveSchedules
      ]);

      const result = await useCase.getUserScheduleQuota('user-123');

      expect(result.success).toBe(true);
      expect(result.data.used).toBe(5);
      expect(result.data.total).toBe(50);
      expect(result.data.remaining).toBe(45);
      expect(result.data.percentUsed).toBe(10);
    });

    test('should handle repository errors in quota check', async () => {
      mockScheduledTaskRepository.findByUserId.mockRejectedValue(new Error('Database error'));

      const result = await useCase.getUserScheduleQuota('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get user quota information');
    });
  });

  describe('private methods', () => {
    test('_validateUserPermissions should handle permission validation errors', async () => {
      mockUserRepository.findById.mockRejectedValue(new Error('Database error'));

      const result = await useCase._validateUserPermissions('user-123', 'ARM_SYSTEM', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission validation failed');
    });

    test('_validateUserPermissions should allow admin system-wide actions', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'admin-123',
        permissions: ['CREATE_SCHEDULES'],
        role: 'admin'
      });

      const result = await useCase._validateUserPermissions(
        'admin-123',
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away', zoneIds: [] }
      );

      expect(result.success).toBe(true);
    });

    test('_convertTemplateToSchedule should return not implemented error', async () => {
      const result = await useCase._convertTemplateToSchedule('daily_arm', {}, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Schedule templates not yet implemented');
      expect(result.details.supportedTemplates).toEqual([]);
    });
  });

  describe('event logging and publishing', () => {
    test('should create proper audit event log', async () => {
      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      const mockSavedTask = new ScheduledTask(
        'task-123',
        'user-123',
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      mockSavedTask.activate();
      mockScheduledTaskRepository.save.mockResolvedValue(mockSavedTask);

      await useCase.execute(params);

      expect(mockEventLogRepository.save).toHaveBeenCalledWith(expect.any(EventLog));
      
      const eventLogCall = mockEventLogRepository.save.mock.calls[0][0];
      expect(eventLogCall.eventType).toBe('SCHEDULE_CREATED');
      expect(eventLogCall.userId).toBe('user-123');
    });

    test('should publish domain event', async () => {
      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      const mockSavedTask = new ScheduledTask(
        'task-123',
        'user-123',
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away' }
      );
      mockScheduledTaskRepository.save.mockResolvedValue(mockSavedTask);

      await useCase.execute(params);

      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(ScheduleCreated));
      
      const domainEvent = mockEventBus.publish.mock.calls[0][0];
      expect(domainEvent.eventType).toBe('ScheduleCreated');
      expect(domainEvent.scheduledTaskId).toBe('task-123');
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle default action parameters', async () => {
      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        // actionParameters not provided
        userId: 'user-123'
      };

      const mockSavedTask = new ScheduledTask(
        'task-123',
        'user-123',
        validScheduleExpression,
        ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        { mode: 'away', zoneIds: [] }
      );
      mockScheduledTaskRepository.save.mockResolvedValue(mockSavedTask);

      const result = await useCase.execute(params);

      expect(result.success).toBe(true);
    });

    test('should include development error details in development environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      mockScheduledTaskRepository.save.mockRejectedValue(new Error('Specific database error'));

      const result = await useCase.execute(params);

      expect(result.success).toBe(false);
      expect(result.details.message).toBe('Specific database error');

      process.env.NODE_ENV = originalEnv;
    });

    test('should hide error details in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const params = {
        scheduleExpression: validScheduleExpression,
        actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
        actionParameters: { mode: 'away' },
        userId: 'user-123'
      };

      mockScheduledTaskRepository.save.mockRejectedValue(new Error('Specific database error'));

      const result = await useCase.execute(params);

      expect(result.success).toBe(false);
      expect(result.details.message).toBe('Internal server error');

      process.env.NODE_ENV = originalEnv;
    });
  });
});