const ScheduledTask = require('../../domain/entities/ScheduledTask');
const ScheduleExpression = require('../../domain/valueObjects/ScheduleExpression');
const Time = require('../../domain/valueObjects/Time');
const DayOfWeek = require('../../domain/valueObjects/DayOfWeek');

/**
 * SchedulingService
 * 
 * High-level orchestration service that coordinates between scheduling use cases
 * and provides complex scheduling operations, conflict resolution, and workflow
 * management. Acts as a facade for the scheduling domain while maintaining
 * separation of concerns and clean architectural boundaries.
 */
class SchedulingService {
  constructor(
    createScheduledTaskUseCase,
    listScheduledTasksUseCase,
    updateScheduledTaskUseCase,
    cancelScheduledTaskUseCase,
    executeScheduledTaskUseCase,
    scheduleParser = null,
    scheduleValidator = null
  ) {
    this.createScheduledTaskUseCase = createScheduledTaskUseCase;
    this.listScheduledTasksUseCase = listScheduledTasksUseCase;
    this.updateScheduledTaskUseCase = updateScheduledTaskUseCase;
    this.cancelScheduledTaskUseCase = cancelScheduledTaskUseCase;
    this.executeScheduledTaskUseCase = executeScheduledTaskUseCase;
    this.scheduleParser = scheduleParser;
    this.scheduleValidator = scheduleValidator;
  }

  /**
   * Creates a schedule from natural language input
   * 
   * @param {string} scheduleText - Natural language schedule description
   * @param {string} actionType - Action type (ARM_SYSTEM, DISARM_SYSTEM)
   * @param {Object} actionParameters - Action parameters
   * @param {string} userId - User creating the schedule
   * @param {Object} options - Creation options
   * 
   * @returns {Promise<Object>} Result with created schedule details
   */
  async createScheduleFromText(scheduleText, actionType, actionParameters, userId, options = {}) {
    try {
      if (!this.scheduleParser) {
        return {
          success: false,
          error: 'Schedule parser not available',
          details: { field: 'parser', message: 'Natural language parsing is not configured' }
        };
      }

      // Parse natural language to schedule expression
      const parseResult = await this.scheduleParser.parseScheduleText(scheduleText);
      if (!parseResult.success) {
        return {
          success: false,
          error: 'Failed to parse schedule text',
          details: parseResult.details
        };
      }

      // Create schedule using parsed expression
      return await this.createScheduledTaskUseCase.execute({
        scheduleExpression: parseResult.scheduleExpression,
        actionType,
        actionParameters,
        userId
      }, options);

    } catch (error) {
      return {
        success: false,
        error: 'Failed to create schedule from text',
        details: { field: 'parsing', message: error.message }
      };
    }
  }

  /**
   * Creates a schedule workflow (multiple related schedules)
   * 
   * @param {Object} workflowConfig - Workflow configuration
   * @param {string} workflowConfig.type - Workflow type (daily_cycle, weekly_pattern, etc.)
   * @param {Object} workflowConfig.parameters - Workflow parameters
   * @param {string} userId - User creating the workflow
   * @param {Object} options - Workflow options
   * 
   * @returns {Promise<Object>} Result with workflow creation details
   */
  async createScheduleWorkflow(workflowConfig, userId, options = {}) {
    try {
      const { type, parameters } = workflowConfig;

      switch (type) {
        case 'daily_cycle':
          return await this._createDailyCycleWorkflow(parameters, userId, options);
        
        case 'weekly_pattern':
          return await this._createWeeklyPatternWorkflow(parameters, userId, options);
        
        case 'vacation_mode':
          return await this._createVacationModeWorkflow(parameters, userId, options);
        
        case 'seasonal_schedule':
          return await this._createSeasonalScheduleWorkflow(parameters, userId, options);
        
        default:
          return {
            success: false,
            error: 'Unknown workflow type',
            details: { 
              field: 'type', 
              message: `Unsupported workflow type: ${type}`,
              supportedTypes: ['daily_cycle', 'weekly_pattern', 'vacation_mode', 'seasonal_schedule']
            }
          };
      }

    } catch (error) {
      return {
        success: false,
        error: 'Failed to create schedule workflow',
        details: { field: 'workflow', message: error.message }
      };
    }
  }

