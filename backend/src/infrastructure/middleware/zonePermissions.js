/**
 * Zone Permissions Middleware
 * 
 * Implements Role-Based Access Control (RBAC) for zone operations
 * Provides granular permission checking for zone-related actions
 */

const zonePermissions = {
  READ: 'zone:read',
  WRITE: 'zone:write', 
  ARM_DISARM: 'zone:arm_disarm',
  ADMIN: 'zone:admin',
  HIERARCHY: 'zone:hierarchy'
};

const rolePermissions = {
  user: [
    zonePermissions.READ,
    zonePermissions.ARM_DISARM
  ],
  admin: [
    zonePermissions.READ,
    zonePermissions.WRITE,
    zonePermissions.ARM_DISARM,
    zonePermissions.ADMIN,
    zonePermissions.HIERARCHY
  ],
  system: [
    zonePermissions.READ,
    zonePermissions.WRITE,
    zonePermissions.ARM_DISARM,
    zonePermissions.ADMIN,
    zonePermissions.HIERARCHY
  ]
};

/**
 * Check if user has required permission for zone operation
 * @param {string} permission - Required permission
 * @returns {Function} Express middleware function
 */
const requireZonePermission = (permission) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTHENTICATION_REQUIRED'
        });
      }

      const userRole = user.role || 'user';
      const permissions = rolePermissions[userRole] || [];

      if (!permissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required: ${permission}`,
          error: 'INSUFFICIENT_PERMISSIONS',
          details: {
            userRole,
            requiredPermission: permission,
            availablePermissions: permissions
          }
        });
      }

      // Add permission context to request
      req.zonePermission = {
        permission,
        userRole,
        allPermissions: permissions
      };

      next();
    } catch (error) {
      console.error('Zone permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
        error: 'PERMISSION_CHECK_FAILED'
      });
    }
  };
};

/**
 * Check if user can access specific zone
 * @param {Function} zoneService - Zone service to check ownership
 * @returns {Function} Express middleware function
 */
const requireZoneAccess = (zoneService) => {
  return async (req, res, next) => {
    try {
      const { id: zoneId } = req.params;
      const user = req.user;

      if (!zoneId) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID is required',
          error: 'ZONE_ID_REQUIRED'
        });
      }

      // Admin users have access to all zones
      if (user.role === 'admin' || user.role === 'system') {
        return next();
      }

      // For regular users, check zone ownership/access
      if (zoneService && typeof zoneService.checkZoneAccess === 'function') {
        const hasAccess = await zoneService.checkZoneAccess(zoneId, user.id);
        
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this zone',
            error: 'ZONE_ACCESS_DENIED',
            details: {
              zoneId,
              userId: user.id
            }
          });
        }
      }

      next();
    } catch (error) {
      console.error('Zone access check error:', error);
      res.status(500).json({
        success: false,
        message: 'Zone access check failed',
        error: 'ZONE_ACCESS_CHECK_FAILED'
      });
    }
  };
};

/**
 * Validate zone ownership for modification operations
 * @param {Function} zoneService - Zone service to check ownership
 * @returns {Function} Express middleware function
 */
const requireZoneOwnership = (zoneService) => {
  return async (req, res, next) => {
    try {
      const { id: zoneId } = req.params;
      const user = req.user;

      if (!zoneId) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID is required',
          error: 'ZONE_ID_REQUIRED'
        });
      }

      // Admin users can modify all zones
      if (user.role === 'admin' || user.role === 'system') {
        return next();
      }

      // Check zone ownership for regular users
      if (zoneService && typeof zoneService.checkZoneOwnership === 'function') {
        const isOwner = await zoneService.checkZoneOwnership(zoneId, user.id);
        
        if (!isOwner) {
          return res.status(403).json({
            success: false,
            message: 'You can only modify zones you own',
            error: 'ZONE_OWNERSHIP_REQUIRED',
            details: {
              zoneId,
              userId: user.id
            }
          });
        }
      }

      next();
    } catch (error) {
      console.error('Zone ownership check error:', error);
      res.status(500).json({
        success: false,
        message: 'Zone ownership check failed',
        error: 'ZONE_OWNERSHIP_CHECK_FAILED'
      });
    }
  };
};

/**
 * Check hierarchy depth limits
 * @param {number} maxDepth - Maximum allowed hierarchy depth (default: 5)
 * @returns {Function} Express middleware function
 */
const validateHierarchyDepth = (maxDepth = 5) => {
  return async (req, res, next) => {
    try {
      const { parentZoneId } = req.body;
      
      if (!parentZoneId) {
        return next(); // Root level zones are allowed
      }

      // TODO: Implement hierarchy depth checking
      // This would require access to the zone service to calculate depth
      // For now, we'll just validate the parent zone ID format
      
      if (typeof parentZoneId !== 'string' || parentZoneId.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid parent zone ID format',
          error: 'INVALID_PARENT_ZONE_ID'
        });
      }

      next();
    } catch (error) {
      console.error('Hierarchy depth validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Hierarchy depth validation failed',
        error: 'HIERARCHY_VALIDATION_FAILED'
      });
    }
  };
};

/**
 * Prevent circular references in zone hierarchy
 * @param {Function} zoneService - Zone service for hierarchy checking
 * @returns {Function} Express middleware function
 */
const preventCircularReference = (zoneService) => {
  return async (req, res, next) => {
    try {
      const { id: zoneId } = req.params;
      const { parentZoneId } = req.body;

      if (!parentZoneId || !zoneId) {
        return next();
      }

      // Prevent self-assignment
      if (zoneId === parentZoneId) {
        return res.status(400).json({
          success: false,
          message: 'Zone cannot be its own parent',
          error: 'CIRCULAR_REFERENCE_SELF'
        });
      }

      // Check for circular references in hierarchy
      if (zoneService && typeof zoneService.wouldCreateCircularReference === 'function') {
        const wouldCreateCircular = await zoneService.wouldCreateCircularReference(zoneId, parentZoneId);
        
        if (wouldCreateCircular) {
          return res.status(400).json({
            success: false,
            message: 'This operation would create a circular reference in the zone hierarchy',
            error: 'CIRCULAR_REFERENCE_DETECTED',
            details: {
              zoneId,
              parentZoneId
            }
          });
        }
      }

      next();
    } catch (error) {
      console.error('Circular reference check error:', error);
      res.status(500).json({
        success: false,
        message: 'Circular reference check failed',
        error: 'CIRCULAR_REFERENCE_CHECK_FAILED'
      });
    }
  };
};

module.exports = {
  zonePermissions,
  rolePermissions,
  requireZonePermission,
  requireZoneAccess,
  requireZoneOwnership,
  validateHierarchyDepth,
  preventCircularReference
};