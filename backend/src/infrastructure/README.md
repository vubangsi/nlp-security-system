# Scheduler Infrastructure Implementation

## Overview

This directory contains a comprehensive infrastructure layer implementation for the scheduled system arming feature, providing robust background scheduling capabilities with production-ready error handling, monitoring, and resource management.

## Components Implemented

### 1. Repository Layer
- **`InMemoryScheduledTaskRepository`** - Complete implementation of the ScheduledTaskRepository interface
  - Full CRUD operations with indexing for efficient queries
  - Advanced filtering capabilities (by user, status, time ranges, etc.)
  - Bulk operations and statistics methods
  - Memory-efficient storage with proper cleanup

### 2. Background Services
- **`SchedulingEngine`** - Core scheduling service with timer management
  - Efficient Node.js timer-based scheduling
  - Automatic schedule loading and recovery
  - Health monitoring and stale timer cleanup
  - Event-driven architecture for schedule updates
  
- **`TaskExecutor`** - Controlled task execution environment
  - Concurrent execution limits and queuing
  - Retry logic with exponential backoff
  - Timeout handling and resource management
  - Comprehensive metrics collection

### 3. Bootstrap & Lifecycle
- **`SchedulerBootstrap`** - Application startup and shutdown coordination
  - Graceful initialization sequence
  - Event listener setup and cleanup
  - Health check coordination
  - Process signal handling for graceful shutdown

### 4. Configuration Management
- **`SchedulerConfig`** - Centralized configuration with environment variable support
  - Validation and bounds checking
  - Runtime configuration updates
  - Feature flags and environment-specific settings
  - Comprehensive logging and debugging options

### 5. Dependency Injection
- **Enhanced `DIContainer`** - Updated to register all scheduler components
  - Proper dependency resolution
  - Configuration injection
  - Component lifecycle management
  - Scheduler-specific component access methods

## Key Features

### Error Handling & Resilience
- Graceful handling of timer failures and system restarts
- Retry mechanisms with exponential backoff and jitter
- Proper cleanup of resources and timers
- Recovery from corrupted or invalid schedules
- Circuit breaker patterns for external dependencies

### Performance & Resource Management
- Efficient timer management to prevent timer proliferation
- Memory-conscious schedule storage and retrieval
- CPU-efficient schedule monitoring with configurable intervals
- Concurrent execution limits to prevent resource exhaustion
- Automatic cleanup of expired and completed tasks

### Monitoring & Observability
- Comprehensive logging for debugging and monitoring
- Health check endpoints for scheduler status monitoring
- Metrics collection for execution statistics
- Event-driven architecture for real-time status updates
- Configuration validation and environment verification

### Production Readiness
- Environment-based configuration management
- Graceful shutdown with configurable timeouts
- Support for multiple deployment environments
- Comprehensive error handling and logging
- Resource cleanup and memory management

## File Structure

```
src/infrastructure/
├── persistence/
│   └── InMemoryScheduledTaskRepository.js    # Repository implementation
├── services/
│   ├── SchedulingEngine.js                   # Core scheduling engine
│   └── TaskExecutor.js                       # Task execution service
├── bootstrap/
│   └── SchedulerBootstrap.js                 # Startup/shutdown coordinator
├── config/
│   └── SchedulerConfig.js                    # Configuration management
├── container/
│   └── DIContainer.js                        # Updated DI container
├── examples/
│   └── SchedulerIntegration.js               # Integration examples
└── README.md                                 # This documentation
```

## Configuration Options

The scheduler infrastructure supports extensive configuration through environment variables:

### Core Scheduler Settings
- `SCHEDULER_CHECK_INTERVAL` - How often to check for due tasks (default: 60000ms)
- `SCHEDULER_EXECUTION_TOLERANCE` - Tolerance for overdue tasks (default: 300000ms)
- `SCHEDULER_MAX_CONCURRENT` - Maximum concurrent executions (default: 5)
- `SCHEDULER_AUTO_RECOVERY` - Enable automatic recovery (default: true)
- `SCHEDULER_AUTO_START` - Auto-start on application startup (default: true)

