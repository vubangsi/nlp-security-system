/**
 * SchedulerBootstrap
 * 
 * Handles initialization and lifecycle management of the scheduling infrastructure.
 * Coordinates startup sequence, loads active schedules, initializes the scheduling
 * engine, and manages graceful shutdown with proper cleanup of timers and resources.
 */
class SchedulerBootstrap {
  constructor(
    schedulingEngine,
    taskExecutor,
    scheduledTaskRepository,
    eventBus,
    config = {}
  ) {
    this.schedulingEngine = schedulingEngine;
    this.taskExecutor = taskExecutor;
    this.scheduledTaskRepository = scheduledTaskRepository;
    this.eventBus = eventBus;
    
    // Configuration with defaults
    this.config = {
      autoStart: config.autoStart !== false,
      loadExistingSchedules: config.loadExistingSchedules !== false,
      shutdownTimeout: config.shutdownTimeout || 30000,
      healthCheckEnabled: config.healthCheckEnabled !== false,
      gracefulShutdown: config.gracefulShutdown !== false,
      enableEventListeners: config.enableEventListeners !== false,
      ...config
    };

    // Internal state
    this.isInitialized = false;
    this.isStarted = false;
    this.isShuttingDown = false;
    this.startupTime = null;
    this.shutdownHandlers = [];
    
    // Bind context for event handlers
    this._handleProcessSignals = this._handleProcessSignals.bind(this);
    this._handleScheduleCreated = this._handleScheduleCreated.bind(this);
    this._handleScheduleUpdated = this._handleScheduleUpdated.bind(this);
    this._handleScheduleCancelled = this._handleScheduleCancelled.bind(this);

    console.log('SchedulerBootstrap initialized with config:', {
      autoStart: this.config.autoStart,
      loadExistingSchedules: this.config.loadExistingSchedules,
      shutdownTimeout: this.config.shutdownTimeout
    });
  }

  /**
   * Initializes the scheduler infrastructure
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    try {
      if (this.isInitialized) {
        console.warn('SchedulerBootstrap is already initialized');
        return;
      }

      console.log('Initializing scheduler infrastructure...');

      const initOptions = {
        loadSchedules: options.loadSchedules !== undefined ? options.loadSchedules : this.config.loadExistingSchedules,
        setupEventListeners: options.setupEventListeners !== undefined ? options.setupEventListeners : this.config.enableEventListeners,
        ...options
      };

      // Setup event listeners for schedule lifecycle events
      if (initOptions.setupEventListeners) {
        await this._setupEventListeners();
      }

      // Setup process signal handlers for graceful shutdown
      if (this.config.gracefulShutdown) {
        this._setupProcessSignals();
      }

      // Validate dependencies
      await this._validateDependencies();

      // Initialize repository if needed
      if (this.scheduledTaskRepository.initialize) {
        await this.scheduledTaskRepository.initialize();
      }

      this.isInitialized = true;
      this.startupTime = new Date();

      console.log('Scheduler infrastructure initialized successfully');

      // Auto-start if configured
      if (this.config.autoStart && !this.isStarted) {
        await this.start(initOptions);
      }

    } catch (error) {
      console.error('Failed to initialize scheduler infrastructure:', error);
      throw error;
    }
  }

  /**
   * Starts the scheduler services
   * @param {Object} options - Start options
   * @returns {Promise<void>}
   */
  async start(options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Scheduler must be initialized before starting');
      }

      if (this.isStarted) {
        console.warn('Scheduler is already started');
        return;
      }

      if (this.isShuttingDown) {
        throw new Error('Cannot start scheduler during shutdown');
      }

      console.log('Starting scheduler services...');

      const startOptions = {
        loadSchedules: options.loadSchedules !== undefined ? options.loadSchedules : this.config.loadExistingSchedules,
        ...options
      };

      // Start the scheduling engine
      await this.schedulingEngine.start(startOptions.loadSchedules);

      // Setup event listeners between components
      this._setupComponentEventListeners();

      this.isStarted = true;

      // Emit startup event
      if (this.eventBus) {
        this.eventBus.emit('scheduler.started', {
          timestamp: new Date(),
          config: this.config,
          scheduledTasks: await this._getActiveTaskCount()
        });
      }

