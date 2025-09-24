/**
 * SchedulerConfig
 * 
 * Centralized configuration management for the scheduling infrastructure.
 * Provides environment-based configuration with sensible defaults, validation,
 * and feature flags for different scheduler components.
 */
class SchedulerConfig {
  constructor() {
    this.config = this._loadConfiguration();
    this._validateConfiguration();
  }

  /**
   * Gets the complete scheduler configuration
   * @returns {Object} Complete configuration object
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Gets scheduling engine configuration
   * @returns {Object} SchedulingEngine configuration
   */
  getSchedulingEngineConfig() {
    return {
      checkInterval: this.config.scheduler.checkInterval,
      executionTolerance: this.config.scheduler.executionTolerance,
      maxConcurrentExecutions: this.config.scheduler.maxConcurrentExecutions,
      enableAutoRecovery: this.config.scheduler.enableAutoRecovery,
      healthCheckInterval: this.config.scheduler.healthCheckInterval,
      timerCleanupInterval: this.config.scheduler.timerCleanupInterval,
      maxTimerDrift: this.config.scheduler.maxTimerDrift
    };
  }

  /**
   * Gets task executor configuration
   * @returns {Object} TaskExecutor configuration
   */
  getTaskExecutorConfig() {
    return {
      maxConcurrentTasks: this.config.taskExecutor.maxConcurrentTasks,
      defaultTimeout: this.config.taskExecutor.defaultTimeout,
      maxRetries: this.config.taskExecutor.maxRetries,
      retryDelayBase: this.config.taskExecutor.retryDelayBase,
      retryDelayMax: this.config.taskExecutor.retryDelayMax,
      queueTimeout: this.config.taskExecutor.queueTimeout,
      enableMetrics: this.config.taskExecutor.enableMetrics,
      gracefulShutdownTimeout: this.config.taskExecutor.gracefulShutdownTimeout
    };
  }

  /**
   * Gets scheduler bootstrap configuration
   * @returns {Object} SchedulerBootstrap configuration
   */
  getBootstrapConfig() {
    return {
      autoStart: this.config.bootstrap.autoStart,
      loadExistingSchedules: this.config.bootstrap.loadExistingSchedules,
      shutdownTimeout: this.config.bootstrap.shutdownTimeout,
      healthCheckEnabled: this.config.bootstrap.healthCheckEnabled,
      gracefulShutdown: this.config.bootstrap.gracefulShutdown,
      enableEventListeners: this.config.bootstrap.enableEventListeners
    };
  }

  /**
   * Gets feature flags configuration
   * @returns {Object} Feature flags
   */
  getFeatureFlags() {
    return { ...this.config.features };
  }

  /**
   * Gets environment-specific settings
   * @returns {Object} Environment settings
   */
  getEnvironmentSettings() {
    return {
      environment: this.config.environment,
      debug: this.config.debug,
      logLevel: this.config.logLevel,
      timezone: this.config.timezone
    };
  }

  /**
   * Checks if a feature is enabled
   * @param {string} featureName - Name of the feature
   * @returns {boolean} True if feature is enabled
   */
  isFeatureEnabled(featureName) {
    return this.config.features[featureName] === true;
  }

  /**
   * Updates configuration at runtime (for specific values only)
   * @param {string} section - Configuration section
   * @param {Object} updates - Updates to apply
   * @returns {boolean} True if updates were applied
   */
  updateConfig(section, updates) {
    const allowedSections = ['scheduler', 'taskExecutor', 'features'];
    
    if (!allowedSections.includes(section)) {
      console.warn(`Configuration section '${section}' is not updatable`);
      return false;
    }

    if (!this.config[section]) {
      console.warn(`Configuration section '${section}' does not exist`);
      return false;
    }

    // Apply updates
    Object.assign(this.config[section], updates);
    
    try {
      this._validateConfiguration();
      console.log(`Configuration section '${section}' updated successfully`);
      return true;
    } catch (error) {
      console.error(`Configuration validation failed after update:`, error);
      return false;
    }
  }

