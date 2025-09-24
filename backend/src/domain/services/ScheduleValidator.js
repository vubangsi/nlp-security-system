const ScheduledTask = require('../entities/ScheduledTask');
const ScheduleExpression = require('../valueObjects/ScheduleExpression');
const Time = require('../valueObjects/Time');

/**
 * ScheduleValidator Domain Service
 * 
 * Validates business rules and constraints for scheduled tasks.
 * Ensures data integrity, prevents conflicts, and enforces business policies.
 */
class ScheduleValidator {
  constructor(options = {}) {
    // Configuration options for validation rules
    this.options = {
      maxSchedulesPerUser: options.maxSchedulesPerUser || 50,
      maxConflictToleranceMinutes: options.maxConflictToleranceMinutes || 5,
      allowNightTimeScheduling: options.allowNightTimeScheduling !== false, // Default true
      nightTimeStart: options.nightTimeStart || new Time(22, 0), // 10 PM
      nightTimeEnd: options.nightTimeEnd || new Time(6, 0), // 6 AM
      minScheduleAdvanceMinutes: options.minScheduleAdvanceMinutes || 5,
      maxScheduleAdvanceDays: options.maxScheduleAdvanceDays || 365,
      businessHoursOnly: options.businessHoursOnly || false,
      businessHoursStart: options.businessHoursStart || new Time(9, 0),
      businessHoursEnd: options.businessHoursEnd || new Time(17, 0),
      allowWeekendScheduling: options.allowWeekendScheduling !== false, // Default true
      ...options
    };
  }

  /**
   * Validates a new scheduled task before creation
   */
  async validateNewSchedule(scheduledTask, existingSchedules = []) {
    if (!(scheduledTask instanceof ScheduledTask)) {
      throw new Error('scheduledTask must be a ScheduledTask instance');
    }

    const validationResults = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Run all validation checks
    this._validateBasicConstraints(scheduledTask, validationResults);
    this._validateTimeConstraints(scheduledTask, validationResults);
    this._validateBusinessRules(scheduledTask, validationResults);
    this._validateUserLimits(scheduledTask, existingSchedules, validationResults);
    this._validateScheduleConflicts(scheduledTask, existingSchedules, validationResults);
    this._validatePermissions(scheduledTask, validationResults);

    validationResults.isValid = validationResults.errors.length === 0;
    
    return validationResults;
  }

  /**
   * Validates schedule updates
   */
  async validateScheduleUpdate(scheduledTask, updatedScheduleExpression, existingSchedules = []) {
    if (!(scheduledTask instanceof ScheduledTask)) {
      throw new Error('scheduledTask must be a ScheduledTask instance');
    }

    if (!(updatedScheduleExpression instanceof ScheduleExpression)) {
      throw new Error('updatedScheduleExpression must be a ScheduleExpression instance');
    }

    // Create a temporary task with updated schedule for validation
    const tempTask = new ScheduledTask(
      scheduledTask.id,
      scheduledTask.userId,
      updatedScheduleExpression,
      scheduledTask.actionType,
      scheduledTask.actionParameters
    );

    // Filter out the current task from existing schedules to avoid self-conflict
    const otherSchedules = existingSchedules.filter(s => s.id !== scheduledTask.id);
    
    return this.validateNewSchedule(tempTask, otherSchedules);
  }

  /**
   * Validates basic constraints (required fields, data types, etc.)
   */
  _validateBasicConstraints(scheduledTask, results) {
    try {
      // Validate schedule expression
      if (!scheduledTask.scheduleExpression.isValid()) {
        results.errors.push('Schedule expression is invalid');
      }

      // Validate action type and parameters
      if (!Object.values(ScheduledTask.ACTION_TYPE).includes(scheduledTask.actionType)) {
        results.errors.push('Invalid action type');
      }

      // Validate action-specific parameters
      if (scheduledTask.actionType === ScheduledTask.ACTION_TYPE.ARM_SYSTEM) {
        if (!scheduledTask.actionParameters.mode || 
            !['away', 'stay'].includes(scheduledTask.actionParameters.mode)) {
          results.errors.push('ARM_SYSTEM action requires valid mode (away or stay)');
        }
      }

      // Validate next execution time can be calculated
      if (!scheduledTask.nextExecutionTime) {
        results.errors.push('Cannot calculate next execution time from schedule');
      }

    } catch (error) {
      results.errors.push(`Basic validation failed: ${error.message}`);
    }
  }

