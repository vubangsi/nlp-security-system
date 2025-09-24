const EventEmitter = require('events');

/**
 * TaskExecutor
 * 
 * Service responsible for executing scheduled tasks in a controlled environment.
 * Provides task queuing, execution coordination, timeout handling, retry logic
 * with exponential backoff, resource management, and concurrent execution limits.
 */
class TaskExecutor extends EventEmitter {
  constructor(executeScheduledTaskUseCase, config = {}) {
    super();
    
    this.executeScheduledTaskUseCase = executeScheduledTaskUseCase;
    
    // Configuration with defaults
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      defaultTimeout: config.defaultTimeout || 300000, // 5 minutes
      maxRetries: config.maxRetries || 3,
      retryDelayBase: config.retryDelayBase || 1000, // 1 second
      retryDelayMax: config.retryDelayMax || 30000, // 30 seconds
      queueTimeout: config.queueTimeout || 600000, // 10 minutes
      enableMetrics: config.enableMetrics !== false,
      gracefulShutdownTimeout: config.gracefulShutdownTimeout || 30000,
      ...config
    };

    // Internal state
    this.activeTasks = new Map(); // taskId -> execution info
    this.taskQueue = []; // pending tasks queue
    this.isShuttingDown = false;
    this.metrics = {
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      tasksTimedOut: 0,
      tasksRetried: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      queueLength: 0,
      maxQueueLength: 0,
      lastExecutionTime: null
    };

