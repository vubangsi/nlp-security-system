const ZoneStateChanged = require('../../domain/events/ZoneStateChanged');
const EventLog = require('../../domain/entities/EventLog');

class UpdateZoneUseCase {
  constructor(zoneRepository, eventLogRepository, eventBus) {
    this.zoneRepository = zoneRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
  }

  async execute(zoneId, updates, userId) {
    try {
      // Validate inputs
      if (!zoneId) {
        throw new Error('Zone ID is required');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates object is required');
      }

      // Find the zone
      const zone = await this.zoneRepository.findById(zoneId);
      if (!zone) {
        throw new Error(`Zone with ID '${zoneId}' not found`);
      }

      // Store previous state for event
      const previousState = zone.getStatus();
      const allowedUpdates = ['name', 'description'];
      const actualUpdates = {};

      // Apply updates
      for (const [key, value] of Object.entries(updates)) {
        if (!allowedUpdates.includes(key)) {
          throw new Error(`Field '${key}' cannot be updated`);
        }

        actualUpdates[key] = value;

        switch (key) {
          case 'name':
            if (value !== zone.name) {
              // Check if new name already exists
              const existingZone = await this.zoneRepository.findByName(value);
              if (existingZone && existingZone.id !== zoneId) {
                throw new Error(`Zone with name '${value}' already exists`);
              }
              zone.updateName(value, userId);
            }
            break;
          case 'description':
            if (value !== zone.description) {
              zone.updateDescription(value, userId);
            }
            break;
        }
      }

      // Save updated zone
      await this.zoneRepository.save(zone);

      // Create and save event log
      const eventLog = EventLog.createZoneUpdatedEvent(zone, actualUpdates, userId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new ZoneStateChanged(
        zone.id,
        previousState,
        zone.getStatus(),
        userId,
        'updated'
      );
      this.eventBus.publish(domainEvent);

      return {
        success: true,
        message: `Zone '${zone.name}' updated successfully`,
        zone: zone.toJSON(),
        updates: actualUpdates
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeBulkUpdate(zoneIds, updates, userId) {
    try {
      // Validate inputs
      if (!zoneIds || !Array.isArray(zoneIds) || zoneIds.length === 0) {
        throw new Error('Zone IDs array is required and cannot be empty');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates object is required');
      }

      const results = [];
      const errors = [];

      // Process each zone
      for (const zoneId of zoneIds) {
        try {
          const result = await this.execute(zoneId, updates, userId);
          if (result.success) {
            results.push(result);
          } else {
            errors.push({ zoneId, error: result.error });
          }
        } catch (error) {
          errors.push({ zoneId, error: error.message });
        }
      }

      return {
        success: errors.length === 0,
        message: `Updated ${results.length} of ${zoneIds.length} zones`,
        results,
        errors,
        successCount: results.length,
        errorCount: errors.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeChangeParent(zoneId, newParentZoneId, userId) {
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

      // Validate new parent zone if provided
      let newParentZone = null;
      if (newParentZoneId) {
        newParentZone = await this.zoneRepository.findById(newParentZoneId);
        if (!newParentZone) {
          throw new Error(`Parent zone with ID '${newParentZoneId}' not found`);
        }

        // Prevent circular references
        if (await this.wouldCreateCircularReference(zoneId, newParentZoneId)) {
          throw new Error('Cannot set parent zone - would create circular reference');
        }
      }

      // Store previous state
      const previousState = zone.getStatus();
      const oldParentZoneId = zone.parentZoneId;

      // Remove from old parent if exists
      if (oldParentZoneId) {
        const oldParentZone = await this.zoneRepository.findById(oldParentZoneId);
        if (oldParentZone) {
          oldParentZone.removeChildZone(zoneId);
          await this.zoneRepository.save(oldParentZone);
        }
      }

      // Add to new parent if provided
      if (newParentZone) {
        newParentZone.addChildZone(zoneId);
        await this.zoneRepository.save(newParentZone);
      }

      // Update zone's parent reference
      zone.parentZoneId = newParentZoneId;
      zone.lastModified = new Date();
      zone.modifiedBy = userId;
      await this.zoneRepository.save(zone);

      // Create and save event log
      const eventLog = EventLog.createZoneParentChangedEvent(zone, oldParentZoneId, newParentZoneId, userId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new ZoneStateChanged(
        zone.id,
        previousState,
        zone.getStatus(),
        userId,
        'updated'
      );
      this.eventBus.publish(domainEvent);

      const message = newParentZoneId
        ? `Zone '${zone.name}' moved to parent '${newParentZone.name}'`
        : `Zone '${zone.name}' moved to root level`;

      return {
        success: true,
        message,
        zone: zone.toJSON(),
        oldParentZoneId,
        newParentZoneId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async wouldCreateCircularReference(zoneId, potentialParentId) {
    // Check if the potential parent is actually a descendant of the zone
    const descendants = await this.getAllDescendants(zoneId);
    return descendants.includes(potentialParentId);
  }

  async getAllDescendants(zoneId) {
    const descendants = [];
    const childZones = await this.zoneRepository.findByParentId(zoneId);

    for (const child of childZones) {
      descendants.push(child.id);
      const grandChildren = await this.getAllDescendants(child.id);
      descendants.push(...grandChildren);
    }

    return descendants;
  }
}

module.exports = UpdateZoneUseCase;