const EventEmitter = require('events');

/**
 * SchedulingEngine
 * 
 * Core scheduling service responsible for monitoring scheduled tasks and executing
 * them at the right time. Uses Node.js timers for in-memory scheduling with 
 * robust error handling, recovery mechanisms, and efficient timer management.
 */
class SchedulingEngine extends EventEmitter {
  constructor(
    scheduledTaskRepository,
    executeScheduledTaskUseCase,
    taskExecutor,
    config = {}
  ) {
    super();
    
    this.scheduledTaskRepository = scheduledTaskRepository;
    this.executeScheduledTaskUseCase = executeScheduledTaskUseCase;
    this.taskExecutor = taskExecutor;
    
    // Configuration with defaults
    this.config = {
      checkInterval: config.checkInterval || 60000, // 1 minute
      executionTolerance: config.executionTolerance || 300000, // 5 minutes in ms
      maxConcurrentExecutions: config.maxConcurrentExecutions || 5,
      enableAutoRecovery: config.enableAutoRecovery !== false,
      healthCheckInterval: config.healthCheckInterval || 300000, // 5 minutes
      timerCleanupInterval: config.timerCleanupInterval || 1800000, // 30 minutes
      maxTimerDrift: config.maxTimerDrift || 60000, // 1 minute
      ...config
    };

    // Internal state
    this.isRunning = false;
    this.scheduledTimers = new Map(); // scheduleId -> timer info
    this.activeExecutions = new Set(); // track active executions
    this.checkIntervalTimer = null;
    this.healthCheckTimer = null;
    this.cleanupTimer = null;
    this.stats = {
      tasksScheduled: 0,
      tasksExecuted: 0,
      tasksFailed: 0,
      timersCreated: 0,
      timersCancelled: 0,
      lastHealthCheck: null,
      uptime: null,
      startTime: null
    };

    // Bind context
    this._executeScheduledCheck = this._executeScheduledCheck.bind(this);
    this._performHealthCheck = this._performHealthCheck.bind(this);
    this._performTimerCleanup = this._performTimerCleanup.bind(this);

    console.log('SchedulingEngine initialized with config:', {
      checkInterval: this.config.checkInterval,
      executionTolerance: this.config.executionTolerance,
      maxConcurrentExecutions: this.config.maxConcurrentExecutions
    });
  }

  /**
   * Starts the scheduling engine
   * @param {boolean} loadExistingSchedules - Load and schedule existing active tasks
   * @returns {Promise<void>}
   */
  async start(loadExistingSchedules = true) {
    try {
      if (this.isRunning) {
        console.warn('SchedulingEngine is already running');
        return;
      }

      console.log('Starting SchedulingEngine...');
      this.isRunning = true;
      this.stats.startTime = new Date();

      // Load and schedule existing active tasks
      if (loadExistingSchedules) {
        await this._loadExistingSchedules();
      }

      // Start periodic check for due tasks
      this.checkIntervalTimer = setInterval(
        this._executeScheduledCheck, 
        this.config.checkInterval
      );

      // Start health check timer
      if (this.config.enableAutoRecovery) {
        this.healthCheckTimer = setInterval(
          this._performHealthCheck,
          this.config.healthCheckInterval
        );
      }

      // Start cleanup timer
      this.cleanupTimer = setInterval(
        this._performTimerCleanup,
        this.config.timerCleanupInterval
      );

      this.emit('started', {
        timestamp: new Date(),
        loadedSchedules: this.scheduledTimers.size,
        config: this.config
      });

      console.log(`SchedulingEngine started with ${this.scheduledTimers.size} scheduled tasks`);

    } catch (error) {
      console.error('Failed to start SchedulingEngine:', error);
      this.isRunning = false;
      this.emit('error', { type: 'startup', error });
      throw error;
    }
  }

