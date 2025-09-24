const DomainEvent = require('./DomainEvent');

/**
 * ScheduleCancelled Domain Event
 * 
 * Fired when a scheduled task is cancelled.
 * Contains information about the cancellation reason and context.
 */
class ScheduleCancelled extends DomainEvent {
  constructor(scheduledTask, reason = null, cancelledBy = null, cancellationTime = new Date()) {
    if (!scheduledTask) {
      throw new Error('scheduledTask is required');
    }

    super('ScheduleCancelled', scheduledTask.id, {
      userId: scheduledTask.userId,
      actionType: scheduledTask.actionType,
      actionParameters: scheduledTask.actionParameters,
      originalStatus: scheduledTask.status,
      reason: reason,
      cancelledBy: cancelledBy || scheduledTask.userId,
      cancellationTime,
      scheduledExecutionTime: scheduledTask.nextExecutionTime,
      executionStats: scheduledTask.getExecutionStats(),
      description: scheduledTask.getDescription(),
      wasActive: scheduledTask.status === 'ACTIVE',
      hadExecutions: scheduledTask.executionCount > 0
    });

    // Store additional properties for easy access
    this.scheduledTaskId = scheduledTask.id;
    this.userId = scheduledTask.userId;
    this.actionType = scheduledTask.actionType;
    this.actionParameters = { ...scheduledTask.actionParameters };
    this.originalStatus = scheduledTask.status;
    this.reason = reason;
    this.cancelledBy = cancelledBy || scheduledTask.userId;
    this.cancellationTime = new Date(cancellationTime);
    this.scheduledExecutionTime = scheduledTask.nextExecutionTime;
    this.description = scheduledTask.getDescription();
    this.wasActive = scheduledTask.status === 'ACTIVE';
    this.hadExecutions = scheduledTask.executionCount > 0;
    this.executionStats = scheduledTask.getExecutionStats();
  }

  /**
   * Gets the cancellation reason
   */
  getCancellationReason() {
    return this.reason;
  }

  /**
   * Gets who cancelled the schedule
   */
  getCancelledBy() {
    return this.cancelledBy;
  }

  /**
   * Checks if the schedule was cancelled by the original creator
   */
  isSelfCancellation() {
    return this.cancelledBy === this.userId;
  }

  /**
   * Checks if the schedule was cancelled by an administrator
   */
  isAdminCancellation() {
    return this.cancelledBy !== this.userId;
  }

  /**
   * Checks if this was an active schedule when cancelled
   */
  wasActiveSchedule() {
    return this.wasActive;
  }

  /**
   * Checks if the schedule had any successful executions
   */
  hadSuccessfulExecutions() {
    return this.executionStats.successCount > 0;
  }

  /**
   * Gets the next execution time that was cancelled
   */
  getNextExecutionTime() {
    return this.scheduledExecutionTime;
  }

  /**
   * Calculates time until the scheduled execution was cancelled
   */
  getTimeUntilExecution() {
    if (!this.scheduledExecutionTime) {
      return null;
    }

    const timeDiff = this.scheduledExecutionTime.getTime() - this.cancellationTime.getTime();
    return Math.max(0, Math.floor(timeDiff / (1000 * 60))); // Return minutes
  }

  /**
   * Checks if cancellation happened close to execution time
   */
  isLastMinuteCancellation(thresholdMinutes = 15) {
    const timeUntilExecution = this.getTimeUntilExecution();
    return timeUntilExecution !== null && timeUntilExecution <= thresholdMinutes;
  }

  /**
   * Gets zones that would have been affected
   */
  getIntendedZones() {
    return this.actionParameters.zoneIds || [];
  }

  /**
   * Checks if this was a system-wide schedule
   */
  isSystemWideSchedule() {
    return this.getIntendedZones().length === 0;
  }

  /**
   * Determines the cancellation category
   */
  getCancellationCategory() {
    if (!this.reason) {
      return 'USER_REQUESTED';
    }

    const reasonLower = this.reason.toLowerCase();

    if (reasonLower.includes('duplicate') || reasonLower.includes('conflict')) {
      return 'CONFLICT_RESOLUTION';
    }

    if (reasonLower.includes('system') || reasonLower.includes('maintenance')) {
      return 'SYSTEM_MAINTENANCE';
    }

    if (reasonLower.includes('error') || reasonLower.includes('failed') || reasonLower.includes('invalid')) {
      return 'ERROR_CORRECTION';
    }

    if (reasonLower.includes('policy') || reasonLower.includes('unauthorized') || reasonLower.includes('permission')) {
      return 'POLICY_VIOLATION';
    }

    if (reasonLower.includes('user') || reasonLower.includes('manual') || reasonLower.includes('requested')) {
      return 'USER_REQUESTED';
    }

    return 'OTHER';
  }