    console.log('TaskExecutor initialized with config:', {
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      defaultTimeout: this.config.defaultTimeout,
      maxRetries: this.config.maxRetries
    });
  }

  /**
   * Executes a scheduled task with retry logic and timeout handling
   * @param {string} scheduleId - ID of the schedule to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeTask(scheduleId, options = {}) {
    try {
      if (!scheduleId) {
        throw new Error('Schedule ID is required');
      }

      if (this.isShuttingDown) {
        throw new Error('TaskExecutor is shutting down, cannot accept new tasks');
      }

      const executionOptions = {
        timeout: options.timeout || this.config.defaultTimeout,
        maxRetries: options.maxRetries !== undefined ? options.maxRetries : this.config.maxRetries,
        retryOnTimeout: options.retryOnTimeout !== false,
        priority: options.priority || 'normal',
        executionTime: options.executionTime || new Date(),
        ...options
      };

      // Check if task is already being executed
      if (this.activeTasks.has(scheduleId)) {
        const activeTask = this.activeTasks.get(scheduleId);
        return {
          success: false,
          error: 'Task is already being executed',
          details: { 
            scheduleId, 
            startedAt: activeTask.startTime,
            currentRetry: activeTask.currentRetry
          }
        };
      }

      // Check concurrent execution limit
      if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
        return await this._queueTask(scheduleId, executionOptions);
      }

      // Execute immediately
      return await this._executeTaskInternal(scheduleId, executionOptions);

    } catch (error) {
      console.error(`TaskExecutor error for ${scheduleId}:`, error);
      
      this.emit('executionError', {
        scheduleId,
        error: error.message,
        timestamp: new Date()
      });

      return {
        success: false,
        error: error.message,
        details: { scheduleId, type: 'executor_error' }
      };
    }
  }

  /**
   * Executes multiple tasks concurrently (batch execution)
   * @param {Array<string>} scheduleIds - Array of schedule IDs
   * @param {Object} options - Batch execution options
   * @returns {Promise<Object>} Batch execution results
   */
  async executeBatch(scheduleIds, options = {}) {
    try {
      if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
        return {
          success: true,
          message: 'No tasks to execute',
          results: []
        };
      }

      const batchOptions = {
        maxConcurrent: Math.min(
          options.maxConcurrent || this.config.maxConcurrentTasks,
          this.config.maxConcurrentTasks
        ),
        continueOnError: options.continueOnError !== false,
        timeout: options.timeout,
        maxRetries: options.maxRetries,
        ...options
      };

      console.log(`Executing batch of ${scheduleIds.length} tasks with max concurrent: ${batchOptions.maxConcurrent}`);

      const results = [];
      const activePromises = new Map();

      for (let i = 0; i < scheduleIds.length; i++) {
        const scheduleId = scheduleIds[i];

        // Wait if we've reached the concurrent limit
        while (activePromises.size >= batchOptions.maxConcurrent) {
          const completedId = await Promise.race(activePromises.keys());
          const result = await activePromises.get(completedId);
          activePromises.delete(completedId);
          results.push(result);

          // Stop on first error if continueOnError is false
          if (!batchOptions.continueOnError && !result.success) {
            break;
          }
        }

        // Start execution if we haven't stopped due to error
        if (batchOptions.continueOnError || results.every(r => r.success)) {
          const promise = this.executeTask(scheduleId, batchOptions)
            .then(result => ({ scheduleId, ...result }))
            .catch(error => ({
              scheduleId,
              success: false,
              error: error.message,
              details: { type: 'batch_execution_error' }
            }));

          activePromises.set(promise, promise);
        }
      }

      // Wait for remaining executions to complete
      while (activePromises.size > 0) {
        const completedPromise = await Promise.race(activePromises.keys());
        const result = await activePromises.get(completedPromise);
        activePromises.delete(completedPromise);
        results.push(result);
      }

      // Calculate batch statistics
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return {
        success: failed === 0 || batchOptions.continueOnError,
        message: `Batch execution completed: ${succeeded} succeeded, ${failed} failed`,
        data: {
          total: results.length,
          succeeded,
          failed,
          results: results
        }
      };

    } catch (error) {
      console.error('Batch execution error:', error);
      return {
        success: false,
        error: 'Batch execution failed',
        details: { message: error.message }
      };
    }
  }

  /**
   * Gets current executor status and metrics
   * @returns {Object} Current status and metrics
   */
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      activeTasks: this.activeTasks.size,
      queueLength: this.taskQueue.length,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      config: { ...this.config },
      metrics: {
        ...this.metrics,
        queueLength: this.taskQueue.length,
        activeTasks: Array.from(this.activeTasks.keys())
      }
    };
  }

  /**
   * Initiates graceful shutdown of the executor
   * @param {number} timeout - Maximum time to wait for active tasks to complete
   * @returns {Promise<void>}
   */
  async shutdown(timeout = this.config.gracefulShutdownTimeout) {
    try {
      console.log('TaskExecutor shutting down...');
      this.isShuttingDown = true;

      // Clear the task queue
      const queuedTasks = this.taskQueue.length;
      this.taskQueue.length = 0;

      if (queuedTasks > 0) {
        console.log(`Cleared ${queuedTasks} queued tasks`);
      }

      // Wait for active tasks to complete
      if (this.activeTasks.size > 0) {
        console.log(`Waiting for ${this.activeTasks.size} active tasks to complete...`);
        
        const shutdownPromise = this._waitForActiveTasks();
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, timeout));

        await Promise.race([shutdownPromise, timeoutPromise]);

        if (this.activeTasks.size > 0) {
          console.warn(`Shutdown timeout reached, ${this.activeTasks.size} tasks still active`);
        }
      }

      this.emit('shutdown', {
        timestamp: new Date(),
        queuedTasksCleared: queuedTasks,
        remainingActiveTasks: this.activeTasks.size,
        metrics: { ...this.metrics }
      });

      console.log('TaskExecutor shutdown completed');

    } catch (error) {
      console.error('Error during TaskExecutor shutdown:', error);
      throw error;
    }
  }

  /**
   * Private: Executes a task with full error handling and retry logic
   */
  async _executeTaskInternal(scheduleId, options, currentRetry = 0) {
    const startTime = new Date();
    const executionId = `${scheduleId}_${Date.now()}_${currentRetry}`;

    // Track active execution
    const activeTaskInfo = {
      scheduleId,
      executionId,
      startTime,
      currentRetry,
      maxRetries: options.maxRetries,
      timeout: options.timeout,
      options
    };

    this.activeTasks.set(scheduleId, activeTaskInfo);

    try {
      this.emit('executionStarted', {
        scheduleId,
        executionId,
        startTime,
        currentRetry,
        maxRetries: options.maxRetries
      });

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task execution timeout after ${options.timeout}ms`));
        }, options.timeout);
      });

      // Execute the task with timeout
      const executionPromise = this.executeScheduledTaskUseCase.execute(scheduleId, {
        executionTime: options.executionTime,
        ignoreOverdue: true
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Calculate execution time
      const executionTime = Date.now() - startTime.getTime();
      
      // Update metrics
      this._updateMetrics(true, executionTime, false);

      this.emit('executionCompleted', {
        scheduleId,
        executionId,
        result,
        executionTime,
        currentRetry,
        success: result.success
      });

      return {
        ...result,
        executionId,
        executionTime,
        currentRetry,
        totalRetries: currentRetry
      };

    } catch (error) {
      const executionTime = Date.now() - startTime.getTime();
      const isTimeout = error.message.includes('timeout');

      console.error(`Task execution ${currentRetry > 0 ? `retry ${currentRetry} ` : ''}failed for ${scheduleId}:`, error);

      // Determine if we should retry
      const shouldRetry = this._shouldRetry(error, currentRetry, options);

      if (shouldRetry) {
        // Update retry metrics
        this.metrics.tasksRetried++;

        // Calculate retry delay with exponential backoff
        const retryDelay = this._calculateRetryDelay(currentRetry);

        this.emit('executionRetry', {
          scheduleId,
          executionId,
          currentRetry,
          maxRetries: options.maxRetries,
          retryDelay,
          error: error.message,
          isTimeout
        });

        console.log(`Retrying task ${scheduleId} in ${retryDelay}ms (attempt ${currentRetry + 1}/${options.maxRetries})`);

        // Remove from active tasks temporarily
        this.activeTasks.delete(scheduleId);

        // Wait for retry delay
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        // Retry the execution
        return await this._executeTaskInternal(scheduleId, options, currentRetry + 1);

      } else {
        // Update failure metrics
        this._updateMetrics(false, executionTime, isTimeout);

        this.emit('executionFailed', {
          scheduleId,
          executionId,
          error: error.message,
          executionTime,
          currentRetry,
          maxRetriesReached: currentRetry >= options.maxRetries,
          isTimeout
        });

        return {
          success: false,
          error: error.message,
          details: {
            scheduleId,
            executionId,
            executionTime,
            currentRetry,
            maxRetries: options.maxRetries,
            isTimeout,
            type: 'execution_failure'
          }
        };
      }

    } finally {
      // Always remove from active tasks
      this.activeTasks.delete(scheduleId);
      
      // Process queued tasks if any
      setImmediate(() => this._processQueue());
    }
  }

  /**
   * Private: Queues a task for later execution
   */
  async _queueTask(scheduleId, options) {
    return new Promise((resolve, reject) => {
      const queueEntry = {
        scheduleId,
        options,
        resolve,
        reject,
        queuedAt: new Date(),
        timeout: setTimeout(() => {
          // Remove from queue and reject with timeout
          const index = this.taskQueue.findIndex(entry => entry.scheduleId === scheduleId);
          if (index !== -1) {
            this.taskQueue.splice(index, 1);
          }
          reject(new Error(`Task queuing timeout after ${this.config.queueTimeout}ms`));
        }, this.config.queueTimeout)
      };

      this.taskQueue.push(queueEntry);
      
      // Update queue metrics
      this.metrics.queueLength = this.taskQueue.length;
      this.metrics.maxQueueLength = Math.max(this.metrics.maxQueueLength, this.taskQueue.length);

      this.emit('taskQueued', {
        scheduleId,
        queuePosition: this.taskQueue.length,
        queuedAt: queueEntry.queuedAt
      });

      console.log(`Task ${scheduleId} queued at position ${this.taskQueue.length}`);
    });
  }

  /**
   * Private: Processes queued tasks
   */
  _processQueue() {
    if (this.isShuttingDown || this.taskQueue.length === 0) {
      return;
    }

    // Check if we have capacity for more executions
    while (this.activeTasks.size < this.config.maxConcurrentTasks && this.taskQueue.length > 0) {
      const queueEntry = this.taskQueue.shift();
      
      // Clear the queue timeout
      clearTimeout(queueEntry.timeout);

      // Update queue metrics
      this.metrics.queueLength = this.taskQueue.length;

      this.emit('taskDequeued', {
        scheduleId: queueEntry.scheduleId,
        queuedDuration: Date.now() - queueEntry.queuedAt.getTime()
      });

      // Execute the task
      this._executeTaskInternal(queueEntry.scheduleId, queueEntry.options)
        .then(queueEntry.resolve)
        .catch(queueEntry.reject);
    }
  }

  /**
   * Private: Determines if a task should be retried
   */
  _shouldRetry(error, currentRetry, options) {
    // Check retry limit
    if (currentRetry >= options.maxRetries) {
      return false;
    }

    // Don't retry on certain error types
    if (error.message.includes('not found') || 
        error.message.includes('invalid') ||
        error.message.includes('unauthorized')) {
      return false;
    }

    // Check if timeout retries are enabled
    if (error.message.includes('timeout') && !options.retryOnTimeout) {
      return false;
    }

    return true;
  }

  /**
   * Private: Calculates retry delay with exponential backoff
   */
  _calculateRetryDelay(retryCount) {
    const baseDelay = this.config.retryDelayBase;
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitterDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add 50% jitter
    
    return Math.min(jitterDelay, this.config.retryDelayMax);
  }

  /**
   * Private: Updates execution metrics
   */
  _updateMetrics(success, executionTime, isTimeout) {
    this.metrics.tasksExecuted++;
    
    if (success) {
      this.metrics.tasksSucceeded++;
    } else {
      this.metrics.tasksFailed++;
      if (isTimeout) {
        this.metrics.tasksTimedOut++;
      }
    }

    // Update execution time metrics
    this.metrics.totalExecutionTime += executionTime;
    this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / this.metrics.tasksExecuted;
    this.metrics.lastExecutionTime = new Date();
  }

  /**
   * Private: Waits for all active tasks to complete
   */
  async _waitForActiveTasks() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.activeTasks.size === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }
}

module.exports = TaskExecutor;