  /**
   * Validates time-based constraints
   */
  _validateTimeConstraints(scheduledTask, results) {
    const scheduleTime = scheduledTask.scheduleExpression.time;
    const now = new Date();
    const nextExecution = scheduledTask.nextExecutionTime;

    // Check minimum advance time
    if (nextExecution) {
      const advanceMinutes = (nextExecution.getTime() - now.getTime()) / (1000 * 60);
      if (advanceMinutes < this.options.minScheduleAdvanceMinutes) {
        results.errors.push(
          `Schedule must be at least ${this.options.minScheduleAdvanceMinutes} minutes in the future`
        );
      }

      // Check maximum advance time
      const advanceDays = advanceMinutes / (60 * 24);
      if (advanceDays > this.options.maxScheduleAdvanceDays) {
        results.errors.push(
          `Schedule cannot be more than ${this.options.maxScheduleAdvanceDays} days in the future`
        );
      }
    }

    // Check night time scheduling
    if (!this.options.allowNightTimeScheduling) {
      if (this._isNightTime(scheduleTime)) {
        results.errors.push(
          `Night time scheduling (${this.options.nightTimeStart.format12Hour()} - ` +
          `${this.options.nightTimeEnd.format12Hour()}) is not allowed`
        );
      }
    } else if (this._isNightTime(scheduleTime)) {
      results.warnings.push('Schedule is set for night time hours');
    }

    // Check business hours only constraint
    if (this.options.businessHoursOnly) {
      if (!this._isBusinessHours(scheduleTime)) {
        results.errors.push(
          `Scheduling is only allowed during business hours ` +
          `(${this.options.businessHoursStart.format12Hour()} - ` +
          `${this.options.businessHoursEnd.format12Hour()})`
        );
      }
    }

    // Check weekend scheduling
    if (!this.options.allowWeekendScheduling) {
      const hasWeekendDays = scheduledTask.scheduleExpression.daysOfWeek.some(day => day.isWeekend());
      if (hasWeekendDays) {
        results.errors.push('Weekend scheduling is not allowed');
      }
    }
  }

  /**
   * Validates business rules specific to the domain
   */
  _validateBusinessRules(scheduledTask, results) {
    // Rule: Cannot schedule disarm right after arm on the same day
    // This would be validated against existing schedules in conflict detection

    // Rule: ARM_SYSTEM in 'stay' mode should not be scheduled too late at night
    if (scheduledTask.actionType === ScheduledTask.ACTION_TYPE.ARM_SYSTEM &&
        scheduledTask.actionParameters.mode === 'stay') {
      const scheduleTime = scheduledTask.scheduleExpression.time;
      const lateNight = new Time(23, 0); // 11 PM
      
      if (scheduleTime.isAfter(lateNight)) {
        results.warnings.push(
          'Scheduling "stay" mode very late at night may cause issues if residents are still moving around'
        );
      }
    }

    // Rule: DISARM_SYSTEM should typically be scheduled for morning hours
    if (scheduledTask.actionType === ScheduledTask.ACTION_TYPE.DISARM_SYSTEM) {
      const scheduleTime = scheduledTask.scheduleExpression.time;
      const earlyMorning = new Time(6, 0);
      const lateMorning = new Time(10, 0);
      
      if (scheduleTime.isBefore(earlyMorning) || scheduleTime.isAfter(lateMorning)) {
        results.warnings.push(
          'Disarm schedules are typically set for morning hours (6 AM - 10 AM)'
        );
      }
    }

    // Rule: Validate logical sequence for recurring schedules
    if (scheduledTask.scheduleExpression.daysOfWeek.length > 1) {
      const description = scheduledTask.getDescription();
      if (description.includes('arm') && description.includes('disarm')) {
        results.warnings.push(
          'Multiple day schedules should be consistent in action type'
        );
      }
    }
  }

  /**
   * Validates user-specific limits and quotas
   */
  _validateUserLimits(scheduledTask, existingSchedules, results) {
    // Count existing active schedules for this user
    const userSchedules = existingSchedules.filter(s => 
      s.userId === scheduledTask.userId && 
      s.status === ScheduledTask.STATUS.ACTIVE
    );

    if (userSchedules.length >= this.options.maxSchedulesPerUser) {
      results.errors.push(
        `User has reached the maximum limit of ${this.options.maxSchedulesPerUser} active schedules`
      );
    }

    // Warn if approaching limit
    if (userSchedules.length >= this.options.maxSchedulesPerUser * 0.8) {
      results.warnings.push(
        `User is approaching the schedule limit (${userSchedules.length}/${this.options.maxSchedulesPerUser})`
      );
    }
  }

  /**
   * Validates schedule conflicts with existing schedules
   */
  _validateScheduleConflicts(scheduledTask, existingSchedules, results) {
    const conflictingSchedules = existingSchedules.filter(existingSchedule => {
      // Skip non-active schedules
      if (existingSchedule.status !== ScheduledTask.STATUS.ACTIVE) {
        return false;
      }

      // Skip schedules for different users (unless system-wide conflict checking is needed)
      if (existingSchedule.userId !== scheduledTask.userId) {
        return false;
      }

      // Check if schedules conflict
      return scheduledTask.scheduleExpression.conflictsWith(
        existingSchedule.scheduleExpression,
        this.options.maxConflictToleranceMinutes
      );
    });

    if (conflictingSchedules.length > 0) {
      results.errors.push(
        `Schedule conflicts with ${conflictingSchedules.length} existing schedule(s). ` +
        `Conflicting schedules: ${conflictingSchedules.map(s => s.id).join(', ')}`
      );
    }

    // Check for logical conflicts (e.g., arm followed immediately by disarm)
    const logicalConflicts = this._findLogicalConflicts(scheduledTask, existingSchedules);
    if (logicalConflicts.length > 0) {
      results.warnings.push(
        `Potential logical conflict: ${logicalConflicts.join('; ')}`
      );
    }
  }

