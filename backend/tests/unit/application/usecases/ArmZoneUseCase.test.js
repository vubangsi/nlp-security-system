const ArmZoneUseCase = require('../../../../src/application/useCases/ArmZoneUseCase');
const Zone = require('../../../../src/domain/entities/Zone');
const ZoneStateChanged = require('../../../../src/domain/events/ZoneStateChanged');
const EventLog = require('../../../../src/domain/entities/EventLog');

describe('ArmZoneUseCase', () => {
  let useCase;
  let mockZoneRepository;
  let mockEventLogRepository;
  let mockEventBus;

  beforeEach(() => {
    mockZoneRepository = {
      findById: jest.fn(),
      save: jest.fn()
    };

    mockEventLogRepository = {
      save: jest.fn()
    };

    mockEventBus = {
      publish: jest.fn()
    };

    useCase = new ArmZoneUseCase(mockZoneRepository, mockEventLogRepository, mockEventBus);
  });

  describe('execute', () => {
    const zoneId = 'zone-123';
    const userId = 'user-456';
    let zone;

    beforeEach(() => {
      zone = new Zone(zoneId, 'Living Room', 'Main living area');
      mockZoneRepository.findById.mockResolvedValue(zone);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();
    });

    test('should arm zone successfully in away mode', async () => {
      const result = await useCase.execute(zoneId, 'away', userId);

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Zone '${zone.name}' armed in away mode`);
      expect(result.zone.armed).toBe(true);
      expect(result.zone.mode).toBe('away');
      expect(result.zone.modifiedBy).toBe(userId);
      expect(result.armedZones).toHaveLength(1);
      expect(result.armedZones[0].id).toBe(zoneId);

      expect(mockZoneRepository.save).toHaveBeenCalledWith(zone);
      expect(mockEventLogRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    test('should arm zone successfully in stay mode', async () => {
      const result = await useCase.execute(zoneId, 'stay', userId);

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Zone '${zone.name}' armed in stay mode`);
      expect(result.zone.armed).toBe(true);
      expect(result.zone.mode).toBe('stay');
      expect(result.zone.modifiedBy).toBe(userId);
    });

    test('should fail when zone ID is missing', async () => {
      const result = await useCase.execute('', 'away', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID is required');
      expect(mockZoneRepository.findById).not.toHaveBeenCalled();
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
    });

    test('should fail when zone ID is null', async () => {
      const result = await useCase.execute(null, 'away', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID is required');
    });

    test('should fail when mode is missing', async () => {
      const result = await useCase.execute(zoneId, '', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid arm mode. Must be "away" or "stay"');
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
    });

    test('should fail when mode is null', async () => {
      const result = await useCase.execute(zoneId, null, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid arm mode. Must be "away" or "stay"');
    });

    test('should fail when mode is invalid', async () => {
      const invalidModes = ['home', 'invalid', 'off', 'night'];
      
      for (const mode of invalidModes) {
        const result = await useCase.execute(zoneId, mode, userId);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid arm mode. Must be "away" or "stay"');
      }
    });

    test('should fail when user ID is missing', async () => {
      const result = await useCase.execute(zoneId, 'away', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
    });

    test('should fail when user ID is null', async () => {
      const result = await useCase.execute(zoneId, 'away', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    test('should fail when zone is not found', async () => {
      mockZoneRepository.findById.mockResolvedValue(null);

      const result = await useCase.execute(zoneId, 'away', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(`Zone with ID '${zoneId}' not found`);
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should fail when zone is already armed', async () => {
      zone.arm('stay', 'previous-user');
      
      const result = await useCase.execute(zoneId, 'away', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(`Zone '${zone.name}' is already armed in stay mode`);
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should handle repository save errors', async () => {
      mockZoneRepository.save.mockRejectedValue(new Error('Database connection failed'));

      const result = await useCase.execute(zoneId, 'away', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    test('should handle event log save errors', async () => {
      mockEventLogRepository.save.mockRejectedValue(new Error('Event log save failed'));

      const result = await useCase.execute(zoneId, 'away', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Event log save failed');
    });
  });

  describe('child zone arming', () => {
    const parentZoneId = 'parent-123';
    const childZoneId1 = 'child-123';
    const childZoneId2 = 'child-456';
    const userId = 'user-789';
    let parentZone, childZone1, childZone2;

    beforeEach(() => {
      parentZone = new Zone(parentZoneId, 'Parent Zone');
      childZone1 = new Zone(childZoneId1, 'Child Zone 1');
      childZone2 = new Zone(childZoneId2, 'Child Zone 2');
      
      parentZone.addChildZone(childZoneId1);
      parentZone.addChildZone(childZoneId2);

      mockZoneRepository.findById
        .mockImplementation((id) => {
          if (id === parentZoneId) return Promise.resolve(parentZone);
          if (id === childZoneId1) return Promise.resolve(childZone1);
          if (id === childZoneId2) return Promise.resolve(childZone2);
          return Promise.resolve(null);
        });
      
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();
    });

    test('should arm only parent zone when includeChildZones is false', async () => {
      const result = await useCase.execute(parentZoneId, 'away', userId, false);

      expect(result.success).toBe(true);
      expect(result.zone.armed).toBe(true);
      expect(result.armedZones).toHaveLength(1);
      expect(result.armedZones[0].id).toBe(parentZoneId);
      
      // Child zones should not be armed
      expect(childZone1.isArmed()).toBe(false);
      expect(childZone2.isArmed()).toBe(false);
      
      // Only parent zone saved
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(1);
      expect(mockZoneRepository.save).toHaveBeenCalledWith(parentZone);
    });

    test('should arm parent and child zones when includeChildZones is true', async () => {
      const result = await useCase.execute(parentZoneId, 'stay', userId, true);

      expect(result.success).toBe(true);
      expect(result.zone.armed).toBe(true);
      expect(result.armedZones).toHaveLength(3);
      expect(result.message).toBe(`Zone '${parentZone.name}' and 2 child zones armed in stay mode`);

      // All zones should be armed
      expect(parentZone.isArmed()).toBe(true);
      expect(childZone1.isArmed()).toBe(true);
      expect(childZone2.isArmed()).toBe(true);

      // All zones should be in the same mode
      expect(parentZone.mode).toBe('stay');
      expect(childZone1.mode).toBe('stay');
      expect(childZone2.mode).toBe('stay');

      // All zones saved
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(3);
      
      // Events published for all zones
      expect(mockEventBus.publish).toHaveBeenCalledTimes(3);
      expect(mockEventLogRepository.save).toHaveBeenCalledTimes(3);
    });

    test('should skip already armed child zones', async () => {
      // Pre-arm one child zone
      childZone1.arm('away', 'another-user');

      const result = await useCase.execute(parentZoneId, 'stay', userId, true);

      expect(result.success).toBe(true);
      expect(result.armedZones).toHaveLength(2); // Parent + one unarmed child
      
      // First child remains in away mode, second child armed in stay mode
      expect(childZone1.mode).toBe('away');
      expect(childZone2.mode).toBe('stay');
      
      // Only parent and second child saved
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(2);
    });

    test('should handle non-existent child zones gracefully', async () => {
      parentZone.addChildZone('non-existent-zone');

      const result = await useCase.execute(parentZoneId, 'away', userId, true);

      expect(result.success).toBe(true);
      expect(result.armedZones).toHaveLength(3); // Parent + 2 existing children
      
      // Should not fail due to non-existent child
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(3);
    });

    test('should handle child zone save errors gracefully', async () => {
      mockZoneRepository.save
        .mockResolvedValueOnce() // Parent zone saves successfully
        .mockRejectedValueOnce(new Error('Child zone save failed')) // First child fails
        .mockResolvedValueOnce(); // Second child saves successfully

      const result = await useCase.execute(parentZoneId, 'away', userId, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Child zone save failed');
    });

    test('should handle zones with no children when includeChildZones is true', async () => {
      const leafZone = new Zone('leaf-123', 'Leaf Zone');
      mockZoneRepository.findById.mockResolvedValue(leafZone);

      const result = await useCase.execute('leaf-123', 'away', userId, true);

      expect(result.success).toBe(true);
      expect(result.armedZones).toHaveLength(1);
      expect(result.message).toBe(`Zone '${leafZone.name}' armed in away mode`);
    });
  });

  describe('event publishing', () => {
    const zoneId = 'zone-123';
    const userId = 'user-456';
    let zone;

    beforeEach(() => {
      zone = new Zone(zoneId, 'Test Zone');
      mockZoneRepository.findById.mockResolvedValue(zone);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();
    });

    test('should publish ZoneStateChanged event with correct data', async () => {
      const initialState = zone.getStatus();

      await useCase.execute(zoneId, 'away', userId);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ZoneStateChanged',
          zoneId: zoneId,
          userId: userId,
          changeType: 'armed'
        })
      );

      const publishedEvent = mockEventBus.publish.mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(ZoneStateChanged);
      expect(publishedEvent.previousState.armed).toBe(false);
      expect(publishedEvent.newState.armed).toBe(true);
      expect(publishedEvent.newState.mode).toBe('away');
    });

    test('should create event log entry with correct data', async () => {
      const mockEventLog = { id: 'event-123', type: 'zone_armed' };
      jest.spyOn(EventLog, 'createZoneArmedEvent').mockReturnValue(mockEventLog);

      await useCase.execute(zoneId, 'stay', userId);

      expect(EventLog.createZoneArmedEvent).toHaveBeenCalledWith(zone, 'stay', userId);
      expect(mockEventLogRepository.save).toHaveBeenCalledWith(mockEventLog);
    });

    test('should publish events for all zones when arming with children', async () => {
      const parentZone = new Zone('parent-123', 'Parent');
      const childZone = new Zone('child-123', 'Child');
      parentZone.addChildZone('child-123');

      mockZoneRepository.findById
        .mockImplementation((id) => {
          if (id === 'parent-123') return Promise.resolve(parentZone);
          if (id === 'child-123') return Promise.resolve(childZone);
          return Promise.resolve(null);
        });

      await useCase.execute('parent-123', 'away', userId, true);

      // Should publish events for both parent and child
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
      expect(mockEventLogRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('validation edge cases', () => {
    const zoneId = 'zone-123';
    const userId = 'user-456';

    test('should handle whitespace in zone ID', async () => {
      const result = await useCase.execute('  ', 'away', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID is required');
    });

    test('should handle whitespace in user ID', async () => {
      const result = await useCase.execute(zoneId, 'away', '  ');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    test('should handle case sensitivity in mode', async () => {
      const result = await useCase.execute(zoneId, 'AWAY', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid arm mode. Must be "away" or "stay"');
    });

    test('should handle boolean includeChildZones parameter', async () => {
      const zone = new Zone(zoneId, 'Test Zone');
      mockZoneRepository.findById.mockResolvedValue(zone);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result1 = await useCase.execute(zoneId, 'away', userId, true);
      const result2 = await useCase.execute(zoneId, 'stay', 'user2', false);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false); // Zone is already armed from first call
    });
  });

  describe('performance considerations', () => {
    test('should fail fast on validation errors', async () => {
      const result = await useCase.execute('', '', '');

      expect(result.success).toBe(false);
      expect(mockZoneRepository.findById).not.toHaveBeenCalled();
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
      expect(mockEventLogRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should handle large numbers of child zones efficiently', async () => {
      const parentZone = new Zone('parent-123', 'Parent Zone');
      const childZones = [];
      
      // Create 50 child zones
      for (let i = 0; i < 50; i++) {
        const childId = `child-${i}`;
        const childZone = new Zone(childId, `Child ${i}`);
        childZones.push(childZone);
        parentZone.addChildZone(childId);
      }

      mockZoneRepository.findById.mockImplementation((id) => {
        if (id === 'parent-123') return Promise.resolve(parentZone);
        const childZone = childZones.find(z => z.id === id);
        return Promise.resolve(childZone || null);
      });
      
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute('parent-123', 'away', 'user-123', true);

      expect(result.success).toBe(true);
      expect(result.armedZones).toHaveLength(51); // Parent + 50 children
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(51);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(51);
    });
  });
});