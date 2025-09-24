const ScheduleExpression = require('../valueObjects/ScheduleExpression');

/**
 * ScheduledTask Aggregate Root
 * 
 * Represents a scheduled system automation task with full business logic
 * for scheduling, execution tracking, and status management.
 */
class ScheduledTask {
  // Status enumeration
  static STATUS = {
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE', 
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED'
  };

  // Action type enumeration
  static ACTION_TYPE = {
    ARM_SYSTEM: 'ARM_SYSTEM',
    DISARM_SYSTEM: 'DISARM_SYSTEM'
  };

  constructor(id, userId, scheduleExpression, actionType, actionParameters = {}) {
    // Validate required parameters
    if (!id || typeof id !== 'string') {
      throw new Error('id must be a non-empty string');
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId must be a non-empty string');
    }

    if (!(scheduleExpression instanceof ScheduleExpression)) {
      throw new Error('scheduleExpression must be a ScheduleExpression instance');
    }

    if (!Object.values(ScheduledTask.ACTION_TYPE).includes(actionType)) {
      throw new Error(`actionType must be one of: ${Object.values(ScheduledTask.ACTION_TYPE).join(', ')}`);
    }

    if (!actionParameters || typeof actionParameters !== 'object') {
      throw new Error('actionParameters must be an object');
    }

    // Validate action-specific parameters
    this._validateActionParameters(actionType, actionParameters);

    // Initialize properties
    this.id = id;
    this.userId = userId;
    this.scheduleExpression = scheduleExpression;
    this.actionType = actionType;
    this.actionParameters = { ...actionParameters }; // Create copy
    this.status = ScheduledTask.STATUS.PENDING;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.nextExecutionTime = null;
    this.lastExecutionTime = null;
    this.executionCount = 0;
    this.failureCount = 0;
    this.lastError = null;

    // Calculate initial next execution time
    this._updateNextExecution();
  }

  /**
   * Static factory method for creating arm system tasks
   */
  static createArmSystemTask(id, userId, scheduleExpression, mode = 'away', zoneIds = []) {
    if (!['away', 'stay'].includes(mode)) {
      throw new Error('mode must be "away" or "stay"');
    }

    const actionParameters = { 
      mode,
      zoneIds: Array.isArray(zoneIds) ? [...zoneIds] : []
    };

    return new ScheduledTask(
      id,
      userId,
      scheduleExpression,
      ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
      actionParameters
    );
  }

  /**
   * Static factory method for creating disarm system tasks
   */
  static createDisarmSystemTask(id, userId, scheduleExpression, zoneIds = []) {
    const actionParameters = {
      zoneIds: Array.isArray(zoneIds) ? [...zoneIds] : []
    };

    return new ScheduledTask(
      id,
      userId,
      scheduleExpression,
      ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
      actionParameters
    );
  }

  /**
   * Activates the scheduled task
   */
  activate() {
    if (this.status === ScheduledTask.STATUS.CANCELLED) {
      throw new Error('Cannot activate a cancelled task');
    }

    if (this.status === ScheduledTask.STATUS.COMPLETED) {
      throw new Error('Cannot activate a completed task');
    }

    this.status = ScheduledTask.STATUS.ACTIVE;
    this.updatedAt = new Date();
    this._updateNextExecution();
  }

  /**
   * Marks the task as completed
   */
  complete(executionTime = new Date()) {
    if (this.status === ScheduledTask.STATUS.CANCELLED) {
      throw new Error('Cannot complete a cancelled task');
    }

    this.status = ScheduledTask.STATUS.COMPLETED;
    this.lastExecutionTime = new Date(executionTime);
    this.executionCount++;
    this.updatedAt = new Date();
    this.nextExecutionTime = null; // No future executions for completed tasks
  }

  /**
   * Cancels the scheduled task
   */
  cancel(reason = null) {
    if (this.status === ScheduledTask.STATUS.COMPLETED) {
      throw new Error('Cannot cancel a completed task');
    }

    this.status = ScheduledTask.STATUS.CANCELLED;
    this.updatedAt = new Date();
    this.nextExecutionTime = null;
    
    if (reason) {
      this.lastError = reason;
    }
  }

  /**
   * Marks execution as failed
   */
  markExecutionFailed(error, executionTime = new Date()) {
    if (typeof error === 'string') {
      this.lastError = error;
    } else if (error instanceof Error) {
      this.lastError = error.message;
    } else {
      this.lastError = 'Unknown execution error';
    }

    this.lastExecutionTime = new Date(executionTime);
    this.executionCount++;
    this.failureCount++;
    this.status = ScheduledTask.STATUS.FAILED;
    this.updatedAt = new Date();

    // Don't schedule next execution for failed tasks
    this.nextExecutionTime = null;
  }

  /**
   * Records successful execution and updates next execution time for recurring tasks
   */
  recordSuccessfulExecution(executionTime = new Date()) {
    this.lastExecutionTime = new Date(executionTime);
    this.executionCount++;
    this.lastError = null; // Clear any previous errors
    this.updatedAt = new Date();

    // For one-time tasks, mark as completed
    // For recurring tasks, update next execution time
    if (this._isRecurringTask()) {
      this.status = ScheduledTask.STATUS.ACTIVE;
      this._updateNextExecution();
    } else {
      this.complete(executionTime);
    }
  }

