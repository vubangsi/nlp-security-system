const ScheduledTask = require('../../domain/entities/ScheduledTask');

/**
 * ListScheduledTasksUseCase
 * 
 * Orchestrates the retrieval and filtering of scheduled tasks with various
 * query options. Provides comprehensive listing capabilities with support
 * for filtering, sorting, pagination, and user-specific views.
 */
class ListScheduledTasksUseCase {
  constructor(scheduledTaskRepository, userRepository = null) {
    this.scheduledTaskRepository = scheduledTaskRepository;
    this.userRepository = userRepository;
  }

  /**
   * Lists scheduled tasks with filtering and sorting options
   * 
   * @param {Object} filters - Filtering criteria
   * @param {string} filters.userId - User ID to filter by
   * @param {string} filters.status - Task status filter (ACTIVE, PENDING, COMPLETED, CANCELLED, FAILED)
   * @param {string} filters.actionType - Action type filter (ARM_SYSTEM, DISARM_SYSTEM)
   * @param {string} filters.timeFilter - Time-based filter (today, week, month, overdue)
   * @param {Date} filters.startDate - Custom start date for filtering
   * @param {Date} filters.endDate - Custom end date for filtering
   * @param {string} filters.searchTerm - Search in description or action parameters
   * 
   * @param {Object} options - Query options
   * @param {string} options.sortBy - Field to sort by (createdAt, nextExecutionTime, status)
   * @param {string} options.sortOrder - Sort order (asc, desc)
   * @param {number} options.limit - Maximum number of results
   * @param {number} options.offset - Number of results to skip
   * @param {boolean} options.includeStats - Include execution statistics
   * @param {boolean} options.includeUpcoming - Include upcoming execution times
   * @param {string} requestingUserId - User making the request (for permission checks)
   * 
   * @returns {Promise<Object>} Result with schedules array and metadata
   */
  async execute(filters = {}, options = {}, requestingUserId) {
    try {
      // Validate requesting user
      if (!requestingUserId) {
        return {
          success: false,
          error: 'User ID is required',
          details: { field: 'requestingUserId', message: 'Must specify the requesting user' }
        };
      }

      // Validate user permissions
      const permissionCheck = await this._validateListPermissions(requestingUserId, filters.userId);
      if (!permissionCheck.success) {
        return permissionCheck;
      }

      // Set default options
      const queryOptions = {
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'desc',
        limit: options.limit || 100,
        offset: options.offset || 0,
        includeStats: options.includeStats !== false,
        includeUpcoming: options.includeUpcoming !== false,
        ...options
      };

      // Apply user filter - regular users can only see their own schedules
      const effectiveFilters = { ...filters };
      if (!await this._isAdmin(requestingUserId)) {
        effectiveFilters.userId = requestingUserId;
      }

      // Execute query based on filters
      let tasks = [];
      if (effectiveFilters.timeFilter) {
        tasks = await this._getTasksByTimeFilter(effectiveFilters, queryOptions);
      } else {
        tasks = await this._getTasksByFilters(effectiveFilters, queryOptions);
      }

      // Apply additional filtering that requires loaded entities
      tasks = this._applyEntityFilters(tasks, effectiveFilters);

      // Sort tasks
      tasks = this._sortTasks(tasks, queryOptions.sortBy, queryOptions.sortOrder);

      // Apply pagination
      const totalCount = tasks.length;
      const paginatedTasks = tasks.slice(queryOptions.offset, queryOptions.offset + queryOptions.limit);

      // Prepare response data
      const scheduleData = await this._prepareScheduleData(paginatedTasks, queryOptions);

      // Calculate summary statistics
      const summary = this._calculateSummaryStats(tasks);

      return {
        success: true,
        data: {
          schedules: scheduleData,
          totalCount,
          returnedCount: paginatedTasks.length,
          summary,
          pagination: {
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            hasMore: (queryOptions.offset + paginatedTasks.length) < totalCount
          }
        },
        message: `Found ${totalCount} schedule${totalCount !== 1 ? 's' : ''}`
      };

    } catch (error) {
      console.error('ListScheduledTasksUseCase error:', error);
      
      return {
        success: false,
        error: 'An unexpected error occurred while listing scheduled tasks',
        details: { 
          field: 'system', 
          message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        }
      };
    }
  }

