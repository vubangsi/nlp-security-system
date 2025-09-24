/**
 * ZoneController - REST API Controller for Zone Management
 * 
 * Provides comprehensive REST endpoints for zone operations including:
 * - CRUD operations (Create, Read, Update, Delete)
 * - Zone state management (Arm/Disarm)
 * - Hierarchy operations (Parent/Child relationships)
 * - Filtering and querying capabilities
 * 
 * All endpoints follow RESTful conventions with proper HTTP methods and status codes.
 */
class ZoneController {
  constructor(
    createZoneUseCase,
    getZoneUseCase,
    updateZoneUseCase,
    deleteZoneUseCase,
    listZonesUseCase,
    armZoneUseCase,
    disarmZoneUseCase,
    manageZoneHierarchyUseCase
  ) {
    this.createZoneUseCase = createZoneUseCase;
    this.getZoneUseCase = getZoneUseCase;
    this.updateZoneUseCase = updateZoneUseCase;
    this.deleteZoneUseCase = deleteZoneUseCase;
    this.listZonesUseCase = listZonesUseCase;
    this.armZoneUseCase = armZoneUseCase;
    this.disarmZoneUseCase = disarmZoneUseCase;
    this.manageZoneHierarchyUseCase = manageZoneHierarchyUseCase;
  }

