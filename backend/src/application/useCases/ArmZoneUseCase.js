const ZoneStateChanged = require('../../domain/events/ZoneStateChanged');
const EventLog = require('../../domain/entities/EventLog');

class ArmZoneUseCase {
  constructor(zoneRepository, eventLogRepository, eventBus) {
    this.zoneRepository = zoneRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
  }

  async execute(zoneId, mode, userId, includeChildZones = false) {
    try {
      // Validate inputs
      if (!zoneId) {
        throw new Error('Zone ID is required');
      }

      if (!mode || !['away', 'stay'].includes(mode)) {
        throw new Error('Invalid arm mode. Must be "away" or "stay"');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Find the zone
      const zone = await this.zoneRepository.findById(zoneId);
      if (!zone) {
        throw new Error(`Zone with ID '${zoneId}' not found`);
      }

      if (zone.isArmed()) {
        throw new Error(`Zone '${zone.name}' is already armed in ${zone.mode} mode`);
      }

      // Store previous state for event
      const previousState = zone.getStatus();

      // Arm the zone
      zone.arm(mode, userId);
      await this.zoneRepository.save(zone);

      const armedZones = [zone];

      // Arm child zones if requested
      if (includeChildZones && zone.hasChildZones()) {
        const childZoneIds = zone.getChildZones();
        for (const childZoneId of childZoneIds) {
          const childZone = await this.zoneRepository.findById(childZoneId);
          if (childZone && !childZone.isArmed()) {
            const childPreviousState = childZone.getStatus();
            childZone.arm(mode, userId);
            await this.zoneRepository.save(childZone);
            armedZones.push(childZone);

            // Publish event for child zone
            const childDomainEvent = new ZoneStateChanged(
              childZone.id,
              childPreviousState,
              childZone.getStatus(),
              userId,
              'armed'
            );
            this.eventBus.publish(childDomainEvent);

            // Create event log for child zone
            const childEventLog = EventLog.createZoneArmedEvent(childZone, mode, userId);
            await this.eventLogRepository.save(childEventLog);
          }
        }
      }

      // Create and save event log for main zone
      const eventLog = EventLog.createZoneArmedEvent(zone, mode, userId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event for main zone
      const domainEvent = new ZoneStateChanged(
        zone.id,
        previousState,
        zone.getStatus(),
        userId,
        'armed'
      );
      this.eventBus.publish(domainEvent);

      const message = includeChildZones && armedZones.length > 1
        ? `Zone '${zone.name}' and ${armedZones.length - 1} child zones armed in ${mode} mode`
        : `Zone '${zone.name}' armed in ${mode} mode`;

      return {
        success: true,
        message,
        zone: zone.toJSON(),
        armedZones: armedZones.map(z => z.toJSON())
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ArmZoneUseCase;