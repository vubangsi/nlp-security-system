const ListZonesUseCase = require('../../../../src/application/useCases/ListZonesUseCase');
const Zone = require('../../../../src/domain/entities/Zone');

describe('ListZonesUseCase', () => {
  let useCase;
  let mockZoneRepository;

  beforeEach(() => {
    mockZoneRepository = {
      findAll: jest.fn(),
      findByParentId: jest.fn(),
      findById: jest.fn()
    };

    useCase = new ListZonesUseCase(mockZoneRepository);
  });

  describe('execute', () => {
    test('should list all zones successfully', async () => {
      const zones = [
        new Zone('zone-1', 'Living Room', 'Main area'),
        new Zone('zone-2', 'Kitchen', 'Cooking area'),
        new Zone('zone-3', 'Bedroom', 'Sleeping area')
      ];

      mockZoneRepository.findAll.mockResolvedValue(zones);

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(3);
      expect(result.count).toBe(3);
      expect(result.rootZones).toBe(3);

      expect(mockZoneRepository.findAll).toHaveBeenCalled();
      expect(mockZoneRepository.findByParentId).not.toHaveBeenCalled();
    });

    test('should list zones by parent zone ID', async () => {
      const parentZoneId = 'parent-123';
      const parentZone = new Zone(parentZoneId, 'Parent Zone');
      const childZones = [
        new Zone('child-1', 'Child Room 1', 'First child room', parentZoneId),
        new Zone('child-2', 'Child Room 2', 'Second child room', parentZoneId)
      ];

      mockZoneRepository.findById.mockResolvedValue(parentZone);
      mockZoneRepository.findByParentId.mockResolvedValue(childZones);

      const result = await useCase.executeByParent(parentZoneId);

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(2);
      expect(result.zones[0].parentZoneId).toBe(parentZoneId);
      expect(result.zones[1].parentZoneId).toBe(parentZoneId);
      expect(result.count).toBe(2);

      expect(mockZoneRepository.findByParentId).toHaveBeenCalledWith(parentZoneId);
      expect(mockZoneRepository.findById).toHaveBeenCalledWith(parentZoneId);
    });

    test('should return empty list when no zones exist', async () => {
      mockZoneRepository.findAll.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    test('should return empty list when no child zones exist for parent', async () => {
      const parentZoneId = 'empty-parent';
      const parentZone = new Zone(parentZoneId, 'Empty Parent');
      mockZoneRepository.findById.mockResolvedValue(parentZone);
      mockZoneRepository.findByParentId.mockResolvedValue([]);

      const result = await useCase.executeByParent(parentZoneId);

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    test('should handle repository errors for findAll', async () => {
      mockZoneRepository.findAll.mockRejectedValue(new Error('Database connection failed'));

      const result = await useCase.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    test('should handle repository errors for findByParentId', async () => {
      const parentZone = new Zone('parent-123', 'Parent Zone');
      mockZoneRepository.findById.mockResolvedValue(parentZone);
      mockZoneRepository.findByParentId.mockRejectedValue(new Error('Query execution failed'));

      const result = await useCase.executeByParent('parent-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query execution failed');
    });

    test('should include zone hierarchy information in results', async () => {
      const parentZone = new Zone('parent-123', 'Parent Zone');
      const childZone = new Zone('child-123', 'Child Zone', 'Description', 'parent-123');
      const rootZone = new Zone('root-123', 'Root Zone');

      parentZone.addChildZone('child-123');
      childZone.arm('away', 'user-123');

      const zones = [parentZone, childZone, rootZone];
      mockZoneRepository.findAll.mockResolvedValue(zones);

      const result = await useCase.execute(true); // includeHierarchy = true

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(2); // Only root zones returned in hierarchy

      // Find parent zone in results
      const parentZoneResult = result.zones.find(z => z.id === 'parent-123');
      expect(parentZoneResult).toBeDefined();
      expect(parentZoneResult.children).toHaveLength(1);
      expect(parentZoneResult.children[0].id).toBe('child-123');

      // Verify root zone
      const rootZoneResult = result.zones.find(z => z.id === 'root-123');
      expect(rootZoneResult).toBeDefined();
      expect(rootZoneResult.children).toEqual([]);
    });

    test('should handle mixed armed and disarmed zones', async () => {
      const zone1 = new Zone('zone-1', 'Armed Zone');
      const zone2 = new Zone('zone-2', 'Disarmed Zone');
      
      zone1.arm('stay', 'user-123');
      // zone2 remains disarmed

      mockZoneRepository.findAll.mockResolvedValue([zone1, zone2]);

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(2);

      const armedZone = result.zones.find(z => z.id === 'zone-1');
      const disarmedZone = result.zones.find(z => z.id === 'zone-2');

      expect(armedZone.armed).toBe(true);
      expect(armedZone.mode).toBe('stay');
      expect(disarmedZone.armed).toBe(false);
      expect(disarmedZone.mode).toBeNull();
    });

    test('should filter by root zones only when parentZoneId is null', async () => {
      const rootZones = [
        new Zone('root-1', 'Root Zone 1'),
        new Zone('root-2', 'Root Zone 2')
      ];

      mockZoneRepository.findByParentZoneId.mockResolvedValue(rootZones);

      const result = await useCase.execute(null);

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(2);
      expect(mockZoneRepository.findByParentZoneId).toHaveBeenCalledWith(null);
    });

    test('should handle whitespace and empty string parent zone ID', async () => {
      // Empty string should be treated as listing all zones
      mockZoneRepository.findAll.mockResolvedValue([]);

      const result1 = await useCase.execute('');
      expect(result1.success).toBe(true);
      expect(mockZoneRepository.findAll).toHaveBeenCalled();

      // Whitespace string should be treated as parent zone ID
      mockZoneRepository.findByParentZoneId.mockResolvedValue([]);
      const result2 = await useCase.execute('  valid-id  ');
      expect(result2.success).toBe(true);
      expect(mockZoneRepository.findByParentZoneId).toHaveBeenCalledWith('  valid-id  ');
    });

    test('should preserve zone metadata and timestamps', async () => {
      const zone = new Zone('zone-123', 'Test Zone', 'Description');
      zone.arm('away', 'user-123');
      zone.updateDescription('Updated description', 'user-456');

      mockZoneRepository.findAll.mockResolvedValue([zone]);

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(1);
      
      const resultZone = result.zones[0];
      expect(resultZone.description).toBe('Updated description');
      expect(resultZone.modifiedBy).toBe('user-456');
      expect(resultZone.createdAt).toBeDefined();
      expect(resultZone.lastModified).toBeDefined();
    });

    test('should handle large numbers of zones efficiently', async () => {
      const zones = [];
      for (let i = 0; i < 1000; i++) {
        zones.push(new Zone(`zone-${i}`, `Zone ${i}`, `Description ${i}`));
      }

      mockZoneRepository.findAll.mockResolvedValue(zones);

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(1000);
      expect(result.message).toBe('1000 zones found');
    });

    test('should handle zones with special characters in names', async () => {
      const zones = [
        new Zone('zone-1', 'Zone-With-Hyphens'),
        new Zone('zone-2', 'Zone_With_Underscores'),
        new Zone('zone-3', 'Zone With Spaces'),
        new Zone('zone-4', 'ZoneWithNumbers123')
      ];

      mockZoneRepository.findAll.mockResolvedValue(zones);

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(4);
      
      const names = result.zones.map(z => z.name);
      expect(names).toContain('Zone-With-Hyphens');
      expect(names).toContain('Zone_With_Underscores');
      expect(names).toContain('Zone With Spaces');
      expect(names).toContain('ZoneWithNumbers123');
    });
  });

  describe('data sanitization and security', () => {
    test('should not expose sensitive internal data', async () => {
      const zone = new Zone('zone-123', 'Test Zone');
      zone.arm('away', 'user-123');
      
      // Add some hypothetical internal properties that shouldn't be exposed
      zone._internalId = 'internal-data';
      zone.__proto__.secretMethod = () => 'secret';

      mockZoneRepository.findAll.mockResolvedValue([zone]);

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(1);
      
      const resultZone = result.zones[0];
      expect(resultZone._internalId).toBeUndefined();
      expect(resultZone.secretMethod).toBeUndefined();
      
      // Should only contain expected properties
      const expectedProperties = [
        'id', 'name', 'description', 'parentZoneId', 'armed', 'mode',
        'childZones', 'createdAt', 'lastModified', 'modifiedBy'
      ];
      
      Object.keys(resultZone).forEach(key => {
        expect(expectedProperties).toContain(key);
      });
    });

    test('should handle null values in zone properties safely', async () => {
      const zone = new Zone('zone-123', 'Test Zone');
      // Some properties might be null or undefined
      zone.description = null;
      zone.modifiedBy = null;

      mockZoneRepository.findAll.mockResolvedValue([zone]);

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(1);
      expect(result.zones[0].description).toBeNull();
      expect(result.zones[0].modifiedBy).toBeNull();
    });
  });

  describe('performance and edge cases', () => {
    test('should handle concurrent modifications during listing', async () => {
      const zones = [new Zone('zone-1', 'Zone 1')];
      
      mockZoneRepository.findAll.mockImplementation(async () => {
        // Simulate zone being modified during the query
        zones[0].arm('away', 'user-123');
        return zones;
      });

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      expect(result.zones).toHaveLength(1);
      expect(result.zones[0].armed).toBe(true);
    });

    test('should handle repository returning null instead of array', async () => {
      mockZoneRepository.findAll.mockResolvedValue(null);

      const result = await useCase.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle repository returning non-array value', async () => {
      mockZoneRepository.findAll.mockResolvedValue('invalid-response');

      const result = await useCase.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});