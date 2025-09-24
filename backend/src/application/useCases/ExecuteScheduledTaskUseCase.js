const ScheduledTask = require('../../domain/entities/ScheduledTask');
const ScheduleExecuted = require('../../domain/events/ScheduleExecuted');
const ScheduleFailed = require('../../domain/events/ScheduleFailed');
const EventLog = require('../../domain/entities/EventLog');

/**
 * ExecuteScheduledTaskUseCase
 * 
 * Orchestrates the execution of scheduled tasks by coordinating with the appropriate
 * system action use cases (ArmSystemUseCase, DisarmSystemUseCase). Handles execution
 * results, retry logic, error handling, and proper state transitions with comprehensive
 * audit logging and event publishing.
 */
class ExecuteScheduledTaskUseCase {
  constructor(
    scheduledTaskRepository,
    armSystemUseCase,
    disarmSystemUseCase,
    eventLogRepository,
    eventBus,
    systemStateRepository = null // Optional for pre-execution validation
  ) {
    this.scheduledTaskRepository = scheduledTaskRepository;
    this.armSystemUseCase = armSystemUseCase;
    this.disarmSystemUseCase = disarmSystemUseCase;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
    this.systemStateRepository = systemStateRepository;
  }

  /**
   * Executes a specific scheduled task
   * 
   * @param {string} scheduleId - ID of the schedule to execute
   * @param {Object} options - Execution options
   * @param {Date} options.executionTime - Time of execution (defaults to now)
   * @param {boolean} options.dryRun - Simulate execution without making changes
   * @param {boolean} options.ignoreOverdue - Execute even if overdue beyond tolerance
   * @param {number} options.maxRetries - Maximum retry attempts for failures (default: 3)
   * 
   * @returns {Promise<Object>} Result with execution details and outcomes
   */
  async execute(scheduleId, options = {}) {
    const executionTime = options.executionTime || new Date();
    const startTime = Date.now();

    try {
      // Validate required parameters
      if (!scheduleId) {
        return {
          success: false,
          error: 'Schedule ID is required',
          details: { field: 'scheduleId', message: 'Must provide schedule ID to execute' }
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

      // Validate task is ready for execution
      const readinessCheck = this._validateExecutionReadiness(scheduledTask, executionTime, options);
      if (!readinessCheck.success) {
        return readinessCheck;
      }

      // Pre-execution validation and system state checks
      const preExecutionCheck = await this._performPreExecutionChecks(scheduledTask, executionTime);
      if (!preExecutionCheck.success && !options.ignorePreChecks) {
        return preExecutionCheck;
      }

      let executionResult;
      let systemActionResult;

      if (options.dryRun) {
        // Simulate execution
        executionResult = await this._simulateExecution(scheduledTask, executionTime);
      } else {
        // Execute the actual system action
        systemActionResult = await this._executeSystemAction(scheduledTask, executionTime);
        executionResult = this._processExecutionResult(systemActionResult, scheduledTask, executionTime);
      }

      // Handle execution outcome
      if (executionResult.success) {
        await this._handleSuccessfulExecution(scheduledTask, executionResult, executionTime);
      } else {
        await this._handleFailedExecution(scheduledTask, executionResult, executionTime, options);
      }

      // Calculate execution duration
      const executionDuration = Date.now() - startTime;
      executionResult.duration = executionDuration;

      // Create comprehensive audit log
      await this._createExecutionAuditLog(scheduledTask, executionResult, executionTime);

      // Publish appropriate domain event
      await this._publishExecutionEvent(scheduledTask, executionResult, executionTime);

      // Prepare response
      const responseData = {
        schedule: scheduledTask.toJSON(),
        executionResult,
        executionTime,
        duration: executionDuration,
        nextExecution: scheduledTask.nextExecutionTime,
        wasOverdue: scheduledTask.isOverdue(executionTime),
        warnings: preExecutionCheck.warnings || []
      };

      return {
        success: executionResult.success,
        message: executionResult.success ? 
          `Successfully executed scheduled ${scheduledTask.actionType.toLowerCase().replace('_', ' ')} task` :
          `Failed to execute scheduled task: ${executionResult.error}`,
        data: responseData
      };

    } catch (error) {
      console.error('ExecuteScheduledTaskUseCase error:', error);
      
      return {
        success: false,
        error: 'An unexpected error occurred during scheduled task execution',
        details: { 
          field: 'system', 
          message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        }
      };
    }
  }

  /**
   * Executes all scheduled tasks that are due for execution
   * 
   * @param {Object} options - Batch execution options
   * @param {Date} options.executionTime - Time to use for execution (defaults to now)
   * @param {number} options.toleranceMinutes - Minutes past due time to consider for execution
   * @param {number} options.maxTasks - Maximum number of tasks to execute in batch
   * @param {boolean} options.continueOnError - Continue executing other tasks if one fails
   * 
   * @returns {Promise<Object>} Result with batch execution statistics
   */
  async executeDueTasks(options = {}) {
    const executionTime = options.executionTime || new Date();
    const toleranceMinutes = options.toleranceMinutes || 5;
    const maxTasks = options.maxTasks || 50;
    const continueOnError = options.continueOnError !== false;

    try {
      // Find all tasks due for execution
      const dueTime = new Date(executionTime.getTime() + (toleranceMinutes * 60 * 1000));
      const dueTasks = await this.scheduledTaskRepository.findByNextExecutionTimeBefore(dueTime);

      // Filter for only active tasks and limit the number
      const executableTasks = dueTasks
        .filter(task => task.status === ScheduledTask.STATUS.ACTIVE)
        .slice(0, maxTasks);

      if (executableTasks.length === 0) {
        return {
          success: true,
          message: 'No scheduled tasks due for execution',
          data: {
            totalDue: 0,
            executed: 0,
            failed: 0,
            skipped: 0,
            results: []
          }
        };
      }

      // Execute tasks
      const batchResults = {
        totalDue: executableTasks.length,
        executed: 0,
        failed: 0,
        skipped: 0,
        results: []
      };

      for (const task of executableTasks) {
        try {
          const executionResult = await this.execute(task.id, { 
            executionTime,
            ignoreOverdue: true // Allow execution of overdue tasks in batch mode
          });

          batchResults.results.push({
            scheduleId: task.id,
            description: task.getDescription(),
            success: executionResult.success,
            message: executionResult.message,
            executionTime: executionTime,
            duration: executionResult.data?.duration
          });

          if (executionResult.success) {
            batchResults.executed++;
          } else {
            batchResults.failed++;
            
            if (!continueOnError) {
              console.log(`Stopping batch execution after failure in task ${task.id}`);
              break;
            }
          }

        } catch (error) {
          batchResults.failed++;
          batchResults.results.push({
            scheduleId: task.id,
            description: task.getDescription(),
            success: false,
            error: 'Execution exception',
            message: error.message
          });

          if (!continueOnError) {
            console.log(`Stopping batch execution after exception in task ${task.id}`);
            break;
          }
        }
      }

      // Create batch execution audit log
      await this._createBatchExecutionAuditLog(batchResults, executionTime);

      return {
        success: batchResults.failed === 0 || continueOnError,
        message: `Executed ${batchResults.executed} of ${batchResults.totalDue} due tasks`,
        data: batchResults
      };

    } catch (error) {
      console.error('ExecuteDueTasks error:', error);
      
      return {
        success: false,
        error: 'Batch execution failed',
        details: { field: 'system', message: error.message }
      };
    }
  }

  /**
   * Executes overdue scheduled tasks
   * 
   * @param {Object} options - Overdue execution options
   * @param {number} options.toleranceMinutes - Minutes past due to consider overdue
   * @param {number} options.maxOverdueHours - Maximum hours overdue to still execute
   * 
   * @returns {Promise<Object>} Result with overdue execution details
   */
  async executeOverdueTasks(options = {}) {
    const toleranceMinutes = options.toleranceMinutes || 5;
    const maxOverdueHours = options.maxOverdueHours || 24;

    try {
      const overdueTasks = await this.scheduledTaskRepository.findOverdue(toleranceMinutes);
      const executionTime = new Date();

      // Filter out tasks that are too old to execute
      const maxOverdueTime = maxOverdueHours * 60 * 60 * 1000; // Convert to milliseconds
      const executableOverdueTasks = overdueTasks.filter(task => {
        if (!task.nextExecutionTime) return false;
        const overdueMs = executionTime.getTime() - task.nextExecutionTime.getTime();
        return overdueMs <= maxOverdueTime;
      });

      return this.executeDueTasks({
        ...options,
        executionTime,
        continueOnError: true,
        maxTasks: executableOverdueTasks.length
      });

    } catch (error) {
      return {
        success: false,
        error: 'Failed to execute overdue tasks',
        details: { field: 'system', message: error.message }
      };
    }
  }

  /**
   * Private: Validates if task is ready for execution
   */
  _validateExecutionReadiness(scheduledTask, executionTime, options) {
    // Check task status
    if (scheduledTask.status !== ScheduledTask.STATUS.ACTIVE) {
      return {
        success: false,
        error: 'Task is not in active status',
        details: { 
          field: 'status', 
          message: `Cannot execute task with status: ${scheduledTask.status}`,
          currentStatus: scheduledTask.status
        }
      };
    }

    // Check if task is ready for execution
    if (!scheduledTask.isReadyForExecution(executionTime)) {
      return {
        success: false,
        error: 'Task is not ready for execution',
        details: { 
          field: 'timing', 
          message: 'Task execution time has not arrived yet',
          nextExecutionTime: scheduledTask.nextExecutionTime,
          currentTime: executionTime
        }
      };
    }

    // Check if task is too overdue (unless ignored)
    if (!options.ignoreOverdue && scheduledTask.isOverdue(executionTime, 60)) { // 1 hour tolerance
      return {
        success: false,
        error: 'Task is too overdue to execute safely',
        details: { 
          field: 'timing', 
          message: 'Task is more than 1 hour overdue',
          nextExecutionTime: scheduledTask.nextExecutionTime,
          currentTime: executionTime
        }
      };
    }

    return { success: true };
  }

  /**
   * Private: Performs pre-execution system checks
   */
  async _performPreExecutionChecks(scheduledTask, executionTime) {
    const warnings = [];

    try {
      // Check system state if repository is available
      if (this.systemStateRepository) {
        const systemState = await this.systemStateRepository.get();
        
        // Check for conflicting system states
        if (scheduledTask.actionType === ScheduledTask.ACTION_TYPE.ARM_SYSTEM && systemState.isArmed()) {
          warnings.push('System is already armed');
        } else if (scheduledTask.actionType === ScheduledTask.ACTION_TYPE.DISARM_SYSTEM && !systemState.isArmed()) {
          warnings.push('System is already disarmed');
        }
      }

      // Check for execution timing warnings
      const hour = executionTime.getHours();
      if (scheduledTask.actionType === ScheduledTask.ACTION_TYPE.ARM_SYSTEM && hour >= 6 && hour <= 22) {
        warnings.push('Arming system during typical waking hours');
      } else if (scheduledTask.actionType === ScheduledTask.ACTION_TYPE.DISARM_SYSTEM && (hour < 6 || hour > 10)) {
        warnings.push('Disarming system outside typical morning hours');
      }

      // Check if task is overdue but within tolerance
      if (scheduledTask.isOverdue(executionTime, 5)) {
        const delayMinutes = Math.floor((executionTime - scheduledTask.nextExecutionTime) / (1000 * 60));
        warnings.push(`Task is ${delayMinutes} minutes overdue`);
      }

      return { 
        success: true, 
        warnings 
      };

    } catch (error) {
      return {
        success: false,
        error: 'Pre-execution checks failed',
        details: { field: 'preChecks', message: error.message }
      };
    }
  }

  /**
   * Private: Executes the appropriate system action
   */
  async _executeSystemAction(scheduledTask, executionTime) {
    const { actionType, actionParameters, userId } = scheduledTask;

    try {
      switch (actionType) {
        case ScheduledTask.ACTION_TYPE.ARM_SYSTEM:
          const mode = actionParameters.mode || 'away';
          return await this.armSystemUseCase.execute(mode, userId);

        case ScheduledTask.ACTION_TYPE.DISARM_SYSTEM:
          return await this.disarmSystemUseCase.execute(userId);

        default:
          return {
            success: false,
            error: `Unknown action type: ${actionType}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: 'System action execution failed',
        details: error.message
      };
    }
  }

  /**
   * Private: Processes execution result from system action
   */
  _processExecutionResult(systemActionResult, scheduledTask, executionTime) {
    const baseResult = {
      scheduledTaskId: scheduledTask.id,
      actionType: scheduledTask.actionType,
      actionParameters: scheduledTask.actionParameters,
      executionTime,
      systemActionResult
    };

    if (systemActionResult.success) {
      return {
        ...baseResult,
        success: true,
        message: systemActionResult.message || 'Action executed successfully',
        systemState: systemActionResult.systemState
      };
    } else {
      return {
        ...baseResult,
        success: false,
        error: systemActionResult.error || 'System action failed',
        details: systemActionResult.details
      };
    }
  }

  /**
   * Private: Simulates execution for dry run
   */
  async _simulateExecution(scheduledTask, executionTime) {
    return {
      scheduledTaskId: scheduledTask.id,
      actionType: scheduledTask.actionType,
      actionParameters: scheduledTask.actionParameters,
      executionTime,
      success: true,
      message: 'Dry run - execution simulated successfully',
      simulatedResult: {
        action: scheduledTask.actionType,
        parameters: scheduledTask.actionParameters,
        wouldExecuteAt: executionTime
      }
    };
  }

  /**
   * Private: Handles successful execution
   */
  async _handleSuccessfulExecution(scheduledTask, executionResult, executionTime) {
    try {
      // Record successful execution on the domain entity
      scheduledTask.recordSuccessfulExecution(executionTime);
      
      // Save updated task
      await this.scheduledTaskRepository.save(scheduledTask);

    } catch (error) {
      console.error('Error handling successful execution:', error);
      // Don't fail the overall execution for audit issues
    }
  }

  /**
   * Private: Handles failed execution with retry logic
   */
  async _handleFailedExecution(scheduledTask, executionResult, executionTime, options) {
    try {
      const maxRetries = options.maxRetries || 3;
      const currentFailures = scheduledTask.failureCount;

      if (currentFailures < maxRetries) {
        // Mark execution as failed but keep task active for retry
        scheduledTask.markExecutionFailed(executionResult.error, executionTime);
        
        // Calculate next retry time (exponential backoff)
        const retryDelayMinutes = Math.pow(2, currentFailures) * 5; // 5, 10, 20 minutes
        const nextRetry = new Date(executionTime.getTime() + (retryDelayMinutes * 60 * 1000));
        scheduledTask.nextExecutionTime = nextRetry;
        
      } else {
        // Max retries reached - mark as permanently failed
        scheduledTask.markExecutionFailed(
          `Max retries (${maxRetries}) exceeded: ${executionResult.error}`, 
          executionTime
        );
      }

      // Save updated task
      await this.scheduledTaskRepository.save(scheduledTask);

    } catch (error) {
      console.error('Error handling failed execution:', error);
    }
  }

  /**
   * Private: Creates execution audit log
   */
  async _createExecutionAuditLog(scheduledTask, executionResult, executionTime) {
    try {
      const logType = executionResult.success ? 'SCHEDULE_EXECUTED_SUCCESS' : 'SCHEDULE_EXECUTED_FAILED';
      const logMessage = executionResult.success ? 
        `Successfully executed scheduled ${scheduledTask.actionType}` :
        `Failed to execute scheduled ${scheduledTask.actionType}: ${executionResult.error}`;

      const eventLog = EventLog.createCustomEvent(
        logType,
        logMessage,
        scheduledTask.userId,
        {
          scheduleId: scheduledTask.id,
          executionTime,
          executionResult: executionResult,
          nextExecutionTime: scheduledTask.nextExecutionTime,
          executionCount: scheduledTask.executionCount,
          failureCount: scheduledTask.failureCount,
          description: scheduledTask.getDescription()
        }
      );

      await this.eventLogRepository.save(eventLog);

    } catch (error) {
      console.error('Failed to create execution audit log:', error);
    }
  }

  /**
   * Private: Creates batch execution audit log
   */
  async _createBatchExecutionAuditLog(batchResults, executionTime) {
    try {
      const eventLog = EventLog.createCustomEvent(
        'BATCH_SCHEDULE_EXECUTION',
        `Batch execution: ${batchResults.executed} succeeded, ${batchResults.failed} failed`,
        'system', // System user for batch operations
        {
          executionTime,
          totalDue: batchResults.totalDue,
          executed: batchResults.executed,
          failed: batchResults.failed,
          results: batchResults.results
        }
      );

      await this.eventLogRepository.save(eventLog);

    } catch (error) {
      console.error('Failed to create batch execution audit log:', error);
    }
  }

  /**
   * Private: Publishes appropriate domain event
   */
  async _publishExecutionEvent(scheduledTask, executionResult, executionTime) {
    try {
      if (executionResult.success) {
        const successEvent = new ScheduleExecuted(scheduledTask, executionResult, executionTime);
        this.eventBus.publish(successEvent);
      } else {
        const failureEvent = new ScheduleFailed(
          scheduledTask, 
          {
            error: executionResult.error,
            details: executionResult.details,
            executionTime,
            retryCount: scheduledTask.failureCount,
            willRetry: scheduledTask.status === ScheduledTask.STATUS.ACTIVE
          }
        );
        this.eventBus.publish(failureEvent);
      }

    } catch (error) {
      console.error('Failed to publish execution event:', error);
    }
  }
}

module.exports = ExecuteScheduledTaskUseCase;