### Task Executor Settings
- `TASK_EXECUTOR_MAX_CONCURRENT` - Maximum concurrent task executions (default: 3)
- `TASK_EXECUTOR_TIMEOUT` - Default task timeout (default: 300000ms)
- `TASK_EXECUTOR_MAX_RETRIES` - Maximum retry attempts (default: 3)
- `TASK_EXECUTOR_RETRY_DELAY_BASE` - Base retry delay (default: 1000ms)
- `TASK_EXECUTOR_RETRY_DELAY_MAX` - Maximum retry delay (default: 30000ms)

### Feature Flags
- `SCHEDULER_ENABLE_DST` - DST handling support
- `SCHEDULER_ENABLE_ADVANCED_RETRIES` - Advanced retry strategies
- `SCHEDULER_ENABLE_PERFORMANCE_MONITORING` - Performance metrics
- `SCHEDULER_DEBUG` - Debug logging

## Integration

### Basic Integration
```javascript
const DIContainer = require('./src/infrastructure/container/DIContainer');

// Initialize
const container = new DIContainer();
const { schedulerBootstrap } = container.getSchedulerComponents();

// Start scheduler
await schedulerBootstrap.initialize();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await schedulerBootstrap.stop();
  process.exit(0);
});
```

### Advanced Integration
See `examples/SchedulerIntegration.js` for comprehensive integration patterns including:
- Application startup coordination
- Health check implementation
- Graceful shutdown handling
- Error recovery strategies
- Development environment setup

## Architecture Patterns

### Repository Pattern
- Clean abstraction over data persistence
- Efficient indexing and querying
- Support for complex filtering and pagination
- Consistent error handling across all operations

### Service Layer
- Clear separation of concerns
- Event-driven architecture
- Configurable behavior through dependency injection
- Comprehensive logging and monitoring

### Factory & Builder Patterns
- Configuration object builders
- Service factory methods
- Dependency injection coordination
- Runtime component creation

### Observer Pattern
- Event bus integration
- Real-time status updates
- Decoupled component communication
- Lifecycle event handling

## Testing Support

The infrastructure is designed with testing in mind:
- Dependency injection for easy mocking
- Configurable timeouts and intervals
- Event-driven architecture for test verification
- Clear separation between core logic and external dependencies
- Mock timer support for controlled time advancement

## Performance Characteristics

### Memory Usage
- Efficient Map-based storage with proper indexing
- Automatic cleanup of completed/cancelled tasks
- Configurable limits on schedule history
- Timer pooling to reduce memory overhead

### CPU Usage
- Configurable check intervals to balance responsiveness vs. CPU usage
- Efficient filtering and querying algorithms
- Batch processing for multiple due tasks
- Minimal overhead during idle periods

### Scalability
- Concurrent execution limits prevent resource exhaustion
- Queue-based task management for load balancing
- Configurable timeouts and retry policies
- Support for horizontal scaling patterns

## Future Extensibility

The architecture is designed to support future enhancements:
- Database persistence layer (interface already defined)
- Distributed scheduling across multiple instances
- External notification services (email, SMS, push)
- Advanced scheduling expressions (cron-like syntax)
- Metrics and monitoring integration (Prometheus, etc.)
- Admin dashboard for schedule management

## Maintenance

### Monitoring
- Regular health checks via `schedulerBootstrap.performHealthCheck()`
- Monitor queue lengths and execution times
- Track retry rates and failure patterns
- Watch for memory leaks in timer management

### Configuration Tuning
- Adjust check intervals based on system load
- Tune concurrent execution limits for available resources
- Configure retry policies based on failure patterns
- Optimize timeouts for system responsiveness

### Troubleshooting
- Enable debug logging via `SCHEDULER_DEBUG=true`
- Check health check results for component status
- Review execution metrics for performance issues
- Monitor event logs for scheduling errors

This implementation provides a solid foundation for reliable, scalable background task scheduling with comprehensive error handling and monitoring capabilities.