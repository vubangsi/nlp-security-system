const GetZoneUseCase = require('../../../../src/application/useCases/GetZoneUseCase');
const Zone = require('../../../../src/domain/entities/Zone');

describe('GetZoneUseCase', () => {
  let useCase;
  let mockZoneRepository;

  beforeEach(() => {
    mockZoneRepository = {
      findById: jest.fn(),
      findByName: jest.fn()
    };

    useCase = new GetZoneUseCase(mockZoneRepository);
  });

  describe('execute by ID', () => {
    const zoneId = 'zone-123';

    test('should get zone by ID successfully', async () => {
      const zone = new Zone(zoneId, 'Living Room', 'Main living area');
      zone.arm('away', 'user-123');
      
      mockZoneRepository.findById.mockResolvedValue(zone);

      const result = await useCase.execute({ zoneId });

      expect(result.success).toBe(true);
      expect(result.zone).toEqual(zone.toJSON());
      expect(result.zone.id).toBe(zoneId);
      expect(result.zone.name).toBe('Living Room');
      expect(result.zone.armed).toBe(true);
      expect(result.zone.mode).toBe('away');
      expect(result.message).toBe(`Zone '${zone.name}' found`);

      expect(mockZoneRepository.findById).toHaveBeenCalledWith(zoneId);
      expect(mockZoneRepository.findByName).not.toHaveBeenCalled();
    });

    test('should fail when zone ID is not found', async () => {
      mockZoneRepository.findById.mockResolvedValue(null);

      const result = await useCase.execute({ zoneId });

      expect(result.success).toBe(false);
      expect(result.error).toBe(`Zone with ID '${zoneId}' not found`);
      expect(result.zone).toBeUndefined();
    });

    test('should fail when zone ID is missing', async () => {
      const result = await useCase.execute({ zoneId: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID or name is required');
      expect(mockZoneRepository.findById).not.toHaveBeenCalled();
    });

    test('should fail when zone ID is null', async () => {
      const result = await useCase.execute({ zoneId: null });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID or name is required');
    });

    test('should handle repository errors for findById', async () => {
      mockZoneRepository.findById.mockRejectedValue(new Error('Database connection failed'));

      const result = await useCase.execute({ zoneId });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('execute by name', () => {
    const zoneName = 'Living Room';

    test('should get zone by name successfully', async () => {
      const zone = new Zone('zone-123', zoneName, 'Main living area');
      zone.disarm('user-456');
      
      mockZoneRepository.findByName.mockResolvedValue(zone);

      const result = await useCase.execute({ zoneName });

      expect(result.success).toBe(true);
      expect(result.zone).toEqual(zone.toJSON());
      expect(result.zone.name).toBe(zoneName);
      expect(result.zone.armed).toBe(false);
      expect(result.zone.mode).toBeNull();
      expect(result.message).toBe(`Zone '${zoneName}' found`);

      expect(mockZoneRepository.findByName).toHaveBeenCalledWith(zoneName);
      expect(mockZoneRepository.findById).not.toHaveBeenCalled();
    });

    test('should fail when zone name is not found', async () => {
      mockZoneRepository.findByName.mockResolvedValue(null);

      const result = await useCase.execute({ zoneName });

      expect(result.success).toBe(false);
      expect(result.error).toBe(`Zone with name '${zoneName}' not found`);
      expect(result.zone).toBeUndefined();
    });

    test('should fail when zone name is missing', async () => {
      const result = await useCase.execute({ zoneName: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID or name is required');
      expect(mockZoneRepository.findByName).not.toHaveBeenCalled();
    });

    test('should fail when zone name is null', async () => {
      const result = await useCase.execute({ zoneName: null });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID or name is required');
    });

    test('should handle repository errors for findByName', async () => {
      mockZoneRepository.findByName.mockRejectedValue(new Error('Query execution failed'));

      const result = await useCase.execute({ zoneName });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query execution failed');
    });

    test('should handle case sensitivity in zone names', async () => {
      const zone = new Zone('zone-123', 'Living Room', 'Main area');
      mockZoneRepository.findByName.mockResolvedValue(zone);

      const result = await useCase.execute({ zoneName: 'living room' });

      expect(result.success).toBe(false);
      expect(mockZoneRepository.findByName).toHaveBeenCalledWith('living room');
    });
  });

  describe('priority handling', () => {
    test('should prioritize zone ID over zone name when both provided', async () => {
      const zoneById = new Zone('zone-123', 'Zone by ID', 'Found by ID');
      const zoneByName = new Zone('zone-456', 'Zone by Name', 'Found by name');
      
      mockZoneRepository.findById.mockResolvedValue(zoneById);
      mockZoneRepository.findByName.mockResolvedValue(zoneByName);

      const result = await useCase.execute({ 
        zoneId: 'zone-123', 
        zoneName: 'Zone by Name' 
      });

      expect(result.success).toBe(true);
      expect(result.zone.id).toBe('zone-123');
      expect(result.zone.name).toBe('Zone by ID');
      
      expect(mockZoneRepository.findById).toHaveBeenCalledWith('zone-123');
      expect(mockZoneRepository.findByName).not.toHaveBeenCalled();
    });

    test('should fallback to name when ID is empty but name is provided', async () => {
      const zone = new Zone('zone-456', 'Named Zone', 'Found by name');
      mockZoneRepository.findByName.mockResolvedValue(zone);

      const result = await useCase.execute({ 
        zoneId: '', 
        zoneName: 'Named Zone' 
      });

      expect(result.success).toBe(true);
      expect(result.zone.name).toBe('Named Zone');
      
      expect(mockZoneRepository.findById).not.toHaveBeenCalled();
      expect(mockZoneRepository.findByName).toHaveBeenCalledWith('Named Zone');
    });
  });

  describe('zone hierarchy information', () => {
    test('should include parent and child zone information', async () => {
      const parentZone = new Zone('parent-123', 'Parent Zone');
      const childZone1 = new Zone('child-1', 'Child 1', 'First child', 'parent-123');
      const childZone2 = new Zone('child-2', 'Child 2', 'Second child', 'parent-123');
      
      parentZone.addChildZone('child-1');
      parentZone.addChildZone('child-2');
      
      mockZoneRepository.findById.mockResolvedValue(parentZone);

      const result = await useCase.execute({ zoneId: 'parent-123' });

      expect(result.success).toBe(true);
      expect(result.zone.childZones).toEqual(['child-1', 'child-2']);
      expect(result.zone.parentZoneId).toBeNull();
    });

    test('should show child zone with parent reference', async () => {
      const childZone = new Zone('child-123', 'Child Zone', 'A child zone', 'parent-456');
      
      mockZoneRepository.findById.mockResolvedValue(childZone);

      const result = await useCase.execute({ zoneId: 'child-123' });

      expect(result.success).toBe(true);
      expect(result.zone.parentZoneId).toBe('parent-456');
      expect(result.zone.childZones).toEqual([]);
    });

    test('should handle root zone with no parent', async () => {
      const rootZone = new Zone('root-123', 'Root Zone');
      
      mockZoneRepository.findById.mockResolvedValue(rootZone);

      const result = await useCase.execute({ zoneId: 'root-123' });

      expect(result.success).toBe(true);
      expect(result.zone.parentZoneId).toBeNull();
      expect(result.zone.childZones).toEqual([]);
    });
  });

  describe('zone state information', () => {
    test('should include complete zone state for armed zone', async () => {
      const zone = new Zone('zone-123', 'Test Zone', 'Test description');
      zone.arm('stay', 'user-123');
      zone.updateDescription('Updated description', 'user-456');
      
      mockZoneRepository.findById.mockResolvedValue(zone);

      const result = await useCase.execute({ zoneId: 'zone-123' });

      expect(result.success).toBe(true);
      expect(result.zone.armed).toBe(true);
      expect(result.zone.mode).toBe('stay');
      expect(result.zone.description).toBe('Updated description');
      expect(result.zone.modifiedBy).toBe('user-456');
      expect(result.zone.createdAt).toBeDefined();
      expect(result.zone.lastModified).toBeDefined();
    });

    test('should include complete zone state for disarmed zone', async () => {
      const zone = new Zone('zone-123', 'Test Zone', 'Test description');
      zone.arm('away', 'user-123');
      zone.disarm('user-456');
      
      mockZoneRepository.findById.mockResolvedValue(zone);

      const result = await useCase.execute({ zoneId: 'zone-123' });

      expect(result.success).toBe(true);
      expect(result.zone.armed).toBe(false);
      expect(result.zone.mode).toBeNull();
      expect(result.zone.modifiedBy).toBe('user-456');
    });
  });

  describe('input validation and edge cases', () => {
    test('should fail when no parameters provided', async () => {
      const result = await useCase.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID or name is required');
    });

    test('should fail when empty object provided', async () => {
      const result = await useCase.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle whitespace in zone ID', async () => {
      const result = await useCase.execute({ zoneId: '  ' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID or name is required');
    });

    test('should handle whitespace in zone name', async () => {
      const result = await useCase.execute({ zoneName: '  ' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Zone ID or name is required');
    });

    test('should handle valid whitespace-containing zone name', async () => {
      const zoneName = '  Living Room  ';
      const zone = new Zone('zone-123', zoneName.trim(), 'Main area');
      mockZoneRepository.findByName.mockResolvedValue(zone);

      const result = await useCase.execute({ zoneName });

      expect(result.success).toBe(true);
      expect(mockZoneRepository.findByName).toHaveBeenCalledWith(zoneName);
    });

    test('should handle special characters in zone names', async () => {
      const specialNames = [
        'Zone-With-Hyphens',
        'Zone_With_Underscores',
        'Zone With Spaces',
        'ZoneWithNumbers123'
      ];

      for (const name of specialNames) {
        const zone = new Zone('zone-123', name, 'Test zone');
        mockZoneRepository.findByName.mockResolvedValue(zone);

        const result = await useCase.execute({ zoneName: name });

        expect(result.success).toBe(true);
        expect(result.zone.name).toBe(name);
      }
    });

    test('should handle very long zone names', async () => {
      const longName = 'A'.repeat(50); // At the limit
      const zone = new Zone('zone-123', longName, 'Long name zone');
      mockZoneRepository.findByName.mockResolvedValue(zone);

      const result = await useCase.execute({ zoneName: longName });

      expect(result.success).toBe(true);
      expect(result.zone.name).toBe(longName);
    });
  });

  describe('data integrity and security', () => {
    test('should not expose internal properties', async () => {
      const zone = new Zone('zone-123', 'Test Zone');
      
      // Add some hypothetical internal properties
      zone._internalData = 'sensitive-data';
      zone.__proto__.secretMethod = () => 'secret';
      
      mockZoneRepository.findById.mockResolvedValue(zone);

      const result = await useCase.execute({ zoneId: 'zone-123' });

      expect(result.success).toBe(true);
      expect(result.zone._internalData).toBeUndefined();
      expect(result.zone.secretMethod).toBeUndefined();
    });

    test('should handle null values in zone properties', async () => {
      const zone = new Zone('zone-123', 'Test Zone');
      zone.description = null;
      zone.modifiedBy = null;
      
      mockZoneRepository.findById.mockResolvedValue(zone);

      const result = await useCase.execute({ zoneId: 'zone-123' });

      expect(result.success).toBe(true);
      expect(result.zone.description).toBeNull();
      expect(result.zone.modifiedBy).toBeNull();
    });

    test('should preserve immutability of original zone object', async () => {
      const zone = new Zone('zone-123', 'Test Zone');
      const originalName = zone.name;
      
      mockZoneRepository.findById.mockResolvedValue(zone);

      const result = await useCase.execute({ zoneId: 'zone-123' });

      // Modify the returned zone
      result.zone.name = 'Modified Name';

      // Original zone should be unchanged
      expect(zone.name).toBe(originalName);
    });
  });

  describe('performance considerations', () => {
    test('should fail fast on validation errors', async () => {
      const result = await useCase.execute({ zoneId: '', zoneName: '' });

      expect(result.success).toBe(false);
      expect(mockZoneRepository.findById).not.toHaveBeenCalled();
      expect(mockZoneRepository.findByName).not.toHaveBeenCalled();
    });

    test('should handle concurrent zone modifications gracefully', async () => {
      const zone = new Zone('zone-123', 'Test Zone');
      
      mockZoneRepository.findById.mockImplementation(async () => {
        // Simulate zone being modified during retrieval
        zone.arm('away', 'concurrent-user');
        return zone;
      });

      const result = await useCase.execute({ zoneId: 'zone-123' });

      expect(result.success).toBe(true);
      expect(result.zone.armed).toBe(true);
      expect(result.zone.modifiedBy).toBe('concurrent-user');
    });

    test('should handle repository returning malformed data', async () => {
      // Return an object that looks like a zone but isn't
      const malformedZone = { id: 'zone-123', name: 'Test' }; // Missing toJSON method
      mockZoneRepository.findById.mockResolvedValue(malformedZone);

      const result = await useCase.execute({ zoneId: 'zone-123' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});