      console.log('Scheduler services started successfully');

    } catch (error) {
      console.error('Failed to start scheduler services:', error);
      this.isStarted = false;
      throw error;
    }
  }

  /**
   * Stops the scheduler services gracefully
   * @param {Object} options - Stop options
   * @returns {Promise<void>}
   */
  async stop(options = {}) {
    try {
      if (!this.isStarted) {
        console.warn('Scheduler is not started');
        return;
      }

      if (this.isShuttingDown) {
        console.warn('Scheduler is already shutting down');
        return;
      }

      console.log('Stopping scheduler services...');
      this.isShuttingDown = true;

      const stopOptions = {
        timeout: options.timeout || this.config.shutdownTimeout,
        cancelActiveExecutions: options.cancelActiveExecutions || false,
        ...options
      };

      const shutdownPromises = [];

      // Stop scheduling engine
      if (this.schedulingEngine) {
        shutdownPromises.push(
          this.schedulingEngine.stop(stopOptions.cancelActiveExecutions)
            .catch(error => {
              console.error('Error stopping SchedulingEngine:', error);
              return error;
            })
        );
      }

      // Stop task executor
      if (this.taskExecutor) {
        shutdownPromises.push(
          this.taskExecutor.shutdown(stopOptions.timeout)
            .catch(error => {
              console.error('Error stopping TaskExecutor:', error);
              return error;
            })
        );
      }

      // Execute custom shutdown handlers
      for (const handler of this.shutdownHandlers) {
        try {
          shutdownPromises.push(handler(stopOptions));
        } catch (error) {
          console.error('Error executing shutdown handler:', error);
        }
      }

      // Wait for all shutdowns to complete or timeout
      const shutdownTimeoutPromise = new Promise(resolve => {
        setTimeout(() => {
          console.warn('Shutdown timeout reached');
          resolve('timeout');
        }, stopOptions.timeout);
      });

      await Promise.race([
        Promise.allSettled(shutdownPromises),
        shutdownTimeoutPromise
      ]);

      // Remove event listeners
      this._removeEventListeners();

      // Remove process signal handlers
      this._removeProcessSignals();

      this.isStarted = false;
      this.isShuttingDown = false;

      // Emit shutdown event
      if (this.eventBus) {
        this.eventBus.emit('scheduler.stopped', {
          timestamp: new Date(),
          graceful: true,
          uptime: Date.now() - this.startupTime?.getTime() || 0
        });
      }

      console.log('Scheduler services stopped successfully');

    } catch (error) {
      console.error('Error during scheduler shutdown:', error);
      this.isShuttingDown = false;
      throw error;
    }
  }

  /**
   * Restarts the scheduler services
   * @param {Object} options - Restart options
   * @returns {Promise<void>}
   */
  async restart(options = {}) {
    try {
      console.log('Restarting scheduler services...');

      if (this.isStarted) {
        await this.stop(options);
        
        // Wait a moment between stop and start
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await this.start(options);

      console.log('Scheduler services restarted successfully');

    } catch (error) {
      console.error('Failed to restart scheduler services:', error);
      throw error;
    }
  }

  /**
   * Gets current scheduler status
   * @returns {Promise<Object>} Status information
   */
  async getStatus() {
    try {
      const status = {
        isInitialized: this.isInitialized,
        isStarted: this.isStarted,
        isShuttingDown: this.isShuttingDown,
        startupTime: this.startupTime,
        uptime: this.startupTime ? Date.now() - this.startupTime.getTime() : 0,
        config: { ...this.config }
      };

      if (this.isStarted) {
        // Get status from components
        if (this.schedulingEngine) {
          status.schedulingEngine = this.schedulingEngine.getStatus();
        }

        if (this.taskExecutor) {
          status.taskExecutor = this.taskExecutor.getStatus();
        }

        // Get repository stats
        status.activeTaskCount = await this._getActiveTaskCount();
        
        if (this.scheduledTaskRepository.getStats) {
          status.repository = this.scheduledTaskRepository.getStats();
        }
      }

      return status;

    } catch (error) {
      console.error('Error getting scheduler status:', error);
      return {
        isInitialized: this.isInitialized,
        isStarted: this.isStarted,
        isShuttingDown: this.isShuttingDown,
        error: error.message
      };
    }
  }

  /**
   * Performs health check on scheduler components
   * @returns {Promise<Object>} Health check results
   */
  async performHealthCheck() {
    try {
      const healthCheck = {
        timestamp: new Date(),
        overall: 'healthy',
        components: {},
        issues: []
      };

      // Check if services are running
      if (!this.isInitialized) {
        healthCheck.overall = 'unhealthy';
        healthCheck.issues.push('Scheduler not initialized');
      }

      if (!this.isStarted) {
        healthCheck.overall = 'unhealthy';
        healthCheck.issues.push('Scheduler not started');
      }

      // Check repository health
      try {
        const repoStats = await this._getActiveTaskCount();
        healthCheck.components.repository = {
          status: 'healthy',
          activeTaskCount: repoStats
        };
      } catch (error) {
        healthCheck.overall = 'degraded';
        healthCheck.components.repository = {
          status: 'unhealthy',
          error: error.message
        };
        healthCheck.issues.push(`Repository error: ${error.message}`);
      }

      // Check scheduling engine health
      if (this.schedulingEngine && this.isStarted) {
        try {
          const engineStatus = this.schedulingEngine.getStatus();
          healthCheck.components.schedulingEngine = {
            status: engineStatus.isRunning ? 'healthy' : 'unhealthy',
            scheduledTasks: engineStatus.scheduledTasks,
            activeExecutions: engineStatus.activeExecutions
          };

          if (!engineStatus.isRunning) {
            healthCheck.overall = 'unhealthy';
            healthCheck.issues.push('SchedulingEngine not running');
          }
        } catch (error) {
          healthCheck.overall = 'degraded';
          healthCheck.components.schedulingEngine = {
            status: 'error',
            error: error.message
          };
          healthCheck.issues.push(`SchedulingEngine error: ${error.message}`);
        }
      }

      // Check task executor health
      if (this.taskExecutor && this.isStarted) {
        try {
          const executorStatus = this.taskExecutor.getStatus();
          healthCheck.components.taskExecutor = {
            status: 'healthy',
            activeTasks: executorStatus.activeTasks,
            queueLength: executorStatus.queueLength
          };

          // Check for concerning queue buildup
          if (executorStatus.queueLength > 10) {
            healthCheck.overall = 'degraded';
            healthCheck.issues.push(`Task queue is backing up: ${executorStatus.queueLength} tasks`);
          }
        } catch (error) {
          healthCheck.overall = 'degraded';
          healthCheck.components.taskExecutor = {
            status: 'error',
            error: error.message
          };
          healthCheck.issues.push(`TaskExecutor error: ${error.message}`);
        }
      }

      return healthCheck;

    } catch (error) {
      console.error('Health check error:', error);
      return {
        timestamp: new Date(),
        overall: 'error',
        error: error.message,
        issues: ['Health check failed']
      };
    }
  }

  /**
   * Adds a custom shutdown handler
   * @param {Function} handler - Shutdown handler function
   */
  addShutdownHandler(handler) {
    if (typeof handler === 'function') {
      this.shutdownHandlers.push(handler);
    }
  }

  /**
   * Private: Setup event listeners for schedule lifecycle events
   */
  async _setupEventListeners() {
    if (!this.eventBus) {
      return;
    }

    try {
      // Listen for schedule lifecycle events
      this.eventBus.on('ScheduleCreated', this._handleScheduleCreated);
      this.eventBus.on('ScheduleUpdated', this._handleScheduleUpdated);
      this.eventBus.on('ScheduleCancelled', this._handleScheduleCancelled);

      console.log('Event listeners setup for scheduler lifecycle events');

    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }

  /**
   * Private: Setup event listeners between components
   */
  _setupComponentEventListeners() {
    if (!this.schedulingEngine || !this.taskExecutor) {
      return;
    }

    // Forward scheduling engine events
    this.schedulingEngine.on('taskExecutionStarted', (data) => {
      if (this.eventBus) {
        this.eventBus.emit('scheduler.task.started', data);
      }
    });

    this.schedulingEngine.on('taskExecutionCompleted', (data) => {
      if (this.eventBus) {
        this.eventBus.emit('scheduler.task.completed', data);
      }
    });

    this.schedulingEngine.on('taskExecutionFailed', (data) => {
      if (this.eventBus) {
        this.eventBus.emit('scheduler.task.failed', data);
      }
    });

    // Forward task executor events
    this.taskExecutor.on('executionStarted', (data) => {
      if (this.eventBus) {
        this.eventBus.emit('scheduler.execution.started', data);
      }
    });

    this.taskExecutor.on('executionCompleted', (data) => {
      if (this.eventBus) {
        this.eventBus.emit('scheduler.execution.completed', data);
      }
    });

    this.taskExecutor.on('executionFailed', (data) => {
      if (this.eventBus) {
        this.eventBus.emit('scheduler.execution.failed', data);
      }
    });
  }

  /**
   * Private: Remove event listeners
   */
  _removeEventListeners() {
    if (!this.eventBus) {
      return;
    }

    try {
      this.eventBus.removeListener('ScheduleCreated', this._handleScheduleCreated);
      this.eventBus.removeListener('ScheduleUpdated', this._handleScheduleUpdated);
      this.eventBus.removeListener('ScheduleCancelled', this._handleScheduleCancelled);

      console.log('Event listeners removed');

    } catch (error) {
      console.error('Error removing event listeners:', error);
    }
  }

  /**
   * Private: Setup process signal handlers
   */
  _setupProcessSignals() {
    process.on('SIGINT', this._handleProcessSignals);
    process.on('SIGTERM', this._handleProcessSignals);
    process.on('SIGUSR2', this._handleProcessSignals); // Nodemon restart
  }

  /**
   * Private: Remove process signal handlers
   */
  _removeProcessSignals() {
    process.removeListener('SIGINT', this._handleProcessSignals);
    process.removeListener('SIGTERM', this._handleProcessSignals);
    process.removeListener('SIGUSR2', this._handleProcessSignals);
  }

  /**
   * Private: Handle process termination signals
   */
  async _handleProcessSignals(signal) {
    console.log(`Received ${signal}, initiating graceful shutdown...`);
    
    try {
      await this.stop({ timeout: this.config.shutdownTimeout });
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Private: Handle schedule created events
   */
  async _handleScheduleCreated(event) {
    try {
      if (this.isStarted && event.scheduledTask) {
        await this.schedulingEngine.scheduleTask(event.scheduledTask);
      }
    } catch (error) {
      console.error('Error handling schedule created event:', error);
    }
  }

  /**
   * Private: Handle schedule updated events
   */
  async _handleScheduleUpdated(event) {
    try {
      if (this.isStarted && event.scheduledTask) {
        await this.schedulingEngine.rescheduleTask(event.scheduledTask);
      }
    } catch (error) {
      console.error('Error handling schedule updated event:', error);
    }
  }

  /**
   * Private: Handle schedule cancelled events
   */
  async _handleScheduleCancelled(event) {
    try {
      if (this.isStarted && event.scheduleId) {
        await this.schedulingEngine.unscheduleTask(event.scheduleId);
      }
    } catch (error) {
      console.error('Error handling schedule cancelled event:', error);
    }
  }

  /**
   * Private: Validate required dependencies
   */
  async _validateDependencies() {
    if (!this.schedulingEngine) {
      throw new Error('SchedulingEngine is required but not provided');
    }

    if (!this.taskExecutor) {
      throw new Error('TaskExecutor is required but not provided');
    }

    if (!this.scheduledTaskRepository) {
      throw new Error('ScheduledTaskRepository is required but not provided');
    }

    // Check if repository has required methods
    const requiredMethods = ['findActive', 'findById', 'save'];
    for (const method of requiredMethods) {
      if (typeof this.scheduledTaskRepository[method] !== 'function') {
        throw new Error(`Repository is missing required method: ${method}`);
      }
    }
  }

  /**
   * Private: Get active task count from repository
   */
  async _getActiveTaskCount() {
    try {
      const activeTasks = await this.scheduledTaskRepository.findActive();
      return activeTasks ? activeTasks.length : 0;
    } catch (error) {
      console.error('Error getting active task count:', error);
      return -1;
    }
  }
}

module.exports = SchedulerBootstrap;