const ScheduledTask = require('../../domain/entities/ScheduledTask');
const ScheduleCancelled = require('../../domain/events/ScheduleCancelled');
const EventLog = require('../../domain/entities/EventLog');

/**
 * CancelScheduledTaskUseCase
 * 
 * Orchestrates the cancellation of scheduled tasks with support for individual,
 * bulk, and conditional cancellation. Handles proper state transitions, audit
 * logging, and event publishing while maintaining data integrity and permissions.
 */
class CancelScheduledTaskUseCase {
  constructor(
    scheduledTaskRepository,
    eventLogRepository,
    eventBus,
    userRepository = null
  ) {
    this.scheduledTaskRepository = scheduledTaskRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
    this.userRepository = userRepository;
  }

  /**
   * Cancels a specific scheduled task
   * 
   * @param {string} scheduleId - ID of the schedule to cancel
   * @param {string} requestingUserId - User making the request
   * @param {Object} options - Cancellation options
   * @param {string} options.reason - Reason for cancellation
   * @param {boolean} options.forceCancel - Allow cancellation of executing tasks (admin only)
   * @param {boolean} options.softCancel - Mark as cancelled but keep data for history
   * 
   * @returns {Promise<Object>} Result with success status and cancellation details
   */
  async execute(scheduleId, requestingUserId, options = {}) {
    try {
      // Validate required parameters
      if (!scheduleId) {
        return {
          success: false,
          error: 'Schedule ID is required',
          details: { field: 'scheduleId', message: 'Must provide schedule ID to cancel' }
        };
      }

      if (!requestingUserId) {
        return {
          success: false,
          error: 'User ID is required',
          details: { field: 'requestingUserId', message: 'Must specify the requesting user' }
        };
      }

      // Find the scheduled task
      const scheduledTask = await this.scheduledTaskRepository.findById(scheduleId);
      if (!scheduledTask) {
        return {
          success: false,
          error: 'Scheduled task not found',
          details: { field: 'scheduleId', message: `No schedule found with ID: ${scheduleId}` }
        };
      }

      // Validate user permissions
      const permissionCheck = await this._validateCancellationPermissions(scheduledTask, requestingUserId, options);
      if (!permissionCheck.success) {
        return permissionCheck;
      }

      // Check if task can be cancelled based on current status
      if (!this._canCancelTaskStatus(scheduledTask.status) && !options.forceCancel) {
        return {
          success: false,
          error: 'Cannot cancel task in current status',
          details: { 
            field: 'status', 
            message: `Tasks with status ${scheduledTask.status} cannot be cancelled`,
            currentStatus: scheduledTask.status,
            suggestion: 'Use forceCancel option if you have admin privileges'
          }
        };
      }

      // Store original data for audit and events
      const originalStatus = scheduledTask.status;
      const originalNextExecution = scheduledTask.nextExecutionTime;
      const taskDescription = scheduledTask.getDescription();

      // Cancel the task with reason
      const cancellationReason = options.reason || 'Cancelled by user request';
      scheduledTask.cancel(cancellationReason);

      // Save the cancelled task
      const savedTask = await this.scheduledTaskRepository.save(scheduledTask);

      // Create audit log entry
      await this._createCancellationAuditLog(savedTask, originalStatus, cancellationReason, requestingUserId);

      // Publish domain event
      const domainEvent = new ScheduleCancelled(
        savedTask,
        {
          reason: cancellationReason,
          cancelledBy: requestingUserId,
          originalStatus: originalStatus,
          originalNextExecution: originalNextExecution
        }
      );
      this.eventBus.publish(domainEvent);

      // Prepare response data
      const responseData = {
        schedule: savedTask.toJSON(),
        cancellationReason,
        cancelledAt: savedTask.updatedAt,
        originalStatus,
        originalNextExecution,
        impactAnalysis: await this._analyzeImpact(savedTask)
      };

      return {
        success: true,
        message: `Successfully cancelled scheduled ${scheduledTask.actionType.toLowerCase().replace('_', ' ')} task`,
        data: responseData
      };

    } catch (error) {
      console.error('CancelScheduledTaskUseCase error:', error);
      
      return {
        success: false,
        error: 'An unexpected error occurred while cancelling the scheduled task',
        details: { 
          field: 'system', 
          message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        }
      };
    }
  }

