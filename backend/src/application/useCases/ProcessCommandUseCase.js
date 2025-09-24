const CommandProcessedEvent = require('../../domain/events/CommandProcessedEvent');
const EventLog = require('../../domain/entities/EventLog');
const ScheduledTask = require('../../domain/entities/ScheduledTask');
const ScheduleParser = require('../../domain/services/ScheduleParser');
const DayOfWeek = require('../../domain/valueObjects/DayOfWeek');
const Time = require('../../domain/valueObjects/Time');
const ScheduleExpression = require('../../domain/valueObjects/ScheduleExpression');
const { v4: uuidv4 } = require('uuid');

class ProcessCommandUseCase {
  constructor(
    nlpService,
    armSystemUseCase,
    disarmSystemUseCase,
    addUserUseCase,
    listUsersUseCase,
    getSystemStatusUseCase,
    createZoneUseCase,
    armZoneUseCase,
    disarmZoneUseCase,
    listZonesUseCase,
    getZoneUseCase,
    updateZoneUseCase,
    deleteZoneUseCase,
    manageZoneHierarchyUseCase,
    scheduledTaskRepository,
    eventLogRepository,
    eventBus
  ) {
    this.nlpService = nlpService;
    this.armSystemUseCase = armSystemUseCase;
    this.disarmSystemUseCase = disarmSystemUseCase;
    this.addUserUseCase = addUserUseCase;
    this.listUsersUseCase = listUsersUseCase;
    this.getSystemStatusUseCase = getSystemStatusUseCase;
    this.createZoneUseCase = createZoneUseCase;
    this.armZoneUseCase = armZoneUseCase;
    this.disarmZoneUseCase = disarmZoneUseCase;
    this.listZonesUseCase = listZonesUseCase;
    this.getZoneUseCase = getZoneUseCase;
    this.updateZoneUseCase = updateZoneUseCase;
    this.deleteZoneUseCase = deleteZoneUseCase;
    this.manageZoneHierarchyUseCase = manageZoneHierarchyUseCase;
    this.scheduledTaskRepository = scheduledTaskRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
    this.scheduleParser = new ScheduleParser();
  }

