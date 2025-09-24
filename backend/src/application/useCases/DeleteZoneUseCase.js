const ZoneStateChanged = require('../../domain/events/ZoneStateChanged');
const EventLog = require('../../domain/entities/EventLog');

class DeleteZoneUseCase {
  constructor(zoneRepository, eventLogRepository, eventBus) {
    this.zoneRepository = zoneRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
  }

  async execute(zoneId, userId, handleChildren = 'block') {
    try {
      // Validate inputs
      if (!zoneId) {
        throw new Error('Zone ID is required');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!['block', 'delete', 'move'].includes(handleChildren)) {
        throw new Error('handleChildren must be "block", "delete", or "move"');
      }

      // Find the zone
      const zone = await this.zoneRepository.findById(zoneId);
      if (!zone) {
        throw new Error(`Zone with ID '${zoneId}' not found`);
      }

      // Check for child zones
      const childZones = await this.zoneRepository.findByParentId(zoneId);

      if (childZones.length > 0) {
        switch (handleChildren) {
          case 'block':
            throw new Error(`Cannot delete zone '${zone.name}' - it has ${childZones.length} child zones. Please handle child zones first.`);
          
          case 'delete':
            // Delete all child zones recursively
            await this.deleteChildZonesRecursively(zoneId, userId);
            break;
          
          case 'move':
            // Move child zones to parent of current zone
            await this.moveChildZonesToParent(zoneId, zone.parentZoneId, userId);
            break;
        }
      }

      // Store zone state for event
      const zoneState = zone.getStatus();

      // Remove zone from parent's children if it has a parent
      if (zone.parentZoneId) {
        const parentZone = await this.zoneRepository.findById(zone.parentZoneId);
        if (parentZone) {
          parentZone.removeChildZone(zoneId);
          await this.zoneRepository.save(parentZone);
        }
      }

      // Delete the zone
      await this.zoneRepository.delete(zoneId);

      // Create and save event log
      const eventLog = EventLog.createZoneDeletedEvent(zoneState, userId, handleChildren);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new ZoneStateChanged(
        zoneId,
        zoneState,
        null,
        userId,
        'deleted'
      );
      this.eventBus.publish(domainEvent);

      return {
        success: true,
        message: `Zone '${zone.name}' deleted successfully`,
        deletedZone: zoneState,
        childrenHandled: handleChildren,
        childZonesCount: childZones.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteChildZonesRecursively(parentZoneId, userId) {
    const childZones = await this.zoneRepository.findByParentId(parentZoneId);

    for (const childZone of childZones) {
      // Recursively delete grandchildren first
      await this.deleteChildZonesRecursively(childZone.id, userId);

      // Delete the child zone
      const childZoneState = childZone.getStatus();
      await this.zoneRepository.delete(childZone.id);

      // Create event log for child zone deletion
      const eventLog = EventLog.createZoneDeletedEvent(childZoneState, userId, 'cascade');
      await this.eventLogRepository.save(eventLog);

      // Publish domain event for child zone
      const domainEvent = new ZoneStateChanged(
        childZone.id,
        childZoneState,
        null,
        userId,
        'deleted'
      );
      this.eventBus.publish(domainEvent);
    }
  }

  async moveChildZonesToParent(currentZoneId, newParentZoneId, userId) {
    const childZones = await this.zoneRepository.findByParentId(currentZoneId);

    for (const childZone of childZones) {
      const previousState = childZone.getStatus();

      // Update child zone's parent
      childZone.parentZoneId = newParentZoneId;
      childZone.lastModified = new Date();
      childZone.modifiedBy = userId;
      await this.zoneRepository.save(childZone);

      // Add to new parent if it exists
      if (newParentZoneId) {
        const newParentZone = await this.zoneRepository.findById(newParentZoneId);
        if (newParentZone) {
          newParentZone.addChildZone(childZone.id);
          await this.zoneRepository.save(newParentZone);
        }
      }

      // Create event log for zone move
      const eventLog = EventLog.createZoneMovedEvent(childZone, currentZoneId, newParentZoneId, userId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new ZoneStateChanged(
        childZone.id,
        previousState,
        childZone.getStatus(),
        userId,
        'updated'
      );
      this.eventBus.publish(domainEvent);
    }
  }

  async executeBulkDelete(zoneIds, userId, handleChildren = 'block') {
    try {
      // Validate inputs
      if (!zoneIds || !Array.isArray(zoneIds) || zoneIds.length === 0) {
        throw new Error('Zone IDs array is required and cannot be empty');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      const results = [];
      const errors = [];

      // Sort zones by hierarchy level (deepest first) to avoid dependency issues
      const sortedZoneIds = await this.sortZonesByHierarchyLevel(zoneIds);

      // Process each zone
      for (const zoneId of sortedZoneIds) {
        try {
          const result = await this.execute(zoneId, userId, handleChildren);
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
        message: `Deleted ${results.length} of ${zoneIds.length} zones`,
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

  async sortZonesByHierarchyLevel(zoneIds) {
    const zoneHierarchyMap = new Map();

    // Calculate hierarchy level for each zone
    for (const zoneId of zoneIds) {
      const level = await this.calculateHierarchyLevel(zoneId);
      if (!zoneHierarchyMap.has(level)) {
        zoneHierarchyMap.set(level, []);
      }
      zoneHierarchyMap.get(level).push(zoneId);
    }

    // Sort by level (deepest first)
    const sortedZoneIds = [];
    const levels = Array.from(zoneHierarchyMap.keys()).sort((a, b) => b - a);
    
    for (const level of levels) {
      sortedZoneIds.push(...zoneHierarchyMap.get(level));
    }

    return sortedZoneIds;
  }

  async calculateHierarchyLevel(zoneId) {
    let level = 0;
    let currentZoneId = zoneId;

    while (currentZoneId) {
      const zone = await this.zoneRepository.findById(currentZoneId);
      if (!zone || !zone.parentZoneId) {
        break;
      }
      level++;
      currentZoneId = zone.parentZoneId;
    }

    return level;
  }
}

module.exports = DeleteZoneUseCase;