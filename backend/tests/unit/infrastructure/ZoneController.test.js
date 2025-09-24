const ZoneController = require('../../../src/infrastructure/controllers/ZoneController');

describe('ZoneController', () => {
  let controller;
  let mockUseCases;
  let req, res, next;

  beforeEach(() => {
    // Mock all use cases
    mockUseCases = {
      createZoneUseCase: {
        execute: jest.fn()
      },
      getZoneUseCase: {
        execute: jest.fn()
      },
      updateZoneUseCase: {
        execute: jest.fn()
      },
      deleteZoneUseCase: {
        execute: jest.fn()
      },
      listZonesUseCase: {
        execute: jest.fn(),
        executeArmedZones: jest.fn(),
        executeByParent: jest.fn()
      },
      armZoneUseCase: {
        execute: jest.fn()
      },
      disarmZoneUseCase: {
        execute: jest.fn()
      },
      manageZoneHierarchyUseCase: {
        getZoneHierarchy: jest.fn(),
        moveZoneToParent: jest.fn(),
        validateHierarchy: jest.fn()
      }
    };

    controller = new ZoneController(
      mockUseCases.createZoneUseCase,
      mockUseCases.getZoneUseCase,
      mockUseCases.updateZoneUseCase,
      mockUseCases.deleteZoneUseCase,
      mockUseCases.listZonesUseCase,
      mockUseCases.armZoneUseCase,
      mockUseCases.disarmZoneUseCase,
      mockUseCases.manageZoneHierarchyUseCase
    );

    // Mock request, response, and next
    req = {
      user: { id: 'user-123' },
      params: {},
      body: {},
      query: {}
    };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('listZones', () => {
    test('should list all zones successfully', async () => {
      const mockZones = [
        { id: 'zone-1', name: 'Zone 1', armed: false },
        { id: 'zone-2', name: 'Zone 2', armed: true }
      ];
      
      mockUseCases.listZonesUseCase.execute.mockResolvedValue({
        success: true,
        zones: mockZones,
        count: 2
      });

      await controller.listZones(req, res, next);

      expect(mockUseCases.listZonesUseCase.execute).toHaveBeenCalledWith(true, 'user-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockZones,
        meta: {
          count: 2
        }
      });
    });

    test('should filter by armed status', async () => {
      req.query.armed = 'true';
      
      const armedZones = [{ id: 'zone-1', name: 'Armed Zone', armed: true }];
      mockUseCases.listZonesUseCase.executeArmedZones.mockResolvedValue({
        success: true,
        zones: armedZones,
        count: 1
      });

      await controller.listZones(req, res, next);

      expect(mockUseCases.listZonesUseCase.executeArmedZones).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: armedZones,
        meta: {
          count: 1,
          filteredByArmed: true
        }
      });
    });

    test('should filter by parent ID', async () => {
      req.query.parentId = 'parent-123';
      
      const childZones = [{ id: 'child-1', name: 'Child Zone', parentZoneId: 'parent-123' }];
      mockUseCases.listZonesUseCase.executeByParent.mockResolvedValue({
        success: true,
        zones: childZones,
        count: 1
      });

      await controller.listZones(req, res, next);

      expect(mockUseCases.listZonesUseCase.executeByParent).toHaveBeenCalledWith('parent-123', 'user-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: childZones,
        meta: {
          count: 1,
          parentZoneId: 'parent-123'
        }
      });
    });

    test('should handle root zones filter', async () => {
      req.query.parentId = 'root';
      
      mockUseCases.listZonesUseCase.executeByParent.mockResolvedValue({
        success: true,
        zones: [],
        count: 0
      });

      await controller.listZones(req, res, next);

      expect(mockUseCases.listZonesUseCase.executeByParent).toHaveBeenCalledWith(null, 'user-123');
    });

    test('should apply limit to results', async () => {
      req.query.limit = '1';
      
      const mockZones = [
        { id: 'zone-1', name: 'Zone 1' },
        { id: 'zone-2', name: 'Zone 2' }
      ];
      
      mockUseCases.listZonesUseCase.execute.mockResolvedValue({
        success: true,
        zones: mockZones,
        count: 2
      });

      await controller.listZones(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 'zone-1', name: 'Zone 1' }],
        meta: {
          count: 1,
          limited: true,
          originalCount: 2
        }
      });
    });

    test('should handle use case errors', async () => {
      mockUseCases.listZonesUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      await controller.listZones(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });

    test('should handle exceptions', async () => {
      mockUseCases.listZonesUseCase.execute.mockRejectedValue(new Error('Unexpected error'));

      await controller.listZones(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getZone', () => {
    test('should get zone successfully', async () => {
      req.params.id = 'zone-123';
      
      const mockZone = { id: 'zone-123', name: 'Test Zone' };
      mockUseCases.getZoneUseCase.execute.mockResolvedValue({
        success: true,
        zone: mockZone
      });

      await controller.getZone(req, res, next);

      expect(mockUseCases.getZoneUseCase.execute).toHaveBeenCalledWith('zone-123', 'user-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockZone
      });
    });

    test('should return 400 for missing zone ID', async () => {
      req.params.id = '';

      await controller.getZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone ID is required'
      });
    });

    test('should return 404 for zone not found', async () => {
      req.params.id = 'zone-123';
      
      mockUseCases.getZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Zone with ID zone-123 not found'
      });

      await controller.getZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone with ID zone-123 not found'
      });
    });

    test('should handle other use case errors', async () => {
      req.params.id = 'zone-123';
      
      mockUseCases.getZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Some other error'
      });

      await controller.getZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Some other error'
      });
    });
  });

  describe('createZone', () => {
    test('should create zone successfully', async () => {
      req.body = {
        name: 'New Zone',
        description: 'Test description',
        parentZoneId: 'parent-123'
      };

      const mockCreatedZone = { id: 'zone-456', name: 'New Zone' };
      mockUseCases.createZoneUseCase.execute.mockResolvedValue({
        success: true,
        message: 'Zone created successfully',
        zone: mockCreatedZone
      });

      await controller.createZone(req, res, next);

      expect(mockUseCases.createZoneUseCase.execute).toHaveBeenCalledWith(
        'New Zone',
        'Test description',
        'parent-123',
        'user-123'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Zone created successfully',
        data: mockCreatedZone
      });
    });

    test('should return 400 for missing name', async () => {
      req.body = { description: 'Test description' };

      await controller.createZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone name is required',
        errors: {
          name: 'Zone name is required'
        }
      });
    });

    test('should return 400 for empty name', async () => {
      req.body = { name: '' };

      await controller.createZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone name must be a non-empty string',
        errors: {
          name: 'Zone name must be a non-empty string'
        }
      });
    });

    test('should return 400 for name too long', async () => {
      req.body = { name: 'A'.repeat(101) };

      await controller.createZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone name must be 100 characters or less',
        errors: {
          name: 'Zone name must be 100 characters or less'
        }
      });
    });

    test('should return 400 for description too long', async () => {
      req.body = {
        name: 'Valid Name',
        description: 'A'.repeat(501)
      };

      await controller.createZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone description must be 500 characters or less',
        errors: {
          description: 'Zone description must be 500 characters or less'
        }
      });
    });

    test('should return 409 for duplicate zone name', async () => {
      req.body = { name: 'Existing Zone' };

      mockUseCases.createZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Zone with name Existing Zone already exists'
      });

      await controller.createZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone with name Existing Zone already exists'
      });
    });

    test('should return 400 for parent not found', async () => {
      req.body = { name: 'New Zone', parentZoneId: 'invalid-parent' };

      mockUseCases.createZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Parent zone with ID invalid-parent not found'
      });

      await controller.createZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Parent zone with ID invalid-parent not found'
      });
    });
  });

  describe('updateZone', () => {
    test('should update zone successfully', async () => {
      req.params.id = 'zone-123';
      req.body = { name: 'Updated Zone', description: 'Updated description' };

      const mockUpdatedZone = { id: 'zone-123', name: 'Updated Zone' };
      mockUseCases.updateZoneUseCase.execute.mockResolvedValue({
        success: true,
        message: 'Zone updated successfully',
        zone: mockUpdatedZone
      });

      await controller.updateZone(req, res, next);

      expect(mockUseCases.updateZoneUseCase.execute).toHaveBeenCalledWith(
        'zone-123',
        { name: 'Updated Zone', description: 'Updated description' },
        'user-123'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Zone updated successfully',
        data: mockUpdatedZone
      });
    });

    test('should return 400 for missing zone ID', async () => {
      req.params.id = '';
      req.body = { name: 'Updated Zone' };

      await controller.updateZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone ID is required'
      });
    });

    test('should return 400 for no update fields', async () => {
      req.params.id = 'zone-123';
      req.body = {};

      await controller.updateZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'At least one field (name or description) must be provided for update',
        errors: {
          general: 'At least one field must be provided for update'
        }
      });
    });

    test('should return 404 for zone not found', async () => {
      req.params.id = 'zone-123';
      req.body = { name: 'Updated Zone' };

      mockUseCases.updateZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Zone with ID zone-123 not found'
      });

      await controller.updateZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone with ID zone-123 not found'
      });
    });

    test('should return 409 for name conflict', async () => {
      req.params.id = 'zone-123';
      req.body = { name: 'Existing Name' };

      mockUseCases.updateZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Zone with name Existing Name already exists'
      });

      await controller.updateZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone with name Existing Name already exists'
      });
    });

    test('should validate name format', async () => {
      req.params.id = 'zone-123';
      req.body = { name: '' };

      await controller.updateZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone name must be a non-empty string',
        errors: {
          name: 'Zone name must be a non-empty string'
        }
      });
    });

    test('should validate description length', async () => {
      req.params.id = 'zone-123';
      req.body = { description: 'A'.repeat(501) };

      await controller.updateZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone description must be 500 characters or less',
        errors: {
          description: 'Zone description must be 500 characters or less'
        }
      });
    });
  });

  describe('deleteZone', () => {
    test('should delete zone successfully', async () => {
      req.params.id = 'zone-123';

      mockUseCases.deleteZoneUseCase.execute.mockResolvedValue({
        success: true,
        message: 'Zone deleted successfully'
      });

      await controller.deleteZone(req, res, next);

      expect(mockUseCases.deleteZoneUseCase.execute).toHaveBeenCalledWith('zone-123', 'user-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Zone deleted successfully'
      });
    });

    test('should return 400 for missing zone ID', async () => {
      req.params.id = '';

      await controller.deleteZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone ID is required'
      });
    });

    test('should return 404 for zone not found', async () => {
      req.params.id = 'zone-123';

      mockUseCases.deleteZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Zone with ID zone-123 not found'
      });

      await controller.deleteZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone with ID zone-123 not found'
      });
    });

    test('should return 409 for zone with children', async () => {
      req.params.id = 'zone-123';

      mockUseCases.deleteZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Zone has child zones and cannot be deleted'
      });

      await controller.deleteZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone has child zones and cannot be deleted'
      });
    });
  });

  describe('armZone', () => {
    test('should arm zone successfully', async () => {
      req.params.id = 'zone-123';

      const mockArmedZone = { id: 'zone-123', name: 'Test Zone', armed: true };
      mockUseCases.armZoneUseCase.execute.mockResolvedValue({
        success: true,
        message: 'Zone armed successfully',
        zone: mockArmedZone
      });

      await controller.armZone(req, res, next);

      expect(mockUseCases.armZoneUseCase.execute).toHaveBeenCalledWith('zone-123', 'user-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Zone armed successfully',
        data: mockArmedZone
      });
    });

    test('should return 400 for missing zone ID', async () => {
      req.params.id = '';

      await controller.armZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone ID is required'
      });
    });

    test('should return 404 for zone not found', async () => {
      req.params.id = 'zone-123';

      mockUseCases.armZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Zone with ID zone-123 not found'
      });

      await controller.armZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone with ID zone-123 not found'
      });
    });

    test('should return 409 for already armed zone', async () => {
      req.params.id = 'zone-123';

      mockUseCases.armZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Zone is already armed'
      });

      await controller.armZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone is already armed'
      });
    });
  });

  describe('disarmZone', () => {
    test('should disarm zone successfully', async () => {
      req.params.id = 'zone-123';

      const mockDisarmedZone = { id: 'zone-123', name: 'Test Zone', armed: false };
      mockUseCases.disarmZoneUseCase.execute.mockResolvedValue({
        success: true,
        message: 'Zone disarmed successfully',
        zone: mockDisarmedZone
      });

      await controller.disarmZone(req, res, next);

      expect(mockUseCases.disarmZoneUseCase.execute).toHaveBeenCalledWith('zone-123', 'user-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Zone disarmed successfully',
        data: mockDisarmedZone
      });
    });

    test('should return 409 for already disarmed zone', async () => {
      req.params.id = 'zone-123';

      mockUseCases.disarmZoneUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Zone is already disarmed'
      });

      await controller.disarmZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone is already disarmed'
      });
    });
  });

  describe('getZoneHierarchy', () => {
    test('should get zone hierarchy successfully', async () => {
      req.params.id = 'zone-123';

      const mockHierarchy = {
        zone: { id: 'zone-123', name: 'Parent Zone' },
        children: [{ id: 'child-1', name: 'Child Zone' }]
      };

      mockUseCases.manageZoneHierarchyUseCase.getZoneHierarchy.mockResolvedValue({
        success: true,
        hierarchy: mockHierarchy
      });

      await controller.getZoneHierarchy(req, res, next);

      expect(mockUseCases.manageZoneHierarchyUseCase.getZoneHierarchy).toHaveBeenCalledWith(
        'zone-123',
        true,
        true
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockHierarchy
      });
    });

    test('should handle query parameters', async () => {
      req.params.id = 'zone-123';
      req.query.includeAncestors = 'false';
      req.query.includeDescendants = 'true';

      mockUseCases.manageZoneHierarchyUseCase.getZoneHierarchy.mockResolvedValue({
        success: true,
        hierarchy: {}
      });

      await controller.getZoneHierarchy(req, res, next);

      expect(mockUseCases.manageZoneHierarchyUseCase.getZoneHierarchy).toHaveBeenCalledWith(
        'zone-123',
        false,
        true
      );
    });
  });

  describe('changeZoneParent', () => {
    test('should change zone parent successfully', async () => {
      req.params.id = 'zone-123';
      req.body.parentZoneId = 'new-parent-456';

      const mockUpdatedZone = { id: 'zone-123', parentZoneId: 'new-parent-456' };
      mockUseCases.manageZoneHierarchyUseCase.moveZoneToParent.mockResolvedValue({
        success: true,
        message: 'Zone moved successfully',
        zone: mockUpdatedZone
      });

      await controller.changeZoneParent(req, res, next);

      expect(mockUseCases.manageZoneHierarchyUseCase.moveZoneToParent).toHaveBeenCalledWith(
        'zone-123',
        'new-parent-456',
        'user-123'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Zone moved successfully',
        data: mockUpdatedZone
      });
    });

    test('should return 400 for self-parenting', async () => {
      req.params.id = 'zone-123';
      req.body.parentZoneId = 'zone-123';

      await controller.changeZoneParent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone cannot be its own parent',
        errors: {
          parentZoneId: 'Zone cannot be its own parent'
        }
      });
    });

    test('should return 409 for circular reference', async () => {
      req.params.id = 'zone-123';
      req.body.parentZoneId = 'child-456';

      mockUseCases.manageZoneHierarchyUseCase.moveZoneToParent.mockResolvedValue({
        success: false,
        error: 'Would create circular reference'
      });

      await controller.changeZoneParent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Would create circular reference'
      });
    });

    test('should handle null parent (move to root)', async () => {
      req.params.id = 'zone-123';
      req.body.parentZoneId = null;

      mockUseCases.manageZoneHierarchyUseCase.moveZoneToParent.mockResolvedValue({
        success: true,
        message: 'Zone moved to root level',
        zone: { id: 'zone-123', parentZoneId: null }
      });

      await controller.changeZoneParent(req, res, next);

      expect(mockUseCases.manageZoneHierarchyUseCase.moveZoneToParent).toHaveBeenCalledWith(
        'zone-123',
        null,
        'user-123'
      );
    });
  });

  describe('validateHierarchy', () => {
    test('should validate hierarchy successfully', async () => {
      mockUseCases.manageZoneHierarchyUseCase.validateHierarchy.mockResolvedValue({
        success: true,
        isValid: true,
        issues: [],
        totalZones: 10,
        issueCount: 0
      });

      await controller.validateHierarchy(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          isValid: true,
          issues: [],
          statistics: {
            totalZones: 10,
            issueCount: 0
          }
        }
      });
    });

    test('should return 422 for invalid hierarchy', async () => {
      mockUseCases.manageZoneHierarchyUseCase.validateHierarchy.mockResolvedValue({
        success: true,
        isValid: false,
        issues: ['Circular reference detected'],
        totalZones: 10,
        issueCount: 1
      });

      await controller.validateHierarchy(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          isValid: false,
          issues: ['Circular reference detected'],
          statistics: {
            totalZones: 10,
            issueCount: 1
          }
        }
      });
    });

    test('should return 500 for validation error', async () => {
      mockUseCases.manageZoneHierarchyUseCase.validateHierarchy.mockResolvedValue({
        success: false,
        error: 'Unable to validate hierarchy'
      });

      await controller.validateHierarchy(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unable to validate hierarchy'
      });
    });
  });

  describe('error handling', () => {
    test('should handle unexpected errors', async () => {
      req.params.id = 'zone-123';
      mockUseCases.getZoneUseCase.execute.mockRejectedValue(new Error('Unexpected error'));

      await controller.getZone(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Unexpected error');
    });

    test('should handle malformed request data', async () => {
      req.body = null;

      await controller.createZone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone name is required',
        errors: {
          name: 'Zone name is required'
        }
      });
    });
  });

  describe('input sanitization', () => {
    test('should trim zone names', async () => {
      req.body = { name: '  Test Zone  ' };

      mockUseCases.createZoneUseCase.execute.mockResolvedValue({
        success: true,
        message: 'Zone created',
        zone: { id: 'zone-123', name: 'Test Zone' }
      });

      await controller.createZone(req, res, next);

      expect(mockUseCases.createZoneUseCase.execute).toHaveBeenCalledWith(
        'Test Zone',
        '',
        null,
        'user-123'
      );
    });

    test('should handle invalid limit parameter', async () => {
      req.query.limit = 'invalid';

      mockUseCases.listZonesUseCase.execute.mockResolvedValue({
        success: true,
        zones: [{ id: 'zone-1' }],
        count: 1
      });

      await controller.listZones(req, res, next);

      // Should not apply limit if invalid
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 'zone-1' }],
        meta: {
          count: 1
        }
      });
    });

    test('should handle negative limit parameter', async () => {
      req.query.limit = '-1';

      mockUseCases.listZonesUseCase.execute.mockResolvedValue({
        success: true,
        zones: [{ id: 'zone-1' }],
        count: 1
      });

      await controller.listZones(req, res, next);

      // Should not apply limit if negative
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 'zone-1' }],
        meta: {
          count: 1
        }
      });
    });
  });
});