const { v4: uuidv4 } = require('uuid');
const Zone = require('../../domain/entities/Zone');
const ZoneStateChanged = require('../../domain/events/ZoneStateChanged');
const EventLog = require('../../domain/entities/EventLog');

class CreateZoneUseCase {
  constructor(zoneRepository, eventLogRepository, eventBus) {
    this.zoneRepository = zoneRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
  }

  async execute(name, description = '', parentZoneId = null, userId) {
    try {
      // Validate inputs
      if (!name) {
        throw new Error('Zone name is required');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Check if zone name already exists
      const existingZone = await this.zoneRepository.findByName(name);
      if (existingZone) {
        throw new Error(`Zone with name '${name}' already exists`);
      }

      // Validate parent zone exists if provided
      let parentZone = null;
      if (parentZoneId) {
        parentZone = await this.zoneRepository.findById(parentZoneId);
        if (!parentZone) {
          throw new Error(`Parent zone with ID '${parentZoneId}' not found`);
        }
      }

      // Create new zone
      const zoneId = uuidv4();
      const zone = new Zone(zoneId, name, description, parentZoneId);
      zone.modifiedBy = userId;
      
      // Save zone
      await this.zoneRepository.save(zone);

      // Update parent zone if specified
      if (parentZone) {
        parentZone.addChildZone(zoneId);
        await this.zoneRepository.save(parentZone);
      }

      // Create and save event log
      const eventLog = EventLog.createZoneCreatedEvent(zone, userId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new ZoneStateChanged(
        zone.id, 
        null, 
        zone.getStatus(), 
        userId, 
        'created'
      );
      this.eventBus.publish(domainEvent);

      return {
        success: true,
        message: `Zone '${name}' created successfully`,
        zone: zone.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = CreateZoneUseCase;