  /**
   * Validates user permissions for the scheduled action
   */
  _validatePermissions(scheduledTask, results) {
    // For now, basic permission check - could be expanded with role-based access
    if (!scheduledTask.userId) {
      results.errors.push('User ID is required for scheduled task');
      return;
    }

    // Additional permission checks could be added here based on:
    // - User role (admin vs regular user)
    // - Zone access permissions
    // - Time-based access restrictions
    // - System state dependencies

    // Example: Only admins can schedule system-wide actions
    // This would require user role information to be passed in
    if (scheduledTask.actionParameters.zoneIds && 
        scheduledTask.actionParameters.zoneIds.length === 0) {
      // System-wide action - could require admin permissions
      results.warnings.push('System-wide scheduling may require administrator privileges');
    }
  }

  /**
   * Checks if time is during night hours
   */
  _isNightTime(time) {
    const nightStart = this.options.nightTimeStart;
    const nightEnd = this.options.nightTimeEnd;
    
    // Handle case where night time spans midnight (e.g., 22:00 to 06:00)
    if (nightStart.isAfter(nightEnd)) {
      return time.isAfter(nightStart) || !time.isAfter(nightEnd);
    } else {
      return !time.isBefore(nightStart) && time.isBefore(nightEnd);
    }
  }

  /**
   * Checks if time is during business hours
   */
  _isBusinessHours(time) {
    const businessStart = this.options.businessHoursStart;
    const businessEnd = this.options.businessHoursEnd;
    
    return !time.isBefore(businessStart) && time.isBefore(businessEnd);
  }

  /**
   * Finds logical conflicts between schedules
   */
  _findLogicalConflicts(newSchedule, existingSchedules) {
    const conflicts = [];
    
    for (const existing of existingSchedules) {
      if (existing.status !== ScheduledTask.STATUS.ACTIVE) continue;
      if (existing.userId !== newSchedule.userId) continue;

      // Check for arm followed by disarm or vice versa on the same day
      const sameDay = newSchedule.scheduleExpression.daysOfWeek.some(newDay =>
        existing.scheduleExpression.daysOfWeek.some(existingDay => 
          newDay.equals(existingDay)
        )
      );

      if (sameDay) {
        const timeDiff = Math.abs(
          newSchedule.scheduleExpression.time.differenceInMinutes(
            existing.scheduleExpression.time
          )
        );

        // If within 30 minutes and opposite actions
        if (timeDiff <= 30) {
          if ((newSchedule.actionType === ScheduledTask.ACTION_TYPE.ARM_SYSTEM &&
               existing.actionType === ScheduledTask.ACTION_TYPE.DISARM_SYSTEM) ||
              (newSchedule.actionType === ScheduledTask.ACTION_TYPE.DISARM_SYSTEM &&
               existing.actionType === ScheduledTask.ACTION_TYPE.ARM_SYSTEM)) {
            conflicts.push(
              `${newSchedule.actionType} scheduled too close to existing ${existing.actionType}`
            );
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Validates bulk schedule operations
   */
  async validateBulkSchedules(scheduledTasks, existingSchedules = []) {
    const results = [];
    let allExistingSchedules = [...existingSchedules];

    for (const task of scheduledTasks) {
      const validation = await this.validateNewSchedule(task, allExistingSchedules);
      results.push({
        taskId: task.id,
        validation
      });

      // If valid, add to the existing schedules for subsequent validations
      if (validation.isValid) {
        allExistingSchedules.push(task);
      }
    }

    return results;
  }

  /**
   * Provides suggestions for fixing validation errors
   */
  getSuggestions(validationResults) {
    const suggestions = [];

    validationResults.errors.forEach(error => {
      if (error.includes('minimum advance time')) {
        suggestions.push('Try scheduling at least 5 minutes in the future');
      }
      
      if (error.includes('Night time scheduling')) {
        suggestions.push('Consider scheduling during daytime hours (6 AM - 10 PM)');
      }
      
      if (error.includes('conflicts with')) {
        suggestions.push('Choose a different time or modify existing conflicting schedules');
      }
      
      if (error.includes('maximum limit')) {
        suggestions.push('Cancel some existing schedules or contact administrator for higher limits');
      }
      
      if (error.includes('business hours')) {
        suggestions.push('Schedule during business hours (9 AM - 5 PM) if required by policy');
      }
    });

    return suggestions;
  }
}

module.exports = ScheduleValidator;