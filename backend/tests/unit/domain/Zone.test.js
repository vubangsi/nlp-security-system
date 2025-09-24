const Zone = require('../../../src/domain/entities/Zone');

describe('Zone Entity', () => {
  describe('constructor', () => {
    test('should create Zone with required fields', () => {
      const zone = new Zone('zone-123', 'Living Room', 'Main living area');

      expect(zone.id).toBe('zone-123');
      expect(zone.name).toBe('Living Room');
      expect(zone.description).toBe('Main living area');
      expect(zone.parentZoneId).toBeNull();
      expect(zone.armed).toBe(false);
      expect(zone.mode).toBeNull();
      expect(zone.childZones).toBeInstanceOf(Set);
      expect(zone.childZones.size).toBe(0);
      expect(zone.createdAt).toBeInstanceOf(Date);
      expect(zone.lastModified).toBeInstanceOf(Date);
      expect(zone.modifiedBy).toBeNull();
    });

    test('should create Zone with parent zone ID', () => {
      const zone = new Zone('zone-123', 'Bedroom', 'Master bedroom', 'zone-parent');

      expect(zone.parentZoneId).toBe('zone-parent');
      expect(zone.isRootZone()).toBe(false);
    });

    test('should create Zone with minimal required parameters', () => {
      const zone = new Zone('zone-123', 'Kitchen');

      expect(zone.description).toBe('');
      expect(zone.parentZoneId).toBeNull();
      expect(zone.isRootZone()).toBe(true);
    });

    test('should throw error for invalid name', () => {
      expect(() => new Zone('zone-123', '')).toThrow('Zone name is required and must be a string');
      expect(() => new Zone('zone-123', null)).toThrow('Zone name is required and must be a string');
      expect(() => new Zone('zone-123', 123)).toThrow('Zone name is required and must be a string');
      expect(() => new Zone('zone-123', '   ')).toThrow('Zone name cannot be empty');
    });

    test('should throw error for name too long', () => {
      const longName = 'a'.repeat(51);
      expect(() => new Zone('zone-123', longName)).toThrow('Zone name cannot exceed 50 characters');
    });

    test('should throw error for invalid characters in name', () => {
      expect(() => new Zone('zone-123', 'Living@Room')).toThrow('Zone name can only contain letters, numbers, spaces, hyphens, and underscores');
      expect(() => new Zone('zone-123', 'Living$Room')).toThrow('Zone name can only contain letters, numbers, spaces, hyphens, and underscores');
      expect(() => new Zone('zone-123', 'Living/Room')).toThrow('Zone name can only contain letters, numbers, spaces, hyphens, and underscores');
    });

    test('should accept valid name characters', () => {
      expect(() => new Zone('zone-123', 'Living Room 1')).not.toThrow();
      expect(() => new Zone('zone-123', 'Living-Room_2')).not.toThrow();
      expect(() => new Zone('zone-123', 'LivingRoom123')).not.toThrow();
    });
  });

  describe('validateName', () => {
    let zone;

    beforeEach(() => {
      zone = new Zone('zone-123', 'Test Zone');
    });

    test('should validate name successfully for valid input', () => {
      expect(() => zone.validateName('Valid Name')).not.toThrow();
      expect(() => zone.validateName('Valid-Name_123')).not.toThrow();
    });

    test('should throw error for invalid name types', () => {
      expect(() => zone.validateName(null)).toThrow('Zone name is required and must be a string');
      expect(() => zone.validateName(undefined)).toThrow('Zone name is required and must be a string');
      expect(() => zone.validateName(123)).toThrow('Zone name is required and must be a string');
      expect(() => zone.validateName({})).toThrow('Zone name is required and must be a string');
    });

    test('should throw error for empty or whitespace-only names', () => {
      expect(() => zone.validateName('')).toThrow('Zone name is required and must be a string');
      expect(() => zone.validateName('   ')).toThrow('Zone name cannot be empty');
      expect(() => zone.validateName('\t\n')).toThrow('Zone name cannot be empty');
    });

    test('should throw error for names exceeding length limit', () => {
      const longName = 'a'.repeat(51);
      expect(() => zone.validateName(longName)).toThrow('Zone name cannot exceed 50 characters');
    });

    test('should throw error for names with invalid characters', () => {
      const invalidNames = ['Test@Zone', 'Test#Zone', 'Test$Zone', 'Test%Zone', 'Test&Zone', 'Test*Zone'];
      invalidNames.forEach(name => {
        expect(() => zone.validateName(name)).toThrow('Zone name can only contain letters, numbers, spaces, hyphens, and underscores');
      });
    });
  });

  describe('child zone management', () => {
    let zone;

    beforeEach(() => {
      zone = new Zone('zone-123', 'Parent Zone');
    });

    test('should add child zone successfully', () => {
      zone.addChildZone('child-123');

      expect(zone.hasChildZones()).toBe(true);
      expect(zone.getChildZones()).toContain('child-123');
      expect(zone.childZones.size).toBe(1);
    });

    test('should add multiple child zones', () => {
      zone.addChildZone('child-123');
      zone.addChildZone('child-456');

      expect(zone.hasChildZones()).toBe(true);
      expect(zone.getChildZones()).toEqual(expect.arrayContaining(['child-123', 'child-456']));
      expect(zone.childZones.size).toBe(2);
    });

    test('should not add duplicate child zones', () => {
      zone.addChildZone('child-123');
      zone.addChildZone('child-123');

      expect(zone.childZones.size).toBe(1);
      expect(zone.getChildZones()).toEqual(['child-123']);
    });

    test('should throw error when adding child zone without ID', () => {
      expect(() => zone.addChildZone('')).toThrow('Child zone ID is required');
      expect(() => zone.addChildZone(null)).toThrow('Child zone ID is required');
      expect(() => zone.addChildZone(undefined)).toThrow('Child zone ID is required');
    });

    test('should throw error when zone tries to be its own child', () => {
      expect(() => zone.addChildZone('zone-123')).toThrow('Zone cannot be its own child');
    });

    test('should remove child zone successfully', () => {
      zone.addChildZone('child-123');
      zone.addChildZone('child-456');

      zone.removeChildZone('child-123');

      expect(zone.hasChildZones()).toBe(true);
      expect(zone.getChildZones()).toEqual(['child-456']);
      expect(zone.childZones.size).toBe(1);
    });

    test('should handle removing non-existent child zone gracefully', () => {
      zone.addChildZone('child-123');

      expect(() => zone.removeChildZone('non-existent')).not.toThrow();
      expect(zone.getChildZones()).toEqual(['child-123']);
    });

    test('should return false for hasChildZones when no children', () => {
      expect(zone.hasChildZones()).toBe(false);
    });

    test('should return empty array for getChildZones when no children', () => {
      expect(zone.getChildZones()).toEqual([]);
    });
  });

  describe('zone hierarchy', () => {
    test('should identify root zone correctly', () => {
      const rootZone = new Zone('root-123', 'Root Zone');
      expect(rootZone.isRootZone()).toBe(true);
    });

    test('should identify non-root zone correctly', () => {
      const childZone = new Zone('child-123', 'Child Zone', 'Description', 'parent-123');
      expect(childZone.isRootZone()).toBe(false);
    });
  });

  describe('arming and disarming', () => {
    let zone;
    const userId = 'user-123';

    beforeEach(() => {
      zone = new Zone('zone-123', 'Test Zone');
    });

    test('should arm zone in away mode successfully', async () => {
      const initialTime = zone.lastModified;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      zone.arm('away', userId);

      expect(zone.armed).toBe(true);
      expect(zone.mode).toBe('away');
      expect(zone.modifiedBy).toBe(userId);
      expect(zone.lastModified.getTime()).toBeGreaterThan(initialTime.getTime());
      expect(zone.isArmed()).toBe(true);
    });

    test('should arm zone in stay mode successfully', () => {
      zone.arm('stay', userId);

      expect(zone.armed).toBe(true);
      expect(zone.mode).toBe('stay');
      expect(zone.modifiedBy).toBe(userId);
      expect(zone.isArmed()).toBe(true);
    });

    test('should throw error for invalid arm mode', () => {
      expect(() => zone.arm('invalid', userId)).toThrow('Invalid arm mode. Must be "away" or "stay"');
      expect(() => zone.arm('home', userId)).toThrow('Invalid arm mode. Must be "away" or "stay"');
      expect(() => zone.arm('', userId)).toThrow('Invalid arm mode. Must be "away" or "stay"');
    });

    test('should throw error when arming without user ID', () => {
      expect(() => zone.arm('away', '')).toThrow('User ID is required for arming');
      expect(() => zone.arm('away', null)).toThrow('User ID is required for arming');
      expect(() => zone.arm('away', undefined)).toThrow('User ID is required for arming');
    });

    test('should disarm zone successfully', async () => {
      zone.arm('away', userId);
      const armedTime = zone.lastModified;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      zone.disarm(userId);

      expect(zone.armed).toBe(false);
      expect(zone.mode).toBeNull();
      expect(zone.modifiedBy).toBe(userId);
      expect(zone.lastModified.getTime()).toBeGreaterThan(armedTime.getTime());
      expect(zone.isArmed()).toBe(false);
    });

    test('should throw error when disarming without user ID', () => {
      zone.arm('away', userId);

      expect(() => zone.disarm('')).toThrow('User ID is required for disarming');
      expect(() => zone.disarm(null)).toThrow('User ID is required for disarming');
      expect(() => zone.disarm(undefined)).toThrow('User ID is required for disarming');
    });

    test('should handle disarming already disarmed zone', () => {
      expect(() => zone.disarm(userId)).not.toThrow();
      expect(zone.armed).toBe(false);
      expect(zone.mode).toBeNull();
    });
  });

  describe('zone updates', () => {
    let zone;
    const userId = 'user-123';

    beforeEach(() => {
      zone = new Zone('zone-123', 'Original Name', 'Original description');
    });

    test('should update name successfully', async () => {
      const initialTime = zone.lastModified;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      zone.updateName('New Name', userId);

      expect(zone.name).toBe('New Name');
      expect(zone.modifiedBy).toBe(userId);
      expect(zone.lastModified.getTime()).toBeGreaterThan(initialTime.getTime());
    });

    test('should validate name when updating', () => {
      expect(() => zone.updateName('', userId)).toThrow('Zone name is required and must be a string');
      expect(() => zone.updateName('a'.repeat(51), userId)).toThrow('Zone name cannot exceed 50 characters');
      expect(() => zone.updateName('Invalid@Name', userId)).toThrow('Zone name can only contain letters, numbers, spaces, hyphens, and underscores');
    });

    test('should throw error when updating name without user ID', () => {
      expect(() => zone.updateName('New Name', '')).toThrow('User ID is required for updates');
      expect(() => zone.updateName('New Name', null)).toThrow('User ID is required for updates');
    });

    test('should update description successfully', async () => {
      const initialTime = zone.lastModified;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      zone.updateDescription('New description', userId);

      expect(zone.description).toBe('New description');
      expect(zone.modifiedBy).toBe(userId);
      expect(zone.lastModified.getTime()).toBeGreaterThan(initialTime.getTime());
    });

    test('should update description to empty string', () => {
      zone.updateDescription('', userId);

      expect(zone.description).toBe('');
    });

    test('should update description to null (converts to empty string)', () => {
      zone.updateDescription(null, userId);

      expect(zone.description).toBe('');
    });

    test('should throw error for non-string description', () => {
      expect(() => zone.updateDescription(123, userId)).toThrow('Description must be a string');
      expect(() => zone.updateDescription({}, userId)).toThrow('Description must be a string');
    });

    test('should throw error for description too long', () => {
      const longDescription = 'a'.repeat(201);
      expect(() => zone.updateDescription(longDescription, userId)).toThrow('Description cannot exceed 200 characters');
    });

    test('should throw error when updating description without user ID', () => {
      expect(() => zone.updateDescription('New description', '')).toThrow('User ID is required for updates');
      expect(() => zone.updateDescription('New description', null)).toThrow('User ID is required for updates');
    });
  });

  describe('getStatus and toJSON', () => {
    let zone;
    const userId = 'user-123';

    beforeEach(() => {
      zone = new Zone('zone-123', 'Test Zone', 'Test description', 'parent-123');
      zone.addChildZone('child-1');
      zone.addChildZone('child-2');
      zone.arm('away', userId);
    });

    test('should return complete status object', () => {
      const status = zone.getStatus();

      expect(status).toEqual({
        id: 'zone-123',
        name: 'Test Zone',
        description: 'Test description',
        parentZoneId: 'parent-123',
        armed: true,
        mode: 'away',
        childZones: expect.arrayContaining(['child-1', 'child-2']),
        createdAt: expect.any(Date),
        lastModified: expect.any(Date),
        modifiedBy: userId
      });
    });

    test('should return same data for toJSON', () => {
      const status = zone.getStatus();
      const json = zone.toJSON();

      expect(json).toEqual(status);
    });

    test('should include all required fields in status', () => {
      const status = zone.getStatus();

      expect(status).toHaveProperty('id');
      expect(status).toHaveProperty('name');
      expect(status).toHaveProperty('description');
      expect(status).toHaveProperty('parentZoneId');
      expect(status).toHaveProperty('armed');
      expect(status).toHaveProperty('mode');
      expect(status).toHaveProperty('childZones');
      expect(status).toHaveProperty('createdAt');
      expect(status).toHaveProperty('lastModified');
      expect(status).toHaveProperty('modifiedBy');
    });

    test('should handle zone with no parent and no children', () => {
      const simpleZone = new Zone('simple-123', 'Simple Zone');
      const status = simpleZone.getStatus();

      expect(status.parentZoneId).toBeNull();
      expect(status.childZones).toEqual([]);
      expect(status.armed).toBe(false);
      expect(status.mode).toBeNull();
      expect(status.modifiedBy).toBeNull();
    });
  });

  describe('edge cases and error conditions', () => {
    test('should handle concurrent modifications correctly', async () => {
      const zone = new Zone('zone-123', 'Test Zone');
      const user1 = 'user-1';
      const user2 = 'user-2';

      zone.arm('away', user1);
      const firstModifiedTime = zone.lastModified;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      // Simulate concurrent update
      zone.updateDescription('Updated by user 2', user2);

      expect(zone.modifiedBy).toBe(user2);
      expect(zone.lastModified.getTime()).toBeGreaterThan(firstModifiedTime.getTime());
    });

    test('should maintain data integrity after multiple operations', () => {
      const zone = new Zone('zone-123', 'Test Zone');
      const userId = 'user-123';

      // Perform multiple operations
      zone.addChildZone('child-1');
      zone.arm('stay', userId);
      zone.updateName('Updated Zone', userId);
      zone.addChildZone('child-2');
      zone.disarm(userId);
      zone.updateDescription('Final description', userId);

      const status = zone.getStatus();

      expect(status.name).toBe('Updated Zone');
      expect(status.description).toBe('Final description');
      expect(status.armed).toBe(false);
      expect(status.mode).toBeNull();
      expect(status.childZones).toEqual(expect.arrayContaining(['child-1', 'child-2']));
      expect(status.modifiedBy).toBe(userId);
    });
  });
});