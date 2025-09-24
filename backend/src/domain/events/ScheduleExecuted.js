const DomainEvent = require('./DomainEvent');

/**
 * ScheduleExecuted Domain Event
 * 
 * Fired when a scheduled task is successfully executed.
 * Contains information about the execution details and results.
 */
class ScheduleExecuted extends DomainEvent {
  constructor(scheduledTask, executionResult = {}, executionTime = new Date()) {
    if (!scheduledTask) {
      throw new Error('scheduledTask is required');
    }

    super('ScheduleExecuted', scheduledTask.id, {
      userId: scheduledTask.userId,
      actionType: scheduledTask.actionType,
      actionParameters: scheduledTask.actionParameters,
      executionTime,
      executionResult,
      executionCount: scheduledTask.executionCount,
      nextExecutionTime: scheduledTask.nextExecutionTime,
      description: scheduledTask.getDescription(),
      wasOverdue: scheduledTask.isOverdue(executionTime),
      executionStats: scheduledTask.getExecutionStats()
    });

    // Store additional properties for easy access
    this.scheduledTaskId = scheduledTask.id;
    this.userId = scheduledTask.userId;
    this.actionType = scheduledTask.actionType;
    this.actionParameters = { ...scheduledTask.actionParameters };
    this.executionTime = new Date(executionTime);
    this.executionResult = { ...executionResult };
    this.executionCount = scheduledTask.executionCount;
    this.nextExecutionTime = scheduledTask.nextExecutionTime;
    this.description = scheduledTask.getDescription();
    this.wasOverdue = scheduledTask.isOverdue(executionTime);
  }

  /**
   * Gets the execution duration if available in the result
   */
  getExecutionDuration() {
    return this.executionResult.duration || null;
  }

  /**
   * Checks if the execution was successful
   */
  wasSuccessful() {
    return this.executionResult.success !== false;
  }

  /**
   * Gets any warnings generated during execution
   */
  getExecutionWarnings() {
    return this.executionResult.warnings || [];
  }

  /**
   * Gets the system state after execution
   */
  getResultingSystemState() {
    return this.executionResult.systemState || null;
  }

  /**
   * Gets zones that were actually affected
   */
  getAffectedZones() {
    return this.executionResult.affectedZones || this.actionParameters.zoneIds || [];
  }

  /**
   * Checks if this execution was overdue
   */
  isOverdueExecution() {
    return this.wasOverdue;
  }

  /**
   * Gets the delay from scheduled time in minutes
   */
  getExecutionDelay() {
    if (!this.data.originalScheduledTime) {
      return null;
    }
    
    const scheduledTime = new Date(this.data.originalScheduledTime);
    const actualTime = this.executionTime;
    return Math.max(0, Math.floor((actualTime - scheduledTime) / (1000 * 60)));
  }

  /**
   * Checks if this is a system-wide execution
   */
  isSystemWideExecution() {
    const affectedZones = this.getAffectedZones();
    return affectedZones.length === 0;
  }

  /**
   * Gets execution summary for logging
   */
  getExecutionSummary() {
    const summary = {
      action: this.actionType,
      description: this.description,
      executionTime: this.executionTime,
      successful: this.wasSuccessful(),
      overdue: this.isOverdueExecution(),
      executionCount: this.executionCount
    };

    if (this.actionType === 'ARM_SYSTEM') {
      summary.mode = this.actionParameters.mode;
    }

    const affectedZones = this.getAffectedZones();
    if (affectedZones.length > 0) {
      summary.affectedZones = affectedZones;
    } else {
      summary.scope = 'system-wide';
    }

    if (this.getExecutionDelay()) {
      summary.delayMinutes = this.getExecutionDelay();
    }

    const warnings = this.getExecutionWarnings();
    if (warnings.length > 0) {
      summary.warnings = warnings;
    }

    return summary;
  }

  /**
   * JSON serialization with additional context
   */
  toJSON() {
    return {
      ...super.toJSON(),
      scheduledTaskId: this.scheduledTaskId,
      userId: this.userId,
      actionType: this.actionType,
      actionParameters: this.actionParameters,
      executionTime: this.executionTime,
      executionResult: this.executionResult,
      executionCount: this.executionCount,
      nextExecutionTime: this.nextExecutionTime,
      description: this.description,
      wasOverdue: this.wasOverdue,
      executionSummary: this.getExecutionSummary()
    };
  }
}

module.exports = ScheduleExecuted;