  /**
   * Checks if the cancellation might impact security
   */
  hasSecurityImplications() {
    // ARM_SYSTEM cancellations might leave system unsecured
    if (this.actionType === 'ARM_SYSTEM' && this.wasActive) {
      return true;
    }

    // Last minute cancellations of security actions are concerning
    if (this.isLastMinuteCancellation() && this.wasActive) {
      return true;
    }

    return false;
  }

  /**
   * Gets cancellation impact level
   */
  getImpactLevel() {
    if (this.hasSecurityImplications()) {
      return 'HIGH';
    }

    if (this.wasActive && this.isLastMinuteCancellation()) {
      return 'MEDIUM';
    }

    if (this.wasActive || this.hadSuccessfulExecutions()) {
      return 'LOW';
    }

    return 'MINIMAL';
  }

  /**
   * Gets cancellation summary for logging/notification
   */
  getCancellationSummary() {
    const summary = {
      taskId: this.scheduledTaskId,
      action: this.actionType,
      description: this.description,
      cancellationTime: this.cancellationTime,
      cancelledBy: this.cancelledBy,
      reason: this.reason,
      category: this.getCancellationCategory(),
      impactLevel: this.getImpactLevel(),
      wasActive: this.wasActive,
      hadExecutions: this.hadExecutions,
      isSelfCancellation: this.isSelfCancellation()
    };

    if (this.actionType === 'ARM_SYSTEM') {
      summary.mode = this.actionParameters.mode;
    }

    const intendedZones = this.getIntendedZones();
    if (intendedZones.length > 0) {
      summary.intendedZones = intendedZones;
    } else {
      summary.scope = 'system-wide';
    }

    if (this.scheduledExecutionTime) {
      summary.scheduledExecutionTime = this.scheduledExecutionTime;
      const timeUntilExecution = this.getTimeUntilExecution();
      if (timeUntilExecution !== null) {
        summary.minutesUntilExecution = timeUntilExecution;
      }
    }

    if (this.isLastMinuteCancellation()) {
      summary.lastMinuteCancellation = true;
    }

    if (this.hasSecurityImplications()) {
      summary.hasSecurityImplications = true;
    }

    if (this.executionStats.executionCount > 0) {
      summary.executionHistory = {
        totalExecutions: this.executionStats.executionCount,
        successfulExecutions: this.executionStats.successCount,
        failedExecutions: this.executionStats.failureCount,
        successRate: this.executionStats.successRate
      };
    }

    return summary;
  }

  /**
   * Gets recommended follow-up actions
   */
  getFollowUpActions() {
    const actions = [];

    if (this.hasSecurityImplications()) {
      actions.push('Review security schedule coverage');
      actions.push('Consider alternative security scheduling');
    }

    if (this.getCancellationCategory() === 'CONFLICT_RESOLUTION') {
      actions.push('Review remaining schedules for conflicts');
      actions.push('Verify intended schedule coverage');
    }

    if (this.getCancellationCategory() === 'ERROR_CORRECTION') {
      actions.push('Validate corrected schedule configuration');
      actions.push('Test schedule functionality before reactivation');
    }

    if (this.isAdminCancellation()) {
      actions.push('Notify affected user of schedule cancellation');
      actions.push('Document reason for administrative action');
    }

    if (this.isLastMinuteCancellation() && this.wasActive) {
      actions.push('Ensure no security gaps from cancelled schedule');
      actions.push('Consider immediate manual security action if needed');
    }

    return actions;
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
      originalStatus: this.originalStatus,
      reason: this.reason,
      cancelledBy: this.cancelledBy,
      cancellationTime: this.cancellationTime,
      scheduledExecutionTime: this.scheduledExecutionTime,
      description: this.description,
      wasActive: this.wasActive,
      hadExecutions: this.hadExecutions,
      executionStats: this.executionStats,
      cancellationCategory: this.getCancellationCategory(),
      impactLevel: this.getImpactLevel(),
      hasSecurityImplications: this.hasSecurityImplications(),
      cancellationSummary: this.getCancellationSummary(),
      followUpActions: this.getFollowUpActions()
    };
  }
}

module.exports = ScheduleCancelled;