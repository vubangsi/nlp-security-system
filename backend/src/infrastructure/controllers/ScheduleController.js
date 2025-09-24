/**
 * ScheduleController - REST API Controller for Schedule Management
 * 
 * Provides comprehensive REST endpoints for schedule operations including:
 * - CRUD operations (Create, Read, Update, Delete)
 * - Bulk operations for multiple schedules
 * - Schedule analytics and statistics
 * - Schedule testing and validation
 * - Administrative schedule management
 * 
 * All endpoints follow RESTful conventions with proper HTTP methods and status codes.
 * Follows the same patterns as existing controllers in the system.
 */
class ScheduleController {
  constructor(
    createScheduleUseCase,
    listSchedulesUseCase,
    getScheduleUseCase,
    updateScheduleUseCase,
    deleteScheduleUseCase,
    bulkCreateSchedulesUseCase,
    bulkUpdateSchedulesUseCase,
    bulkDeleteSchedulesUseCase,
    getScheduleStatisticsUseCase,
    getUpcomingSchedulesUseCase,
    testScheduleExpressionUseCase,
    executeScheduleUseCase,
    getSchedulerHealthUseCase
  ) {
    this.createScheduleUseCase = createScheduleUseCase;
    this.listSchedulesUseCase = listSchedulesUseCase;
    this.getScheduleUseCase = getScheduleUseCase;
    this.updateScheduleUseCase = updateScheduleUseCase;
    this.deleteScheduleUseCase = deleteScheduleUseCase;
    this.bulkCreateSchedulesUseCase = bulkCreateSchedulesUseCase;
    this.bulkUpdateSchedulesUseCase = bulkUpdateSchedulesUseCase;
    this.bulkDeleteSchedulesUseCase = bulkDeleteSchedulesUseCase;
    this.getScheduleStatisticsUseCase = getScheduleStatisticsUseCase;
    this.getUpcomingSchedulesUseCase = getUpcomingSchedulesUseCase;
    this.testScheduleExpressionUseCase = testScheduleExpressionUseCase;
    this.executeScheduleUseCase = executeScheduleUseCase;
    this.getSchedulerHealthUseCase = getSchedulerHealthUseCase;
  }