  /**
   * Cancels multiple scheduled tasks based on criteria
   * 
   * @param {Object} criteria - Selection criteria
   * @param {string} criteria.userId - User ID (required)
   * @param {Array<string>} criteria.scheduleIds - Specific schedule IDs to cancel
   * @param {Array<string>} criteria.days - Days filter for schedule expression
   * @param {string} criteria.actionType - Action type filter (ARM_SYSTEM, DISARM_SYSTEM)
   * @param {string} criteria.status - Status filter
   * @param {boolean} criteria.cancelAll - Cancel all user's schedules
   * @param {string} requestingUserId - User making the request
   * @param {Object} options - Bulk cancellation options
   * 
   * @returns {Promise<Object>} Result with cancellation statistics
   */
  async executeBulk(criteria, requestingUserId, options = {}) {
    try {
      // Validate criteria
      if (!criteria.userId) {
        return {
          success: false,
          error: 'User ID is required in criteria',
          details: { field: 'criteria.userId', message: 'Must specify user ID for bulk cancellation' }
        };
      }

      // Validate permissions for bulk cancellation
      const permissionCheck = await this._validateBulkCancellationPermissions(criteria, requestingUserId);
      if (!permissionCheck.success) {
        return permissionCheck;
      }

      // Find tasks matching criteria
      const matchingTasks = await this._findTasksByCriteria(criteria);

      if (matchingTasks.length === 0) {
        return {
          success: true,
          message: 'No matching schedules found to cancel',
          data: {
            totalFound: 0,
            cancelled: 0,
            failed: 0,
            errors: []
          }
        };
      }

      // Warn if cancelling many tasks
      if (matchingTasks.length > 10 && !options.confirmed) {
        return {
          success: false,
          error: 'Bulk cancellation confirmation required',
          details: { 
            field: 'confirmation', 
            message: `About to cancel ${matchingTasks.length} schedules. Set confirmed: true to proceed`,
            matchingTasksCount: matchingTasks.length
          }
        };
      }

      // Cancel each matching task
      const results = {
        totalFound: matchingTasks.length,
        cancelled: 0,
        failed: 0,
        errors: [],
        cancelledSchedules: []
      };

      for (const task of matchingTasks) {
        try {
          const cancellationResult = await this.execute(task.id, requestingUserId, options);
          
          if (cancellationResult.success) {
            results.cancelled++;
            results.cancelledSchedules.push({
              id: task.id,
              description: task.getDescription(),
              originalStatus: cancellationResult.data.originalStatus,
              cancelledAt: cancellationResult.data.cancelledAt
            });
          } else {
            results.failed++;
            results.errors.push({
              scheduleId: task.id,
              error: cancellationResult.error,
              details: cancellationResult.details
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            scheduleId: task.id,
            error: 'Cancellation failed',
            details: { message: error.message }
          });
        }
      }

      return {
        success: results.failed === 0,
        message: `Cancelled ${results.cancelled} of ${results.totalFound} schedules`,
        data: results
      };

    } catch (error) {
      return {
        success: false,
        error: 'Bulk cancellation operation failed',
        details: { field: 'system', message: error.message }
      };
    }
  }

  /**
   * Cancels schedules by specific days
   * 
   * @param {Array<string>} days - Days to cancel (e.g., ['monday', 'tuesday'])
   * @param {string} userId - User ID
   * @param {string} requestingUserId - User making the request
   * @param {Object} options - Cancellation options
   * 
   * @returns {Promise<Object>} Result with day-specific cancellation details
   */
  async cancelByDays(days, userId, requestingUserId, options = {}) {
    if (!Array.isArray(days) || days.length === 0) {
      return {
        success: false,
        error: 'Days array is required',
        details: { field: 'days', message: 'Must provide array of days to cancel' }
      };
    }

    const criteria = {
      userId,
      days,
      status: ScheduledTask.STATUS.ACTIVE // Only cancel active schedules by default
    };

    return this.executeBulk(criteria, requestingUserId, options);
  }

  /**
   * Cancels all active schedules for a user
   * 
   * @param {string} userId - User ID
   * @param {string} requestingUserId - User making the request
   * @param {Object} options - Cancellation options
   * 
   * @returns {Promise<Object>} Result with cancellation details
   */
  async cancelAll(userId, requestingUserId, options = {}) {
    const criteria = {
      userId,
      cancelAll: true,
      status: [ScheduledTask.STATUS.ACTIVE, ScheduledTask.STATUS.PENDING]
    };

    return this.executeBulk(criteria, requestingUserId, {
      ...options,
      reason: options.reason || 'Bulk cancellation - all schedules'
    });
  }

  /**
   * Cancels schedules by action type
   * 
   * @param {string} actionType - Action type to cancel (ARM_SYSTEM or DISARM_SYSTEM)
   * @param {string} userId - User ID
   * @param {string} requestingUserId - User making the request
   * @param {Object} options - Cancellation options
   * 
   * @returns {Promise<Object>} Result with action-specific cancellation details
   */
  async cancelByActionType(actionType, userId, requestingUserId, options = {}) {
    if (!Object.values(ScheduledTask.ACTION_TYPE).includes(actionType)) {
      return {
        success: false,
        error: 'Invalid action type',
        details: { 
          field: 'actionType', 
          message: 'Must be ARM_SYSTEM or DISARM_SYSTEM',
          allowedValues: Object.values(ScheduledTask.ACTION_TYPE)
        }
      };
    }

    const criteria = {
      userId,
      actionType,
      status: ScheduledTask.STATUS.ACTIVE
    };

    return this.executeBulk(criteria, requestingUserId, {
      ...options,
      reason: options.reason || `Cancelled all ${actionType} schedules`
    });
  }

  /**
   * Emergency cancellation - cancels all schedules for a user immediately
   * 
   * @param {string} userId - User ID
   * @param {string} requestingUserId - User making the request (must be admin)
   * @param {string} emergencyReason - Reason for emergency cancellation
   * 
   * @returns {Promise<Object>} Result with emergency cancellation details
   */
  async emergencyCancel(userId, requestingUserId, emergencyReason) {
    // Validate admin permissions for emergency operations
    if (this.userRepository) {
      const requestingUser = await this.userRepository.findById(requestingUserId);
      if (!requestingUser || requestingUser.role !== 'admin') {
        return {
          success: false,
          error: 'Emergency cancellation requires admin permissions',
          details: { field: 'permissions', message: 'Only administrators can perform emergency cancellations' }
        };
      }
    }

    const criteria = {
      userId,
      cancelAll: true
      // No status filter - cancel everything
    };

    const options = {
      forceCancel: true,
      reason: emergencyReason || 'Emergency cancellation',
      confirmed: true
    };

    return this.executeBulk(criteria, requestingUserId, options);
  }

  /**
   * Private: Validates cancellation permissions
   */
  async _validateCancellationPermissions(scheduledTask, requestingUserId, options) {
    // Basic ownership check
    if (scheduledTask.userId !== requestingUserId) {
      // Check if requesting user is admin
      if (this.userRepository) {
        const requestingUser = await this.userRepository.findById(requestingUserId);
        if (!requestingUser || requestingUser.role !== 'admin') {
          return {
            success: false,
            error: 'Insufficient permissions',
            details: { field: 'permissions', message: 'Only the schedule owner or admin can cancel schedules' }
          };
        }
      } else {
        return {
          success: false,
          error: 'Insufficient permissions',
          details: { field: 'permissions', message: 'Only the schedule owner can cancel schedules' }
        };
      }
    }

    // Check for admin-only operations
    if (options.forceCancel && this.userRepository) {
      const requestingUser = await this.userRepository.findById(requestingUserId);
      if (!requestingUser || requestingUser.role !== 'admin') {
        return {
          success: false,
          error: 'Admin permissions required',
          details: { field: 'permissions', message: 'Force cancellation requires administrator privileges' }
        };
      }
    }

    return { success: true };
  }

  /**
   * Private: Validates bulk cancellation permissions
   */
  async _validateBulkCancellationPermissions(criteria, requestingUserId) {
    // Only allow bulk cancellation for own schedules or by admin
    if (criteria.userId !== requestingUserId && this.userRepository) {
      const requestingUser = await this.userRepository.findById(requestingUserId);
      if (!requestingUser || requestingUser.role !== 'admin') {
        return {
          success: false,
          error: 'Insufficient permissions for bulk cancellation',
          details: { field: 'permissions', message: 'Only administrators can bulk cancel other users\' schedules' }
        };
      }
    }

    return { success: true };
  }

  /**
   * Private: Checks if a task status allows cancellation
   */
  _canCancelTaskStatus(status) {
    return [
      ScheduledTask.STATUS.PENDING,
      ScheduledTask.STATUS.ACTIVE
    ].includes(status);
  }

  /**
   * Private: Creates audit log for cancellation
   */
  async _createCancellationAuditLog(cancelledTask, originalStatus, reason, requestingUserId) {
    const eventLog = EventLog.createCustomEvent(
      'SCHEDULE_CANCELLED',
      `Cancelled scheduled task: ${reason}`,
      requestingUserId,
      {
        scheduleId: cancelledTask.id,
        originalStatus: originalStatus,
        cancellationReason: reason,
        description: cancelledTask.getDescription(),
        originalNextExecution: cancelledTask.nextExecutionTime
      }
    );

    await this.eventLogRepository.save(eventLog);
  }

  /**
   * Private: Analyzes the impact of cancellation
   */
  async _analyzeImpact(cancelledTask) {
    const impact = {
      affectedZones: [],
      systemWideImpact: false,
      missedExecutions: 0,
      nextScheduledAction: null
    };

    // Determine affected zones
    if (cancelledTask.actionParameters.zoneIds && cancelledTask.actionParameters.zoneIds.length > 0) {
      impact.affectedZones = cancelledTask.actionParameters.zoneIds;
    } else {
      impact.systemWideImpact = true;
    }

    // Calculate missed executions (next 30 days)
    if (cancelledTask.nextExecutionTime) {
      const upcomingExecutions = cancelledTask.getUpcomingExecutions(30);
      impact.missedExecutions = upcomingExecutions.length;
    }

    // Find next scheduled action of same type for same user
    try {
      const userSchedules = await this.scheduledTaskRepository.findByUserIdAndStatus(
        cancelledTask.userId, 
        ScheduledTask.STATUS.ACTIVE
      );
      
      const sameTypeSchedules = userSchedules.filter(s => 
        s.actionType === cancelledTask.actionType &&
        s.id !== cancelledTask.id &&
        s.nextExecutionTime
      );

      if (sameTypeSchedules.length > 0) {
        const nextSchedule = sameTypeSchedules.sort((a, b) => 
          a.nextExecutionTime - b.nextExecutionTime
        )[0];
        
        impact.nextScheduledAction = {
          scheduleId: nextSchedule.id,
          executionTime: nextSchedule.nextExecutionTime,
          description: nextSchedule.getDescription()
        };
      }
    } catch (error) {
      // Impact analysis is non-critical, so continue if it fails
      console.warn('Impact analysis failed:', error.message);
    }

    return impact;
  }

  /**
   * Private: Finds tasks by criteria for bulk operations
   */
  async _findTasksByCriteria(criteria) {
    let tasks = [];

    // Get base task list by user
    if (criteria.cancelAll) {
      tasks = await this.scheduledTaskRepository.findByUserId(criteria.userId);
    } else if (criteria.scheduleIds && Array.isArray(criteria.scheduleIds)) {
      // Get specific schedules by ID
      for (const scheduleId of criteria.scheduleIds) {
        try {
          const task = await this.scheduledTaskRepository.findById(scheduleId);
          if (task && task.userId === criteria.userId) {
            tasks.push(task);
          }
        } catch (error) {
          // Skip invalid IDs
          continue;
        }
      }
    } else {
      tasks = await this.scheduledTaskRepository.findByUserId(criteria.userId);
    }

    // Apply status filter
    if (criteria.status) {
      if (Array.isArray(criteria.status)) {
        tasks = tasks.filter(task => criteria.status.includes(task.status));
      } else {
        tasks = tasks.filter(task => task.status === criteria.status);
      }
    }

    // Apply action type filter
    if (criteria.actionType) {
      tasks = tasks.filter(task => task.actionType === criteria.actionType);
    }

    // Apply days filter
    if (criteria.days && Array.isArray(criteria.days)) {
      tasks = tasks.filter(task => {
        const taskDays = task.scheduleExpression.days.map(day => day.value);
        return criteria.days.some(day => taskDays.includes(day));
      });
    }

    // Only return tasks that can be cancelled (unless force cancellation is enabled)
    if (!criteria.forceCancel) {
      tasks = tasks.filter(task => this._canCancelTaskStatus(task.status));
    }

    return tasks;
  }
}

module.exports = CancelScheduledTaskUseCase;