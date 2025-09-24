const ScheduledTask = require('../../domain/entities/ScheduledTask');
const EventLog = require('../../domain/entities/EventLog');

/**
 * UpdateScheduledTaskUseCase
 * 
 * Orchestrates the modification of existing scheduled tasks with proper validation,
 * permission checks, and event publishing. Handles schedule expression updates,
 * action parameter changes, and status transitions while maintaining data integrity.
 */
class UpdateScheduledTaskUseCase {
  constructor(
    scheduledTaskRepository,
    scheduleValidator,
    eventLogRepository,
    eventBus,
    userRepository = null
  ) {
    this.scheduledTaskRepository = scheduledTaskRepository;
    this.scheduleValidator = scheduleValidator;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
    this.userRepository = userRepository;
  }

  /**
   * Updates an existing scheduled task
   * 
   * @param {string} scheduleId - ID of the schedule to update
   * @param {Object} updates - Update data
   * @param {ScheduleExpression} updates.scheduleExpression - New schedule expression
   * @param {Object} updates.actionParameters - New action parameters
   * @param {string} updates.status - New status (if changing)
   * @param {string} requestingUserId - User making the request
   * @param {Object} options - Update options
   * @param {boolean} options.skipValidation - Skip business rule validation (admin only)
   * @param {boolean} options.forceUpdate - Allow updates to completed/failed tasks (admin only)
   * 
   * @returns {Promise<Object>} Result with success status and updated schedule details
   */
  async execute(scheduleId, updates = {}, requestingUserId, options = {}) {
    try {
      // Validate required parameters
      if (!scheduleId) {
        return {
          success: false,
          error: 'Schedule ID is required',
          details: { field: 'scheduleId', message: 'Must provide schedule ID to update' }
        };
      }

      if (!requestingUserId) {
        return {
          success: false,
          error: 'User ID is required',
          details: { field: 'requestingUserId', message: 'Must specify the requesting user' }
        };
      }

      if (!updates || Object.keys(updates).length === 0) {
        return {
          success: false,
          error: 'Updates are required',
          details: { field: 'updates', message: 'Must provide at least one field to update' }
        };
      }

      // Find the existing scheduled task
      const existingTask = await this.scheduledTaskRepository.findById(scheduleId);
      if (!existingTask) {
        return {
          success: false,
          error: 'Scheduled task not found',
          details: { field: 'scheduleId', message: `No schedule found with ID: ${scheduleId}` }
        };
      }

      // Validate user permissions
      const permissionCheck = await this._validateUpdatePermissions(existingTask, requestingUserId, options);
      if (!permissionCheck.success) {
        return permissionCheck;
      }

      // Check if task can be updated based on its current status
      if (!options.forceUpdate && !this._canUpdateTaskStatus(existingTask.status)) {
        return {
          success: false,
          error: 'Cannot update task in current status',
          details: { 
            field: 'status', 
            message: `Tasks with status ${existingTask.status} cannot be updated`,
            currentStatus: existingTask.status
          }
        };
      }

      // Validate individual update fields
      const fieldValidation = this._validateUpdateFields(updates, existingTask);
      if (!fieldValidation.success) {
        return fieldValidation;
      }

      // Perform business rule validation if updating schedule expression
      if (updates.scheduleExpression && !options.skipValidation) {
        const validationResult = await this._validateScheduleUpdate(existingTask, updates.scheduleExpression);
        if (!validationResult.success) {
          return validationResult;
        }
      }

      // Track changes for audit logging
      const changes = this._trackChanges(existingTask, updates);

      // Apply updates to the task
      const updatedTask = await this._applyUpdates(existingTask, updates);

      // Save the updated task
      const savedTask = await this.scheduledTaskRepository.save(updatedTask);

      // Create audit log entry
      await this._createAuditLog(savedTask, changes, requestingUserId);

      // Publish domain events if needed
      await this._publishUpdateEvents(savedTask, changes);

      // Prepare response
      const responseData = {
        schedule: savedTask.toJSON(),
        changes: changes,
        nextExecution: savedTask.nextExecutionTime,
        description: savedTask.getDescription()
      };

      // Include upcoming executions if task is still active
      if (savedTask.status === ScheduledTask.STATUS.ACTIVE) {
        responseData.upcomingExecutions = savedTask.getUpcomingExecutions(7);
      }

      return {
        success: true,
        message: 'Schedule updated successfully',
        data: responseData
      };

    } catch (error) {
      console.error('UpdateScheduledTaskUseCase error:', error);
      
      return {
        success: false,
        error: 'An unexpected error occurred while updating the scheduled task',
        details: { 
          field: 'system', 
          message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        }
      };
    }
  }

