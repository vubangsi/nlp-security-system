const ScheduledTask = require('../../domain/entities/ScheduledTask');
const ScheduleCreated = require('../../domain/events/ScheduleCreated');
const EventLog = require('../../domain/entities/EventLog');
const { v4: uuidv4 } = require('uuid');

/**
 * CreateScheduledTaskUseCase
 * 
 * Orchestrates the creation of new scheduled tasks with proper validation,
 * permission checks, and event publishing. Coordinates between domain services
 * and infrastructure components while maintaining clean architectural boundaries.
 */
class CreateScheduledTaskUseCase {
  constructor(
    scheduledTaskRepository,
    scheduleValidator,
    eventLogRepository,
    eventBus,
    userRepository = null // Optional for permission validation
  ) {
    this.scheduledTaskRepository = scheduledTaskRepository;
    this.scheduleValidator = scheduleValidator;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
    this.userRepository = userRepository;
  }

  /**
   * Creates a new scheduled task
   * 
   * @param {Object} params - Schedule creation parameters
   * @param {ScheduleExpression} params.scheduleExpression - When to execute
   * @param {string} params.actionType - Type of action (ARM_SYSTEM, DISARM_SYSTEM)
   * @param {Object} params.actionParameters - Action-specific parameters
   * @param {string} params.userId - User creating the schedule
   * @param {Object} options - Additional options
   * @param {boolean} options.skipValidation - Skip business rule validation (admin only)
   * @param {boolean} options.autoActivate - Automatically activate the schedule (default: true)
   * 
   * @returns {Promise<Object>} Result with success status and schedule details
   */
  async execute({ scheduleExpression, actionType, actionParameters = {}, userId }, options = {}) {
    try {
      // Validate required parameters
      if (!scheduleExpression) {
        return {
          success: false,
          error: 'Schedule expression is required',
          details: { field: 'scheduleExpression', message: 'Must provide schedule expression' }
        };
      }

      if (!actionType) {
        return {
          success: false,
          error: 'Action type is required',
          details: { field: 'actionType', message: 'Must specify ARM_SYSTEM or DISARM_SYSTEM' }
        };
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required',
          details: { field: 'userId', message: 'Must specify the user creating the schedule' }
        };
      }

      // Validate user permissions if userRepository is available
      if (this.userRepository) {
        const hasPermission = await this._validateUserPermissions(userId, actionType, actionParameters);
        if (!hasPermission.success) {
          return {
            success: false,
            error: hasPermission.error,
            details: { field: 'permissions', message: hasPermission.message }
          };
        }
      }

      // Generate unique ID for the scheduled task
      const taskId = uuidv4();

      // Create scheduled task entity using factory methods
      let scheduledTask;
      try {
        if (actionType === ScheduledTask.ACTION_TYPE.ARM_SYSTEM) {
          const mode = actionParameters.mode || 'away';
          const zoneIds = actionParameters.zoneIds || [];
          scheduledTask = ScheduledTask.createArmSystemTask(taskId, userId, scheduleExpression, mode, zoneIds);
        } else if (actionType === ScheduledTask.ACTION_TYPE.DISARM_SYSTEM) {
          const zoneIds = actionParameters.zoneIds || [];
          scheduledTask = ScheduledTask.createDisarmSystemTask(taskId, userId, scheduleExpression, zoneIds);
        } else {
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
      } catch (error) {
        return {
          success: false,
          error: 'Failed to create scheduled task',
          details: { field: 'validation', message: error.message }
        };
      }

      // Validate business rules using domain service
      if (!options.skipValidation) {
        const existingSchedules = await this.scheduledTaskRepository.findByUserId(userId);
        const validationResult = await this.scheduleValidator.validateNewSchedule(scheduledTask, existingSchedules);
        
        if (!validationResult.isValid) {
          return {
            success: false,
            error: 'Schedule validation failed',
            details: {
              errors: validationResult.errors,
              warnings: validationResult.warnings,
              suggestions: this.scheduleValidator.getSuggestions(validationResult)
            }
          };
        }

        // Include warnings in success response if any
        if (validationResult.warnings.length > 0) {
          // Store warnings for inclusion in final response
          scheduledTask._validationWarnings = validationResult.warnings;
        }
      }

      // Auto-activate the schedule unless explicitly disabled
      if (options.autoActivate !== false) {
        scheduledTask.activate();
      }

      // Save to repository
      const savedTask = await this.scheduledTaskRepository.save(scheduledTask);

      // Create and save audit event log
      const eventLog = EventLog.createCustomEvent(
        'SCHEDULE_CREATED',
        `Created scheduled ${actionType.toLowerCase().replace('_', ' ')} task`,
        userId,
        {
          scheduleId: savedTask.id,
          actionType: savedTask.actionType,
          actionParameters: savedTask.actionParameters,
          scheduleExpression: savedTask.scheduleExpression.toJSON(),
          nextExecutionTime: savedTask.nextExecutionTime,
          description: savedTask.getDescription()
        }
      );
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new ScheduleCreated(savedTask);
      this.eventBus.publish(domainEvent);

      // Prepare success response
      const responseData = {
        schedule: savedTask.toJSON(),
        scheduleId: savedTask.id,
        nextExecution: savedTask.nextExecutionTime,
        description: savedTask.getDescription(),
        upcomingExecutions: savedTask.getUpcomingExecutions(7) // Next 7 days
      };

      // Include warnings if any
      if (scheduledTask._validationWarnings && scheduledTask._validationWarnings.length > 0) {
        responseData.warnings = scheduledTask._validationWarnings;
      }

      return {
        success: true,
        message: `Successfully created scheduled ${actionType.toLowerCase().replace('_', ' ')} task`,
        data: responseData
      };

    } catch (error) {
      // Handle unexpected errors
      console.error('CreateScheduledTaskUseCase error:', error);
      
      return {
        success: false,
        error: 'An unexpected error occurred while creating the scheduled task',
        details: { 
          field: 'system', 
          message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        }
      };
    }
  }