  /**
   * Lists active scheduled tasks for a specific user
   * 
   * @param {string} userId - User ID
   * @param {string} requestingUserId - User making the request
   * 
   * @returns {Promise<Object>} Result with active schedules
   */
  async executeActiveSchedules(userId, requestingUserId) {
    const filters = { 
      userId, 
      status: ScheduledTask.STATUS.ACTIVE 
    };
    
    const options = { 
      sortBy: 'nextExecutionTime', 
      sortOrder: 'asc',
      includeUpcoming: true 
    };

    return this.execute(filters, options, requestingUserId);
  }

  /**
   * Lists upcoming scheduled tasks (next 24 hours)
   * 
   * @param {string} requestingUserId - User making the request
   * @param {number} hoursAhead - Hours to look ahead (default: 24)
   * 
   * @returns {Promise<Object>} Result with upcoming schedules
   */
  async executeUpcoming(requestingUserId, hoursAhead = 24) {
    const filters = { 
      timeFilter: 'upcoming',
      hoursAhead 
    };
    
    const options = { 
      sortBy: 'nextExecutionTime', 
      sortOrder: 'asc',
      includeUpcoming: false // No need since these are already upcoming
    };

    return this.execute(filters, options, requestingUserId);
  }

  /**
   * Lists overdue scheduled tasks
   * 
   * @param {string} requestingUserId - User making the request
   * @param {number} toleranceMinutes - Tolerance for overdue (default: 5)
   * 
   * @returns {Promise<Object>} Result with overdue schedules
   */
  async executeOverdue(requestingUserId, toleranceMinutes = 5) {
    const filters = { 
      timeFilter: 'overdue',
      toleranceMinutes 
    };
    
    const options = { 
      sortBy: 'nextExecutionTime', 
      sortOrder: 'asc',
      includeStats: true 
    };

    return this.execute(filters, options, requestingUserId);
  }

  /**
   * Gets execution history for scheduled tasks
   * 
   * @param {Object} filters - History filters
   * @param {string} requestingUserId - User making the request
   * 
   * @returns {Promise<Object>} Result with execution history
   */
  async executeHistory(filters = {}, requestingUserId) {
    const historyFilters = {
      ...filters,
      status: [ScheduledTask.STATUS.COMPLETED, ScheduledTask.STATUS.FAILED]
    };
    
    const options = { 
      sortBy: 'lastExecutionTime', 
      sortOrder: 'desc',
      includeStats: true,
      includeUpcoming: false
    };

    return this.execute(historyFilters, options, requestingUserId);
  }

  /**
   * Private: Gets tasks by time-based filters
   */
  async _getTasksByTimeFilter(filters, options) {
    const now = new Date();
    
    switch (filters.timeFilter) {
      case 'today':
        return this._getTasksForToday(filters, now);
        
      case 'week':
        return this._getTasksForWeek(filters, now);
        
      case 'month':
        return this._getTasksForMonth(filters, now);
        
      case 'upcoming':
        return this._getUpcomingTasks(filters, now);
        
      case 'overdue':
        return this._getOverdueTasks(filters, now);
        
      default:
        return this._getTasksByFilters(filters, options);
    }
  }

  /**
   * Private: Gets tasks for today
   */
  async _getTasksForToday(filters, now) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    let tasks = [];
    if (filters.userId) {
      const userTasks = await this.scheduledTaskRepository.findByUserId(filters.userId);
      tasks = userTasks.filter(task => 
        task.nextExecutionTime && 
        task.nextExecutionTime >= startOfDay && 
        task.nextExecutionTime <= endOfDay
      );
    } else {
      tasks = await this.scheduledTaskRepository.findByNextExecutionTimeBetween(startOfDay, endOfDay);
    }
    
