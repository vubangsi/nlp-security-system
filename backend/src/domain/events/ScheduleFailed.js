const DomainEvent = require('./DomainEvent');

/**
 * ScheduleFailed Domain Event
 * 
 * Fired when a scheduled task execution fails.
 * Contains information about the failure reason and context.
 */
class ScheduleFailed extends DomainEvent {
  constructor(scheduledTask, error, executionTime = new Date(), attemptNumber = 1) {
    if (!scheduledTask) {
      throw new Error('scheduledTask is required');
    }

    if (!error) {
      throw new Error('error is required');
    }

    // Extract error information
    let errorMessage, errorType, errorStack;
    if (error instanceof Error) {
      errorMessage = error.message;
      errorType = error.constructor.name;
      errorStack = error.stack;
    } else if (typeof error === 'string') {
      errorMessage = error;
      errorType = 'UnknownError';
      errorStack = null;
    } else {
      errorMessage = error.message || 'Unknown error occurred';
      errorType = error.type || 'UnknownError';
      errorStack = error.stack || null;
    }

    super('ScheduleFailed', scheduledTask.id, {
      userId: scheduledTask.userId,
      actionType: scheduledTask.actionType,
      actionParameters: scheduledTask.actionParameters,
      executionTime,
      attemptNumber,
      error: {
        message: errorMessage,
        type: errorType,
        stack: errorStack
      },
      failureCount: scheduledTask.failureCount,
      totalExecutionCount: scheduledTask.executionCount,
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
    this.attemptNumber = attemptNumber;
    this.error = {
      message: errorMessage,
      type: errorType,
      stack: errorStack
    };
    this.failureCount = scheduledTask.failureCount;
    this.description = scheduledTask.getDescription();
    this.wasOverdue = scheduledTask.isOverdue(executionTime);
  }

  /**
   * Gets the error message
   */
  getErrorMessage() {
    return this.error.message;
  }

  /**
   * Gets the error type
   */
  getErrorType() {
    return this.error.type;
  }

  /**
   * Gets the error stack trace
   */
  getErrorStack() {
    return this.error.stack;
  }

  /**
   * Checks if this is a retry attempt
   */
  isRetryAttempt() {
    return this.attemptNumber > 1;
  }

  /**
   * Gets the current retry count
   */
  getRetryCount() {
    return Math.max(0, this.attemptNumber - 1);
  }

  /**
   * Checks if the failure was due to timeout
   */
  isTimeoutFailure() {
    const message = this.error.message.toLowerCase();
    const type = this.error.type.toLowerCase();
    return message.includes('timeout') || 
           message.includes('timed out') ||
           type.includes('timeout');
  }

  /**
   * Checks if the failure was due to network issues
   */
  isNetworkFailure() {
    const message = this.error.message.toLowerCase();
    const type = this.error.type.toLowerCase();
    return message.includes('network') || 
           message.includes('connection') ||
           message.includes('econnrefused') ||
           message.includes('enotfound') ||
           type.includes('network');
  }

  /**
   * Checks if the failure was due to authorization
   */
  isAuthorizationFailure() {
    const message = this.error.message.toLowerCase();
    const type = this.error.type.toLowerCase();
    return message.includes('unauthorized') || 
           message.includes('forbidden') ||
           message.includes('permission') ||
           message.includes('access denied') ||
           type.includes('auth');
  }

  /**
   * Checks if the failure was due to system state conflicts
   */
  isSystemStateFailure() {
    const message = this.error.message.toLowerCase();
    return message.includes('system already') || 
           message.includes('conflicting state') ||
           message.includes('invalid state') ||
           message.includes('system state');
  }

  /**
   * Checks if this is a frequently failing task
   */
  isFrequentFailure(threshold = 3) {
    return this.failureCount >= threshold;
  }

  /**
   * Determines if the failure is likely recoverable
   */
  isRecoverableFailure() {
    // Network and timeout failures are usually recoverable
    if (this.isNetworkFailure() || this.isTimeoutFailure()) {
      return true;
    }

    // Authorization failures usually need manual intervention
    if (this.isAuthorizationFailure()) {
      return false;
    }

    // System state failures might be recoverable after some time
    if (this.isSystemStateFailure()) {
      return true;
    }

    // Default to recoverable for unknown errors (conservative approach)
    return true;
  }

  /**
   * Gets failure category for classification
   */
  getFailureCategory() {
    if (this.isTimeoutFailure()) return 'TIMEOUT';
    if (this.isNetworkFailure()) return 'NETWORK';
    if (this.isAuthorizationFailure()) return 'AUTHORIZATION';
    if (this.isSystemStateFailure()) return 'SYSTEM_STATE';
    return 'UNKNOWN';
  }

  /**
   * Gets zones that were supposed to be affected
   */
  getIntendedZones() {
    return this.actionParameters.zoneIds || [];
  }

  /**
   * Checks if this was a system-wide operation that failed
   */
  isSystemWideFailure() {
    return this.getIntendedZones().length === 0;
  }

  /**
   * Gets failure summary for logging/alerting
   */
  getFailureSummary() {
    const summary = {
      taskId: this.scheduledTaskId,
      action: this.actionType,
      description: this.description,
      executionTime: this.executionTime,
      attemptNumber: this.attemptNumber,
      failureCount: this.failureCount,
      errorMessage: this.getErrorMessage(),
      errorType: this.getErrorType(),
      category: this.getFailureCategory(),
      recoverable: this.isRecoverableFailure(),
      wasOverdue: this.wasOverdue
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

    if (this.isRetryAttempt()) {
      summary.retryCount = this.getRetryCount();
    }

    if (this.isFrequentFailure()) {
      summary.frequentFailure = true;
    }

    return summary;
  }

  /**
   * Gets suggested recovery actions
   */
  getRecoveryActions() {
    const actions = [];

    if (this.isNetworkFailure()) {
      actions.push('Check network connectivity');
      actions.push('Verify system endpoints are accessible');
    }

    if (this.isTimeoutFailure()) {
      actions.push('Check system response times');
      actions.push('Consider increasing timeout values');
    }

    if (this.isAuthorizationFailure()) {
      actions.push('Verify user permissions');
      actions.push('Check authentication credentials');
    }

    if (this.isSystemStateFailure()) {
      actions.push('Check current system state');
      actions.push('Ensure system is in expected state for this action');
    }

    if (this.isFrequentFailure()) {
      actions.push('Consider disabling this schedule');
      actions.push('Review schedule configuration');
    }

    if (actions.length === 0) {
      actions.push('Review error details and system logs');
      actions.push('Contact system administrator if issue persists');
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
      executionTime: this.executionTime,
      attemptNumber: this.attemptNumber,
      error: this.error,
      failureCount: this.failureCount,
      description: this.description,
      wasOverdue: this.wasOverdue,
      failureCategory: this.getFailureCategory(),
      isRecoverable: this.isRecoverableFailure(),
      failureSummary: this.getFailureSummary(),
      recoveryActions: this.getRecoveryActions()
    };
  }
}

module.exports = ScheduleFailed;