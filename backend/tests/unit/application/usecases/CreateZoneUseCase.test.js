const CreateZoneUseCase = require('../../../../src/application/useCases/CreateZoneUseCase');
const Zone = require('../../../../src/domain/entities/Zone');
const ZoneStateChanged = require('../../../../src/domain/events/ZoneStateChanged');
const EventLog = require('../../../../src/domain/entities/EventLog');

describe('CreateZoneUseCase', () => {
  let useCase;
  let mockZoneRepository;
  let mockEventLogRepository;
  let mockEventBus;

  beforeEach(() => {
    mockZoneRepository = {
      findByName: jest.fn(),
      findById: jest.fn(),
      save: jest.fn()
    };

    mockEventLogRepository = {
      save: jest.fn()
    };

    mockEventBus = {
      publish: jest.fn()
    };

    useCase = new CreateZoneUseCase(mockZoneRepository, mockEventLogRepository, mockEventBus);
  });

  describe('execute', () => {
    const validName = 'Living Room';
    const validDescription = 'Main living area';
    const userId = 'user-123';

    test('should create zone successfully with valid inputs', async () => {
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute(validName, validDescription, null, userId);

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Zone '${validName}' created successfully`);
      expect(result.zone).toBeDefined();
      expect(result.zone.name).toBe(validName);
      expect(result.zone.description).toBe(validDescription);
      expect(result.zone.parentZoneId).toBeNull();
      expect(result.zone.armed).toBe(false);
      expect(result.zone.modifiedBy).toBe(userId);

      expect(mockZoneRepository.findByName).toHaveBeenCalledWith(validName);
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(1);
      expect(mockEventLogRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    test('should create zone with parent zone successfully', async () => {
      const parentZoneId = 'parent-123';
      const parentZone = new Zone(parentZoneId, 'Parent Zone');
      
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.findById.mockResolvedValue(parentZone);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute(validName, validDescription, parentZoneId, userId);

      expect(result.success).toBe(true);
      expect(result.zone.parentZoneId).toBe(parentZoneId);
      
      // Parent zone should be updated with new child
      expect(parentZone.hasChildZones()).toBe(true);
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(2); // Child and parent
    });

    test('should create zone with minimal parameters', async () => {
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute(validName, '', null, userId);

      expect(result.success).toBe(true);
      expect(result.zone.description).toBe('');
      expect(result.zone.parentZoneId).toBeNull();
    });

    test('should fail when zone name is missing', async () => {
      const result = await useCase.execute('', validDescription, null, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone name is required');
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should fail when zone name is null', async () => {
      const result = await useCase.execute(null, validDescription, null, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone name is required');
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
    });

    test('should fail when user ID is missing', async () => {
      const result = await useCase.execute(validName, validDescription, null, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
    });

    test('should fail when user ID is null', async () => {
      const result = await useCase.execute(validName, validDescription, null, null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
    });

    test('should fail when zone name already exists', async () => {
      const existingZone = new Zone('existing-123', validName);
      mockZoneRepository.findByName.mockResolvedValue(existingZone);

      const result = await useCase.execute(validName, validDescription, null, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(`Zone with name '${validName}' already exists`);
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should fail when parent zone does not exist', async () => {
      const nonExistentParentId = 'non-existent-123';
      
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.findById.mockResolvedValue(null);

      const result = await useCase.execute(validName, validDescription, nonExistentParentId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(`Parent zone with ID '${nonExistentParentId}' not found`);
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should handle invalid zone name validation errors', async () => {
      const invalidName = 'Invalid@Name';
      mockZoneRepository.findByName.mockResolvedValue(null);

      const result = await useCase.execute(invalidName, validDescription, null, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Zone name can only contain letters, numbers, spaces, hyphens, and underscores');
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
    });

    test('should handle zone repository save errors', async () => {
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.save.mockRejectedValue(new Error('Database connection failed'));
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute(validName, validDescription, null, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    test('should handle event log repository save errors', async () => {
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockRejectedValue(new Error('Event log save failed'));

      const result = await useCase.execute(validName, validDescription, null, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Event log save failed');
    });

    test('should handle parent zone repository save errors', async () => {
      const parentZoneId = 'parent-123';
      const parentZone = new Zone(parentZoneId, 'Parent Zone');
      
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.findById.mockResolvedValue(parentZone);
      mockZoneRepository.save
        .mockResolvedValueOnce() // First save (child zone) succeeds
        .mockRejectedValueOnce(new Error('Parent zone save failed')); // Second save (parent zone) fails

      const result = await useCase.execute(validName, validDescription, parentZoneId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Parent zone save failed');
    });
  });

  describe('event publishing', () => {
    const validName = 'Test Zone';
    const userId = 'user-123';

    test('should publish ZoneStateChanged event with correct data', async () => {
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      await useCase.execute(validName, '', null, userId);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ZoneStateChanged',
          changeType: 'created',
          userId: userId,
          previousState: null
        })
      );

      const publishedEvent = mockEventBus.publish.mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(ZoneStateChanged);
      expect(publishedEvent.newState).toBeDefined();
      expect(publishedEvent.newState.name).toBe(validName);
    });

    test('should create event log entry for zone creation', async () => {
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      // Mock EventLog.createZoneCreatedEvent
      const mockEventLog = { id: 'event-123', type: 'zone_created' };
      jest.spyOn(EventLog, 'createZoneCreatedEvent').mockReturnValue(mockEventLog);

      await useCase.execute(validName, '', null, userId);

      expect(EventLog.createZoneCreatedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ name: validName }),
        userId
      );
      expect(mockEventLogRepository.save).toHaveBeenCalledWith(mockEventLog);
    });
  });

  describe('zone hierarchy management', () => {
    const childName = 'Child Zone';
    const parentZoneId = 'parent-123';
    const userId = 'user-123';

    test('should add child to parent zone child list', async () => {
      const parentZone = new Zone(parentZoneId, 'Parent Zone');
      const addChildZoneSpy = jest.spyOn(parentZone, 'addChildZone');
      
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.findById.mockResolvedValue(parentZone);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute(childName, '', parentZoneId, userId);

      expect(result.success).toBe(true);
      expect(addChildZoneSpy).toHaveBeenCalledWith(result.zone.id);
      expect(parentZone.hasChildZones()).toBe(true);
    });

    test('should not modify parent when parent zone ID is null', async () => {
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      await useCase.execute(childName, '', null, userId);

      expect(mockZoneRepository.findById).not.toHaveBeenCalled();
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(1); // Only child zone saved
    });
  });

  describe('data validation and sanitization', () => {
    const userId = 'user-123';

    test('should handle description with default empty string', async () => {
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute('Test Zone', undefined, null, userId);

      expect(result.success).toBe(true);
      expect(result.zone.description).toBe('');
    });

    test('should preserve valid description', async () => {
      const description = 'Valid description with special chars: ñüé';
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute('Test Zone', description, null, userId);

      expect(result.success).toBe(true);
      expect(result.zone.description).toBe(description);
    });

    test('should handle whitespace in zone names', async () => {
      const nameWithSpaces = '  Living Room  ';
      mockZoneRepository.findByName.mockResolvedValue(null);

      const result = await useCase.execute(nameWithSpaces, '', null, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Zone name cannot be empty'); // Assumes validation trims whitespace
    });
  });

  describe('concurrent operation handling', () => {
    const zoneName = 'Concurrent Zone';
    const userId = 'user-123';

    test('should handle race condition when zone is created between check and save', async () => {
      // First call returns null (zone doesn't exist)
      // Second call during actual creation might find the zone exists due to concurrent creation
      mockZoneRepository.findByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(new Zone('existing-123', zoneName));

      const result = await useCase.execute(zoneName, '', null, userId);

      // The use case should still attempt to save, and the error will be caught
      expect(mockZoneRepository.findByName).toHaveBeenCalledWith(zoneName);
    });
  });

  describe('performance considerations', () => {
    test('should not perform unnecessary operations when validation fails early', async () => {
      const result = await useCase.execute('', '', null, 'user-123');

      expect(result.success).toBe(false);
      expect(mockZoneRepository.findByName).not.toHaveBeenCalled();
      expect(mockZoneRepository.findById).not.toHaveBeenCalled();
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
      expect(mockEventLogRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should handle large zone descriptions efficiently', async () => {
      const largeDescription = 'A'.repeat(200); // At the limit
      mockZoneRepository.findByName.mockResolvedValue(null);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute('Large Zone', largeDescription, null, 'user-123');

      expect(result.success).toBe(true);
      expect(result.zone.description).toBe(largeDescription);
    });
  });
});