  /**
   * Updates the schedule expression and recalculates next execution
   */
  updateSchedule(newScheduleExpression) {
    if (!(newScheduleExpression instanceof ScheduleExpression)) {
      throw new Error('newScheduleExpression must be a ScheduleExpression instance');
    }

    if (this.status === ScheduledTask.STATUS.COMPLETED) {
      throw new Error('Cannot update schedule of a completed task');
    }

    if (this.status === ScheduledTask.STATUS.CANCELLED) {
      throw new Error('Cannot update schedule of a cancelled task');
    }

    this.scheduleExpression = newScheduleExpression;
    this.updatedAt = new Date();
    this._updateNextExecution();
  }

  /**
   * Updates action parameters
   */
  updateActionParameters(newParameters) {
    if (!newParameters || typeof newParameters !== 'object') {
      throw new Error('newParameters must be an object');
    }

    this._validateActionParameters(this.actionType, newParameters);
    
    this.actionParameters = { ...newParameters };
    this.updatedAt = new Date();
  }

  /**
   * Checks if the task is ready for execution
   */
  isReadyForExecution(currentTime = new Date()) {
    if (this.status !== ScheduledTask.STATUS.ACTIVE) {
      return false;
    }

    if (!this.nextExecutionTime) {
      return false;
    }

    return currentTime >= this.nextExecutionTime;
  }

  /**
   * Checks if the task is overdue
   */
  isOverdue(currentTime = new Date(), toleranceMinutes = 5) {
    if (!this.isReadyForExecution(currentTime)) {
      return false;
    }

    const overdueThreshold = new Date(this.nextExecutionTime.getTime() + (toleranceMinutes * 60 * 1000));
    return currentTime > overdueThreshold;
  }

  /**
   * Gets the next few execution times
   */
  getUpcomingExecutions(days = 7) {
    if (this.status !== ScheduledTask.STATUS.ACTIVE) {
      return [];
    }

    return this.scheduleExpression.getUpcomingExecutions(days, new Date());
  }

  /**
   * Gets a human-readable description
   */
  getDescription() {
    const actionDescription = this._getActionDescription();
    const scheduleDescription = this.scheduleExpression.getDescription();
    
    return `${actionDescription} ${scheduleDescription}`;
  }

  /**
   * Checks if this task can be executed by the given user
   */
  canBeExecutedBy(userId) {
    // For now, only the creator can execute their own tasks
    // This could be expanded with role-based permissions
    return this.userId === userId;
  }

  /**
   * Gets execution statistics
   */
  getExecutionStats() {
    return {
      executionCount: this.executionCount,
      failureCount: this.failureCount,
      successCount: this.executionCount - this.failureCount,
      successRate: this.executionCount > 0 ? ((this.executionCount - this.failureCount) / this.executionCount) : 0,
      lastExecutionTime: this.lastExecutionTime,
      lastError: this.lastError
    };
  }

  /**
   * Private: Updates the next execution time
   */
  _updateNextExecution() {
    try {
      if (this.status === ScheduledTask.STATUS.ACTIVE || this.status === ScheduledTask.STATUS.PENDING) {
        this.nextExecutionTime = this.scheduleExpression.getNextExecutionTime();
      } else {
        this.nextExecutionTime = null;
      }
    } catch (error) {
      this.nextExecutionTime = null;
      this.lastError = `Failed to calculate next execution time: ${error.message}`;
    }
  }

  /**
   * Private: Validates action-specific parameters
   */
  _validateActionParameters(actionType, parameters) {
    switch (actionType) {
      case ScheduledTask.ACTION_TYPE.ARM_SYSTEM:
        if (!parameters.mode || !['away', 'stay'].includes(parameters.mode)) {
          throw new Error('ARM_SYSTEM requires mode to be "away" or "stay"');
        }
        if (parameters.zoneIds && !Array.isArray(parameters.zoneIds)) {
          throw new Error('zoneIds must be an array when provided');
        }
        break;

      case ScheduledTask.ACTION_TYPE.DISARM_SYSTEM:
        if (parameters.zoneIds && !Array.isArray(parameters.zoneIds)) {
          throw new Error('zoneIds must be an array when provided');
        }
        break;

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  /**
   * Private: Determines if this is a recurring task
   */
  _isRecurringTask() {
    // For this implementation, all scheduled tasks are considered recurring
    // This could be made configurable in the future
    return true;
  }

  /**
   * Private: Gets action description for display
   */
  _getActionDescription() {
    switch (this.actionType) {
      case ScheduledTask.ACTION_TYPE.ARM_SYSTEM:
        const mode = this.actionParameters.mode;
        const zones = this.actionParameters.zoneIds;
        if (zones && zones.length > 0) {
          return `Arm zones in ${mode} mode`;
        }
        return `Arm system in ${mode} mode`;

      case ScheduledTask.ACTION_TYPE.DISARM_SYSTEM:
        const disarmZones = this.actionParameters.zoneIds;
        if (disarmZones && disarmZones.length > 0) {
          return 'Disarm specified zones';
        }
        return 'Disarm system';

      default:
        return 'Execute action';
    }
  }

  /**
   * JSON serialization
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      scheduleExpression: this.scheduleExpression.toJSON(),
      actionType: this.actionType,
      actionParameters: this.actionParameters,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      nextExecutionTime: this.nextExecutionTime,
      lastExecutionTime: this.lastExecutionTime,
      executionCount: this.executionCount,
      failureCount: this.failureCount,
      lastError: this.lastError,
      description: this.getDescription(),
      executionStats: this.getExecutionStats()
    };
  }
}

module.exports = ScheduledTask;