  /**
   * Resolves scheduling conflicts and provides recommendations
   * 
   * @param {string} userId - User ID to check conflicts for
   * @param {ScheduleExpression} newScheduleExpression - New schedule to check
   * @param {string} actionType - Action type for the new schedule
   * 
   * @returns {Promise<Object>} Result with conflict analysis and recommendations
   */
  async resolveSchedulingConflicts(userId, newScheduleExpression, actionType) {
    try {
      // Get existing user schedules
      const existingSchedulesResult = await this.listScheduledTasksUseCase.execute(
        { userId, status: ScheduledTask.STATUS.ACTIVE },
        { includeUpcoming: true },
        userId
      );

      if (!existingSchedulesResult.success) {
        return {
          success: false,
          error: 'Failed to retrieve existing schedules',
          details: existingSchedulesResult.details
        };
      }

      const existingSchedules = existingSchedulesResult.data.schedules;

      // Analyze conflicts
      const conflicts = this._analyzeScheduleConflicts(existingSchedules, newScheduleExpression, actionType);
      
      // Generate recommendations
      const recommendations = this._generateConflictResolutions(conflicts, newScheduleExpression, actionType);

      return {
        success: true,
        data: {
          hasConflicts: conflicts.length > 0,
          conflicts,
          recommendations,
          conflictSeverity: this._assessConflictSeverity(conflicts),
          alternativeSchedules: await this._suggestAlternativeSchedules(
            newScheduleExpression, 
            actionType, 
            existingSchedules
          )
        }
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to resolve scheduling conflicts',
        details: { field: 'conflicts', message: error.message }
      };
    }
  }

  /**
   * Manages schedule lifecycle transitions
   * 
   * @param {string} scheduleId - Schedule ID
   * @param {string} transition - Lifecycle transition (activate, pause, resume, archive)
   * @param {string} userId - User performing the transition
   * @param {Object} options - Transition options
   * 
   * @returns {Promise<Object>} Result with transition details
   */
  async manageScheduleLifecycle(scheduleId, transition, userId, options = {}) {
    try {
      switch (transition) {
        case 'activate':
          return await this.updateScheduledTaskUseCase.activate(scheduleId, userId);
        
        case 'pause':
          return await this._pauseSchedule(scheduleId, userId, options);
        
        case 'resume':
          return await this._resumeSchedule(scheduleId, userId, options);
        
        case 'archive':
          return await this._archiveSchedule(scheduleId, userId, options);
        
        default:
          return {
            success: false,
            error: 'Unknown lifecycle transition',
            details: { 
              field: 'transition', 
              message: `Unsupported transition: ${transition}`,
              supportedTransitions: ['activate', 'pause', 'resume', 'archive']
            }
          };
      }

    } catch (error) {
      return {
        success: false,
        error: 'Failed to manage schedule lifecycle',
        details: { field: 'lifecycle', message: error.message }
      };
    }
  }

