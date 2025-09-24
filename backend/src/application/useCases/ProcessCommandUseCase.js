const CommandProcessedEvent = require('../../domain/events/CommandProcessedEvent');
const EventLog = require('../../domain/entities/EventLog');

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
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
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
}

module.exports = ProcessCommandUseCase;
