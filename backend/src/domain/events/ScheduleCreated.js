const DomainEvent = require('./DomainEvent');

/**
 * ScheduleCreated Domain Event
 * 
 * Fired when a new scheduled task is created.
 * Contains information about the newly created schedule.
 */
class ScheduleCreated extends DomainEvent {
  constructor(scheduledTask) {
    if (!scheduledTask) {
      throw new Error('scheduledTask is required');
    }

    super('ScheduleCreated', scheduledTask.id, {
      userId: scheduledTask.userId,
      actionType: scheduledTask.actionType,
      actionParameters: scheduledTask.actionParameters,
      scheduleExpression: scheduledTask.scheduleExpression.toJSON(),
      nextExecutionTime: scheduledTask.nextExecutionTime,
      status: scheduledTask.status,
      description: scheduledTask.getDescription()
    });

    // Store additional properties for easy access
    this.scheduledTaskId = scheduledTask.id;
    this.userId = scheduledTask.userId;
    this.actionType = scheduledTask.actionType;
    this.actionParameters = { ...scheduledTask.actionParameters };
    this.nextExecutionTime = scheduledTask.nextExecutionTime;
    this.description = scheduledTask.getDescription();
  }

  /**
   * Gets the schedule description for logging/notification purposes
   */
  getScheduleDescription() {
    return this.description;
  }

  /**
   * Checks if this is a system-wide schedule (affects all zones)
   */
  isSystemWideSchedule() {
    return !this.actionParameters.zoneIds || this.actionParameters.zoneIds.length === 0;
  }

  /**
   * Gets the zones affected by this schedule
   */
  getAffectedZones() {
    return this.actionParameters.zoneIds || [];
  }

  /**
   * Gets the schedule mode (for ARM_SYSTEM actions)
   */
  getScheduleMode() {
    return this.actionParameters.mode || null;
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
      nextExecutionTime: this.nextExecutionTime,
      description: this.description,
      isSystemWide: this.isSystemWideSchedule(),
      affectedZones: this.getAffectedZones()
    };
  }
}

module.exports = ScheduleCreated;