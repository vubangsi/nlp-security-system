/**
 * SchedulerIntegration - Example Integration
 * 
 * This file demonstrates how to integrate the comprehensive scheduler infrastructure
 * into your main application. This is an example implementation showing the proper
 * initialization sequence and lifecycle management.
 * 
 * To integrate the scheduler into your main app.js, follow these patterns:
 */

const DIContainer = require('../container/DIContainer');

/**
 * Example: Initialize and start the scheduler infrastructure
 * This should be called during application startup, after basic services are initialized
 */
async function initializeScheduler() {
  try {
    console.log('Initializing scheduler infrastructure...');
    
    // Create DI container (this gives us access to all scheduler components)
    const container = new DIContainer();
    
    // Get scheduler components
    const schedulerComponents = container.getSchedulerComponents();
    const { 
      schedulerConfig, 
      schedulerBootstrap, 
      schedulingEngine, 
      taskExecutor,
      scheduledTaskRepository 
    } = schedulerComponents;

    // Log configuration summary for debugging
    console.log('Scheduler configuration:', schedulerConfig.getConfigSummary());

    // Initialize the scheduler infrastructure
    await schedulerBootstrap.initialize({
      loadSchedules: true,
      setupEventListeners: true
    });

    // The bootstrap will auto-start if configured to do so
    // Otherwise, manually start:
    // await schedulerBootstrap.start();

    console.log('Scheduler infrastructure initialized successfully');
    
    // Return components for further use in the application
    return {
      container,
      schedulerComponents,
      schedulerBootstrap,
      schedulingEngine,
      taskExecutor
    };

  } catch (error) {
    console.error('Failed to initialize scheduler infrastructure:', error);
    throw error;
  }
}

/**
 * Example: Graceful shutdown of scheduler infrastructure
 * This should be called during application shutdown
 */
async function shutdownScheduler(schedulerBootstrap) {
  try {
    console.log('Shutting down scheduler infrastructure...');
    
    await schedulerBootstrap.stop({
      timeout: 30000,
      cancelActiveExecutions: false // Let running tasks complete
    });
    
    console.log('Scheduler infrastructure shut down successfully');
    
  } catch (error) {
    console.error('Error during scheduler shutdown:', error);
    throw error;
  }
}

/**
 * Example: Health check for scheduler components
 */
async function checkSchedulerHealth(schedulerBootstrap) {
  try {
    const healthCheck = await schedulerBootstrap.performHealthCheck();
    
    if (healthCheck.overall === 'healthy') {
      console.log('Scheduler health check: All systems operational');
    } else {
      console.warn('Scheduler health check warnings:', healthCheck.issues);
    }
    
    return healthCheck;
    
  } catch (error) {
    console.error('Scheduler health check failed:', error);
    return {
      overall: 'error',
      error: error.message
    };
  }
}

/**
 * Example: Create a scheduled task programmatically
 */
async function createExampleScheduledTask(container, userId) {
  try {
    const { createScheduledTaskUseCase } = container.getSchedulerComponents();
    
    const result = await createScheduledTaskUseCase.execute({
      userId: userId,
      actionType: 'ARM_SYSTEM',
      actionParameters: { mode: 'away' },
      scheduleExpression: {
        type: 'SPECIFIC_TIME',
        specificTime: new Date(Date.now() + 3600000), // 1 hour from now
        timezone: 'UTC'
      },
      description: 'Evening system arming'
    });
    
    if (result.success) {
      console.log('Created example scheduled task:', result.data.schedule.id);
      return result.data.schedule;
    } else {
      console.error('Failed to create scheduled task:', result.error);
      return null;
    }
    
  } catch (error) {
    console.error('Error creating example scheduled task:', error);
    return null;
  }
}

/**
 * Example: Integration into main application (app.js pattern)
 */
async function integrateIntoMainApp() {
  let schedulerComponents = null;
  
  try {
    // Initialize scheduler during app startup
    schedulerComponents = await initializeScheduler();
    
    // Setup periodic health checks
    setInterval(async () => {
      await checkSchedulerHealth(schedulerComponents.schedulerBootstrap);
    }, 300000); // Every 5 minutes
    
    // Setup graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      
      if (schedulerComponents) {
        await shutdownScheduler(schedulerComponents.schedulerBootstrap);
      }
      
      process.exit(0);
    };
    
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
    // Example: Create a test scheduled task (optional)
    if (process.env.NODE_ENV === 'development') {
      setTimeout(async () => {
        await createExampleScheduledTask(schedulerComponents.container, 'admin');
      }, 5000); // Wait 5 seconds after startup
    }
    
    console.log('Application started with scheduler integration');
    return schedulerComponents;
    
  } catch (error) {
    console.error('Failed to integrate scheduler into main app:', error);
    
    if (schedulerComponents) {
      await shutdownScheduler(schedulerComponents.schedulerBootstrap);
    }
    
    process.exit(1);
  }
}

/**
 * Example: Environment variables for configuration
 * Add these to your .env file for customization:
 * 
 * # Scheduler Configuration
 * SCHEDULER_CHECK_INTERVAL=60000          # Check for due tasks every 60 seconds
 * SCHEDULER_EXECUTION_TOLERANCE=300000    # Allow 5 minutes tolerance for execution
 * SCHEDULER_MAX_CONCURRENT=5              # Maximum concurrent executions
 * SCHEDULER_AUTO_RECOVERY=true            # Enable automatic recovery
 * SCHEDULER_AUTO_START=true               # Auto-start on application startup
 * SCHEDULER_LOAD_EXISTING=true            # Load existing schedules on startup
 * SCHEDULER_GRACEFUL_SHUTDOWN=true        # Enable graceful shutdown
 * 
 * # Task Executor Configuration  
 * TASK_EXECUTOR_MAX_CONCURRENT=3          # Maximum concurrent task executions
 * TASK_EXECUTOR_TIMEOUT=300000            # Default task timeout (5 minutes)
 * TASK_EXECUTOR_MAX_RETRIES=3             # Maximum retry attempts
 * TASK_EXECUTOR_RETRY_DELAY_BASE=1000     # Base retry delay (1 second)
 * TASK_EXECUTOR_RETRY_DELAY_MAX=30000     # Maximum retry delay (30 seconds)
 * 
 * # Feature Flags
 * SCHEDULER_ENABLE_DST=true               # Enable DST handling
 * SCHEDULER_ENABLE_ADVANCED_RETRIES=true # Enable advanced retry strategies
 * SCHEDULER_ENABLE_PERFORMANCE_MONITORING=true # Enable performance monitoring
 * SCHEDULER_DEBUG=true                    # Enable debug logging
 */

module.exports = {
  initializeScheduler,
  shutdownScheduler,
  checkSchedulerHealth,
  createExampleScheduledTask,
  integrateIntoMainApp
};

/**
 * Usage in your main app.js:
 * 
 * const express = require('express');
 * const { integrateIntoMainApp } = require('./src/infrastructure/examples/SchedulerIntegration');
 * 
 * async function startApplication() {
 *   const app = express();
 *   
 *   // ... your existing Express setup ...
 *   
 *   // Initialize scheduler infrastructure
 *   const schedulerComponents = await integrateIntoMainApp();
 *   
 *   // Make scheduler components available to your routes if needed
 *   app.locals.scheduler = schedulerComponents;
 *   
 *   const port = process.env.PORT || 3000;
 *   app.listen(port, () => {
 *     console.log(`Server running on port ${port} with scheduler enabled`);
 *   });
 * }
 * 
 * startApplication().catch(console.error);
 */