  /**
   * Creates multiple scheduled tasks in a batch operation
   * 
   * @param {Array} scheduleRequests - Array of schedule creation parameters
   * @param {string} userId - User creating the schedules
   * @param {Object} options - Batch operation options
   * 
   * @returns {Promise<Object>} Result with success counts and details
   */
  async executeBatch(scheduleRequests, userId, options = {}) {
    if (!Array.isArray(scheduleRequests) || scheduleRequests.length === 0) {
      return {
        success: false,
        error: 'Schedule requests array is required and cannot be empty',
        details: { field: 'scheduleRequests', message: 'Must provide array of schedule requests' }
      };
    }

    const results = {
      success: true,
      totalRequested: scheduleRequests.length,
      successful: 0,
      failed: 0,
      schedules: [],
      errors: []
    };

    for (let i = 0; i < scheduleRequests.length; i++) {
      const request = scheduleRequests[i];
      const result = await this.execute({ ...request, userId }, options);
      
      if (result.success) {
        results.successful++;
        results.schedules.push(result.data.schedule);
      } else {
        results.failed++;
        results.errors.push({
          index: i,
          request: request,
          error: result.error,
          details: result.details
        });
      }
    }

    // Update overall success status
    results.success = results.failed === 0;
    results.message = results.success 
      ? `Successfully created ${results.successful} scheduled tasks`
      : `Created ${results.successful} tasks, ${results.failed} failed`;

    return results;
  }

  /**
   * Creates a scheduled task with template validation
   * 
   * @param {string} templateType - Type of schedule template
   * @param {Object} templateParams - Template-specific parameters
   * @param {string} userId - User creating the schedule
   * 
   * @returns {Promise<Object>} Result with success status and schedule details
   */
  async executeFromTemplate(templateType, templateParams, userId) {
    try {
      // Convert template to schedule parameters
      const scheduleParams = await this._convertTemplateToSchedule(templateType, templateParams, userId);
      
      if (!scheduleParams.success) {
        return scheduleParams; // Return error from template conversion
      }

      // Create the schedule using converted parameters
      return await this.execute(scheduleParams.data, { autoActivate: true });

    } catch (error) {
      return {
        success: false,
        error: 'Failed to create schedule from template',
        details: { field: 'template', message: error.message }
      };
    }
  }

  /**
   * Private: Validates user permissions for the specified action
   */
  async _validateUserPermissions(userId, actionType, actionParameters) {
    try {
      // Basic existence check
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          message: 'The specified user does not exist'
        };
      }

      // Check if user has scheduling permissions
      // This could be expanded with role-based permissions
      if (user.permissions && !user.permissions.includes('CREATE_SCHEDULES')) {
        return {
          success: false,
          error: 'Insufficient permissions',
          message: 'User does not have permission to create schedules'
        };
      }

      // System-wide actions might require admin permissions
      if ((!actionParameters.zoneIds || actionParameters.zoneIds.length === 0) && 
          user.role !== 'admin') {
        return {
          success: false,
          error: 'Admin permissions required',
          message: 'System-wide scheduling requires administrator privileges'
        };
      }

      // Zone-specific permissions could be validated here
      if (actionParameters.zoneIds && actionParameters.zoneIds.length > 0) {
        // Could check if user has access to specified zones
        // For now, assuming all users can access all zones they can see
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: 'Permission validation failed',
        message: error.message
      };
    }
  }

  /**
   * Private: Converts template configuration to schedule parameters
   */
  async _convertTemplateToSchedule(templateType, templateParams, userId) {
    // This would implement common schedule templates like:
    // - 'daily_arm': Arm system every day at specified time
    // - 'weekdays_only': Arm/disarm on weekdays only
    // - 'weekend_mode': Different schedule for weekends
    // - 'vacation_mode': Extended away mode
    
    // For now, return error as templates are not implemented
    return {
      success: false,
      error: 'Schedule templates not yet implemented',
      details: { 
        field: 'templateType', 
        message: `Template type '${templateType}' is not supported`,
        supportedTemplates: [] // Would list available templates
      }
    };
  }

  /**
   * Gets quota information for a user
   */
  async getUserScheduleQuota(userId) {
    try {
      const existingSchedules = await this.scheduledTaskRepository.findByUserId(userId);
      const activeSchedules = existingSchedules.filter(s => s.status === ScheduledTask.STATUS.ACTIVE);
      
      // Get max quota from validator options
      const maxQuota = this.scheduleValidator.options.maxSchedulesPerUser;
      
      return {
        success: true,
        data: {
          used: activeSchedules.length,
          total: maxQuota,
          remaining: maxQuota - activeSchedules.length,
          percentUsed: Math.round((activeSchedules.length / maxQuota) * 100)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get user quota information',
        details: { field: 'quota', message: error.message }
      };
    }
  }
}

module.exports = CreateScheduledTaskUseCase;