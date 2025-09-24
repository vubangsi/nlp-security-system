const ScheduledTaskRepository = require('../../domain/repositories/ScheduledTaskRepository');
const ScheduledTask = require('../../domain/entities/ScheduledTask');

/**
 * InMemoryScheduledTaskRepository
 * 
 * In-memory implementation of ScheduledTaskRepository following the established
 * pattern used by other repositories in the system. Uses Map for efficient
 * lookups and provides all methods defined in the domain repository interface.
 */
class InMemoryScheduledTaskRepository extends ScheduledTaskRepository {
  constructor() {
    super();
    this.tasks = new Map(); // id -> ScheduledTask
    this.userTasksIndex = new Map(); // userId -> Set of task ids
    this.statusIndex = new Map(); // status -> Set of task ids
    this.actionTypeIndex = new Map(); // actionType -> Set of task ids
    this.nextTaskId = 1;
  }

  /**
   * Saves a scheduled task (create or update)
   * @param {ScheduledTask} scheduledTask - The task to save
   * @returns {Promise<ScheduledTask>} The saved task
   * @throws {Error} If save operation fails
   */
  async save(scheduledTask) {
    try {
      if (!scheduledTask || typeof scheduledTask !== 'object') {
        throw new Error('Invalid scheduled task provided');
      }

      // Ensure task has an ID
      if (!scheduledTask.id) {
        scheduledTask.id = `task_${this.nextTaskId++}`;
      }

      // Remove old indexes if updating
      const existingTask = this.tasks.get(scheduledTask.id);
      if (existingTask) {
        this._removeFromIndexes(existingTask);
      }

      // Store task
      this.tasks.set(scheduledTask.id, scheduledTask);

      // Update indexes
      this._addToIndexes(scheduledTask);

      return scheduledTask;

    } catch (error) {
      console.error('Error saving scheduled task:', error);
      throw new Error(`Failed to save scheduled task: ${error.message}`);
    }
  }

  /**
   * Finds a scheduled task by its ID
   * @param {string} id - The task ID
   * @returns {Promise<ScheduledTask|null>} The task if found, null otherwise
   * @throws {Error} If query operation fails
   */
  async findById(id) {
    try {
      if (!id) {
        return null;
      }
      return this.tasks.get(id) || null;
    } catch (error) {
      console.error('Error finding task by ID:', error);
      throw new Error(`Failed to find task by ID: ${error.message}`);
    }
  }

  /**
   * Finds all scheduled tasks for a specific user
   * @param {string} userId - The user ID
   * @returns {Promise<ScheduledTask[]>} Array of user's tasks
   * @throws {Error} If query operation fails
   */
  async findByUserId(userId) {
    try {
      if (!userId) {
        return [];
      }

      const userTaskIds = this.userTasksIndex.get(userId);
      if (!userTaskIds) {
        return [];
      }

      return Array.from(userTaskIds)
        .map(id => this.tasks.get(id))
        .filter(task => task != null);

    } catch (error) {
      console.error('Error finding tasks by user ID:', error);
      throw new Error(`Failed to find tasks by user ID: ${error.message}`);
    }
  }

  /**
   * Finds scheduled tasks by status
   * @param {string} status - The task status
   * @returns {Promise<ScheduledTask[]>} Array of tasks with matching status
   * @throws {Error} If query operation fails
   */
  async findByStatus(status) {
    try {
      if (!status) {
        return [];
      }

      const statusTaskIds = this.statusIndex.get(status);
      if (!statusTaskIds) {
        return [];
      }

      return Array.from(statusTaskIds)
        .map(id => this.tasks.get(id))
        .filter(task => task != null);

    } catch (error) {
      console.error('Error finding tasks by status:', error);
      throw new Error(`Failed to find tasks by status: ${error.message}`);
    }
  }

