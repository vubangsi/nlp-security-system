const ZoneStateChanged = require('../../domain/events/ZoneStateChanged');
const EventLog = require('../../domain/entities/EventLog');

class DisarmZoneUseCase {
  constructor(zoneRepository, eventLogRepository, eventBus) {
    this.zoneRepository = zoneRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
  }

  async execute(zoneId, userId, includeChildZones = false) {
    try {
      // Validate inputs
      if (!zoneId) {
        throw new Error('Zone ID is required');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Find the zone
      const zone = await this.zoneRepository.findById(zoneId);
      if (!zone) {
        throw new Error(`Zone with ID '${zoneId}' not found`);
      }

      if (!zone.isArmed()) {
        throw new Error(`Zone '${zone.name}' is already disarmed`);
      }

      // Store previous state for event
      const previousState = zone.getStatus();

      // Disarm the zone
      zone.disarm(userId);
      await this.zoneRepository.save(zone);

      const disarmedZones = [zone];

      // Disarm child zones if requested
      if (includeChildZones && zone.hasChildZones()) {
        const childZoneIds = zone.getChildZones();
        for (const childZoneId of childZoneIds) {
          const childZone = await this.zoneRepository.findById(childZoneId);
          if (childZone && childZone.isArmed()) {
            const childPreviousState = childZone.getStatus();
            childZone.disarm(userId);
            await this.zoneRepository.save(childZone);
            disarmedZones.push(childZone);

            // Publish event for child zone
            const childDomainEvent = new ZoneStateChanged(
              childZone.id,
              childPreviousState,
              childZone.getStatus(),
              userId,
              'disarmed'
            );
            this.eventBus.publish(childDomainEvent);

            // Create event log for child zone
            const childEventLog = EventLog.createZoneDisarmedEvent(childZone, userId);
            await this.eventLogRepository.save(childEventLog);
          }
        }
      }

      // Create and save event log for main zone
      const eventLog = EventLog.createZoneDisarmedEvent(zone, userId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event for main zone
      const domainEvent = new ZoneStateChanged(
        zone.id,
        previousState,
        zone.getStatus(),
        userId,
        'disarmed'
      );
      this.eventBus.publish(domainEvent);

      const message = includeChildZones && disarmedZones.length > 1
        ? `Zone '${zone.name}' and ${disarmedZones.length - 1} child zones disarmed`
        : `Zone '${zone.name}' disarmed`;

      return {
        success: true,
        message,
        zone: zone.toJSON(),
        disarmedZones: disarmedZones.map(z => z.toJSON())
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DisarmZoneUseCase;