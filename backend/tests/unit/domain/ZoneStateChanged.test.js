const ZoneStateChanged = require('../../../src/domain/events/ZoneStateChanged');
const DomainEvent = require('../../../src/domain/events/DomainEvent');

describe('ZoneStateChanged Event', () => {
  const zoneId = 'zone-123';
  const userId = 'user-456';
  const previousState = {
    armed: false,
    mode: null,
    name: 'Old Zone Name'
  };
  const newState = {
    armed: true,
    mode: 'away',
    name: 'New Zone Name'
  };

  describe('constructor', () => {
    test('should create ZoneStateChanged event with all parameters', () => {
      const event = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');

      expect(event).toBeInstanceOf(DomainEvent);
      expect(event.eventType).toBe('ZoneStateChanged');
      expect(event.aggregateId).toBe(zoneId);
      expect(event.zoneId).toBe(zoneId);
      expect(event.previousState).toEqual(previousState);
      expect(event.newState).toEqual(newState);
      expect(event.userId).toBe(userId);
      expect(event.changeType).toBe('armed');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.eventId).toBeDefined();
    });

    test('should create event with null previous state for creation', () => {
      const event = new ZoneStateChanged(zoneId, null, newState, userId, 'created');

      expect(event.previousState).toBeNull();
      expect(event.newState).toEqual(newState);
      expect(event.changeType).toBe('created');
    });

    test('should include data in parent DomainEvent', () => {
      const event = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');

      expect(event.data).toEqual({
        previousState,
        newState,
        userId,
        changeType: 'armed'
      });
    });

    test('should have unique event IDs for different instances', async () => {
      const event1 = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');
      
      // Small delay to ensure different timestamps/IDs
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const event2 = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');

      expect(event1.eventId).not.toBe(event2.eventId);
    });

    test('should have different timestamps for events created at different times', () => {
      const event1 = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');
      
      // Small delay to ensure different timestamps
      setTimeout(() => {
        const event2 = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');
        expect(event2.timestamp.getTime()).toBeGreaterThan(event1.timestamp.getTime());
      }, 1);
    });
  });

  describe('change type detection methods', () => {
    test('should correctly identify arming event', () => {
      const event = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');

      expect(event.isArmingEvent()).toBe(true);
      expect(event.isDisarmingEvent()).toBe(false);
      expect(event.isUpdateEvent()).toBe(false);
      expect(event.isCreationEvent()).toBe(false);
    });

    test('should correctly identify disarming event', () => {
      const event = new ZoneStateChanged(zoneId, previousState, newState, userId, 'disarmed');

      expect(event.isArmingEvent()).toBe(false);
      expect(event.isDisarmingEvent()).toBe(true);
      expect(event.isUpdateEvent()).toBe(false);
      expect(event.isCreationEvent()).toBe(false);
    });

    test('should correctly identify update event', () => {
      const event = new ZoneStateChanged(zoneId, previousState, newState, userId, 'updated');

      expect(event.isArmingEvent()).toBe(false);
      expect(event.isDisarmingEvent()).toBe(false);
      expect(event.isUpdateEvent()).toBe(true);
      expect(event.isCreationEvent()).toBe(false);
    });

    test('should correctly identify creation event', () => {
      const event = new ZoneStateChanged(zoneId, null, newState, userId, 'created');

      expect(event.isArmingEvent()).toBe(false);
      expect(event.isDisarmingEvent()).toBe(false);
      expect(event.isUpdateEvent()).toBe(false);
      expect(event.isCreationEvent()).toBe(true);
    });
  });

  describe('getter methods', () => {
    let event;

    beforeEach(() => {
      event = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');
    });

    test('should return zone ID', () => {
      expect(event.getZoneId()).toBe(zoneId);
    });

    test('should return user ID', () => {
      expect(event.getUserId()).toBe(userId);
    });

    test('should return previous armed state', () => {
      expect(event.getPreviousArmedState()).toBe(false);
    });

    test('should return new armed state', () => {
      expect(event.getNewArmedState()).toBe(true);
    });

    test('should return previous mode', () => {
      expect(event.getPreviousMode()).toBeNull();
    });

    test('should return new mode', () => {
      expect(event.getNewMode()).toBe('away');
    });
  });

  describe('edge cases with null states', () => {
    test('should handle null previous state gracefully', () => {
      const event = new ZoneStateChanged(zoneId, null, newState, userId, 'created');

      expect(event.getPreviousArmedState()).toBe(false);
      expect(event.getPreviousMode()).toBeNull();
      expect(event.getNewArmedState()).toBe(true);
      expect(event.getNewMode()).toBe('away');
    });

    test('should handle null new state gracefully', () => {
      const event = new ZoneStateChanged(zoneId, previousState, null, userId, 'deleted');

      expect(event.getPreviousArmedState()).toBe(false);
      expect(event.getPreviousMode()).toBeNull();
      expect(event.getNewArmedState()).toBe(false);
      expect(event.getNewMode()).toBeNull();
    });

    test('should handle both states being null', () => {
      const event = new ZoneStateChanged(zoneId, null, null, userId, 'unknown');

      expect(event.getPreviousArmedState()).toBe(false);
      expect(event.getPreviousMode()).toBeNull();
      expect(event.getNewArmedState()).toBe(false);
      expect(event.getNewMode()).toBeNull();
    });
  });

  describe('event data consistency', () => {
    test('should maintain consistency between direct properties and data object', () => {
      const event = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');

      expect(event.data.previousState).toEqual(event.previousState);
      expect(event.data.newState).toEqual(event.newState);
      expect(event.data.userId).toBe(event.userId);
      expect(event.data.changeType).toBe(event.changeType);
    });

    test('should preserve state object references', () => {
      const event = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');

      expect(event.previousState).toBe(previousState);
      expect(event.newState).toBe(newState);
      expect(event.data.previousState).toBe(previousState);
      expect(event.data.newState).toBe(newState);
    });
  });

  describe('real-world scenarios', () => {
    test('should handle zone arming scenario', () => {
      const disarmedState = { armed: false, mode: null, name: 'Living Room' };
      const armedState = { armed: true, mode: 'away', name: 'Living Room' };
      
      const event = new ZoneStateChanged('living-room', disarmedState, armedState, 'admin-user', 'armed');

      expect(event.isArmingEvent()).toBe(true);
      expect(event.getPreviousArmedState()).toBe(false);
      expect(event.getNewArmedState()).toBe(true);
      expect(event.getPreviousMode()).toBeNull();
      expect(event.getNewMode()).toBe('away');
    });

    test('should handle zone disarming scenario', () => {
      const armedState = { armed: true, mode: 'stay', name: 'Bedroom' };
      const disarmedState = { armed: false, mode: null, name: 'Bedroom' };
      
      const event = new ZoneStateChanged('bedroom', armedState, disarmedState, 'user-123', 'disarmed');

      expect(event.isDisarmingEvent()).toBe(true);
      expect(event.getPreviousArmedState()).toBe(true);
      expect(event.getNewArmedState()).toBe(false);
      expect(event.getPreviousMode()).toBe('stay');
      expect(event.getNewMode()).toBeNull();
    });

    test('should handle zone creation scenario', () => {
      const createdState = { armed: false, mode: null, name: 'New Zone' };
      
      const event = new ZoneStateChanged('new-zone', null, createdState, 'admin-user', 'created');

      expect(event.isCreationEvent()).toBe(true);
      expect(event.previousState).toBeNull();
      expect(event.newState).toEqual(createdState);
      expect(event.getPreviousArmedState()).toBe(false);
      expect(event.getNewArmedState()).toBe(false);
    });

    test('should handle zone update scenario', () => {
      const oldState = { armed: false, mode: null, name: 'Old Name' };
      const updatedState = { armed: false, mode: null, name: 'Updated Name' };
      
      const event = new ZoneStateChanged('zone-123', oldState, updatedState, 'user-456', 'updated');

      expect(event.isUpdateEvent()).toBe(true);
      expect(event.previousState.name).toBe('Old Name');
      expect(event.newState.name).toBe('Updated Name');
      expect(event.getPreviousArmedState()).toBe(false);
      expect(event.getNewArmedState()).toBe(false);
    });

    test('should handle mode change without arming state change', () => {
      const stayState = { armed: true, mode: 'stay', name: 'Zone' };
      const awayState = { armed: true, mode: 'away', name: 'Zone' };
      
      const event = new ZoneStateChanged('zone-123', stayState, awayState, 'user-789', 'armed');

      expect(event.getPreviousArmedState()).toBe(true);
      expect(event.getNewArmedState()).toBe(true);
      expect(event.getPreviousMode()).toBe('stay');
      expect(event.getNewMode()).toBe('away');
    });
  });

  describe('performance and memory considerations', () => {
    test('should create lightweight event objects', () => {
      const event = new ZoneStateChanged(zoneId, previousState, newState, userId, 'armed');
      
      // Check that the event doesn't have excessive properties
      const eventKeys = Object.keys(event);
      expect(eventKeys.length).toBeLessThan(15); // Reasonable limit for event properties
    });

    test('should handle large state objects without issues', () => {
      const largeState = {
        armed: true,
        mode: 'away',
        name: 'Zone with lots of data',
        metadata: {
          sensors: Array(100).fill().map((_, i) => ({ id: i, type: 'motion' })),
          configuration: {
            delays: { entry: 30, exit: 60 },
            sensitivity: 'high',
            notifications: true
          }
        }
      };

      expect(() => {
        new ZoneStateChanged(zoneId, largeState, largeState, userId, 'updated');
      }).not.toThrow();
    });
  });
});