  /**
   * Finds all active scheduled tasks
   * @returns {Promise<ScheduledTask[]>} Array of active tasks
   * @throws {Error} If query operation fails
   */
  async findActive() {
    return this.findByStatus(ScheduledTask.STATUS.ACTIVE);
  }

  /**
   * Finds scheduled tasks that are due for execution
   * @param {Date} beforeTime - Find tasks due before this time (default: now)
   * @returns {Promise<ScheduledTask[]>} Array of tasks due for execution
   * @throws {Error} If query operation fails
   */
  async findByNextExecutionTimeBefore(beforeTime = new Date()) {
    try {
      const activeTasks = await this.findActive();
      
      return activeTasks.filter(task => {
        return task.nextExecutionTime && task.nextExecutionTime <= beforeTime;
      });

    } catch (error) {
      console.error('Error finding tasks due for execution:', error);
      throw new Error(`Failed to find tasks due for execution: ${error.message}`);
    }
  }

  /**
   * Finds scheduled tasks within a time range
   * @param {Date} startTime - Start of time range
   * @param {Date} endTime - End of time range
   * @returns {Promise<ScheduledTask[]>} Array of tasks in the time range
   * @throws {Error} If query operation fails
   */
  async findByNextExecutionTimeBetween(startTime, endTime) {
    try {
      if (!startTime || !endTime || startTime > endTime) {
        return [];
      }

      const activeTasks = await this.findActive();
      
      return activeTasks.filter(task => {
        return task.nextExecutionTime && 
               task.nextExecutionTime >= startTime && 
               task.nextExecutionTime <= endTime;
      });

    } catch (error) {
      console.error('Error finding tasks by time range:', error);
      throw new Error(`Failed to find tasks by time range: ${error.message}`);
    }
  }

  /**
   * Finds scheduled tasks by user and status
   * @param {string} userId - The user ID
   * @param {string} status - The task status
   * @returns {Promise<ScheduledTask[]>} Array of matching tasks
   * @throws {Error} If query operation fails
   */
  async findByUserIdAndStatus(userId, status) {
    try {
      if (!userId || !status) {
        return [];
      }

      const userTasks = await this.findByUserId(userId);
      return userTasks.filter(task => task.status === status);

    } catch (error) {
      console.error('Error finding tasks by user and status:', error);
      throw new Error(`Failed to find tasks by user and status: ${error.message}`);
    }
  }

  /**
   * Finds scheduled tasks by action type
   * @param {string} actionType - The action type
   * @returns {Promise<ScheduledTask[]>} Array of tasks with matching action type
   * @throws {Error} If query operation fails
   */
  async findByActionType(actionType) {
    try {
      if (!actionType) {
        return [];
      }

      const actionTypeTaskIds = this.actionTypeIndex.get(actionType);
      if (!actionTypeTaskIds) {
        return [];
      }

      return Array.from(actionTypeTaskIds)
        .map(id => this.tasks.get(id))
        .filter(task => task != null);

    } catch (error) {
      console.error('Error finding tasks by action type:', error);
      throw new Error(`Failed to find tasks by action type: ${error.message}`);
    }
  }

  /**
   * Finds scheduled tasks created within a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<ScheduledTask[]>} Array of tasks created in the date range
   * @throws {Error} If query operation fails
   */
  async findByCreatedAtBetween(startDate, endDate) {
    try {
      if (!startDate || !endDate || startDate > endDate) {
        return [];
      }

      return Array.from(this.tasks.values()).filter(task => {
        return task.createdAt >= startDate && task.createdAt <= endDate;
      });

    } catch (error) {
      console.error('Error finding tasks by creation date range:', error);
      throw new Error(`Failed to find tasks by creation date range: ${error.message}`);
    }
  }