  /**
   * Private: Loads configuration from environment variables with defaults
   */
  _loadConfiguration() {
    return {
      environment: process.env.NODE_ENV || 'development',
      debug: process.env.SCHEDULER_DEBUG === 'true',
      logLevel: process.env.SCHEDULER_LOG_LEVEL || 'info',
      timezone: process.env.TZ || 'UTC',

      scheduler: {
        // How often to check for due tasks (milliseconds)
        checkInterval: this._parseEnvInt('SCHEDULER_CHECK_INTERVAL', 60000, 5000, 300000),
        
        // Tolerance for executing overdue tasks (milliseconds)
        executionTolerance: this._parseEnvInt('SCHEDULER_EXECUTION_TOLERANCE', 300000, 60000, 1800000),
        
        // Maximum concurrent task executions
        maxConcurrentExecutions: this._parseEnvInt('SCHEDULER_MAX_CONCURRENT', 5, 1, 20),
        
        // Enable automatic recovery from failures
        enableAutoRecovery: process.env.SCHEDULER_AUTO_RECOVERY !== 'false',
        
        // Health check interval (milliseconds)
        healthCheckInterval: this._parseEnvInt('SCHEDULER_HEALTH_CHECK_INTERVAL', 300000, 30000, 1800000),
        
        // Timer cleanup interval (milliseconds)
        timerCleanupInterval: this._parseEnvInt('SCHEDULER_TIMER_CLEANUP_INTERVAL', 1800000, 300000, 7200000),
        
        // Maximum timer drift before considering it stale (milliseconds)
        maxTimerDrift: this._parseEnvInt('SCHEDULER_MAX_TIMER_DRIFT', 60000, 10000, 300000)
      },

      taskExecutor: {
        // Maximum concurrent tasks in executor
        maxConcurrentTasks: this._parseEnvInt('TASK_EXECUTOR_MAX_CONCURRENT', 3, 1, 10),
        
        // Default task execution timeout (milliseconds)
        defaultTimeout: this._parseEnvInt('TASK_EXECUTOR_TIMEOUT', 300000, 30000, 1800000),
        
        // Maximum retry attempts for failed tasks
        maxRetries: this._parseEnvInt('TASK_EXECUTOR_MAX_RETRIES', 3, 0, 10),
        
        // Base delay for retry backoff (milliseconds)
        retryDelayBase: this._parseEnvInt('TASK_EXECUTOR_RETRY_DELAY_BASE', 1000, 100, 10000),
        
        // Maximum retry delay (milliseconds)
        retryDelayMax: this._parseEnvInt('TASK_EXECUTOR_RETRY_DELAY_MAX', 30000, 1000, 300000),
        
        // Timeout for tasks waiting in queue (milliseconds)
        queueTimeout: this._parseEnvInt('TASK_EXECUTOR_QUEUE_TIMEOUT', 600000, 60000, 3600000),
        
        // Enable execution metrics collection
        enableMetrics: process.env.TASK_EXECUTOR_ENABLE_METRICS !== 'false',
        
        // Graceful shutdown timeout (milliseconds)
        gracefulShutdownTimeout: this._parseEnvInt('TASK_EXECUTOR_SHUTDOWN_TIMEOUT', 30000, 5000, 120000)
      },

      bootstrap: {
        // Auto-start scheduler on application startup
        autoStart: process.env.SCHEDULER_AUTO_START !== 'false',
        
        // Load existing schedules on startup
        loadExistingSchedules: process.env.SCHEDULER_LOAD_EXISTING !== 'false',
        
        // Shutdown timeout for bootstrap (milliseconds)
        shutdownTimeout: this._parseEnvInt('SCHEDULER_SHUTDOWN_TIMEOUT', 30000, 5000, 120000),
        
        // Enable health checks
        healthCheckEnabled: process.env.SCHEDULER_HEALTH_CHECK !== 'false',
        
        // Enable graceful shutdown handling
        gracefulShutdown: process.env.SCHEDULER_GRACEFUL_SHUTDOWN !== 'false',
        
        // Enable event listeners for schedule lifecycle
        enableEventListeners: process.env.SCHEDULER_ENABLE_EVENTS !== 'false'
      },

      features: {
        // Enable DST (Daylight Saving Time) handling
        enableDstHandling: process.env.SCHEDULER_ENABLE_DST === 'true',
        
        // Enable advanced retry strategies
        enableAdvancedRetries: process.env.SCHEDULER_ENABLE_ADVANCED_RETRIES === 'true',
        
        // Enable schedule persistence to external storage
        enablePersistence: process.env.SCHEDULER_ENABLE_PERSISTENCE === 'true',
        
        // Enable distributed scheduling (for future multi-instance support)
        enableDistributed: process.env.SCHEDULER_ENABLE_DISTRIBUTED === 'true',
        
        // Enable performance monitoring
        enablePerformanceMonitoring: process.env.SCHEDULER_ENABLE_PERFORMANCE_MONITORING === 'true',
        
        // Enable schedule analytics
        enableAnalytics: process.env.SCHEDULER_ENABLE_ANALYTICS === 'true',
        
        // Enable external notifications for failures
        enableFailureNotifications: process.env.SCHEDULER_ENABLE_FAILURE_NOTIFICATIONS === 'true'
      },

      limits: {
        // Maximum number of schedules per user
        maxSchedulesPerUser: this._parseEnvInt('SCHEDULER_MAX_SCHEDULES_PER_USER', 50, 1, 1000),
        
        // Maximum schedule description length
        maxDescriptionLength: this._parseEnvInt('SCHEDULER_MAX_DESCRIPTION_LENGTH', 500, 10, 2000),
        
        // Maximum days in advance to schedule tasks
        maxScheduleDaysAhead: this._parseEnvInt('SCHEDULER_MAX_SCHEDULE_DAYS_AHEAD', 365, 1, 1095),
        
        // Maximum failed task history to keep
        maxFailureHistory: this._parseEnvInt('SCHEDULER_MAX_FAILURE_HISTORY', 100, 10, 1000)
      },

      performance: {
        // Enable timer pooling to reduce memory usage
        enableTimerPooling: process.env.SCHEDULER_ENABLE_TIMER_POOLING === 'true',
        
        // Timer pool size
        timerPoolSize: this._parseEnvInt('SCHEDULER_TIMER_POOL_SIZE', 100, 10, 1000),
        
        // Enable batch processing for multiple due tasks
        enableBatchProcessing: process.env.SCHEDULER_ENABLE_BATCH_PROCESSING !== 'false',
        
        // Batch size for processing multiple tasks
        batchSize: this._parseEnvInt('SCHEDULER_BATCH_SIZE', 10, 1, 100)
      }
    };
  }