  /**
   * Optimizes user's schedule configuration
   * 
   * @param {string} userId - User ID
   * @param {Object} optimizationOptions - Optimization preferences
   * 
   * @returns {Promise<Object>} Result with optimization suggestions
   */
  async optimizeScheduleConfiguration(userId, optimizationOptions = {}) {
    try {
      // Get user's current schedules
      const schedulesResult = await this.listScheduledTasksUseCase.execute(
        { userId, status: ScheduledTask.STATUS.ACTIVE },
        { includeStats: true, includeUpcoming: true },
        userId
      );

      if (!schedulesResult.success) {
        return schedulesResult;
      }

      const schedules = schedulesResult.data.schedules;
      
      // Analyze current configuration
      const analysis = this._analyzeScheduleConfiguration(schedules, optimizationOptions);
      
      // Generate optimization recommendations
      const optimizations = this._generateOptimizationRecommendations(analysis, optimizationOptions);

      return {
        success: true,
        data: {
          currentConfiguration: analysis,
          optimizations,
          potentialImprovements: this._calculateOptimizationBenefits(optimizations),
          implementationPlan: this._createOptimizationPlan(optimizations)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to optimize schedule configuration',
        details: { field: 'optimization', message: error.message }
      };
    }
  }

  /**
   * Gets comprehensive scheduling dashboard data
   * 
   * @param {string} userId - User ID
   * @param {Object} dashboardOptions - Dashboard configuration options
   * 
   * @returns {Promise<Object>} Result with dashboard data
   */
  async getSchedulingDashboard(userId, dashboardOptions = {}) {
    try {
      const timeRange = dashboardOptions.timeRange || 7; // days

      // Get active schedules
      const activeSchedulesResult = await this.listScheduledTasksUseCase.executeActiveSchedules(userId, userId);
      
      // Get upcoming executions
      const upcomingResult = await this.listScheduledTasksUseCase.executeUpcoming(userId, 24);
      
      // Get recent execution history
      const historyResult = await this.listScheduledTasksUseCase.executeHistory(
        { 
          startDate: new Date(Date.now() - (timeRange * 24 * 60 * 60 * 1000)),
          endDate: new Date()
        }, 
        userId
      );

      // Get overdue tasks
      const overdueResult = await this.listScheduledTasksUseCase.executeOverdue(userId);

      // Aggregate dashboard data
      const dashboardData = {
        summary: {
          activeSchedules: activeSchedulesResult.data?.totalCount || 0,
          upcomingExecutions: upcomingResult.data?.totalCount || 0,
          overdueSchedules: overdueResult.data?.totalCount || 0,
          recentExecutions: historyResult.data?.totalCount || 0
        },
        activeSchedules: activeSchedulesResult.data?.schedules || [],
        upcomingExecutions: upcomingResult.data?.schedules || [],
        overdueSchedules: overdueResult.data?.schedules || [],
        executionHistory: historyResult.data?.schedules || [],
        healthMetrics: this._calculateScheduleHealthMetrics(
          activeSchedulesResult.data?.schedules || [],
          historyResult.data?.schedules || []
        ),
        recommendations: await this._getPersonalizedRecommendations(userId, {
          activeSchedules: activeSchedulesResult.data?.schedules || [],
          executionHistory: historyResult.data?.schedules || []
        })
      };

      return {
        success: true,
        data: dashboardData
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to generate scheduling dashboard',
        details: { field: 'dashboard', message: error.message }
      };
    }
  }

  /**
   * Private: Creates a daily cycle workflow (arm at night, disarm in morning)
   */
  async _createDailyCycleWorkflow(parameters, userId, options) {
    const { 
      armTime = '22:00', 
      disarmTime = '07:00', 
      days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      armMode = 'away'
    } = parameters;

    const scheduleRequests = [];

    // Create arm schedule
    const armDays = days.map(day => new DayOfWeek(day));
    const [armHour, armMinute] = armTime.split(':').map(Number);
    const armScheduleExpression = new ScheduleExpression(armDays, new Time(armHour, armMinute));

    scheduleRequests.push({
      scheduleExpression: armScheduleExpression,
      actionType: ScheduledTask.ACTION_TYPE.ARM_SYSTEM,
      actionParameters: { mode: armMode },
      userId
    });

    // Create disarm schedule
    const disarmDays = days.map(day => new DayOfWeek(day));
    const [disarmHour, disarmMinute] = disarmTime.split(':').map(Number);
    const disarmScheduleExpression = new ScheduleExpression(disarmDays, new Time(disarmHour, disarmMinute));

    scheduleRequests.push({
      scheduleExpression: disarmScheduleExpression,
      actionType: ScheduledTask.ACTION_TYPE.DISARM_SYSTEM,
      actionParameters: {},
      userId
    });

    return await this.createScheduledTaskUseCase.executeBatch(scheduleRequests, userId, options);
  }

  /**
   * Private: Creates a weekly pattern workflow
   */
  async _createWeeklyPatternWorkflow(parameters, userId, options) {
    const { patterns } = parameters;

    if (!Array.isArray(patterns) || patterns.length === 0) {
      return {
        success: false,
        error: 'Weekly patterns are required',
        details: { field: 'patterns', message: 'Must provide array of weekly schedule patterns' }
      };
    }

    const scheduleRequests = [];

    for (const pattern of patterns) {
      const { days, time, actionType, actionParameters = {} } = pattern;
      
      const scheduleDays = days.map(day => new DayOfWeek(day));
      const [hour, minute] = time.split(':').map(Number);
      const scheduleExpression = new ScheduleExpression(scheduleDays, new Time(hour, minute));

      scheduleRequests.push({
        scheduleExpression,
        actionType,
        actionParameters,
        userId
      });
    }

    return await this.createScheduledTaskUseCase.executeBatch(scheduleRequests, userId, options);
  }

  /**
   * Private: Creates vacation mode workflow
   */
  async _createVacationModeWorkflow(parameters, userId, options) {
    // Vacation mode typically involves random scheduling to simulate presence
    // This is a simplified implementation
    
    const { 
      startDate, 
      endDate, 
      randomizeSchedule = true,
      baseArmTime = '21:00',
      baseDis armTime = '08:00'
    } = parameters;

    // For now, create a simple daily cycle
    // A full implementation would create randomized schedules
    return this._createDailyCycleWorkflow({
      armTime: baseArmTime,
      disarmTime: baseDisarmTime,
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      armMode: 'away'
    }, userId, options);
  }

  /**
   * Private: Creates seasonal schedule workflow
   */
  async _createSeasonalScheduleWorkflow(parameters, userId, options) {
    // Seasonal schedules adjust timing based on daylight hours
    // This is a placeholder for a more complex implementation
    
    return {
      success: false,
      error: 'Seasonal schedules not yet implemented',
      details: { field: 'seasonal', message: 'Feature under development' }
    };
  }

  /**
   * Private: Analyzes schedule conflicts
   */
  _analyzeScheduleConflicts(existingSchedules, newScheduleExpression, actionType) {
    const conflicts = [];

    for (const schedule of existingSchedules) {
      // Check for time conflicts
      if (this._hasTimeConflict(schedule.scheduleExpression, newScheduleExpression)) {
        conflicts.push({
          type: 'time_conflict',
          conflictingSchedule: schedule,
          severity: 'high',
          description: `Time conflict with existing ${schedule.actionType} schedule`
        });
      }

      // Check for logical conflicts (arm after arm, disarm after disarm)
      if (this._hasLogicalConflict(schedule, actionType, newScheduleExpression)) {
        conflicts.push({
          type: 'logical_conflict',
          conflictingSchedule: schedule,
          severity: 'medium',
          description: `Logical conflict: ${actionType} scheduled after ${schedule.actionType}`
        });
      }
    }

    return conflicts;
  }

  /**
   * Private: Generates conflict resolution recommendations
   */
  _generateConflictResolutions(conflicts, newScheduleExpression, actionType) {
    const recommendations = [];

    for (const conflict of conflicts) {
      switch (conflict.type) {
        case 'time_conflict':
          recommendations.push({
            type: 'reschedule',
            description: 'Reschedule one of the conflicting tasks',
            suggestedActions: [
              'Move new schedule to a different time',
              'Modify existing schedule timing',
              'Cancel conflicting schedule'
            ]
          });
          break;
        
        case 'logical_conflict':
          recommendations.push({
            type: 'reorder',
            description: 'Reorder schedules to create logical sequence',
            suggestedActions: [
              'Ensure ARM schedules come before DISARM schedules',
              'Add time buffer between conflicting actions'
            ]
          });
          break;
      }
    }

    return recommendations;
  }

  /**
   * Private: Assesses conflict severity
   */
  _assessConflictSeverity(conflicts) {
    if (conflicts.length === 0) return 'none';
    
    const hasHighSeverity = conflicts.some(c => c.severity === 'high');
    const hasMediumSeverity = conflicts.some(c => c.severity === 'medium');
    
    if (hasHighSeverity) return 'high';
    if (hasMediumSeverity) return 'medium';
    return 'low';
  }

  /**
   * Private: Suggests alternative schedules
   */
  async _suggestAlternativeSchedules(originalExpression, actionType, existingSchedules) {
    const alternatives = [];
    const originalTime = originalExpression.time;

    // Suggest times 30 minutes before and after
    const beforeTime = new Time(
      originalTime.hour, 
      Math.max(0, originalTime.minute - 30)
    );
    const afterTime = new Time(
      originalTime.hour, 
      Math.min(59, originalTime.minute + 30)
    );

    alternatives.push({
      description: '30 minutes earlier',
      scheduleExpression: new ScheduleExpression(originalExpression.days, beforeTime)
    });

    alternatives.push({
      description: '30 minutes later',
      scheduleExpression: new ScheduleExpression(originalExpression.days, afterTime)
    });

    return alternatives;
  }

  /**
   * Private: Helper methods for conflict detection
   */
  _hasTimeConflict(existing, newSchedule) {
    // Check if schedules overlap in time (within 10 minutes)
    const timeDiff = Math.abs(
      existing.time.differenceInMinutes(newSchedule.time)
    );
    
    // Check if any days overlap
    const daysOverlap = existing.days.some(existingDay =>
      newSchedule.days.some(newDay => newDay.equals(existingDay))
    );
    
    return daysOverlap && timeDiff < 10;
  }

  _hasLogicalConflict(existingSchedule, newActionType, newScheduleExpression) {
    // Simple logical conflict: same action type at similar times
    if (existingSchedule.actionType === newActionType) {
      return this._hasTimeConflict(existingSchedule.scheduleExpression, newScheduleExpression);
    }
    return false;
  }

  /**
   * Private: Schedule configuration analysis methods
   */
  _analyzeScheduleConfiguration(schedules, options) {
    return {
      totalSchedules: schedules.length,
      byActionType: this._groupSchedulesByActionType(schedules),
      timeDistribution: this._analyzeTimeDistribution(schedules),
      weeklyPattern: this._analyzeWeeklyPattern(schedules),
      potentialIssues: this._identifyConfigurationIssues(schedules)
    };
  }

  _groupSchedulesByActionType(schedules) {
    return schedules.reduce((groups, schedule) => {
      groups[schedule.actionType] = (groups[schedule.actionType] || 0) + 1;
      return groups;
    }, {});
  }

  _analyzeTimeDistribution(schedules) {
    // Analyze what times of day schedules are concentrated
    const hourCounts = {};
    schedules.forEach(schedule => {
      const hour = schedule.scheduleExpression.time.hour;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    return hourCounts;
  }

  _analyzeWeeklyPattern(schedules) {
    // Analyze day-of-week distribution
    const dayCounts = {};
    schedules.forEach(schedule => {
      schedule.scheduleExpression.days.forEach(day => {
        dayCounts[day.value] = (dayCounts[day.value] || 0) + 1;
      });
    });
    return dayCounts;
  }

  _identifyConfigurationIssues(schedules) {
    const issues = [];
    
    // Check for too many schedules in a short time window
    // Check for unbalanced arm/disarm ratios
    // Check for gaps in coverage
    
    return issues;
  }

  _generateOptimizationRecommendations(analysis, options) {
    const recommendations = [];
    
    // Add specific optimization suggestions based on analysis
    if (analysis.totalSchedules > 20) {
      recommendations.push({
        type: 'consolidation',
        description: 'Consider consolidating similar schedules',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  _calculateOptimizationBenefits(optimizations) {
    return {
      estimatedTimeReduction: 0,
      reducedComplexity: 0,
      improvedReliability: 0
    };
  }

  _createOptimizationPlan(optimizations) {
    return optimizations.map((opt, index) => ({
      step: index + 1,
      action: opt.description,
      priority: opt.priority,
      estimatedTime: '5-10 minutes'
    }));
  }

  _calculateScheduleHealthMetrics(activeSchedules, executionHistory) {
    return {
      reliability: this._calculateReliabilityScore(executionHistory),
      coverage: this._calculateCoverageScore(activeSchedules),
      efficiency: this._calculateEfficiencyScore(activeSchedules, executionHistory)
    };
  }

  _calculateReliabilityScore(executionHistory) {
    if (executionHistory.length === 0) return 100;
    
    const successful = executionHistory.filter(h => h.executionStats?.successCount > 0).length;
    return Math.round((successful / executionHistory.length) * 100);
  }

  _calculateCoverageScore(activeSchedules) {
    // Calculate how well the week is covered by schedules
    const daysCovered = new Set();
    activeSchedules.forEach(schedule => {
      schedule.scheduleExpression.days.forEach(day => daysCovered.add(day.value));
    });
    
    return Math.round((daysCovered.size / 7) * 100);
  }

  _calculateEfficiencyScore(activeSchedules, executionHistory) {
    // Simple efficiency calculation based on schedule count vs execution success
    if (activeSchedules.length === 0) return 100;
    
    const avgSuccessRate = this._calculateReliabilityScore(executionHistory);
    const scheduleLoad = Math.min(activeSchedules.length / 10, 1); // Normalize to 0-1
    
    return Math.round(avgSuccessRate * (1 - scheduleLoad * 0.2));
  }

  async _getPersonalizedRecommendations(userId, data) {
    const recommendations = [];
    
    // Analyze user's scheduling patterns and provide personalized suggestions
    if (data.activeSchedules.length === 0) {
      recommendations.push({
        type: 'setup',
        title: 'Get Started',
        description: 'Create your first schedule to automate system arming',
        priority: 'high'
      });
    }
    
    return recommendations;
  }

  // Lifecycle management methods
  async _pauseSchedule(scheduleId, userId, options) {
    // Implementation would pause a schedule without cancelling it
    return {
      success: false,
      error: 'Schedule pause/resume functionality not yet implemented',
      details: { field: 'lifecycle', message: 'Feature under development' }
    };
  }

  async _resumeSchedule(scheduleId, userId, options) {
    // Implementation would resume a paused schedule
    return {
      success: false,
      error: 'Schedule pause/resume functionality not yet implemented',
      details: { field: 'lifecycle', message: 'Feature under development' }
    };
  }

  async _archiveSchedule(scheduleId, userId, options) {
    // Implementation would archive completed/old schedules
    return {
      success: false,
      error: 'Schedule archiving functionality not yet implemented',
      details: { field: 'lifecycle', message: 'Feature under development' }
    };
  }
}

module.exports = SchedulingService;