  async execute(command, userId) {
    try {
      // Interpret the command using NLP
      const interpretation = await this.nlpService.interpretCommand(command);
      
      if (!interpretation.success) {
        throw new Error(interpretation.error || 'Could not understand command');
      }

      let result;
      const { intent, entities } = interpretation;

      // Execute the appropriate use case based on intent
      switch (intent) {
        case 'ARM_SYSTEM':
          const mode = entities.mode || 'away';
          result = await this.armSystemUseCase.execute(mode, userId);
          break;

        case 'DISARM_SYSTEM':
          result = await this.disarmSystemUseCase.execute(userId);
          break;

        case 'ADD_USER':
          if (!entities.name || !entities.pin) {
            throw new Error('User name and PIN are required for adding a user');
          }
          result = await this.addUserUseCase.execute(entities.name, entities.pin, userId);
          break;

        case 'LIST_USERS':
          result = await this.listUsersUseCase.execute(userId);
          break;

        case 'GET_STATUS':
          result = await this.getSystemStatusUseCase.execute();
          break;

        case 'CREATE_ZONE':
          if (!entities.name) {
            throw new Error('Zone name is required for creating a zone');
          }
          result = await this.createZoneUseCase.execute(
            entities.name,
            entities.description || '',
            entities.parentZoneId || null,
            userId
          );
          break;

        case 'ARM_ZONE':
          if (!entities.zoneId && !entities.zoneName) {
            throw new Error('Zone ID or zone name is required for arming a zone');
          }
          
          let zoneToArm = entities.zoneId;
          if (!zoneToArm && entities.zoneName) {
            const getZoneResult = await this.getZoneUseCase.executeByName(entities.zoneName, userId);
            if (!getZoneResult.success) {
              throw new Error(`Zone '${entities.zoneName}' not found`);
            }
            zoneToArm = getZoneResult.zone.id;
          }
          
          const armMode = entities.mode || 'away';
          const includeChildren = entities.includeChildren === true;
          result = await this.armZoneUseCase.execute(zoneToArm, armMode, userId, includeChildren);
          break;

        case 'DISARM_ZONE':
          if (!entities.zoneId && !entities.zoneName) {
            throw new Error('Zone ID or zone name is required for disarming a zone');
          }
          
          let zoneToDisarm = entities.zoneId;
          if (!zoneToDisarm && entities.zoneName) {
            const getZoneResult = await this.getZoneUseCase.executeByName(entities.zoneName, userId);
            if (!getZoneResult.success) {
              throw new Error(`Zone '${entities.zoneName}' not found`);
            }
            zoneToDisarm = getZoneResult.zone.id;
          }
          
          const includeChildrenDisarm = entities.includeChildren === true;
          result = await this.disarmZoneUseCase.execute(zoneToDisarm, userId, includeChildrenDisarm);
          break;

        case 'LIST_ZONES':
          const includeHierarchy = entities.includeHierarchy !== false;
          if (entities.parentZoneId || entities.filterType === 'parent') {
            result = await this.listZonesUseCase.executeByParent(entities.parentZoneId, userId);
          } else if (entities.filterType === 'armed') {
            result = await this.listZonesUseCase.executeArmedZones(userId);
          } else {
            result = await this.listZonesUseCase.execute(includeHierarchy, userId);
          }
          break;

        case 'GET_ZONE':
          if (!entities.zoneId && !entities.zoneName) {
            throw new Error('Zone ID or zone name is required for getting zone details');
          }
          
          const includeChildrenGet = entities.includeChildren === true;
          const includeHierarchyInfo = entities.includeHierarchy === true;

          if (entities.zoneId) {
            if (includeHierarchyInfo) {
              result = await this.getZoneUseCase.executeWithHierarchy(entities.zoneId, userId);
            } else {
              result = await this.getZoneUseCase.execute(entities.zoneId, includeChildrenGet, userId);
            }
          } else {
            result = await this.getZoneUseCase.executeByName(entities.zoneName, userId);
          }
          break;

        case 'UPDATE_ZONE':
          if (!entities.zoneId && !entities.zoneName) {
            throw new Error('Zone ID or zone name is required for updating a zone');
          }
          
          let zoneToUpdate = entities.zoneId;
          if (!zoneToUpdate && entities.zoneName) {
            const getZoneResult = await this.getZoneUseCase.executeByName(entities.zoneName, userId);
            if (!getZoneResult.success) {
              throw new Error(`Zone '${entities.zoneName}' not found`);
            }
            zoneToUpdate = getZoneResult.zone.id;
          }
          
          const updates = {};
          if (entities.newName) updates.name = entities.newName;
          if (entities.description !== undefined) updates.description = entities.description;
          
          if (Object.keys(updates).length === 0) {
            throw new Error('No valid updates provided. Specify name or description to update.');
          }
          
          result = await this.updateZoneUseCase.execute(zoneToUpdate, updates, userId);
          break;

        case 'DELETE_ZONE':
          if (!entities.zoneId && !entities.zoneName) {
            throw new Error('Zone ID or zone name is required for deleting a zone');
          }
          
          let zoneToDelete = entities.zoneId;
          if (!zoneToDelete && entities.zoneName) {
            const getZoneResult = await this.getZoneUseCase.executeByName(entities.zoneName, userId);
            if (!getZoneResult.success) {
              throw new Error(`Zone '${entities.zoneName}' not found`);
            }
            zoneToDelete = getZoneResult.zone.id;
          }
          
          const handleChildren = entities.handleChildren || 'block';
          result = await this.deleteZoneUseCase.execute(zoneToDelete, userId, handleChildren);
          break;

        case 'MANAGE_ZONE_HIERARCHY':
          if (!entities.action) {
            throw new Error('Action is required for managing zone hierarchy');
          }
          
          switch (entities.action) {
            case 'add_child':
              if (!entities.parentZoneId || !entities.childZoneId) {
                throw new Error('Parent zone ID and child zone ID are required');
              }
              result = await this.manageZoneHierarchyUseCase.addChildZone(
                entities.parentZoneId, entities.childZoneId, userId
              );
              break;
              
            case 'remove_child':
              if (!entities.parentZoneId || !entities.childZoneId) {
                throw new Error('Parent zone ID and child zone ID are required');
              }
              result = await this.manageZoneHierarchyUseCase.removeChildZone(
                entities.parentZoneId, entities.childZoneId, userId
              );
              break;
              
            case 'move_zone':
              if (!entities.zoneId) {
                throw new Error('Zone ID is required');
              }
              result = await this.manageZoneHierarchyUseCase.moveZoneToParent(
                entities.zoneId, entities.newParentZoneId || null, userId
              );
              break;
              
            case 'get_hierarchy':
              if (!entities.zoneId) {
                throw new Error('Zone ID is required');
              }
              result = await this.manageZoneHierarchyUseCase.getZoneHierarchy(
                entities.zoneId, 
                entities.includeAncestors !== false,
                entities.includeDescendants !== false
              );
              break;
              
            case 'validate_hierarchy':
              result = await this.manageZoneHierarchyUseCase.validateHierarchy();
              break;
              
            default:
              throw new Error(`Unknown hierarchy action: ${entities.action}`);
          }
          break;

        case 'SCHEDULE_ARM_SYSTEM':
          if (!entities.days || !entities.time) {
            throw new Error('Days and time are required for scheduling system arming');
          }
          result = await this._createScheduledTask(
            entities, 
            'ARM_SYSTEM', 
            { mode: entities.mode || 'away', zoneIds: entities.zoneIds || [] },
            userId
          );
          break;

        case 'SCHEDULE_DISARM_SYSTEM':
          if (!entities.days || !entities.time) {
            throw new Error('Days and time are required for scheduling system disarming');
          }
          result = await this._createScheduledTask(
            entities, 
            'DISARM_SYSTEM', 
            { zoneIds: entities.zoneIds || [] },
            userId
          );
          break;

        case 'LIST_SCHEDULES':
          result = await this._listScheduledTasks(entities, userId);
          break;

        case 'CANCEL_SCHEDULE':
          result = await this._cancelScheduledTasks(entities, userId);
          break;

        case 'UPDATE_SCHEDULE':
          result = await this._updateScheduledTask(entities, userId);
          break;

        default:
          throw new Error(`Unknown intent: ${intent}`);
      }

      // Log the command processing
      const eventLog = EventLog.createCommandProcessedEvent(command, intent, userId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new CommandProcessedEvent(
        Date.now().toString(),
        command,
        intent,
        userId,
        result
      );
      this.eventBus.publish(domainEvent);

      return {
        success: true,
        command,
        intent,
        interpretation,
        result
      };
    } catch (error) {
      return {
        success: false,
        command,
        error: error.message
      };
    }
  }

  // ===== SCHEDULE HELPER METHODS =====

  async _createScheduledTask(entities, actionType, actionParameters, userId) {
    try {
      // Convert NLP entities to domain objects
      const days = entities.days.map(dayString => new DayOfWeek(dayString));
      const [hour, minute] = entities.time.split(':').map(Number);
      const time = new Time(hour, minute);
      const scheduleExpression = new ScheduleExpression(days, time);

      // Create scheduled task entity
      const taskId = uuidv4();
      let scheduledTask;

      if (actionType === 'ARM_SYSTEM') {
        scheduledTask = ScheduledTask.createArmSystemTask(
          taskId, 
          userId, 
          scheduleExpression, 
          actionParameters.mode, 
          actionParameters.zoneIds
        );
      } else if (actionType === 'DISARM_SYSTEM') {
        scheduledTask = ScheduledTask.createDisarmSystemTask(
          taskId, 
          userId, 
          scheduleExpression, 
          actionParameters.zoneIds
        );
      } else {
        throw new Error(`Unsupported action type: ${actionType}`);
      }

      // Activate the task immediately
      scheduledTask.activate();

      // Save to repository
      const savedTask = await this.scheduledTaskRepository.save(scheduledTask);

      return {
        success: true,
        message: `Successfully scheduled ${actionType.toLowerCase().replace('_', ' ')} for ${entities.days.join(', ')} at ${entities.time}`,
        schedule: savedTask.toJSON(),
        scheduleId: savedTask.id,
        nextExecution: savedTask.nextExecutionTime
      };

    } catch (error) {
      throw new Error(`Failed to create scheduled task: ${error.message}`);
    }
  }

  async _listScheduledTasks(entities, userId) {
    try {
      let tasks;

      // Apply filters based on entities
      if (entities.filterType === 'active') {
        tasks = await this.scheduledTaskRepository.findByUserIdAndStatus(userId, ScheduledTask.STATUS.ACTIVE);
      } else if (entities.filterType === 'inactive') {
        const cancelled = await this.scheduledTaskRepository.findByUserIdAndStatus(userId, ScheduledTask.STATUS.CANCELLED);
        const completed = await this.scheduledTaskRepository.findByUserIdAndStatus(userId, ScheduledTask.STATUS.COMPLETED);
        const failed = await this.scheduledTaskRepository.findByUserIdAndStatus(userId, ScheduledTask.STATUS.FAILED);
        tasks = [...cancelled, ...completed, ...failed];
      } else if (entities.filterType === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        
        const allUserTasks = await this.scheduledTaskRepository.findByUserId(userId);
        tasks = allUserTasks.filter(task => 
          task.nextExecutionTime && 
          task.nextExecutionTime >= startOfDay && 
          task.nextExecutionTime <= endOfDay
        );
      } else if (entities.filterType === 'week') {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start of current week
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        const allUserTasks = await this.scheduledTaskRepository.findByUserId(userId);
        tasks = allUserTasks.filter(task => 
          task.nextExecutionTime && 
          task.nextExecutionTime >= startOfWeek && 
          task.nextExecutionTime <= endOfWeek
        );
      } else {
        // No filter - get all user tasks
        tasks = await this.scheduledTaskRepository.findByUserId(userId);
      }

      // Apply schedule type filter
      if (entities.scheduleType === 'arm') {
        tasks = tasks.filter(task => task.actionType === ScheduledTask.ACTION_TYPE.ARM_SYSTEM);
      } else if (entities.scheduleType === 'disarm') {
        tasks = tasks.filter(task => task.actionType === ScheduledTask.ACTION_TYPE.DISARM_SYSTEM);
      }

      const scheduleSummaries = tasks.map(task => ({
        id: task.id,
        description: task.getDescription(),
        actionType: task.actionType,
        status: task.status,
        nextExecution: task.nextExecutionTime,
        executionStats: task.getExecutionStats(),
        createdAt: task.createdAt
      }));

      return {
        success: true,
        message: `Found ${tasks.length} schedule${tasks.length !== 1 ? 's' : ''}`,
        schedules: scheduleSummaries,
        count: tasks.length
      };

    } catch (error) {
      throw new Error(`Failed to list scheduled tasks: ${error.message}`);
    }
  }

  async _cancelScheduledTasks(entities, userId) {
    try {
      let tasksToCancel = [];

      if (entities.deleteAll) {
        // Cancel all schedules for the user
        tasksToCancel = await this.scheduledTaskRepository.findByUserId(userId);
        tasksToCancel = tasksToCancel.filter(task => 
          task.status === ScheduledTask.STATUS.ACTIVE || task.status === ScheduledTask.STATUS.PENDING
        );
      } else if (entities.days && entities.days.length > 0) {
        // Cancel schedules for specific days
        const allUserTasks = await this.scheduledTaskRepository.findByUserId(userId);
        const activeTasks = allUserTasks.filter(task => 
          task.status === ScheduledTask.STATUS.ACTIVE || task.status === ScheduledTask.STATUS.PENDING
        );

        tasksToCancel = activeTasks.filter(task => {
          const taskDays = task.scheduleExpression.days.map(day => day.value);
          return entities.days.some(requestedDay => taskDays.includes(requestedDay));
        });
      } else if (entities.scheduleId) {
        // Cancel specific schedule
        const task = await this.scheduledTaskRepository.findById(entities.scheduleId);
        if (task && task.userId === userId) {
          tasksToCancel = [task];
        }
      } else {
        throw new Error('Please specify which schedules to cancel: specific days, schedule ID, or "all schedules"');
      }

      // Apply schedule type filter
      if (entities.scheduleType === 'arm') {
        tasksToCancel = tasksToCancel.filter(task => task.actionType === ScheduledTask.ACTION_TYPE.ARM_SYSTEM);
      } else if (entities.scheduleType === 'disarm') {
        tasksToCancel = tasksToCancel.filter(task => task.actionType === ScheduledTask.ACTION_TYPE.DISARM_SYSTEM);
      }

      if (tasksToCancel.length === 0) {
        return {
          success: true,
          message: 'No matching schedules found to cancel',
          cancelledCount: 0
        };
      }

      // Cancel the tasks
      const cancelledTasks = [];
      for (const task of tasksToCancel) {
        task.cancel('Cancelled via voice command');
        const savedTask = await this.scheduledTaskRepository.save(task);
        cancelledTasks.push(savedTask);
      }

      return {
        success: true,
        message: `Successfully cancelled ${cancelledTasks.length} schedule${cancelledTasks.length !== 1 ? 's' : ''}`,
        cancelledCount: cancelledTasks.length,
        cancelledSchedules: cancelledTasks.map(task => ({
          id: task.id,
          description: task.getDescription(),
          status: task.status
        }))
      };

    } catch (error) {
      throw new Error(`Failed to cancel scheduled tasks: ${error.message}`);
    }
  }

  async _updateScheduledTask(entities, userId) {
    try {
      let tasksToUpdate = [];

      // Find tasks to update based on entities
      if (entities.scheduleId) {
        // Update specific schedule
        const task = await this.scheduledTaskRepository.findById(entities.scheduleId);
        if (task && task.userId === userId) {
          tasksToUpdate = [task];
        }
      } else if (entities.days && entities.days.length > 0) {
        // Update schedules for specific days
        const allUserTasks = await this.scheduledTaskRepository.findByUserId(userId);
        const activeTasks = allUserTasks.filter(task => 
          task.status === ScheduledTask.STATUS.ACTIVE || task.status === ScheduledTask.STATUS.PENDING
        );

        tasksToUpdate = activeTasks.filter(task => {
          const taskDays = task.scheduleExpression.days.map(day => day.value);
          return entities.days.some(requestedDay => taskDays.includes(requestedDay));
        });
      } else {
        throw new Error('Please specify which schedule to update by day or schedule ID');
      }

      if (tasksToUpdate.length === 0) {
        return {
          success: true,
          message: 'No matching schedules found to update',
          updatedCount: 0
        };
      }

      const updatedTasks = [];
      for (const task of tasksToUpdate) {
        let hasUpdates = false;

        // Update time if provided
        if (entities.newTime) {
          const [hour, minute] = entities.newTime.split(':').map(Number);
          const newTime = new Time(hour, minute);
          const newScheduleExpression = new ScheduleExpression(task.scheduleExpression.days, newTime);
          task.updateSchedule(newScheduleExpression);
          hasUpdates = true;
        }

        // Update action parameters if provided
        if (entities.newMode || entities.newAction) {
          const currentParams = { ...task.actionParameters };
          
          if (entities.newMode) {
            currentParams.mode = entities.newMode;
          }
          
          // If changing action type, we need to recreate the task
          if (entities.newAction && entities.newAction !== task.actionType.replace('_SYSTEM', '')) {
            throw new Error('Changing action type (ARM/DISARM) requires cancelling the old schedule and creating a new one');
          }
          
          if (entities.newMode) {
            task.updateActionParameters(currentParams);
            hasUpdates = true;
          }
        }

        if (hasUpdates) {
          const savedTask = await this.scheduledTaskRepository.save(task);
          updatedTasks.push(savedTask);
        }
      }

      return {
        success: true,
        message: `Successfully updated ${updatedTasks.length} schedule${updatedTasks.length !== 1 ? 's' : ''}`,
        updatedCount: updatedTasks.length,
        updatedSchedules: updatedTasks.map(task => ({
          id: task.id,
          description: task.getDescription(),
          nextExecution: task.nextExecutionTime,
          status: task.status
        }))
      };

    } catch (error) {
      throw new Error(`Failed to update scheduled task: ${error.message}`);
    }
  }
}

module.exports = ProcessCommandUseCase;