  /**
   * POST /api/schedules
   * Create new scheduled task
   * 
   * Request Body:
   * - scheduleExpression: string (required) - Natural language or cron expression
   * - actionType: string (required) - Type of action (ARM, DISARM)
   * - actionParameters: object (optional) - Additional parameters for the action
   * - description: string (optional) - Human-readable description
   * - enabled: boolean (optional, default: true) - Whether schedule is active
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async createSchedule(req, res, next) {
    try {
      const { scheduleExpression, actionType, actionParameters = {}, description = '', enabled = true } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!scheduleExpression) {
        return res.status(400).json({
          success: false,
          message: 'Schedule expression is required',
          errors: {
            scheduleExpression: 'Schedule expression is required'
          }
        });
      }

      if (!actionType) {
        return res.status(400).json({
          success: false,
          message: 'Action type is required',
          errors: {
            actionType: 'Action type is required'
          }
        });
      }

      // Validate action type
      const validActionTypes = ['ARM', 'DISARM'];
      if (!validActionTypes.includes(actionType.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `Action type must be one of: ${validActionTypes.join(', ')}`,
          errors: {
            actionType: `Action type must be one of: ${validActionTypes.join(', ')}`
          }
        });
      }

      // Validate schedule expression format
      if (typeof scheduleExpression !== 'string' || scheduleExpression.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Schedule expression must be a non-empty string',
          errors: {
            scheduleExpression: 'Schedule expression must be a non-empty string'
          }
        });
      }

      // Validate description length if provided
      if (description && description.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Description must be 500 characters or less',
          errors: {
            description: 'Description must be 500 characters or less'
          }
        });
      }

      const result = await this.createScheduleUseCase.execute({
        scheduleExpression: scheduleExpression.trim(),
        actionType: actionType.toUpperCase(),
        actionParameters,
        description,
        enabled,
        userId
      });

      if (!result.success) {
        // Check for validation errors
        if (result.error && result.error.includes('Invalid schedule expression')) {
          return res.status(422).json({
            success: false,
            message: result.error,
            errors: {
              scheduleExpression: result.error
            }
          });
        }

        // Check for conflict errors
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

      res.status(201).json({
        success: true,
        message: 'Schedule created successfully',
        data: result.schedule
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/schedules
   * List user's scheduled tasks with filtering and pagination
   * 
   * Query Parameters:
   * - status: string (PENDING, ACTIVE, COMPLETED, CANCELLED) - Filter by status
   * - actionType: string (ARM, DISARM) - Filter by action type
   * - enabled: boolean - Filter by enabled status
   * - upcoming: boolean - Show only upcoming schedules
   * - limit: number - Limit number of results (default: 50, max: 200)
   * - offset: number - Skip number of results for pagination
   * - sortBy: string (createdAt, nextExecution, status) - Sort field
   * - sortOrder: string (asc, desc) - Sort order
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async listSchedules(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      const {
        status,
        actionType,
        enabled,
        upcoming,
        limit = '50',
        offset = '0',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeAllUsers = 'false'
      } = req.query;

      // Parse and validate limit
      const limitNum = Math.min(parseInt(limit) || 50, 200);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      // Validate sort parameters
      const validSortFields = ['createdAt', 'nextExecution', 'status', 'actionType'];
      const validSortOrders = ['asc', 'desc'];

      if (!validSortFields.includes(sortBy)) {
        return res.status(400).json({
          success: false,
          message: `Sort field must be one of: ${validSortFields.join(', ')}`,
          errors: {
            sortBy: `Sort field must be one of: ${validSortFields.join(', ')}`
          }
        });
      }

      if (!validSortOrders.includes(sortOrder)) {
        return res.status(400).json({
          success: false,
          message: `Sort order must be one of: ${validSortOrders.join(', ')}`,
          errors: {
            sortOrder: `Sort order must be one of: ${validSortOrders.join(', ')}`
          }
        });
      }

      // Build filters
      const filters = {};
      if (status) {
        const validStatuses = ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
        if (!validStatuses.includes(status.toUpperCase())) {
          return res.status(400).json({
            success: false,
            message: `Status must be one of: ${validStatuses.join(', ')}`,
            errors: {
              status: `Status must be one of: ${validStatuses.join(', ')}`
            }
          });
        }
        filters.status = status.toUpperCase();
      }

      if (actionType) {
        const validActionTypes = ['ARM', 'DISARM'];
        if (!validActionTypes.includes(actionType.toUpperCase())) {
          return res.status(400).json({
            success: false,
            message: `Action type must be one of: ${validActionTypes.join(', ')}`,
            errors: {
              actionType: `Action type must be one of: ${validActionTypes.join(', ')}`
            }
          });
        }
        filters.actionType = actionType.toUpperCase();
      }

      if (enabled !== undefined) {
        filters.enabled = enabled === 'true';
      }

      if (upcoming === 'true') {
        filters.upcoming = true;
      }

      // Admin can view all users' schedules
      const targetUserId = (isAdmin && includeAllUsers === 'true') ? null : userId;

      const result = await this.listSchedulesUseCase.execute({
        userId: targetUserId,
        filters,
        pagination: {
          limit: limitNum,
          offset: offsetNum
        },
        sorting: {
          sortBy,
          sortOrder
        }
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.schedules,
        meta: {
          count: result.schedules.length,
          total: result.totalCount,
          limit: limitNum,
          offset: offsetNum,
          hasMore: (offsetNum + limitNum) < result.totalCount,
          filters: {
            ...filters,
            ...(targetUserId === null && { includeAllUsers: true })
          },
          sorting: {
            sortBy,
            sortOrder
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/schedules/:id
   * Get specific scheduled task details
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getSchedule(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      // Validate schedule ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Schedule ID is required'
        });
      }

      const result = await this.getScheduleUseCase.execute(id, userId, isAdmin);

      if (!result.success) {
        // Check if it's a "not found" error
        if (result.error && result.error.includes('not found')) {
          return res.status(404).json({
            success: false,
            message: result.error
          });
        }

        // Check for permission errors
        if (result.error && result.error.includes('not authorized')) {
          return res.status(403).json({
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
        data: result.schedule
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/schedules/:id
   * Update existing scheduled task
   * 
   * Request Body:
   * - scheduleExpression: string (optional) - New schedule expression
   * - actionParameters: object (optional) - Updated action parameters
   * - description: string (optional) - Updated description
   * - enabled: boolean (optional) - Enable/disable schedule
   * - status: string (optional) - Update status (admin only)
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async updateSchedule(req, res, next) {
    try {
      const { id } = req.params;
      const { scheduleExpression, actionParameters, description, enabled, status } = req.body;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      // Validate schedule ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Schedule ID is required'
        });
      }

      // Validate that at least one field is provided
      if (scheduleExpression === undefined && actionParameters === undefined && 
          description === undefined && enabled === undefined && status === undefined) {
        return res.status(400).json({
          success: false,
          message: 'At least one field must be provided for update',
          errors: {
            general: 'At least one field must be provided for update'
          }
        });
      }

      // Validate schedule expression if provided
      if (scheduleExpression !== undefined) {
        if (typeof scheduleExpression !== 'string' || scheduleExpression.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Schedule expression must be a non-empty string',
            errors: {
              scheduleExpression: 'Schedule expression must be a non-empty string'
            }
          });
        }
      }

      // Validate description if provided
      if (description !== undefined && description.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Description must be 500 characters or less',
          errors: {
            description: 'Description must be 500 characters or less'
          }
        });
      }

      // Validate status if provided (admin only)
      if (status !== undefined) {
        if (!isAdmin) {
          return res.status(403).json({
            success: false,
            message: 'Only administrators can update schedule status'
          });
        }

        const validStatuses = ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
        if (!validStatuses.includes(status.toUpperCase())) {
          return res.status(400).json({
            success: false,
            message: `Status must be one of: ${validStatuses.join(', ')}`,
            errors: {
              status: `Status must be one of: ${validStatuses.join(', ')}`
            }
          });
        }
      }

      // Prepare update data
      const updateData = {};
      if (scheduleExpression !== undefined) updateData.scheduleExpression = scheduleExpression.trim();
      if (actionParameters !== undefined) updateData.actionParameters = actionParameters;
      if (description !== undefined) updateData.description = description;
      if (enabled !== undefined) updateData.enabled = enabled;
      if (status !== undefined) updateData.status = status.toUpperCase();

      const result = await this.updateScheduleUseCase.execute(id, updateData, userId, isAdmin);

      if (!result.success) {
        // Check if it's a "not found" error
        if (result.error && result.error.includes('not found')) {
          return res.status(404).json({
            success: false,
            message: result.error
          });
        }

        // Check for permission errors
        if (result.error && result.error.includes('not authorized')) {
          return res.status(403).json({
            success: false,
            message: result.error
          });
        }

        // Check for validation errors
        if (result.error && result.error.includes('Invalid schedule expression')) {
          return res.status(422).json({
            success: false,
            message: result.error,
            errors: {
              scheduleExpression: result.error
            }
          });
        }

        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: 'Schedule updated successfully',
        data: result.schedule
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/schedules/:id
   * Cancel/delete scheduled task
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteSchedule(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      // Validate schedule ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Schedule ID is required'
        });
      }

      const result = await this.deleteScheduleUseCase.execute(id, userId, isAdmin);

      if (!result.success) {
        // Check if it's a "not found" error
        if (result.error && result.error.includes('not found')) {
          return res.status(404).json({
            success: false,
            message: result.error
          });
        }

        // Check for permission errors
        if (result.error && result.error.includes('not authorized')) {
          return res.status(403).json({
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
        message: result.message || 'Schedule deleted successfully',
        data: {
          impactAnalysis: result.impactAnalysis
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/schedules/bulk
   * Create multiple schedules
   * 
   * Request Body:
   * - schedules: Array<ScheduleRequest> (required) - Array of schedule definitions
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async bulkCreateSchedules(req, res, next) {
    try {
      const { schedules } = req.body;
      const userId = req.user.id;

      // Validate schedules array
      if (!schedules || !Array.isArray(schedules)) {
        return res.status(400).json({
          success: false,
          message: 'Schedules must be provided as an array',
          errors: {
            schedules: 'Schedules must be provided as an array'
          }
        });
      }

      if (schedules.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one schedule must be provided',
          errors: {
            schedules: 'At least one schedule must be provided'
          }
        });
      }

      if (schedules.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Cannot create more than 50 schedules at once',
          errors: {
            schedules: 'Cannot create more than 50 schedules at once'
          }
        });
      }

      const result = await this.bulkCreateSchedulesUseCase.execute(schedules, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      // Determine status code based on results
      const hasFailures = result.results.some(r => !r.success);
      const statusCode = hasFailures ? 207 : 201; // 207 Multi-Status for partial success

      res.status(statusCode).json({
        success: true,
        message: `Bulk schedule creation completed. ${result.successCount} succeeded, ${result.failureCount} failed.`,
        data: {
          results: result.results,
          summary: {
            total: result.results.length,
            successful: result.successCount,
            failed: result.failureCount
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/schedules/bulk
   * Cancel multiple schedules
   * 
   * Request Body:
   * - scheduleIds: string[] (optional) - Array of schedule IDs to delete
   * - criteria: object (optional) - Criteria for bulk deletion
   *   - status: string - Delete schedules with this status
   *   - actionType: string - Delete schedules with this action type
   *   - days: string[] - Delete schedules for specific days
   *   - enabled: boolean - Delete enabled/disabled schedules
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async bulkDeleteSchedules(req, res, next) {
    try {
      const { scheduleIds, criteria } = req.body;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      // Validate that either scheduleIds or criteria is provided
      if (!scheduleIds && !criteria) {
        return res.status(400).json({
          success: false,
          message: 'Either scheduleIds or criteria must be provided',
          errors: {
            general: 'Either scheduleIds or criteria must be provided'
          }
        });
      }

      // Validate scheduleIds if provided
      if (scheduleIds && (!Array.isArray(scheduleIds) || scheduleIds.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'scheduleIds must be a non-empty array',
          errors: {
            scheduleIds: 'scheduleIds must be a non-empty array'
          }
        });
      }

      if (scheduleIds && scheduleIds.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete more than 100 schedules at once',
          errors: {
            scheduleIds: 'Cannot delete more than 100 schedules at once'
          }
        });
      }

      const result = await this.bulkDeleteSchedulesUseCase.execute({
        scheduleIds,
        criteria,
        userId,
        isAdmin
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: `Bulk schedule deletion completed. ${result.deletedCount} schedules were deleted.`,
        data: {
          deletedCount: result.deletedCount,
          impactAnalysis: result.impactAnalysis,
          errors: result.errors || []
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/schedules/bulk
   * Update multiple schedules
   * 
   * Request Body:
   * - updates: Array<{ id: string, changes: object }> (required) - Array of schedule updates
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async bulkUpdateSchedules(req, res, next) {
    try {
      const { updates } = req.body;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      // Validate updates array
      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({
          success: false,
          message: 'Updates must be provided as an array',
          errors: {
            updates: 'Updates must be provided as an array'
          }
        });
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one update must be provided',
          errors: {
            updates: 'At least one update must be provided'
          }
        });
      }

      if (updates.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update more than 50 schedules at once',
          errors: {
            updates: 'Cannot update more than 50 schedules at once'
          }
        });
      }

      const result = await this.bulkUpdateSchedulesUseCase.execute(updates, userId, isAdmin);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      // Determine status code based on results
      const hasFailures = result.results.some(r => !r.success);
      const statusCode = hasFailures ? 207 : 200; // 207 Multi-Status for partial success

      res.status(statusCode).json({
        success: true,
        message: `Bulk schedule update completed. ${result.successCount} succeeded, ${result.failureCount} failed.`,
        data: {
          results: result.results,
          summary: {
            total: result.results.length,
            successful: result.successCount,
            failed: result.failureCount
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/schedules/statistics
   * Get user's schedule statistics
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getStatistics(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      const { includeAllUsers = 'false' } = req.query;

      // Admin can view system-wide stats
      const targetUserId = (isAdmin && includeAllUsers === 'true') ? null : userId;

      const result = await this.getScheduleStatisticsUseCase.execute(targetUserId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.statistics
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/schedules/upcoming
   * Get upcoming schedule executions
   * 
   * Query Parameters:
   * - days: number - Number of days ahead to look (default: 7, max: 30)
   * - limit: number - Limit number of results (default: 100, max: 500)
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getUpcoming(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      const { days = '7', limit = '100', includeAllUsers = 'false' } = req.query;

      // Parse and validate days
      const daysNum = Math.min(Math.max(parseInt(days) || 7, 1), 30);
      const limitNum = Math.min(parseInt(limit) || 100, 500);

      // Admin can view all users' upcoming schedules
      const targetUserId = (isAdmin && includeAllUsers === 'true') ? null : userId;

      const result = await this.getUpcomingSchedulesUseCase.execute({
        userId: targetUserId,
        days: daysNum,
        limit: limitNum
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: result.upcomingSchedules,
        meta: {
          days: daysNum,
          limit: limitNum,
          count: result.upcomingSchedules.length,
          ...(targetUserId === null && { includeAllUsers: true })
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/schedules/test
   * Test schedule expression parsing
   * 
   * Request Body:
   * - scheduleExpression: string (required) - Schedule expression to test
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async testScheduleExpression(req, res, next) {
    try {
      const { scheduleExpression } = req.body;

      // Validate schedule expression
      if (!scheduleExpression) {
        return res.status(400).json({
          success: false,
          message: 'Schedule expression is required',
          errors: {
            scheduleExpression: 'Schedule expression is required'
          }
        });
      }

      if (typeof scheduleExpression !== 'string' || scheduleExpression.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Schedule expression must be a non-empty string',
          errors: {
            scheduleExpression: 'Schedule expression must be a non-empty string'
          }
        });
      }

      const result = await this.testScheduleExpressionUseCase.execute(scheduleExpression.trim());

      if (!result.success) {
        return res.status(422).json({
          success: false,
          message: result.error,
          errors: {
            scheduleExpression: result.error
          }
        });
      }

      res.json({
        success: true,
        data: result.parsedSchedule
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/schedules/execute/:id
   * Manually execute schedule (Admin only)
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async executeSchedule(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Validate schedule ID
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Schedule ID is required'
        });
      }

      const result = await this.executeScheduleUseCase.execute(id, userId);

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
        message: 'Schedule executed successfully',
        data: {
          executionResult: result.executionResult,
          schedule: result.schedule
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/schedules/health
   * Get scheduler health status (Admin only)
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getSchedulerHealth(req, res, next) {
    try {
      const result = await this.getSchedulerHealthUseCase.execute();

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error
        });
      }

      // Determine status code based on health
      const statusCode = result.health.isHealthy ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: result.health
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ScheduleController;