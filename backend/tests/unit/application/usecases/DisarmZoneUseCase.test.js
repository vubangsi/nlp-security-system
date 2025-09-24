const DisarmZoneUseCase = require('../../../../src/application/useCases/DisarmZoneUseCase');
const Zone = require('../../../../src/domain/entities/Zone');
const ZoneStateChanged = require('../../../../src/domain/events/ZoneStateChanged');
const EventLog = require('../../../../src/domain/entities/EventLog');

describe('DisarmZoneUseCase', () => {
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

    useCase = new DisarmZoneUseCase(mockZoneRepository, mockEventLogRepository, mockEventBus);
  });

  describe('execute', () => {
    const zoneId = 'zone-123';
    const userId = 'user-456';
    let zone;

    beforeEach(() => {
      zone = new Zone(zoneId, 'Living Room', 'Main living area');
      zone.arm('away', 'initial-user'); // Pre-arm the zone
      
      mockZoneRepository.findById.mockResolvedValue(zone);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();
    });

    test('should disarm zone successfully', async () => {
      const result = await useCase.execute(zoneId, userId);

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Zone '${zone.name}' disarmed`);
      expect(result.zone.armed).toBe(false);
      expect(result.zone.mode).toBeNull();
      expect(result.zone.modifiedBy).toBe(userId);
      expect(result.disarmedZones).toHaveLength(1);
      expect(result.disarmedZones[0].id).toBe(zoneId);

      expect(mockZoneRepository.save).toHaveBeenCalledWith(zone);
      expect(mockEventLogRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    test('should fail when zone ID is missing', async () => {
      const result = await useCase.execute('', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID is required');
      expect(mockZoneRepository.findById).not.toHaveBeenCalled();
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
    });

    test('should fail when zone ID is null', async () => {
      const result = await useCase.execute(null, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID is required');
    });

    test('should fail when user ID is missing', async () => {
      const result = await useCase.execute(zoneId, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
    });

    test('should fail when user ID is null', async () => {
      const result = await useCase.execute(zoneId, null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    test('should fail when zone is not found', async () => {
      mockZoneRepository.findById.mockResolvedValue(null);

      const result = await useCase.execute(zoneId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(`Zone with ID '${zoneId}' not found`);
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should fail when zone is already disarmed', async () => {
      zone.disarm('previous-user'); // Disarm the zone first
      
      const result = await useCase.execute(zoneId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(`Zone '${zone.name}' is already disarmed`);
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should handle repository save errors', async () => {
      mockZoneRepository.save.mockRejectedValue(new Error('Database connection failed'));

      const result = await useCase.execute(zoneId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    test('should handle event log save errors', async () => {
      mockEventLogRepository.save.mockRejectedValue(new Error('Event log save failed'));

      const result = await useCase.execute(zoneId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Event log save failed');
    });

    test('should preserve previous armed mode information in result', async () => {
      // Zone is armed in 'away' mode from beforeEach
      const result = await useCase.execute(zoneId, userId);

      expect(result.success).toBe(true);
      expect(result.zone.armed).toBe(false);
      expect(result.zone.mode).toBeNull();
      
      // Check that the event was published with correct previous state
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ZoneStateChanged',
          changeType: 'disarmed'
        })
      );
    });
  });

  describe('child zone disarming', () => {
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

      // Arm all zones
      parentZone.arm('away', 'initial-user');
      childZone1.arm('stay', 'initial-user');
      childZone2.arm('away', 'initial-user');

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

    test('should disarm only parent zone when includeChildZones is false', async () => {
      const result = await useCase.execute(parentZoneId, userId, false);

      expect(result.success).toBe(true);
      expect(result.zone.armed).toBe(false);
      expect(result.disarmedZones).toHaveLength(1);
      expect(result.disarmedZones[0].id).toBe(parentZoneId);
      
      // Child zones should remain armed
      expect(childZone1.isArmed()).toBe(true);
      expect(childZone2.isArmed()).toBe(true);
      
      // Only parent zone saved
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(1);
      expect(mockZoneRepository.save).toHaveBeenCalledWith(parentZone);
    });

    test('should disarm parent and child zones when includeChildZones is true', async () => {
      const result = await useCase.execute(parentZoneId, userId, true);

      expect(result.success).toBe(true);
      expect(result.zone.armed).toBe(false);
      expect(result.disarmedZones).toHaveLength(3);
      expect(result.message).toBe(`Zone '${parentZone.name}' and 2 child zones disarmed`);

      // All zones should be disarmed
      expect(parentZone.isArmed()).toBe(false);
      expect(childZone1.isArmed()).toBe(false);
      expect(childZone2.isArmed()).toBe(false);

      // All zones should have null mode
      expect(parentZone.mode).toBeNull();
      expect(childZone1.mode).toBeNull();
      expect(childZone2.mode).toBeNull();

      // All zones saved
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(3);
      
      // Events published for all zones
      expect(mockEventBus.publish).toHaveBeenCalledTimes(3);
      expect(mockEventLogRepository.save).toHaveBeenCalledTimes(3);
    });

    test('should skip already disarmed child zones', async () => {
      // Pre-disarm one child zone
      childZone1.disarm('another-user');

      const result = await useCase.execute(parentZoneId, userId, true);

      expect(result.success).toBe(true);
      expect(result.disarmedZones).toHaveLength(2); // Parent + one armed child
      
      // First child remains disarmed, second child gets disarmed
      expect(childZone1.isArmed()).toBe(false);
      expect(childZone2.isArmed()).toBe(false);
      
      // Only parent and second child saved
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(2);
    });

    test('should handle non-existent child zones gracefully', async () => {
      parentZone.addChildZone('non-existent-zone');

      const result = await useCase.execute(parentZoneId, userId, true);

      expect(result.success).toBe(true);
      expect(result.disarmedZones).toHaveLength(3); // Parent + 2 existing children
      
      // Should not fail due to non-existent child
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(3);
    });

    test('should handle child zone save errors gracefully', async () => {
      mockZoneRepository.save
        .mockResolvedValueOnce() // Parent zone saves successfully
        .mockRejectedValueOnce(new Error('Child zone save failed')) // First child fails
        .mockResolvedValueOnce(); // Second child would save successfully but won't reach it

      const result = await useCase.execute(parentZoneId, userId, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Child zone save failed');
    });

    test('should handle zones with no children when includeChildZones is true', async () => {
      const leafZone = new Zone('leaf-123', 'Leaf Zone');
      leafZone.arm('stay', 'initial-user');
      mockZoneRepository.findById.mockResolvedValue(leafZone);

      const result = await useCase.execute('leaf-123', userId, true);

      expect(result.success).toBe(true);
      expect(result.disarmedZones).toHaveLength(1);
      expect(result.message).toBe(`Zone '${leafZone.name}' disarmed`);
    });

    test('should handle mixed armed/disarmed child zones', async () => {
      // Leave childZone1 disarmed but arm childZone2
      childZone1.disarm('previous-user');
      
      const result = await useCase.execute(parentZoneId, userId, true);

      expect(result.success).toBe(true);
      expect(result.disarmedZones).toHaveLength(2); // Parent + only childZone2
      
      // Verify the correct zones were processed
      const disarmedIds = result.disarmedZones.map(z => z.id);
      expect(disarmedIds).toContain(parentZoneId);
      expect(disarmedIds).toContain(childZoneId2);
      expect(disarmedIds).not.toContain(childZoneId1);
    });
  });

  describe('event publishing', () => {
    const zoneId = 'zone-123';
    const userId = 'user-456';
    let zone;

    beforeEach(() => {
      zone = new Zone(zoneId, 'Test Zone');
      zone.arm('stay', 'initial-user');
      
      mockZoneRepository.findById.mockResolvedValue(zone);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();
    });

    test('should publish ZoneStateChanged event with correct data', async () => {
      await useCase.execute(zoneId, userId);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ZoneStateChanged',
          zoneId: zoneId,
          userId: userId,
          changeType: 'disarmed'
        })
      );

      const publishedEvent = mockEventBus.publish.mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(ZoneStateChanged);
      expect(publishedEvent.previousState.armed).toBe(true);
      expect(publishedEvent.previousState.mode).toBe('stay');
      expect(publishedEvent.newState.armed).toBe(false);
      expect(publishedEvent.newState.mode).toBeNull();
    });

    test('should create event log entry with correct data', async () => {
      const mockEventLog = { id: 'event-123', type: 'zone_disarmed' };
      jest.spyOn(EventLog, 'createZoneDisarmedEvent').mockReturnValue(mockEventLog);

      await useCase.execute(zoneId, userId);

      expect(EventLog.createZoneDisarmedEvent).toHaveBeenCalledWith(zone, userId);
      expect(mockEventLogRepository.save).toHaveBeenCalledWith(mockEventLog);
    });

    test('should publish events for all zones when disarming with children', async () => {
      const parentZone = new Zone('parent-123', 'Parent');
      const childZone = new Zone('child-123', 'Child');
      parentZone.addChildZone('child-123');
      
      // Arm both zones
      parentZone.arm('away', 'initial-user');
      childZone.arm('away', 'initial-user');

      mockZoneRepository.findById
        .mockImplementation((id) => {
          if (id === 'parent-123') return Promise.resolve(parentZone);
          if (id === 'child-123') return Promise.resolve(childZone);
          return Promise.resolve(null);
        });

      await useCase.execute('parent-123', userId, true);

      // Should publish events for both parent and child
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
      expect(mockEventLogRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('validation edge cases', () => {
    const zoneId = 'zone-123';
    const userId = 'user-456';

    test('should handle whitespace in zone ID', async () => {
      const result = await useCase.execute('  ', userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID is required');
    });

    test('should handle whitespace in user ID', async () => {
      const result = await useCase.execute(zoneId, '  ');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    test('should handle boolean includeChildZones parameter', async () => {
      const zone = new Zone(zoneId, 'Test Zone');
      zone.arm('away', 'initial-user');
      
      mockZoneRepository.findById.mockResolvedValue(zone);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result1 = await useCase.execute(zoneId, userId, true);
      
      expect(result1.success).toBe(true);
      expect(zone.isArmed()).toBe(false);
    });

    test('should handle zone that was armed then disarmed then armed again', async () => {
      const zone = new Zone(zoneId, 'Test Zone');
      zone.arm('away', 'user1');
      zone.disarm('user2');
      zone.arm('stay', 'user3');
      
      mockZoneRepository.findById.mockResolvedValue(zone);
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute(zoneId, userId);

      expect(result.success).toBe(true);
      expect(result.zone.armed).toBe(false);
      expect(result.zone.mode).toBeNull();
      expect(result.zone.modifiedBy).toBe(userId);
    });
  });

  describe('performance considerations', () => {
    test('should fail fast on validation errors', async () => {
      const result = await useCase.execute('', '');

      expect(result.success).toBe(false);
      expect(mockZoneRepository.findById).not.toHaveBeenCalled();
      expect(mockZoneRepository.save).not.toHaveBeenCalled();
      expect(mockEventLogRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('should handle large numbers of child zones efficiently', async () => {
      const parentZone = new Zone('parent-123', 'Parent Zone');
      const childZones = [];
      
      // Create and arm 50 child zones
      for (let i = 0; i < 50; i++) {
        const childId = `child-${i}`;
        const childZone = new Zone(childId, `Child ${i}`);
        childZone.arm('away', 'initial-user');
        childZones.push(childZone);
        parentZone.addChildZone(childId);
      }

      parentZone.arm('away', 'initial-user');

      mockZoneRepository.findById.mockImplementation((id) => {
        if (id === 'parent-123') return Promise.resolve(parentZone);
        const childZone = childZones.find(z => z.id === id);
        return Promise.resolve(childZone || null);
      });
      
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute('parent-123', 'user-123', true);

      expect(result.success).toBe(true);
      expect(result.disarmedZones).toHaveLength(51); // Parent + 50 children
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(51);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(51);
    });

    test('should not perform unnecessary operations for already disarmed zones', async () => {
      const parentZone = new Zone('parent-123', 'Parent Zone');
      const armedChild = new Zone('armed-child', 'Armed Child');
      const disarmedChild = new Zone('disarmed-child', 'Disarmed Child');
      
      parentZone.addChildZone('armed-child');
      parentZone.addChildZone('disarmed-child');
      
      parentZone.arm('away', 'initial-user');
      armedChild.arm('away', 'initial-user');
      // disarmedChild is left disarmed

      mockZoneRepository.findById.mockImplementation((id) => {
        if (id === 'parent-123') return Promise.resolve(parentZone);
        if (id === 'armed-child') return Promise.resolve(armedChild);
        if (id === 'disarmed-child') return Promise.resolve(disarmedChild);
        return Promise.resolve(null);
      });
      
      mockZoneRepository.save.mockResolvedValue();
      mockEventLogRepository.save.mockResolvedValue();

      const result = await useCase.execute('parent-123', 'user-123', true);

      expect(result.success).toBe(true);
      expect(result.disarmedZones).toHaveLength(2); // Parent + only the armed child
      expect(mockZoneRepository.save).toHaveBeenCalledTimes(2); // Only parent and armed child
    });
  });
});