  /**
   * GET /api/zones
   * List all zones with optional filtering
   * 
   * Query Parameters:
   * - includeHierarchy: boolean (default: true) - Include hierarchical structure
   * - parentId: string - Filter by parent zone ID ('root' for root zones)
   * - armed: boolean - Filter by armed status
   * - limit: number - Limit number of results
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async listZones(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        includeHierarchy = 'true',
        parentId,
        armed,
        limit
      } = req.query;

      let result;

      // Filter by armed status
      if (armed !== undefined) {
        const isArmed = armed === 'true';
        if (isArmed) {
          result = await this.listZonesUseCase.executeArmedZones(userId);
        } else {
          // Get all zones and filter non-armed
          const allZonesResult = await this.listZonesUseCase.execute(false, userId);
          if (allZonesResult.success) {
            const nonArmedZones = allZonesResult.zones.filter(zone => !zone.isArmed);
            result = {
              success: true,
              zones: nonArmedZones,
              count: nonArmedZones.length
            };
          } else {
            result = allZonesResult;
          }
        }
      }
      // Filter by parent ID
      else if (parentId !== undefined) {
        result = await this.listZonesUseCase.executeByParent(
          parentId === 'root' ? null : parentId,
          userId
        );
      }
      // Default: all zones with optional hierarchy
      else {
        const includeHierarchyBool = includeHierarchy === 'true';
        result = await this.listZonesUseCase.execute(includeHierarchyBool, userId);
      }

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      // Apply limit if specified
      if (limit && result.zones) {
        const limitNum = parseInt(limit);
        if (!isNaN(limitNum) && limitNum > 0) {
          result.zones = result.zones.slice(0, limitNum);
          result.limited = true;
          result.originalCount = result.count;
          result.count = result.zones.length;
        }
      }

      res.json({
        success: true,
        data: result.zones,
        meta: {
          count: result.count,
          ...(result.rootZones && { rootZones: result.rootZones }),
          ...(result.totalZones && { totalZones: result.totalZones }),
          ...(result.limited && { 
            limited: true, 
            originalCount: result.originalCount 
          }),
          ...(parentId && { parentZoneId: parentId }),
          ...(armed !== undefined && { filteredByArmed: armed === 'true' })
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/zones/:id
   * Get specific zone by ID
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getZone(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Validate zone ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID is required'
        });
      }

      const result = await this.getZoneUseCase.execute(id, userId);

      if (!result.success) {
        // Check if it's a "not found" error
        if (result.error && result.error.includes('not found')) {
          return res.status(404).json({
            success: false,
            message: result.error
          });
        }
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.zone
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/zones
   * Create new zone
   * 
   * Request Body:
   * - name: string (required) - Zone name
   * - description: string (optional) - Zone description
   * - parentZoneId: string (optional) - Parent zone ID
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async createZone(req, res, next) {
    try {
      const { name, description = '', parentZoneId } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Zone name is required',
          errors: {
            name: 'Zone name is required'
          }
        });
      }

      // Validate name format
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Zone name must be a non-empty string',
          errors: {
            name: 'Zone name must be a non-empty string'
          }
        });
      }

      // Validate name length
      if (name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Zone name must be 100 characters or less',
          errors: {
            name: 'Zone name must be 100 characters or less'
          }
        });
      }

      // Validate description length if provided
      if (description && description.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Zone description must be 500 characters or less',
          errors: {
            description: 'Zone description must be 500 characters or less'
          }
        });
      }

      const result = await this.createZoneUseCase.execute(
        name.trim(),
        description,
        parentZoneId || null,
        userId
      );

      if (!result.success) {
        // Check for conflict errors (zone already exists)
        if (result.error && result.error.includes('already exists')) {
          return res.status(409).json({
            success: false,
            message: result.error
          });
        }
        
        // Check for validation errors (parent not found)
        if (result.error && result.error.includes('not found')) {
          return res.status(400).json({
            success: false,
            message: result.error
          });
        }

        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.status(201).json({
        success: true,
        message: result.message,
        data: result.zone
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/zones/:id
   * Update zone
   * 
   * Request Body:
   * - name: string (optional) - Zone name
   * - description: string (optional) - Zone description
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async updateZone(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const userId = req.user.id;

      // Validate zone ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID is required'
        });
      }

      // Validate that at least one field is provided
      if (!name && description === undefined) {
        return res.status(400).json({
          success: false,
          message: 'At least one field (name or description) must be provided for update',
          errors: {
            general: 'At least one field must be provided for update'
          }
        });
      }

      // Validate name if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Zone name must be a non-empty string',
            errors: {
              name: 'Zone name must be a non-empty string'
            }
          });
        }

        if (name.trim().length > 100) {
          return res.status(400).json({
            success: false,
            message: 'Zone name must be 100 characters or less',
            errors: {
              name: 'Zone name must be 100 characters or less'
            }
          });
        }
      }

      // Validate description if provided
      if (description !== undefined && description.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Zone description must be 500 characters or less',
          errors: {
            description: 'Zone description must be 500 characters or less'
          }
        });
      }

      // Prepare update data
      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description;

      const result = await this.updateZoneUseCase.execute(id, updateData, userId);

      if (!result.success) {
        // Check if it's a "not found" error
        if (result.error && result.error.includes('not found')) {
          return res.status(404).json({
            success: false,
            message: result.error
          });
        }

        // Check for conflict errors (name already exists)
        if (result.error && result.error.includes('already exists')) {
          return res.status(409).json({
            success: false,
            message: result.error
          });
        }

        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.zone
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/zones/:id
   * Delete zone
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteZone(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Validate zone ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID is required'
        });
      }

      const result = await this.deleteZoneUseCase.execute(id, userId);

      if (!result.success) {
        // Check if it's a "not found" error
        if (result.error && result.error.includes('not found')) {
          return res.status(404).json({
            success: false,
            message: result.error
          });
        }

        // Check for conflict errors (zone has children)
        if (result.error && (
          result.error.includes('has child zones') ||
          result.error.includes('cannot be deleted')
        )) {
          return res.status(409).json({
            success: false,
            message: result.error
          });
        }

        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/zones/:id/arm
   * Arm specific zone
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async armZone(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Validate zone ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID is required'
        });
      }

      const result = await this.armZoneUseCase.execute(id, userId);

      if (!result.success) {
        // Check if it's a "not found" error
        if (result.error && result.error.includes('not found')) {
          return res.status(404).json({
            success: false,
            message: result.error
          });
        }

        // Check for conflict errors (zone already armed)
        if (result.error && result.error.includes('already armed')) {
          return res.status(409).json({
            success: false,
            message: result.error
          });
        }

        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.zone
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/zones/:id/disarm
   * Disarm specific zone
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async disarmZone(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Validate zone ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID is required'
        });
      }

      const result = await this.disarmZoneUseCase.execute(id, userId);

      if (!result.success) {
        // Check if it's a "not found" error
        if (result.error && result.error.includes('not found')) {
          return res.status(404).json({
            success: false,
            message: result.error
          });
        }

        // Check for conflict errors (zone already disarmed)
        if (result.error && result.error.includes('already disarmed')) {
          return res.status(409).json({
            success: false,
            message: result.error
          });
        }

        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.zone
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/zones/:id/hierarchy
   * Get zone hierarchy (ancestors and descendants)
   * 
   * Query Parameters:
   * - includeAncestors: boolean (default: true) - Include ancestor zones
   * - includeDescendants: boolean (default: true) - Include descendant zones
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getZoneHierarchy(req, res, next) {
    try {
      const { id } = req.params;
      const {
        includeAncestors = 'true',
        includeDescendants = 'true'
      } = req.query;

      // Validate zone ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID is required'
        });
      }

      const result = await this.manageZoneHierarchyUseCase.getZoneHierarchy(
        id,
        includeAncestors === 'true',
        includeDescendants === 'true'
      );

      if (!result.success) {
        // Check if it's a "not found" error
        if (result.error && result.error.includes('not found')) {
          return res.status(404).json({
            success: false,
            message: result.error
          });
        }

        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.hierarchy
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/zones/:id/parent
   * Change zone parent (move zone in hierarchy)
   * 
   * Request Body:
   * - parentZoneId: string (optional) - New parent zone ID (null for root level)
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async changeZoneParent(req, res, next) {
    try {
      const { id } = req.params;
      const { parentZoneId } = req.body;
      const userId = req.user.id;

      // Validate zone ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID is required'
        });
      }

      // Validate parent zone ID format if provided
      if (parentZoneId === id) {
        return res.status(400).json({
          success: false,
          message: 'Zone cannot be its own parent',
          errors: {
            parentZoneId: 'Zone cannot be its own parent'
          }
        });
      }

      const result = await this.manageZoneHierarchyUseCase.moveZoneToParent(
        id,
        parentZoneId || null,
        userId
      );

      if (!result.success) {
        // Check if it's a "not found" error
        if (result.error && result.error.includes('not found')) {
          return res.status(404).json({
            success: false,
            message: result.error
          });
        }

        // Check for circular reference errors
        if (result.error && result.error.includes('circular reference')) {
          return res.status(409).json({
            success: false,
            message: result.error
          });
        }

        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.zone || result.childZone
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/zones/hierarchy/validate
   * Validate zone hierarchy integrity
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async validateHierarchy(req, res, next) {
    try {
      const result = await this.manageZoneHierarchyUseCase.validateHierarchy();

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error
        });
      }

      const statusCode = result.isValid ? 200 : 422;

      res.status(statusCode).json({
        success: true,
        data: {
          isValid: result.isValid,
          issues: result.issues,
          statistics: {
            totalZones: result.totalZones,
            issueCount: result.issueCount
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ZoneController;