  /**
   * Finds overdue scheduled tasks
   * @param {number} toleranceMinutes - Minutes past due time to consider overdue
   * @returns {Promise<ScheduledTask[]>} Array of overdue tasks
   * @throws {Error} If query operation fails
   */
  async findOverdue(toleranceMinutes = 5) {
    try {
      const currentTime = new Date();
      const toleranceMs = toleranceMinutes * 60 * 1000;
      const overdueThreshold = new Date(currentTime.getTime() - toleranceMs);

      const activeTasks = await this.findActive();
      
      return activeTasks.filter(task => {
        return task.nextExecutionTime && task.nextExecutionTime < overdueThreshold;
      });

    } catch (error) {
      console.error('Error finding overdue tasks:', error);
      throw new Error(`Failed to find overdue tasks: ${error.message}`);
    }
  }

  /**
   * Finds scheduled tasks that have failed multiple times
   * @param {number} minFailureCount - Minimum number of failures
   * @returns {Promise<ScheduledTask[]>} Array of frequently failing tasks
   * @throws {Error} If query operation fails
   */
  async findFrequentFailures(minFailureCount = 3) {
    try {
      return Array.from(this.tasks.values()).filter(task => {
        return task.failureCount >= minFailureCount;
      });

    } catch (error) {
      console.error('Error finding frequently failing tasks:', error);
      throw new Error(`Failed to find frequently failing tasks: ${error.message}`);
    }
  }

  /**
   * Counts scheduled tasks by status
   * @param {string} status - The task status
   * @returns {Promise<number>} Count of tasks with the status
   * @throws {Error} If query operation fails
   */
  async countByStatus(status) {
    try {
      const tasks = await this.findByStatus(status);
      return tasks.length;
    } catch (error) {
      console.error('Error counting tasks by status:', error);
      throw new Error(`Failed to count tasks by status: ${error.message}`);
    }
  }

  /**
   * Counts scheduled tasks for a specific user
   * @param {string} userId - The user ID
   * @returns {Promise<number>} Count of user's tasks
   * @throws {Error} If query operation fails
   */
  async countByUserId(userId) {
    try {
      const tasks = await this.findByUserId(userId);
      return tasks.length;
    } catch (error) {
      console.error('Error counting tasks by user ID:', error);
      throw new Error(`Failed to count tasks by user ID: ${error.message}`);
    }
  }