    return tasks;
  }

  /**
   * Private: Gets tasks for the current week
   */
  async _getTasksForWeek(filters, now) {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    let tasks = [];
    if (filters.userId) {
      const userTasks = await this.scheduledTaskRepository.findByUserId(filters.userId);
      tasks = userTasks.filter(task => 
        task.nextExecutionTime && 
        task.nextExecutionTime >= startOfWeek && 
        task.nextExecutionTime <= endOfWeek
      );
    } else {
      tasks = await this.scheduledTaskRepository.findByNextExecutionTimeBetween(startOfWeek, endOfWeek);
    }
    
    return tasks;
  }

  /**
   * Private: Gets tasks for the current month
   */
  async _getTasksForMonth(filters, now) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    let tasks = [];
    if (filters.userId) {
      const userTasks = await this.scheduledTaskRepository.findByUserId(filters.userId);
      tasks = userTasks.filter(task => 
        task.nextExecutionTime && 
        task.nextExecutionTime >= startOfMonth && 
        task.nextExecutionTime <= endOfMonth
      );
    } else {
      tasks = await this.scheduledTaskRepository.findByNextExecutionTimeBetween(startOfMonth, endOfMonth);
    }
    
    return tasks;
  }

  /**
   * Private: Gets upcoming tasks within specified hours
   */
  async _getUpcomingTasks(filters, now) {
    const hoursAhead = filters.hoursAhead || 24;
    const futureTime = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000));
    
    let tasks = [];
    if (filters.userId) {
      const userTasks = await this.scheduledTaskRepository.findByUserId(filters.userId);
      tasks = userTasks.filter(task => 
        task.status === ScheduledTask.STATUS.ACTIVE &&
        task.nextExecutionTime && 
        task.nextExecutionTime >= now && 
        task.nextExecutionTime <= futureTime
      );
    } else {
      tasks = await this.scheduledTaskRepository.findByNextExecutionTimeBetween(now, futureTime);
      tasks = tasks.filter(task => task.status === ScheduledTask.STATUS.ACTIVE);
    }
    
    return tasks;
  }

  /**
   * Private: Gets overdue tasks
   */
  async _getOverdueTasks(filters, now) {
    const toleranceMinutes = filters.toleranceMinutes || 5;
    
    if (filters.userId) {
      const userTasks = await this.scheduledTaskRepository.findByUserId(filters.userId);
      return userTasks.filter(task => task.isOverdue(now, toleranceMinutes));
    } else {
      return await this.scheduledTaskRepository.findOverdue(toleranceMinutes);
    }
  }

  /**
   * Private: Gets tasks by standard filters
   */
  async _getTasksByFilters(filters, options) {
    // Start with base query
    let tasks = [];
    
    if (filters.userId) {
      if (filters.status) {
        tasks = await this.scheduledTaskRepository.findByUserIdAndStatus(filters.userId, filters.status);
      } else {
        tasks = await this.scheduledTaskRepository.findByUserId(filters.userId);
      }
    } else if (filters.status) {
      tasks = await this.scheduledTaskRepository.findByStatus(filters.status);
    } else {
      const result = await this.scheduledTaskRepository.findAll({
        limit: options.limit * 2, // Get extra to account for filtering
        offset: options.offset,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder
      });
      tasks = result.tasks || [];
    }
    
    return tasks;
  }

  /**
   * Private: Applies filters that require loaded entities
   */
  _applyEntityFilters(tasks, filters) {
    let filteredTasks = [...tasks];
    
    // Action type filter
    if (filters.actionType) {
      filteredTasks = filteredTasks.filter(task => task.actionType === filters.actionType);
    }
    
    // Search term filter
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filteredTasks = filteredTasks.filter(task => {
        const description = task.getDescription().toLowerCase();
        const actionType = task.actionType.toLowerCase();
        return description.includes(searchTerm) || actionType.includes(searchTerm);
      });
    }
    
    // Date range filter
    if (filters.startDate || filters.endDate) {
      filteredTasks = filteredTasks.filter(task => {
        if (!task.nextExecutionTime) return false;
        
        if (filters.startDate && task.nextExecutionTime < filters.startDate) {
          return false;
        }
        
        if (filters.endDate && task.nextExecutionTime > filters.endDate) {
          return false;
        }
        
        return true;
      });
    }
    
    return filteredTasks;
  }

  /**
   * Private: Sorts tasks by specified criteria
   */
  _sortTasks(tasks, sortBy, sortOrder) {
    const isAscending = sortOrder === 'asc';
    
    return tasks.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'nextExecutionTime':
          valueA = a.nextExecutionTime || new Date(0);
          valueB = b.nextExecutionTime || new Date(0);
          break;
        case 'lastExecutionTime':
          valueA = a.lastExecutionTime || new Date(0);
          valueB = b.lastExecutionTime || new Date(0);
          break;
        case 'createdAt':
          valueA = a.createdAt;
          valueB = b.createdAt;
          break;
        case 'status':
          valueA = a.status;
          valueB = b.status;
          break;
        case 'actionType':
          valueA = a.actionType;
          valueB = b.actionType;
          break;
        default:
          valueA = a.createdAt;
          valueB = b.createdAt;
      }
      
      if (valueA < valueB) return isAscending ? -1 : 1;
      if (valueA > valueB) return isAscending ? 1 : -1;
      return 0;
    });
  }

  /**
   * Private: Prepares schedule data for response
   */
  async _prepareScheduleData(tasks, options) {
    return tasks.map(task => {
      const scheduleData = {
        id: task.id,
        userId: task.userId,
        description: task.getDescription(),
        actionType: task.actionType,
        actionParameters: task.actionParameters,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        nextExecution: task.nextExecutionTime,
        lastExecution: task.lastExecutionTime
      };

      // Include execution statistics if requested
      if (options.includeStats) {
        scheduleData.executionStats = task.getExecutionStats();
      }

      // Include upcoming executions if requested
      if (options.includeUpcoming && task.status === ScheduledTask.STATUS.ACTIVE) {
        scheduleData.upcomingExecutions = task.getUpcomingExecutions(7);
      }

      // Include schedule expression details
      scheduleData.scheduleExpression = task.scheduleExpression.toJSON();

      return scheduleData;
    });
  }

  /**
   * Private: Calculates summary statistics
   */
  _calculateSummaryStats(tasks) {
    const summary = {
      total: tasks.length,
      byStatus: {},
      byActionType: {},
      overdue: 0,
      nextExecution: null
    };

    const now = new Date();
    let nextExecution = null;

    tasks.forEach(task => {
      // Count by status
      summary.byStatus[task.status] = (summary.byStatus[task.status] || 0) + 1;
      
      // Count by action type
      summary.byActionType[task.actionType] = (summary.byActionType[task.actionType] || 0) + 1;
      
      // Count overdue
      if (task.isOverdue(now)) {
        summary.overdue++;
      }
      
      // Find next execution
      if (task.status === ScheduledTask.STATUS.ACTIVE && task.nextExecutionTime) {
        if (!nextExecution || task.nextExecutionTime < nextExecution) {
          nextExecution = task.nextExecutionTime;
        }
      }
    });

    summary.nextExecution = nextExecution;
    return summary;
  }

  /**
   * Private: Validates user permissions for listing schedules
   */
  async _validateListPermissions(requestingUserId, filterUserId) {
    if (!this.userRepository) {
      return { success: true }; // Skip validation if no user repository
    }

    try {
      const user = await this.userRepository.findById(requestingUserId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          details: { field: 'requestingUserId', message: 'The requesting user does not exist' }
        };
      }

      // If filtering by another user ID, check admin permissions
      if (filterUserId && filterUserId !== requestingUserId && user.role !== 'admin') {
        return {
          success: false,
          error: 'Insufficient permissions',
          details: { field: 'permissions', message: 'Only administrators can view other users\' schedules' }
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: 'Permission validation failed',
        details: { field: 'permissions', message: error.message }
      };
    }
  }

  /**
   * Private: Checks if user is admin
   */
  async _isAdmin(userId) {
    if (!this.userRepository) {
      return false; // Default to non-admin if no user repository
    }

    try {
      const user = await this.userRepository.findById(userId);
      return user && user.role === 'admin';
    } catch (error) {
      return false;
    }
  }
}

module.exports = ListScheduledTasksUseCase;