  /**
   * Updates multiple scheduled tasks by criteria
   * 
   * @param {Object} criteria - Selection criteria
   * @param {string} criteria.userId - User ID (required)
   * @param {string} criteria.actionType - Action type filter
   * @param {string} criteria.status - Status filter
   * @param {Array<string>} criteria.days - Days filter for schedule expression
   * @param {Object} updates - Updates to apply
   * @param {string} requestingUserId - User making the request
   * @param {Object} options - Bulk update options
   * 
   * @returns {Promise<Object>} Result with update statistics
   */
  async executeBulk(criteria, updates, requestingUserId, options = {}) {
    try {
      // Validate criteria
      if (!criteria.userId) {
        return {
          success: false,
          error: 'User ID is required in criteria',
          details: { field: 'criteria.userId', message: 'Must specify user ID for bulk updates' }
        };
      }

      // Validate permissions for bulk updates
      const permissionCheck = await this._validateBulkUpdatePermissions(criteria, requestingUserId);
      if (!permissionCheck.success) {
        return permissionCheck;
      }

      // Find tasks matching criteria
      const matchingTasks = await this._findTasksByCriteria(criteria);

      if (matchingTasks.length === 0) {
        return {
          success: true,
          message: 'No matching schedules found to update',
          data: {
            totalFound: 0,
            updated: 0,
            failed: 0,
            errors: []
          }
        };
      }

      // Apply updates to each matching task
      const results = {
        totalFound: matchingTasks.length,
        updated: 0,
        failed: 0,
        errors: [],
        updatedSchedules: []
      };

      for (const task of matchingTasks) {
        try {
          const updateResult = await this.execute(task.id, updates, requestingUserId, options);
          
          if (updateResult.success) {
            results.updated++;
            results.updatedSchedules.push({
              id: task.id,
              description: updateResult.data.description,
              changes: updateResult.data.changes
            });
          } else {
            results.failed++;
            results.errors.push({
              scheduleId: task.id,
              error: updateResult.error,
              details: updateResult.details
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            scheduleId: task.id,
            error: 'Update failed',
            details: { message: error.message }
          });
        }
      }

      return {
        success: results.failed === 0,
        message: `Updated ${results.updated} of ${results.totalFound} schedules`,
        data: results
      };

    } catch (error) {
      return {
        success: false,
        error: 'Bulk update operation failed',
        details: { field: 'system', message: error.message }
      };
    }
  }

  /**
   * Reschedules a task to a new time
   * 
   * @param {string} scheduleId - Schedule ID
   * @param {ScheduleExpression} newScheduleExpression - New schedule expression
   * @param {string} requestingUserId - User making the request
   * 
   * @returns {Promise<Object>} Result with rescheduling details
   */
  async reschedule(scheduleId, newScheduleExpression, requestingUserId) {
    return this.execute(
      scheduleId, 
      { scheduleExpression: newScheduleExpression }, 
      requestingUserId,
      { skipValidation: false }
    );
  }

  /**
   * Changes the action parameters of a scheduled task
   * 
   * @param {string} scheduleId - Schedule ID
   * @param {Object} newActionParameters - New action parameters
   * @param {string} requestingUserId - User making the request
   * 
   * @returns {Promise<Object>} Result with parameter update details
   */
  async updateActionParameters(scheduleId, newActionParameters, requestingUserId) {
    return this.execute(
      scheduleId, 
      { actionParameters: newActionParameters }, 
      requestingUserId
    );
  }

  /**
   * Activates a pending scheduled task
   * 
   * @param {string} scheduleId - Schedule ID
   * @param {string} requestingUserId - User making the request
   * 
   * @returns {Promise<Object>} Result with activation details
   */
  async activate(scheduleId, requestingUserId) {
    try {
      const existingTask = await this.scheduledTaskRepository.findById(scheduleId);
      if (!existingTask) {
        return {
          success: false,
          error: 'Scheduled task not found'
        };
      }

      // Use the domain method to activate
      existingTask.activate();
      
      return this.execute(
        scheduleId, 
        { status: ScheduledTask.STATUS.ACTIVE }, 
        requestingUserId
      );

    } catch (error) {
      return {
        success: false,
        error: 'Failed to activate schedule',
        details: { field: 'activation', message: error.message }
      };
    }
  }

  /**
   * Private: Validates update permissions
   */
  async _validateUpdatePermissions(existingTask, requestingUserId, options) {
    // Basic ownership check
    if (existingTask.userId !== requestingUserId) {
      // Check if requesting user is admin
      if (this.userRepository) {
        const requestingUser = await this.userRepository.findById(requestingUserId);
        if (!requestingUser || requestingUser.role !== 'admin') {
          return {
            success: false,
            error: 'Insufficient permissions',
            details: { field: 'permissions', message: 'Only the schedule owner or admin can update schedules' }
          };
        }
      } else {
        return {
          success: false,
          error: 'Insufficient permissions',
          details: { field: 'permissions', message: 'Only the schedule owner can update schedules' }
        };
      }
    }

    // Check for admin-only operations
    if ((options.skipValidation || options.forceUpdate) && this.userRepository) {
      const requestingUser = await this.userRepository.findById(requestingUserId);
      if (!requestingUser || requestingUser.role !== 'admin') {
        return {
          success: false,
          error: 'Admin permissions required',
          details: { field: 'permissions', message: 'Admin permissions required for advanced update options' }
        };
      }
    }

    return { success: true };
  }

  /**
   * Private: Validates bulk update permissions
   */
  async _validateBulkUpdatePermissions(criteria, requestingUserId) {
    // Only allow bulk updates for own schedules or by admin
    if (criteria.userId !== requestingUserId && this.userRepository) {
      const requestingUser = await this.userRepository.findById(requestingUserId);
      if (!requestingUser || requestingUser.role !== 'admin') {
        return {
          success: false,
          error: 'Insufficient permissions for bulk update',
          details: { field: 'permissions', message: 'Only administrators can bulk update other users\' schedules' }
        };
      }
    }

    return { success: true };
  }

  /**
   * Private: Checks if a task status allows updates
   */
  _canUpdateTaskStatus(status) {
    return [
      ScheduledTask.STATUS.PENDING,
      ScheduledTask.STATUS.ACTIVE
    ].includes(status);
  }

  /**
   * Private: Validates update fields
   */
  _validateUpdateFields(updates, existingTask) {
    // Validate schedule expression if provided
    if (updates.scheduleExpression) {
      try {
        if (typeof updates.scheduleExpression.isValid === 'function' && 
            !updates.scheduleExpression.isValid()) {
          return {
            success: false,
            error: 'Invalid schedule expression',
            details: { field: 'scheduleExpression', message: 'The provided schedule expression is not valid' }
          };
        }
      } catch (error) {
        return {
          success: false,
          error: 'Invalid schedule expression format',
          details: { field: 'scheduleExpression', message: error.message }
        };
      }
    }

    // Validate action parameters if provided
    if (updates.actionParameters) {
      try {
        // Use the existing task's validation method
        const tempTask = new ScheduledTask(
          existingTask.id,
          existingTask.userId,
          existingTask.scheduleExpression,
          existingTask.actionType,
          updates.actionParameters
        );
      } catch (error) {
        return {
          success: false,
          error: 'Invalid action parameters',
          details: { field: 'actionParameters', message: error.message }
        };
      }
    }

    // Validate status if provided
    if (updates.status && !Object.values(ScheduledTask.STATUS).includes(updates.status)) {
      return {
        success: false,
        error: 'Invalid status',
        details: { 
          field: 'status', 
          message: 'Status must be one of: ' + Object.values(ScheduledTask.STATUS).join(', ') 
        }
      };
    }

    return { success: true };
  }

  /**
   * Private: Validates schedule expression updates
   */
  async _validateScheduleUpdate(existingTask, newScheduleExpression) {
    try {
      const existingSchedules = await this.scheduledTaskRepository.findByUserId(existingTask.userId);
      const otherSchedules = existingSchedules.filter(s => s.id !== existingTask.id);
      
      const validationResult = await this.scheduleValidator.validateScheduleUpdate(
        existingTask, 
        newScheduleExpression, 
        otherSchedules
      );
      
      if (!validationResult.isValid) {
        return {
          success: false,
          error: 'Schedule update validation failed',
          details: {
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            suggestions: this.scheduleValidator.getSuggestions(validationResult)
          }
        };
      }

      return { success: true, warnings: validationResult.warnings };

    } catch (error) {
      return {
        success: false,
        error: 'Validation error',
        details: { field: 'validation', message: error.message }
      };
    }
  }

  /**
   * Private: Tracks changes for audit purposes
   */
  _trackChanges(existingTask, updates) {
    const changes = {};

    if (updates.scheduleExpression && 
        JSON.stringify(updates.scheduleExpression.toJSON()) !== JSON.stringify(existingTask.scheduleExpression.toJSON())) {
      changes.scheduleExpression = {
        from: existingTask.scheduleExpression.toJSON(),
        to: updates.scheduleExpression.toJSON()
      };
    }

    if (updates.actionParameters && 
        JSON.stringify(updates.actionParameters) !== JSON.stringify(existingTask.actionParameters)) {
      changes.actionParameters = {
        from: existingTask.actionParameters,
        to: updates.actionParameters
      };
    }

    if (updates.status && updates.status !== existingTask.status) {
      changes.status = {
        from: existingTask.status,
        to: updates.status
      };
    }

    return changes;
  }

  /**
   * Private: Applies updates to the task entity
   */
  async _applyUpdates(existingTask, updates) {
    const updatedTask = existingTask;

    // Update schedule expression
    if (updates.scheduleExpression) {
      updatedTask.updateSchedule(updates.scheduleExpression);
    }

    // Update action parameters
    if (updates.actionParameters) {
      updatedTask.updateActionParameters(updates.actionParameters);
    }

    // Update status (with proper state transitions)
    if (updates.status) {
      switch (updates.status) {
        case ScheduledTask.STATUS.ACTIVE:
          if (existingTask.status === ScheduledTask.STATUS.PENDING) {
            updatedTask.activate();
          }
          break;
        case ScheduledTask.STATUS.CANCELLED:
          updatedTask.cancel('Updated via API');
          break;
        // Other status transitions would be handled here
      }
    }

    return updatedTask;
  }

  /**
   * Private: Creates audit log entry
   */
  async _createAuditLog(updatedTask, changes, requestingUserId) {
    const changeDescriptions = Object.keys(changes).map(field => {
      switch (field) {
        case 'scheduleExpression':
          return `Updated schedule timing`;
        case 'actionParameters':
          return `Updated action parameters`;
        case 'status':
          return `Changed status from ${changes[field].from} to ${changes[field].to}`;
        default:
          return `Updated ${field}`;
      }
    }).join(', ');

    const eventLog = EventLog.createCustomEvent(
      'SCHEDULE_UPDATED',
      `Updated scheduled task: ${changeDescriptions}`,
      requestingUserId,
      {
        scheduleId: updatedTask.id,
        changes: changes,
        nextExecutionTime: updatedTask.nextExecutionTime,
        description: updatedTask.getDescription()
      }
    );

    await this.eventLogRepository.save(eventLog);
  }

  /**
   * Private: Publishes domain events for updates
   */
  async _publishUpdateEvents(updatedTask, changes) {
    // Could publish different events based on what changed
    // For now, publish a generic update event
    
    // This would require creating a ScheduleUpdated domain event
    // Similar to ScheduleCreated but with change information
  }

  /**
   * Private: Finds tasks by criteria for bulk operations
   */
  async _findTasksByCriteria(criteria) {
    let tasks = await this.scheduledTaskRepository.findByUserId(criteria.userId);

    // Apply additional filters
    if (criteria.actionType) {
      tasks = tasks.filter(task => task.actionType === criteria.actionType);
    }

    if (criteria.status) {
      tasks = tasks.filter(task => task.status === criteria.status);
    }

    if (criteria.days && Array.isArray(criteria.days)) {
      tasks = tasks.filter(task => {
        const taskDays = task.scheduleExpression.days.map(day => day.value);
        return criteria.days.some(day => taskDays.includes(day));
      });
    }

    return tasks;
  }
}

module.exports = UpdateScheduledTaskUseCase;