  /**
   * Deletes a scheduled task by ID
   * @param {string} id - The task ID
   * @returns {Promise<boolean>} True if task was deleted, false if not found
   * @throws {Error} If delete operation fails
   */
  async delete(id) {
    try {
      const task = this.tasks.get(id);
      if (!task) {
        return false;
      }

      // Remove from indexes
      this._removeFromIndexes(task);
      
      // Remove from main storage
      this.tasks.delete(id);
      
      return true;

    } catch (error) {
      console.error('Error deleting task:', error);
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  }

  /**
   * Deletes all scheduled tasks for a user
   * @param {string} userId - The user ID
   * @returns {Promise<number>} Number of tasks deleted
   * @throws {Error} If delete operation fails
   */
  async deleteByUserId(userId) {
    try {
      const userTasks = await this.findByUserId(userId);
      let deletedCount = 0;

      for (const task of userTasks) {
        const deleted = await this.delete(task.id);
        if (deleted) {
          deletedCount++;
        }
      }

      return deletedCount;

    } catch (error) {
      console.error('Error deleting tasks by user ID:', error);
      throw new Error(`Failed to delete tasks by user ID: ${error.message}`);
    }
  }

  /**
   * Deletes scheduled tasks by status
   * @param {string} status - The task status
   * @returns {Promise<number>} Number of tasks deleted
   * @throws {Error} If delete operation fails
   */
  async deleteByStatus(status) {
    try {
      const statusTasks = await this.findByStatus(status);
      let deletedCount = 0;

      for (const task of statusTasks) {
        const deleted = await this.delete(task.id);
        if (deleted) {
          deletedCount++;
        }
      }

      return deletedCount;

    } catch (error) {
      console.error('Error deleting tasks by status:', error);
      throw new Error(`Failed to delete tasks by status: ${error.message}`);
    }
  }

  /**
   * Checks if a task exists with the given ID
   * @param {string} id - The task ID
   * @returns {Promise<boolean>} True if task exists, false otherwise
   * @throws {Error} If query operation fails
   */
  async exists(id) {
    try {
      return this.tasks.has(id);
    } catch (error) {
      console.error('Error checking task existence:', error);
      throw new Error(`Failed to check task existence: ${error.message}`);
    }
  }

  /**
   * Updates the next execution time for multiple tasks
   * @param {Array<{id: string, nextExecutionTime: Date}>} updates - Array of update objects
   * @returns {Promise<number>} Number of tasks updated
   * @throws {Error} If update operation fails
   */
  async batchUpdateNextExecutionTime(updates) {
    try {
      if (!Array.isArray(updates)) {
        return 0;
      }

      let updatedCount = 0;

      for (const update of updates) {
        const task = this.tasks.get(update.id);
        if (task && update.nextExecutionTime instanceof Date) {
          task.nextExecutionTime = update.nextExecutionTime;
          await this.save(task);
          updatedCount++;
        }
      }

      return updatedCount;

    } catch (error) {
      console.error('Error batch updating next execution times:', error);
      throw new Error(`Failed to batch update next execution times: ${error.message}`);
    }
  }

  /**
   * Finds all scheduled tasks (with optional pagination)
   * @param {Object} options - Query options
   * @returns {Promise<{tasks: ScheduledTask[], total: number}>} Paginated results
   * @throws {Error} If query operation fails
   */
  async findAll(options = {}) {
    try {
      const {
        limit = null,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      let allTasks = Array.from(this.tasks.values());
      const total = allTasks.length;

      // Sort tasks
      allTasks.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        // Handle Date objects and null values
        if (aValue instanceof Date) aValue = aValue.getTime();
        if (bValue instanceof Date) bValue = bValue.getTime();
        if (aValue == null) aValue = 0;
        if (bValue == null) bValue = 0;

        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      // Apply pagination
      if (offset > 0) {
        allTasks = allTasks.slice(offset);
      }
      if (limit && limit > 0) {
        allTasks = allTasks.slice(0, limit);
      }

      return {
        tasks: allTasks,
        total: total
      };

    } catch (error) {
      console.error('Error finding all tasks:', error);
      throw new Error(`Failed to find all tasks: ${error.message}`);
    }
  }

  /**
   * Searches scheduled tasks by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<ScheduledTask[]>} Array of matching tasks
   * @throws {Error} If query operation fails
   */
  async search(criteria) {
    try {
      if (!criteria || typeof criteria !== 'object') {
        return [];
      }

      let results = Array.from(this.tasks.values());

      // Filter by user ID
      if (criteria.userId) {
        results = results.filter(task => task.userId === criteria.userId);
      }

      // Filter by status
      if (criteria.status) {
        results = results.filter(task => task.status === criteria.status);
      }

      // Filter by action type
      if (criteria.actionType) {
        results = results.filter(task => task.actionType === criteria.actionType);
      }

      // Filter by creation date range
      if (criteria.createdAfter) {
        results = results.filter(task => task.createdAt >= criteria.createdAfter);
      }
      if (criteria.createdBefore) {
        results = results.filter(task => task.createdAt <= criteria.createdBefore);
      }

      // Text search in description
      if (criteria.searchTerm) {
        const searchTerm = criteria.searchTerm.toLowerCase();
        results = results.filter(task => {
          const description = task.getDescription ? task.getDescription().toLowerCase() : '';
          return description.includes(searchTerm);
        });
      }

      return results;

    } catch (error) {
      console.error('Error searching tasks:', error);
      throw new Error(`Failed to search tasks: ${error.message}`);
    }
  }

  /**
   * Gets execution statistics for scheduled tasks
   * @param {string} userId - Filter by user ID (optional)
   * @param {Date} fromDate - Start date for statistics (optional)
   * @param {Date} toDate - End date for statistics (optional)
   * @returns {Promise<Object>} Statistics object
   * @throws {Error} If query operation fails
   */
  async getExecutionStatistics(userId = null, fromDate = null, toDate = null) {
    try {
      let tasks = Array.from(this.tasks.values());

      // Filter by user if specified
      if (userId) {
        tasks = tasks.filter(task => task.userId === userId);
      }

      // Filter by date range if specified
      if (fromDate) {
        tasks = tasks.filter(task => task.createdAt >= fromDate);
      }
      if (toDate) {
        tasks = tasks.filter(task => task.createdAt <= toDate);
      }

      // Calculate statistics
      const stats = {
        totalTasks: tasks.length,
        activeCount: tasks.filter(task => task.status === ScheduledTask.STATUS.ACTIVE).length,
        completedCount: tasks.filter(task => task.status === ScheduledTask.STATUS.COMPLETED).length,
        cancelledCount: tasks.filter(task => task.status === ScheduledTask.STATUS.CANCELLED).length,
        failedCount: tasks.filter(task => task.status === ScheduledTask.STATUS.FAILED).length,
        totalExecutions: tasks.reduce((sum, task) => sum + (task.executionCount || 0), 0),
        totalFailures: tasks.reduce((sum, task) => sum + (task.failureCount || 0), 0),
        averageExecutionsPerTask: 0,
        successRate: 0,
        actionTypeBreakdown: {},
        userBreakdown: userId ? null : {}
      };

      // Calculate averages and rates
      if (stats.totalTasks > 0) {
        stats.averageExecutionsPerTask = stats.totalExecutions / stats.totalTasks;
        
        if (stats.totalExecutions > 0) {
          stats.successRate = ((stats.totalExecutions - stats.totalFailures) / stats.totalExecutions) * 100;
        }
      }

      // Action type breakdown
      tasks.forEach(task => {
        const actionType = task.actionType || 'UNKNOWN';
        if (!stats.actionTypeBreakdown[actionType]) {
          stats.actionTypeBreakdown[actionType] = 0;
        }
        stats.actionTypeBreakdown[actionType]++;
      });

      // User breakdown (if not filtering by specific user)
      if (!userId && stats.userBreakdown) {
        tasks.forEach(task => {
          const taskUserId = task.userId || 'UNKNOWN';
          if (!stats.userBreakdown[taskUserId]) {
            stats.userBreakdown[taskUserId] = 0;
          }
          stats.userBreakdown[taskUserId]++;
        });
      }

      return stats;

    } catch (error) {
      console.error('Error getting execution statistics:', error);
      throw new Error(`Failed to get execution statistics: ${error.message}`);
    }
  }

  /**
   * Archives completed and cancelled tasks older than specified days
   * @param {number} olderThanDays - Archive tasks older than this many days
   * @returns {Promise<number>} Number of tasks archived
   * @throws {Error} If archive operation fails
   */
  async archiveOldTasks(olderThanDays = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const oldTasks = Array.from(this.tasks.values()).filter(task => {
        return (task.status === ScheduledTask.STATUS.COMPLETED || 
                task.status === ScheduledTask.STATUS.CANCELLED) &&
               task.createdAt < cutoffDate;
      });

      let archivedCount = 0;
      for (const task of oldTasks) {
        const deleted = await this.delete(task.id);
        if (deleted) {
          archivedCount++;
        }
      }

      return archivedCount;

    } catch (error) {
      console.error('Error archiving old tasks:', error);
      throw new Error(`Failed to archive old tasks: ${error.message}`);
    }
  }

  /**
   * Performs bulk operations on scheduled tasks
   * @param {string} operation - Operation type: 'activate', 'cancel', 'delete'
   * @param {Array<string>} taskIds - Array of task IDs
   * @returns {Promise<{success: number, failed: Array<{id: string, error: string}>}>} Operation results
   * @throws {Error} If bulk operation fails
   */
  async bulkOperation(operation, taskIds) {
    try {
      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return { success: 0, failed: [] };
      }

      const results = { success: 0, failed: [] };

      for (const taskId of taskIds) {
        try {
          switch (operation) {
            case 'activate':
              const activeTask = await this.findById(taskId);
              if (activeTask) {
                activeTask.status = ScheduledTask.STATUS.ACTIVE;
                await this.save(activeTask);
                results.success++;
              } else {
                results.failed.push({ id: taskId, error: 'Task not found' });
              }
              break;

            case 'cancel':
              const cancelTask = await this.findById(taskId);
              if (cancelTask) {
                cancelTask.status = ScheduledTask.STATUS.CANCELLED;
                await this.save(cancelTask);
                results.success++;
              } else {
                results.failed.push({ id: taskId, error: 'Task not found' });
              }
              break;

            case 'delete':
              const deleted = await this.delete(taskId);
              if (deleted) {
                results.success++;
              } else {
                results.failed.push({ id: taskId, error: 'Task not found' });
              }
              break;

            default:
              results.failed.push({ id: taskId, error: `Unknown operation: ${operation}` });
              break;
          }
        } catch (error) {
          results.failed.push({ id: taskId, error: error.message });
        }
      }

      return results;

    } catch (error) {
      console.error('Error performing bulk operation:', error);
      throw new Error(`Failed to perform bulk operation: ${error.message}`);
    }
  }

