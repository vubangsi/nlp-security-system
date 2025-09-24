const InMemoryZoneRepository = require('../../../src/infrastructure/persistence/InMemoryZoneRepository');
const Zone = require('../../../src/domain/entities/Zone');

describe('InMemoryZoneRepository', () => {
  let repository;

  beforeEach(() => {
    repository = new InMemoryZoneRepository();
  });

  describe('initialization', () => {
    test('should initialize with default zones', async () => {
      const zones = await repository.findAll();
      
      expect(zones.length).toBe(3);
      expect(zones.map(z => z.name)).toEqual(
        expect.arrayContaining(['Living Room', 'Garage', 'Bedroom'])
      );
      
      // All default zones should be root zones
      zones.forEach(zone => {
        expect(zone.parentZoneId).toBeNull();
        expect(zone.isRootZone()).toBe(true);
      });
    });

    test('should generate unique IDs for default zones', async () => {
      const zones = await repository.findAll();
      const ids = zones.map(z => z.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
      ids.forEach(id => {
        expect(id).toMatch(/^zone_\d+$/);
      });
    });

    test('should initialize indexes correctly', async () => {
      // Test name index
      const livingRoom = await repository.findByName('Living Room');
      expect(livingRoom).toBeDefined();
      expect(livingRoom.name).toBe('Living Room');

      // Test root zones
      const rootZones = await repository.findRootZones();
      expect(rootZones.length).toBe(3);
    });
  });

  describe('save', () => {
    test('should save new zone successfully', async () => {
      const zone = new Zone('new-zone-123', 'New Zone', 'A new test zone');
      
      const savedZone = await repository.save(zone);
      
      expect(savedZone).toBe(zone);
      
      const retrievedZone = await repository.findById('new-zone-123');
      expect(retrievedZone).toBe(zone);
      expect(retrievedZone.name).toBe('New Zone');
    });

    test('should update existing zone', async () => {
      const zones = await repository.findAll();
      const existingZone = zones[0];
      const originalName = existingZone.name;
      
      existingZone.updateName('Updated Name', 'user-123');
      
      await repository.save(existingZone);
      
      const retrievedZone = await repository.findById(existingZone.id);
      expect(retrievedZone.name).toBe('Updated Name');
      expect(retrievedZone.modifiedBy).toBe('user-123');
      
      // Should not be able to find by old name
      const oldNameResult = await repository.findByName(originalName);
      expect(oldNameResult).toBeNull();
      
      // Should find by new name
      const newNameResult = await repository.findByName('Updated Name');
      expect(newNameResult).toBe(existingZone);
    });

    test('should throw error for zone without ID', async () => {
      const zone = { name: 'Invalid Zone' }; // Not a proper Zone instance
      
      await expect(repository.save(zone)).rejects.toThrow('Invalid zone: Zone must have an ID');
    });

    test('should throw error for null zone', async () => {
      await expect(repository.save(null)).rejects.toThrow('Invalid zone: Zone must have an ID');
    });

    test('should throw error for duplicate name', async () => {
      const zone1 = new Zone('zone-1', 'Duplicate Name', 'First zone');
      const zone2 = new Zone('zone-2', 'Duplicate Name', 'Second zone');
      
      await repository.save(zone1);
      
      await expect(repository.save(zone2)).rejects.toThrow("Zone with name 'Duplicate Name' already exists");
    });

    test('should allow updating zone with same name', async () => {
      const zone = new Zone('zone-123', 'Test Zone', 'Original description');
      await repository.save(zone);
      
      zone.updateDescription('Updated description', 'user-123');
      
      await expect(repository.save(zone)).resolves.toBe(zone);
    });

    test('should handle hierarchy changes when updating zone', async () => {
      const parentZone = new Zone('parent-123', 'Parent Zone');
      const childZone = new Zone('child-123', 'Child Zone');
      
      await repository.save(parentZone);
      await repository.save(childZone);
      
      // Move child under parent
      childZone.parentZoneId = 'parent-123';
      parentZone.addChildZone('child-123');
      
      await repository.save(childZone);
      await repository.save(parentZone);
      
      const childZones = await repository.findChildZones('parent-123');
      expect(childZones).toHaveLength(1);
      expect(childZones[0].id).toBe('child-123');
      
      const rootZones = await repository.findRootZones();
      expect(rootZones.find(z => z.id === 'child-123')).toBeUndefined();
    });
  });

  describe('findById', () => {
    test('should find existing zone by ID', async () => {
      const zones = await repository.findAll();
      const existingZone = zones[0];
      
      const foundZone = await repository.findById(existingZone.id);
      
      expect(foundZone).toBe(existingZone);
    });

    test('should return null for non-existent ID', async () => {
      const foundZone = await repository.findById('non-existent-123');
      
      expect(foundZone).toBeNull();
    });

    test('should return null for empty ID', async () => {
      const foundZone = await repository.findById('');
      
      expect(foundZone).toBeNull();
    });

    test('should return null for null ID', async () => {
      const foundZone = await repository.findById(null);
      
      expect(foundZone).toBeNull();
    });
  });

  describe('findByName', () => {
    test('should find zone by exact name', async () => {
      const foundZone = await repository.findByName('Living Room');
      
      expect(foundZone).toBeDefined();
      expect(foundZone.name).toBe('Living Room');
    });

    test('should find zone by name case-insensitively', async () => {
      const foundZone = await repository.findByName('living room');
      
      expect(foundZone).toBeDefined();
      expect(foundZone.name).toBe('Living Room');
    });

    test('should find zone by name with different case', async () => {
      const foundZone = await repository.findByName('LIVING ROOM');
      
      expect(foundZone).toBeDefined();
      expect(foundZone.name).toBe('Living Room');
    });

    test('should return null for non-existent name', async () => {
      const foundZone = await repository.findByName('Non-existent Zone');
      
      expect(foundZone).toBeNull();
    });

    test('should return null for empty name', async () => {
      const foundZone = await repository.findByName('');
      
      expect(foundZone).toBeNull();
    });

    test('should return null for null name', async () => {
      const foundZone = await repository.findByName(null);
      
      expect(foundZone).toBeNull();
    });

    test('should return null for non-string name', async () => {
      const foundZone = await repository.findByName(123);
      
      expect(foundZone).toBeNull();
    });
  });

  describe('findAll', () => {
    test('should return all zones including defaults', async () => {
      const newZone = new Zone('new-123', 'New Zone');
      await repository.save(newZone);
      
      const allZones = await repository.findAll();
      
      expect(allZones.length).toBe(4); // 3 defaults + 1 new
      expect(allZones.find(z => z.id === 'new-123')).toBe(newZone);
    });

    test('should return empty array when no zones exist', async () => {
      // Create a fresh repository without default zones
      const emptyRepo = new InMemoryZoneRepository();
      emptyRepo.zones.clear();
      emptyRepo.nameIndex.clear();
      emptyRepo.rootZones.clear();
      emptyRepo.parentIndex.clear();
      
      const allZones = await emptyRepo.findAll();
      
      expect(allZones).toEqual([]);
    });
  });

  describe('findRootZones', () => {
    test('should return only root zones', async () => {
      const parentZone = new Zone('parent-123', 'Parent Zone');
      const childZone = new Zone('child-123', 'Child Zone', '', 'parent-123');
      
      await repository.save(parentZone);
      await repository.save(childZone);
      
      const rootZones = await repository.findRootZones();
      
      expect(rootZones.length).toBe(4); // 3 defaults + 1 new parent
      expect(rootZones.find(z => z.id === 'parent-123')).toBe(parentZone);
      expect(rootZones.find(z => z.id === 'child-123')).toBeUndefined();
    });
  });

  describe('findChildZones', () => {
    test('should return child zones for parent', async () => {
      const parentZone = new Zone('parent-123', 'Parent Zone');
      const child1 = new Zone('child-1', 'Child 1', '', 'parent-123');
      const child2 = new Zone('child-2', 'Child 2', '', 'parent-123');
      
      await repository.save(parentZone);
      await repository.save(child1);
      await repository.save(child2);
      
      parentZone.addChildZone('child-1');
      parentZone.addChildZone('child-2');
      await repository.save(parentZone);
      
      const childZones = await repository.findChildZones('parent-123');
      
      expect(childZones.length).toBe(2);
      expect(childZones.find(z => z.id === 'child-1')).toBe(child1);
      expect(childZones.find(z => z.id === 'child-2')).toBe(child2);
    });

    test('should return empty array for zone with no children', async () => {
      const zones = await repository.findAll();
      const leafZone = zones[0];
      
      const childZones = await repository.findChildZones(leafZone.id);
      
      expect(childZones).toEqual([]);
    });

    test('should return empty array for non-existent parent', async () => {
      const childZones = await repository.findChildZones('non-existent-123');
      
      expect(childZones).toEqual([]);
    });

    test('should return empty array for null parent ID', async () => {
      const childZones = await repository.findChildZones(null);
      
      expect(childZones).toEqual([]);
    });
  });

  describe('findArmedZones', () => {
    test('should return only armed zones', async () => {
      const zones = await repository.findAll();
      const zone1 = zones[0];
      const zone2 = zones[1];
      
      zone1.arm('away', 'user-123');
      zone2.arm('stay', 'user-456');
      // zones[2] remains disarmed
      
      await repository.save(zone1);
      await repository.save(zone2);
      
      const armedZones = await repository.findArmedZones();
      
      expect(armedZones.length).toBe(2);
      expect(armedZones.find(z => z.id === zone1.id)).toBe(zone1);
      expect(armedZones.find(z => z.id === zone2.id)).toBe(zone2);
    });

    test('should return empty array when no zones are armed', async () => {
      const armedZones = await repository.findArmedZones();
      
      expect(armedZones).toEqual([]);
    });
  });

  describe('findDisarmedZones', () => {
    test('should return only disarmed zones', async () => {
      const zones = await repository.findAll();
      const zone1 = zones[0];
      
      zone1.arm('away', 'user-123');
      await repository.save(zone1);
      
      const disarmedZones = await repository.findDisarmedZones();
      
      expect(disarmedZones.length).toBe(2); // 2 of 3 zones remain disarmed
      expect(disarmedZones.find(z => z.id === zone1.id)).toBeUndefined();
    });

    test('should return all zones when none are armed', async () => {
      const disarmedZones = await repository.findDisarmedZones();
      
      expect(disarmedZones.length).toBe(3); // All default zones are disarmed
    });
  });

  describe('findZonesByMode', () => {
    test('should find zones by mode', async () => {
      const zones = await repository.findAll();
      const zone1 = zones[0];
      const zone2 = zones[1];
      
      zone1.arm('away', 'user-123');
      zone2.arm('away', 'user-456');
      zones[2].arm('stay', 'user-789');
      
      await repository.save(zone1);
      await repository.save(zone2);
      await repository.save(zones[2]);
      
      const awayZones = await repository.findZonesByMode('away');
      const stayZones = await repository.findZonesByMode('stay');
      
      expect(awayZones.length).toBe(2);
      expect(stayZones.length).toBe(1);
      expect(stayZones[0]).toBe(zones[2]);
    });

    test('should return empty array for mode with no zones', async () => {
      const homeZones = await repository.findZonesByMode('home');
      
      expect(homeZones).toEqual([]);
    });

    test('should return empty array for null mode', async () => {
      const nullModeZones = await repository.findZonesByMode(null);
      
      expect(nullModeZones).toEqual([]);
    });
  });

  describe('delete', () => {
    test('should delete zone successfully', async () => {
      const zone = new Zone('delete-me-123', 'Delete Me');
      await repository.save(zone);
      
      const deleted = await repository.delete('delete-me-123');
      
      expect(deleted).toBe(true);
      
      const retrievedZone = await repository.findById('delete-me-123');
      expect(retrievedZone).toBeNull();
      
      const allZones = await repository.findAll();
      expect(allZones.find(z => z.id === 'delete-me-123')).toBeUndefined();
    });

    test('should remove zone from name index when deleted', async () => {
      const zone = new Zone('delete-me-123', 'Delete Me');
      await repository.save(zone);
      
      await repository.delete('delete-me-123');
      
      const foundByName = await repository.findByName('Delete Me');
      expect(foundByName).toBeNull();
    });

    test('should remove zone from parent index when deleted', async () => {
      const parentZone = new Zone('parent-123', 'Parent');
      const childZone = new Zone('child-123', 'Child', '', 'parent-123');
      
      await repository.save(parentZone);
      await repository.save(childZone);
      
      parentZone.addChildZone('child-123');
      await repository.save(parentZone);
      
      await repository.delete('child-123');
      
      const children = await repository.findChildZones('parent-123');
      expect(children).toEqual([]);
    });

    test('should throw error when deleting zone with children', async () => {
      const parentZone = new Zone('parent-123', 'Parent');
      const childZone = new Zone('child-123', 'Child', '', 'parent-123');
      
      await repository.save(parentZone);
      await repository.save(childZone);
      
      parentZone.addChildZone('child-123');
      await repository.save(parentZone);
      
      await expect(repository.delete('parent-123')).rejects.toThrow('Cannot delete zone with child zones');
    });

    test('should return false for non-existent zone', async () => {
      const deleted = await repository.delete('non-existent-123');
      
      expect(deleted).toBe(false);
    });

    test('should return false for empty ID', async () => {
      const deleted = await repository.delete('');
      
      expect(deleted).toBe(false);
    });

    test('should return false for null ID', async () => {
      const deleted = await repository.delete(null);
      
      expect(deleted).toBe(false);
    });
  });

  describe('exists', () => {
    test('should return true for existing zone', async () => {
      const zones = await repository.findAll();
      const existingZone = zones[0];
      
      const exists = await repository.exists(existingZone.id);
      
      expect(exists).toBe(true);
    });

    test('should return false for non-existent zone', async () => {
      const exists = await repository.exists('non-existent-123');
      
      expect(exists).toBe(false);
    });

    test('should return false for empty ID', async () => {
      const exists = await repository.exists('');
      
      expect(exists).toBe(false);
    });

    test('should return false for null ID', async () => {
      const exists = await repository.exists(null);
      
      expect(exists).toBe(false);
    });
  });

  describe('nameExists', () => {
    test('should return true for existing name', async () => {
      const exists = await repository.nameExists('Living Room');
      
      expect(exists).toBe(true);
    });

    test('should return true for existing name case-insensitive', async () => {
      const exists = await repository.nameExists('living room');
      
      expect(exists).toBe(true);
    });

    test('should return false for non-existent name', async () => {
      const exists = await repository.nameExists('Non-existent Zone');
      
      expect(exists).toBe(false);
    });

    test('should exclude specific zone ID when checking', async () => {
      const zones = await repository.findAll();
      const livingRoom = zones.find(z => z.name === 'Living Room');
      
      const exists = await repository.nameExists('Living Room', livingRoom.id);
      
      expect(exists).toBe(false); // Should return false because we're excluding the zone itself
    });

    test('should return false for empty name', async () => {
      const exists = await repository.nameExists('');
      
      expect(exists).toBe(false);
    });

    test('should return false for null name', async () => {
      const exists = await repository.nameExists(null);
      
      expect(exists).toBe(false);
    });

    test('should return false for non-string name', async () => {
      const exists = await repository.nameExists(123);
      
      expect(exists).toBe(false);
    });
  });

  describe('hasChildZones', () => {
    test('should return true for zone with children', async () => {
      const parentZone = new Zone('parent-123', 'Parent');
      const childZone = new Zone('child-123', 'Child', '', 'parent-123');
      
      await repository.save(parentZone);
      await repository.save(childZone);
      
      parentZone.addChildZone('child-123');
      await repository.save(parentZone);
      
      const hasChildren = await repository.hasChildZones('parent-123');
      
      expect(hasChildren).toBe(true);
    });

    test('should return false for zone without children', async () => {
      const zones = await repository.findAll();
      const leafZone = zones[0];
      
      const hasChildren = await repository.hasChildZones(leafZone.id);
      
      expect(hasChildren).toBe(false);
    });

    test('should return false for non-existent zone', async () => {
      const hasChildren = await repository.hasChildZones('non-existent-123');
      
      expect(hasChildren).toBe(false);
    });

    test('should return false for null zone ID', async () => {
      const hasChildren = await repository.hasChildZones(null);
      
      expect(hasChildren).toBe(false);
    });
  });

  describe('validateZoneHierarchy', () => {
    test('should validate valid parent-child relationship', async () => {
      const parentZone = new Zone('parent-123', 'Parent');
      const childZone = new Zone('child-123', 'Child');
      
      await repository.save(parentZone);
      await repository.save(childZone);
      
      const isValid = await repository.validateZoneHierarchy('parent-123', 'child-123');
      
      expect(isValid).toBe(true);
    });

    test('should throw error for self-parenting', async () => {
      const zone = new Zone('zone-123', 'Zone');
      await repository.save(zone);
      
      await expect(repository.validateZoneHierarchy('zone-123', 'zone-123'))
        .rejects.toThrow('Zone cannot be its own parent');
    });

    test('should throw error for non-existent parent', async () => {
      const childZone = new Zone('child-123', 'Child');
      await repository.save(childZone);
      
      await expect(repository.validateZoneHierarchy('non-existent', 'child-123'))
        .rejects.toThrow("Parent zone with ID 'non-existent' not found");
    });

    test('should throw error for non-existent child', async () => {
      const parentZone = new Zone('parent-123', 'Parent');
      await repository.save(parentZone);
      
      await expect(repository.validateZoneHierarchy('parent-123', 'non-existent'))
        .rejects.toThrow("Child zone with ID 'non-existent' not found");
    });

    test('should detect circular dependency', async () => {
      const zone1 = new Zone('zone-1', 'Zone 1');
      const zone2 = new Zone('zone-2', 'Zone 2', '', 'zone-1');
      const zone3 = new Zone('zone-3', 'Zone 3', '', 'zone-2');
      
      await repository.save(zone1);
      await repository.save(zone2);
      await repository.save(zone3);
      
      zone1.addChildZone('zone-2');
      zone2.addChildZone('zone-3');
      await repository.save(zone1);
      await repository.save(zone2);
      
      // Try to make zone-1 a child of zone-3 (would create circular dependency)
      await expect(repository.validateZoneHierarchy('zone-3', 'zone-1'))
        .rejects.toThrow('Adding this relationship would create a circular dependency');
    });

    test('should throw error for missing parameters', async () => {
      await expect(repository.validateZoneHierarchy(null, 'child-123'))
        .rejects.toThrow('Both parent and child zone IDs are required');
      
      await expect(repository.validateZoneHierarchy('parent-123', null))
        .rejects.toThrow('Both parent and child zone IDs are required');
    });
  });

  describe('utility methods', () => {
    test('countZones should return correct count', async () => {
      const count = await repository.countZones();
      
      expect(count).toBe(3); // Default zones
      
      const newZone = new Zone('new-123', 'New Zone');
      await repository.save(newZone);
      
      const newCount = await repository.countZones();
      expect(newCount).toBe(4);
    });

    test('findZonesModifiedAfter should filter by timestamp', async () => {
      const beforeTime = new Date();
      
      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const zone = new Zone('modified-123', 'Modified Zone');
      zone.arm('away', 'user-123');
      await repository.save(zone);
      
      const modifiedZones = await repository.findZonesModifiedAfter(beforeTime);
      
      expect(modifiedZones.length).toBe(1);
      expect(modifiedZones[0]).toBe(zone);
    });

    test('findZonesModifiedAfter should return empty for future timestamp', async () => {
      const futureTime = new Date(Date.now() + 10000);
      
      const modifiedZones = await repository.findZonesModifiedAfter(futureTime);
      
      expect(modifiedZones).toEqual([]);
    });

    test('findZonesModifiedAfter should handle invalid timestamp', async () => {
      const modifiedZones = await repository.findZonesModifiedAfter('invalid');
      
      expect(modifiedZones).toEqual([]);
    });

    test('findZonesModifiedBy should filter by user ID', async () => {
      const zone1 = new Zone('zone-1', 'Zone 1');
      const zone2 = new Zone('zone-2', 'Zone 2');
      
      zone1.arm('away', 'user-123');
      zone2.arm('stay', 'user-456');
      
      await repository.save(zone1);
      await repository.save(zone2);
      
      const zonesModifiedByUser123 = await repository.findZonesModifiedBy('user-123');
      
      expect(zonesModifiedByUser123.length).toBe(1);
      expect(zonesModifiedByUser123[0]).toBe(zone1);
    });

    test('findZonesModifiedBy should return empty for non-existent user', async () => {
      const modifiedZones = await repository.findZonesModifiedBy('non-existent-user');
      
      expect(modifiedZones).toEqual([]);
    });

    test('findZonesModifiedBy should handle null user ID', async () => {
      const modifiedZones = await repository.findZonesModifiedBy(null);
      
      expect(modifiedZones).toEqual([]);
    });
  });

  describe('hierarchy operations', () => {
    test('getZoneHierarchy should build complete hierarchy', async () => {
      const root = new Zone('root-123', 'Root');
      const child1 = new Zone('child-1', 'Child 1', '', 'root-123');
      const child2 = new Zone('child-2', 'Child 2', '', 'root-123');
      const grandchild = new Zone('grandchild-1', 'Grandchild', '', 'child-1');
      
      await repository.save(root);
      await repository.save(child1);
      await repository.save(child2);
      await repository.save(grandchild);
      
      root.addChildZone('child-1');
      root.addChildZone('child-2');
      child1.addChildZone('grandchild-1');
      
      await repository.save(root);
      await repository.save(child1);
      
      const hierarchy = await repository.getZoneHierarchy('root-123');
      
      expect(hierarchy.zone).toBe(root);
      expect(hierarchy.children.length).toBe(2);
      
      const child1Hierarchy = hierarchy.children.find(c => c.zone.id === 'child-1');
      expect(child1Hierarchy.children.length).toBe(1);
      expect(child1Hierarchy.children[0].zone).toBe(grandchild);
      
      const child2Hierarchy = hierarchy.children.find(c => c.zone.id === 'child-2');
      expect(child2Hierarchy.children.length).toBe(0);
    });

    test('getZoneHierarchy should throw error for non-existent root', async () => {
      await expect(repository.getZoneHierarchy('non-existent'))
        .rejects.toThrow("Zone with ID 'non-existent' not found");
    });

    test('getZoneHierarchy should throw error for null root ID', async () => {
      await expect(repository.getZoneHierarchy(null))
        .rejects.toThrow('Root zone ID is required');
    });
  });

  describe('performance and edge cases', () => {
    test('should handle large numbers of zones efficiently', async () => {
      const startTime = Date.now();
      
      // Add 1000 zones
      for (let i = 0; i < 1000; i++) {
        const zone = new Zone(`perf-zone-${i}`, `Performance Zone ${i}`);
        await repository.save(zone);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
      
      const allZones = await repository.findAll();
      expect(allZones.length).toBe(1003); // 1000 + 3 defaults
    });

    test('should handle concurrent operations safely', async () => {
      const zone1 = new Zone('concurrent-1', 'Concurrent Zone 1');
      const zone2 = new Zone('concurrent-2', 'Concurrent Zone 2');
      
      // Simulate concurrent saves
      const promises = [
        repository.save(zone1),
        repository.save(zone2)
      ];
      
      await Promise.all(promises);
      
      const foundZone1 = await repository.findById('concurrent-1');
      const foundZone2 = await repository.findById('concurrent-2');
      
      expect(foundZone1).toBe(zone1);
      expect(foundZone2).toBe(zone2);
    });

    test('should maintain data consistency during complex operations', async () => {
      const parent = new Zone('parent-123', 'Parent');
      const child = new Zone('child-123', 'Child');
      
      await repository.save(parent);
      await repository.save(child);
      
      // Move child under parent
      child.parentZoneId = 'parent-123';
      parent.addChildZone('child-123');
      
      await repository.save(child);
      await repository.save(parent);
      
      // Verify all indexes are consistent
      const childZones = await repository.findChildZones('parent-123');
      expect(childZones).toHaveLength(1);
      
      const rootZones = await repository.findRootZones();
      expect(rootZones.find(z => z.id === 'child-123')).toBeUndefined();
      
      const hasChildren = await repository.hasChildZones('parent-123');
      expect(hasChildren).toBe(true);
    });
  });
});