  /**
   * Stops the scheduling engine
   * @param {boolean} cancelActiveExecutions - Cancel currently running executions
   * @returns {Promise<void>}
   */
  async stop(cancelActiveExecutions = false) {
    try {
      if (!this.isRunning) {
        console.warn('SchedulingEngine is not running');
        return;
      }

      console.log('Stopping SchedulingEngine...');
      this.isRunning = false;

      // Clear interval timers
      if (this.checkIntervalTimer) {
        clearInterval(this.checkIntervalTimer);
        this.checkIntervalTimer = null;
      }
      
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }

      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      // Cancel all scheduled timers
      const timerCount = this.scheduledTimers.size;
      this._cancelAllTimers();

      // Handle active executions
      if (cancelActiveExecutions && this.activeExecutions.size > 0) {
        console.log(`Cancelling ${this.activeExecutions.size} active executions`);
        this.activeExecutions.clear();
      } else if (this.activeExecutions.size > 0) {
        console.log(`Waiting for ${this.activeExecutions.size} active executions to complete`);
        // Wait for active executions to complete (with timeout)
        await this._waitForActiveExecutions(30000); // 30 second timeout
      }

      // Update stats
      this.stats.uptime = Date.now() - this.stats.startTime.getTime();

      this.emit('stopped', {
        timestamp: new Date(),
        cancelledTimers: timerCount,
        uptime: this.stats.uptime,
        stats: { ...this.stats }
      });

      console.log('SchedulingEngine stopped successfully');

    } catch (error) {
      console.error('Error stopping SchedulingEngine:', error);
      this.emit('error', { type: 'shutdown', error });
      throw error;
    }
  }

  /**
   * Schedules a specific task
   * @param {ScheduledTask} scheduledTask - Task to schedule
   * @returns {Promise<boolean>} True if scheduled successfully
   */
  async scheduleTask(scheduledTask) {
    try {
      if (!this.isRunning) {
        throw new Error('SchedulingEngine is not running');
      }

      if (!scheduledTask || !scheduledTask.id) {
        throw new Error('Invalid scheduled task provided');
      }

      // Validate task readiness
      if (scheduledTask.status !== 'ACTIVE') {
        console.warn(`Cannot schedule task ${scheduledTask.id}: status is ${scheduledTask.status}`);
        return false;
      }

      if (!scheduledTask.nextExecutionTime) {
        console.warn(`Cannot schedule task ${scheduledTask.id}: no next execution time`);
        return false;
      }

      // Cancel existing timer if present
      await this.unscheduleTask(scheduledTask.id);

      // Calculate delay until execution
      const now = Date.now();
      const executionTime = scheduledTask.nextExecutionTime.getTime();
      const delay = Math.max(0, executionTime - now);

      // Create timer for task execution
      const timerId = setTimeout(() => {
        this._executeTask(scheduledTask.id);
      }, delay);

      // Store timer information
      const timerInfo = {
        timerId,
        scheduleId: scheduledTask.id,
        scheduledFor: scheduledTask.nextExecutionTime,
        createdAt: new Date(),
        delay: delay,
        task: scheduledTask
      };

      this.scheduledTimers.set(scheduledTask.id, timerInfo);
      this.stats.tasksScheduled++;
      this.stats.timersCreated++;

      // Emit scheduling event
      this.emit('taskScheduled', {
        scheduleId: scheduledTask.id,
        scheduledFor: scheduledTask.nextExecutionTime,
        delay: delay,
        description: scheduledTask.getDescription ? scheduledTask.getDescription() : 'N/A'
      });

      console.log(`Scheduled task ${scheduledTask.id} for execution in ${Math.round(delay / 1000)}s`);
      return true;

    } catch (error) {
      console.error('Error scheduling task:', error);
      this.emit('error', { 
        type: 'scheduleTask', 
        scheduleId: scheduledTask?.id,
        error 
      });
      return false;
    }
  }

  /**
   * Unschedules a specific task
   * @param {string} scheduleId - ID of task to unschedule
   * @returns {Promise<boolean>} True if unscheduled successfully
   */
  async unscheduleTask(scheduleId) {
    try {
      const timerInfo = this.scheduledTimers.get(scheduleId);
      if (!timerInfo) {
        return false; // Task was not scheduled
      }

      // Clear the timer
      clearTimeout(timerInfo.timerId);
      
      // Remove from scheduled timers
      this.scheduledTimers.delete(scheduleId);
      this.stats.timersCancelled++;

      this.emit('taskUnscheduled', {
        scheduleId,
        wasScheduledFor: timerInfo.scheduledFor,
        reason: 'manual'
      });

      console.log(`Unscheduled task ${scheduleId}`);
      return true;

    } catch (error) {
      console.error('Error unscheduling task:', error);
      this.emit('error', { 
        type: 'unscheduleTask', 
        scheduleId,
        error 
      });
      return false;
    }
  }

  /**
   * Reschedules an updated task
   * @param {ScheduledTask} updatedTask - Updated task to reschedule
   * @returns {Promise<boolean>} True if rescheduled successfully
   */
  async rescheduleTask(updatedTask) {
    try {
      if (!updatedTask || !updatedTask.id) {
        return false;
      }

      // Unschedule existing timer
      await this.unscheduleTask(updatedTask.id);
      
      // Schedule with updated information
      const scheduled = await this.scheduleTask(updatedTask);
      
      if (scheduled) {
        this.emit('taskRescheduled', {
          scheduleId: updatedTask.id,
          newScheduleTime: updatedTask.nextExecutionTime,
          description: updatedTask.getDescription ? updatedTask.getDescription() : 'N/A'
        });
      }

      return scheduled;

    } catch (error) {
      console.error('Error rescheduling task:', error);
      this.emit('error', { 
        type: 'rescheduleTask', 
        scheduleId: updatedTask?.id,
        error 
      });
      return false;
    }
  }

  /**
   * Gets current scheduling status
   * @returns {Object} Current status and statistics
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: this.scheduledTimers.size,
      activeExecutions: this.activeExecutions.size,
      stats: {
        ...this.stats,
        uptime: this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0
      },
      config: { ...this.config },
      nextExecutions: this._getNextExecutions(5)
    };
  }

  /**
   * Forces execution of due tasks (manual trigger)
   * @returns {Promise<Object>} Execution results
   */
  async executeDueTasks() {
    try {
      if (!this.isRunning) {
        throw new Error('SchedulingEngine is not running');
      }

      console.log('Manual execution of due tasks triggered');
      return await this.executeScheduledTaskUseCase.executeDueTasks({
        toleranceMinutes: this.config.executionTolerance / 60000,
        maxTasks: this.config.maxConcurrentExecutions
      });

    } catch (error) {
      console.error('Error in manual due task execution:', error);
      this.emit('error', { type: 'manualExecution', error });
      throw error;
    }
  }

  /**
   * Private: Loads existing active schedules on startup
   */
  async _loadExistingSchedules() {
    try {
      console.log('Loading existing active schedules...');
      
      const activeTasks = await this.scheduledTaskRepository.findActive();
      
      let scheduledCount = 0;
      for (const task of activeTasks) {
        if (task.nextExecutionTime && task.nextExecutionTime > new Date()) {
          const scheduled = await this.scheduleTask(task);
          if (scheduled) {
            scheduledCount++;
          }
        } else if (task.nextExecutionTime && task.nextExecutionTime <= new Date()) {
          // Task is overdue, schedule for immediate execution
          console.log(`Task ${task.id} is overdue, scheduling for immediate execution`);
          task.nextExecutionTime = new Date(Date.now() + 1000); // 1 second from now
          const scheduled = await this.scheduleTask(task);
          if (scheduled) {
            scheduledCount++;
          }
        }
      }

      console.log(`Loaded ${scheduledCount} active schedules from ${activeTasks.length} total active tasks`);
      
    } catch (error) {
      console.error('Error loading existing schedules:', error);
      throw error;
    }
  }

  /**
   * Private: Executes scheduled task check (periodic)
   */
  async _executeScheduledCheck() {
    try {
      if (!this.isRunning) {
        return;
      }

      // Execute due tasks
      const results = await this.executeScheduledTaskUseCase.executeDueTasks({
        toleranceMinutes: this.config.executionTolerance / 60000,
        maxTasks: Math.max(1, this.config.maxConcurrentExecutions - this.activeExecutions.size),
        continueOnError: true
      });

      // Update stats
      if (results.success && results.data) {
        this.stats.tasksExecuted += results.data.executed;
        this.stats.tasksFailed += results.data.failed;
      }

      // Check for rescheduling needs
      await this._refreshSchedules();

    } catch (error) {
      console.error('Error in scheduled check:', error);
      this.emit('error', { type: 'scheduledCheck', error });
    }
  }

  /**
   * Private: Executes a specific task
   */
  async _executeTask(scheduleId) {
    try {
      // Remove from scheduled timers (task is now being executed)
      const timerInfo = this.scheduledTimers.get(scheduleId);
      this.scheduledTimers.delete(scheduleId);

      if (!this.isRunning) {
        console.log(`Skipping execution of ${scheduleId} - engine is not running`);
        return;
      }

      // Check concurrent execution limit
      if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
        console.warn(`Execution limit reached, delaying task ${scheduleId}`);
        // Reschedule for 30 seconds later
        if (timerInfo && timerInfo.task) {
          timerInfo.task.nextExecutionTime = new Date(Date.now() + 30000);
          await this.scheduleTask(timerInfo.task);
        }
        return;
      }

      // Track active execution
      this.activeExecutions.add(scheduleId);

      this.emit('taskExecutionStarted', {
        scheduleId,
        startTime: new Date(),
        wasScheduledFor: timerInfo?.scheduledFor
      });

      try {
        // Use task executor for controlled execution
        const result = await this.taskExecutor.executeTask(scheduleId, {
          timeout: 300000, // 5 minute timeout
          maxRetries: 3
        });

        this.stats.tasksExecuted++;
        
        this.emit('taskExecutionCompleted', {
          scheduleId,
          result,
          executionTime: new Date(),
          success: result.success
        });

        // Refresh schedules to pick up any updates
        await this._refreshTaskSchedule(scheduleId);

      } catch (executionError) {
        this.stats.tasksFailed++;
        
        this.emit('taskExecutionFailed', {
          scheduleId,
          error: executionError,
          failureTime: new Date()
        });

        console.error(`Task execution failed for ${scheduleId}:`, executionError);
      }

    } catch (error) {
      console.error(`Error executing task ${scheduleId}:`, error);
      this.emit('error', { type: 'taskExecution', scheduleId, error });
    } finally {
      // Always remove from active executions
      this.activeExecutions.delete(scheduleId);
    }
  }

  /**
   * Private: Performs health check and recovery
   */
  async _performHealthCheck() {
    try {
      this.stats.lastHealthCheck = new Date();

      if (!this.isRunning) {
        return;
      }

      // Check for stale timers
      const now = Date.now();
      let staleTimers = 0;

      for (const [scheduleId, timerInfo] of this.scheduledTimers) {
        const scheduledTime = timerInfo.scheduledFor.getTime();
        const drift = Math.abs(scheduledTime - now);
        
        // If timer is significantly overdue, it might be stale
        if (scheduledTime < now - this.config.maxTimerDrift) {
          console.warn(`Detected stale timer for task ${scheduleId}, rescheduling...`);
          await this.unscheduleTask(scheduleId);
          staleTimers++;
        }
      }

      if (staleTimers > 0) {
        console.log(`Health check: cleaned up ${staleTimers} stale timers`);
        await this._refreshSchedules();
      }

      // Emit health check event
      this.emit('healthCheck', {
        timestamp: new Date(),
        scheduledTasks: this.scheduledTimers.size,
        activeExecutions: this.activeExecutions.size,
        staleTimersRemoved: staleTimers
      });

    } catch (error) {
      console.error('Error in health check:', error);
      this.emit('error', { type: 'healthCheck', error });
    }
  }

  /**
   * Private: Performs timer cleanup
   */
  async _performTimerCleanup() {
    try {
      if (!this.isRunning) {
        return;
      }

      // Force garbage collection of completed timers
      const initialSize = this.scheduledTimers.size;
      
      // Refresh all schedules to ensure accuracy
      await this._refreshSchedules();
      
      const finalSize = this.scheduledTimers.size;
      
      if (initialSize !== finalSize) {
        console.log(`Timer cleanup: ${initialSize - finalSize} timers cleaned`);
      }

      this.emit('timerCleanup', {
        timestamp: new Date(),
        cleaned: initialSize - finalSize,
        remaining: finalSize
      });

    } catch (error) {
      console.error('Error in timer cleanup:', error);
      this.emit('error', { type: 'timerCleanup', error });
    }
  }

  /**
   * Private: Refreshes all schedules from repository
   */
  async _refreshSchedules() {
    try {
      const activeTasks = await this.scheduledTaskRepository.findActive();
      const currentScheduleIds = new Set(this.scheduledTimers.keys());

      // Schedule new or updated tasks
      for (const task of activeTasks) {
        if (task.nextExecutionTime && task.nextExecutionTime > new Date()) {
          const currentTimer = this.scheduledTimers.get(task.id);
          
          // Check if timer needs updating
          if (!currentTimer || 
              currentTimer.scheduledFor.getTime() !== task.nextExecutionTime.getTime()) {
            await this.scheduleTask(task);
          }
        }
        
        // Remove from current set (remaining will be unscheduled)
        currentScheduleIds.delete(task.id);
      }

      // Unschedule tasks that are no longer active
      for (const scheduleId of currentScheduleIds) {
        await this.unscheduleTask(scheduleId);
      }

    } catch (error) {
      console.error('Error refreshing schedules:', error);
    }
  }

  /**
   * Private: Refreshes a specific task's schedule
   */
  async _refreshTaskSchedule(scheduleId) {
    try {
      const task = await this.scheduledTaskRepository.findById(scheduleId);
      
      if (task && task.status === 'ACTIVE' && task.nextExecutionTime) {
        await this.scheduleTask(task);
      } else if (this.scheduledTimers.has(scheduleId)) {
        await this.unscheduleTask(scheduleId);
      }

    } catch (error) {
      console.error(`Error refreshing schedule for task ${scheduleId}:`, error);
    }
  }

  /**
   * Private: Cancels all scheduled timers
   */
  _cancelAllTimers() {
    for (const [scheduleId, timerInfo] of this.scheduledTimers) {
      clearTimeout(timerInfo.timerId);
      this.stats.timersCancelled++;
    }
    this.scheduledTimers.clear();
  }

  /**
   * Private: Waits for active executions to complete
   */
  async _waitForActiveExecutions(timeout = 30000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        if (this.activeExecutions.size === 0 || Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * Private: Gets next few executions for status reporting
   */
  _getNextExecutions(limit = 5) {
    const executions = Array.from(this.scheduledTimers.values())
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
      .slice(0, limit)
      .map(timerInfo => ({
        scheduleId: timerInfo.scheduleId,
        scheduledFor: timerInfo.scheduledFor,
        delay: Math.max(0, timerInfo.scheduledFor.getTime() - Date.now()),
        description: timerInfo.task?.getDescription ? timerInfo.task.getDescription() : 'N/A'
      }));

    return executions;
  }
}

module.exports = SchedulingEngine;