  /**
   * Private: Adds a task to all relevant indexes
   */
  _addToIndexes(task) {
    // User index
    if (!this.userTasksIndex.has(task.userId)) {
      this.userTasksIndex.set(task.userId, new Set());
    }
    this.userTasksIndex.get(task.userId).add(task.id);

    // Status index
    if (!this.statusIndex.has(task.status)) {
      this.statusIndex.set(task.status, new Set());
    }
    this.statusIndex.get(task.status).add(task.id);

    // Action type index
    if (!this.actionTypeIndex.has(task.actionType)) {
      this.actionTypeIndex.set(task.actionType, new Set());
    }
    this.actionTypeIndex.get(task.actionType).add(task.id);
  }

  /**
   * Private: Removes a task from all relevant indexes
   */
  _removeFromIndexes(task) {
    // User index
    const userTasks = this.userTasksIndex.get(task.userId);
    if (userTasks) {
      userTasks.delete(task.id);
      if (userTasks.size === 0) {
        this.userTasksIndex.delete(task.userId);
      }
    }

    // Status index
    const statusTasks = this.statusIndex.get(task.status);
    if (statusTasks) {
      statusTasks.delete(task.id);
      if (statusTasks.size === 0) {
        this.statusIndex.delete(task.status);
      }
    }

    // Action type index
    const actionTypeTasks = this.actionTypeIndex.get(task.actionType);
    if (actionTypeTasks) {
      actionTypeTasks.delete(task.id);
      if (actionTypeTasks.size === 0) {
        this.actionTypeIndex.delete(task.actionType);
      }
    }
  }

  /**
   * Get repository stats for debugging/monitoring
   * @returns {Object} Repository statistics
   */
  getStats() {
    return {
      totalTasks: this.tasks.size,
      userIndexes: this.userTasksIndex.size,
      statusIndexes: this.statusIndex.size,
      actionTypeIndexes: this.actionTypeIndex.size,
      nextTaskId: this.nextTaskId
    };
  }

  /**
   * Clear all data (useful for testing)
   * @returns {Promise<void>}
   */
  async clear() {
    this.tasks.clear();
    this.userTasksIndex.clear();
    this.statusIndex.clear();
    this.actionTypeIndex.clear();
    this.nextTaskId = 1;
  }
}

module.exports = InMemoryScheduledTaskRepository;