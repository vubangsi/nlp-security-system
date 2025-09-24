/**
 * ScheduledTaskRepository - Domain Repository Interface
 * 
 * Defines the contract for scheduled task persistence operations.
 * Abstracts data access concerns from the domain layer.
 */
class ScheduledTaskRepository {
  
  /**
   * Saves a scheduled task (create or update)
   * @param {ScheduledTask} scheduledTask - The task to save
   * @returns {Promise<ScheduledTask>} The saved task
   * @throws {Error} If save operation fails
   */
  async save(scheduledTask) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds a scheduled task by its ID
   * @param {string} id - The task ID
   * @returns {Promise<ScheduledTask|null>} The task if found, null otherwise
   * @throws {Error} If query operation fails
   */
  async findById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds all scheduled tasks for a specific user
   * @param {string} userId - The user ID
   * @returns {Promise<ScheduledTask[]>} Array of user's tasks
   * @throws {Error} If query operation fails
   */
  async findByUserId(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds scheduled tasks by status
   * @param {string} status - The task status (PENDING, ACTIVE, COMPLETED, CANCELLED, FAILED)
   * @returns {Promise<ScheduledTask[]>} Array of tasks with matching status
   * @throws {Error} If query operation fails
   */
  async findByStatus(status) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds all active scheduled tasks
   * @returns {Promise<ScheduledTask[]>} Array of active tasks
   * @throws {Error} If query operation fails
   */
  async findActive() {
    throw new Error('Method not implemented');
  }

  /**
   * Finds scheduled tasks that are due for execution
   * @param {Date} beforeTime - Find tasks due before this time (default: now)
   * @returns {Promise<ScheduledTask[]>} Array of tasks due for execution
   * @throws {Error} If query operation fails
   */
  async findByNextExecutionTimeBefore(beforeTime = new Date()) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds scheduled tasks within a time range
   * @param {Date} startTime - Start of time range
   * @param {Date} endTime - End of time range
   * @returns {Promise<ScheduledTask[]>} Array of tasks in the time range
   * @throws {Error} If query operation fails
   */
  async findByNextExecutionTimeBetween(startTime, endTime) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds scheduled tasks by user and status
   * @param {string} userId - The user ID
   * @param {string} status - The task status
   * @returns {Promise<ScheduledTask[]>} Array of matching tasks
   * @throws {Error} If query operation fails
   */
  async findByUserIdAndStatus(userId, status) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds scheduled tasks by action type
   * @param {string} actionType - The action type (ARM_SYSTEM, DISARM_SYSTEM)
   * @returns {Promise<ScheduledTask[]>} Array of tasks with matching action type
   * @throws {Error} If query operation fails
   */
  async findByActionType(actionType) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds scheduled tasks created within a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<ScheduledTask[]>} Array of tasks created in the date range
   * @throws {Error} If query operation fails
   */
  async findByCreatedAtBetween(startDate, endDate) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds overdue scheduled tasks
   * @param {number} toleranceMinutes - Minutes past due time to consider overdue (default: 5)
   * @returns {Promise<ScheduledTask[]>} Array of overdue tasks
   * @throws {Error} If query operation fails
   */
  async findOverdue(toleranceMinutes = 5) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds scheduled tasks that have failed multiple times
   * @param {number} minFailureCount - Minimum number of failures (default: 3)
   * @returns {Promise<ScheduledTask[]>} Array of frequently failing tasks
   * @throws {Error} If query operation fails
   */
  async findFrequentFailures(minFailureCount = 3) {
    throw new Error('Method not implemented');
  }

  /**
   * Counts scheduled tasks by status
   * @param {string} status - The task status
   * @returns {Promise<number>} Count of tasks with the status
   * @throws {Error} If query operation fails
   */
  async countByStatus(status) {
    throw new Error('Method not implemented');
  }

  /**
   * Counts scheduled tasks for a specific user
   * @param {string} userId - The user ID
   * @returns {Promise<number>} Count of user's tasks
   * @throws {Error} If query operation fails
   */
  async countByUserId(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Deletes a scheduled task by ID
   * @param {string} id - The task ID
   * @returns {Promise<boolean>} True if task was deleted, false if not found
   * @throws {Error} If delete operation fails
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Deletes all scheduled tasks for a user
   * @param {string} userId - The user ID
   * @returns {Promise<number>} Number of tasks deleted
   * @throws {Error} If delete operation fails
   */
  async deleteByUserId(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Deletes scheduled tasks by status
   * @param {string} status - The task status
   * @returns {Promise<number>} Number of tasks deleted
   * @throws {Error} If delete operation fails
   */
  async deleteByStatus(status) {
    throw new Error('Method not implemented');
  }

  /**
   * Checks if a task exists with the given ID
   * @param {string} id - The task ID
   * @returns {Promise<boolean>} True if task exists, false otherwise
   * @throws {Error} If query operation fails
   */
  async exists(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Updates the next execution time for multiple tasks
   * This is useful for batch updates during system maintenance
   * @param {Array<{id: string, nextExecutionTime: Date}>} updates - Array of update objects
   * @returns {Promise<number>} Number of tasks updated
   * @throws {Error} If update operation fails
   */
  async batchUpdateNextExecutionTime(updates) {
    throw new Error('Method not implemented');
  }

  /**
   * Finds all scheduled tasks (with optional pagination)
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of results (optional)
   * @param {number} options.offset - Number of results to skip (optional)
   * @param {string} options.sortBy - Field to sort by (optional, default: 'createdAt')
   * @param {string} options.sortOrder - Sort order 'asc' or 'desc' (optional, default: 'desc')
   * @returns {Promise<{tasks: ScheduledTask[], total: number}>} Paginated results
   * @throws {Error} If query operation fails
   */
  async findAll(options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Searches scheduled tasks by description or user-defined criteria
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.userId - Filter by user ID (optional)
   * @param {string} criteria.status - Filter by status (optional)
   * @param {string} criteria.actionType - Filter by action type (optional)
   * @param {Date} criteria.createdAfter - Tasks created after this date (optional)
   * @param {Date} criteria.createdBefore - Tasks created before this date (optional)
   * @param {string} criteria.searchTerm - Text search in description (optional)
   * @returns {Promise<ScheduledTask[]>} Array of matching tasks
   * @throws {Error} If query operation fails
   */
  async search(criteria) {
    throw new Error('Method not implemented');
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
    throw new Error('Method not implemented');
  }

  /**
   * Archives completed and cancelled tasks older than specified days
   * @param {number} olderThanDays - Archive tasks older than this many days
   * @returns {Promise<number>} Number of tasks archived
   * @throws {Error} If archive operation fails
   */
  async archiveOldTasks(olderThanDays = 90) {
    throw new Error('Method not implemented');
  }

  /**
   * Performs bulk operations on scheduled tasks
   * @param {string} operation - Operation type: 'activate', 'cancel', 'delete'
   * @param {Array<string>} taskIds - Array of task IDs
   * @returns {Promise<{success: number, failed: Array<{id: string, error: string}>}>} Operation results
   * @throws {Error} If bulk operation fails
   */
  async bulkOperation(operation, taskIds) {
    throw new Error('Method not implemented');
  }
}

module.exports = ScheduledTaskRepository;