  /**
   * Private: Parses environment variable as integer with bounds checking
   */
  _parseEnvInt(envVar, defaultValue, minValue = null, maxValue = null) {
    const value = process.env[envVar];
    
    if (!value) {
      return defaultValue;
    }

    const parsed = parseInt(value, 10);
    
    if (isNaN(parsed)) {
      console.warn(`Invalid integer value for ${envVar}: ${value}, using default: ${defaultValue}`);
      return defaultValue;
    }

    if (minValue !== null && parsed < minValue) {
      console.warn(`Value for ${envVar} (${parsed}) is below minimum (${minValue}), using minimum`);
      return minValue;
    }

    if (maxValue !== null && parsed > maxValue) {
      console.warn(`Value for ${envVar} (${parsed}) is above maximum (${maxValue}), using maximum`);
      return maxValue;
    }

    return parsed;
  }

  /**
   * Private: Validates the loaded configuration
   */
  _validateConfiguration() {
    // Validate scheduler configuration
    if (this.config.scheduler.checkInterval >= this.config.scheduler.executionTolerance) {
      throw new Error('Scheduler check interval must be less than execution tolerance');
    }

    if (this.config.scheduler.maxConcurrentExecutions < 1) {
      throw new Error('Maximum concurrent executions must be at least 1');
    }

    // Validate task executor configuration
    if (this.config.taskExecutor.maxConcurrentTasks < 1) {
      throw new Error('Task executor maximum concurrent tasks must be at least 1');
    }

    if (this.config.taskExecutor.defaultTimeout < 1000) {
      throw new Error('Task executor default timeout must be at least 1000ms');
    }

    if (this.config.taskExecutor.maxRetries < 0) {
      throw new Error('Task executor maximum retries cannot be negative');
    }

    if (this.config.taskExecutor.retryDelayBase < 100) {
      throw new Error('Task executor retry delay base must be at least 100ms');
    }

    if (this.config.taskExecutor.retryDelayMax < this.config.taskExecutor.retryDelayBase) {
      throw new Error('Task executor maximum retry delay must be >= base delay');
    }

    // Validate bootstrap configuration
    if (this.config.bootstrap.shutdownTimeout < 1000) {
      throw new Error('Bootstrap shutdown timeout must be at least 1000ms');
    }

    // Validate limits
    if (this.config.limits.maxSchedulesPerUser < 1) {
      throw new Error('Maximum schedules per user must be at least 1');
    }

    if (this.config.limits.maxDescriptionLength < 10) {
      throw new Error('Maximum description length must be at least 10');
    }

    if (this.config.limits.maxScheduleDaysAhead < 1) {
      throw new Error('Maximum schedule days ahead must be at least 1');
    }

    console.log('Scheduler configuration validated successfully');
  }

  /**
   * Gets a summary of the current configuration for debugging
   * @returns {Object} Configuration summary
   */
  getConfigSummary() {
    return {
      environment: this.config.environment,
      scheduler: {
        checkInterval: `${this.config.scheduler.checkInterval}ms`,
        executionTolerance: `${this.config.scheduler.executionTolerance}ms`,
        maxConcurrentExecutions: this.config.scheduler.maxConcurrentExecutions,
        autoRecovery: this.config.scheduler.enableAutoRecovery
      },
      taskExecutor: {
        maxConcurrentTasks: this.config.taskExecutor.maxConcurrentTasks,
        defaultTimeout: `${this.config.taskExecutor.defaultTimeout}ms`,
        maxRetries: this.config.taskExecutor.maxRetries
      },
      bootstrap: {
        autoStart: this.config.bootstrap.autoStart,
        loadExistingSchedules: this.config.bootstrap.loadExistingSchedules,
        gracefulShutdown: this.config.bootstrap.gracefulShutdown
      },
      featuresEnabled: Object.keys(this.config.features).filter(
        key => this.config.features[key] === true
      )
    };
  }
}

// Export singleton instance
module.exports = new SchedulerConfig();