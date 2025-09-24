const ZoneStateChanged = require('../../domain/events/ZoneStateChanged');
const EventLog = require('../../domain/entities/EventLog');

class ManageZoneHierarchyUseCase {
  constructor(zoneRepository, eventLogRepository, eventBus) {
    this.zoneRepository = zoneRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
  }

  async addChildZone(parentZoneId, childZoneId, userId) {
    try {
      // Validate inputs
      if (!parentZoneId) {
        throw new Error('Parent zone ID is required');
      }

      if (!childZoneId) {
        throw new Error('Child zone ID is required');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      if (parentZoneId === childZoneId) {
        throw new Error('Zone cannot be its own child');
      }

      // Find both zones
      const parentZone = await this.zoneRepository.findById(parentZoneId);
      if (!parentZone) {
        throw new Error(`Parent zone with ID '${parentZoneId}' not found`);
      }

      const childZone = await this.zoneRepository.findById(childZoneId);
      if (!childZone) {
        throw new Error(`Child zone with ID '${childZoneId}' not found`);
      }

      // Check if child already has a parent
      if (childZone.parentZoneId) {
        throw new Error(`Zone '${childZone.name}' already has a parent zone`);
      }

      // Check for circular references
      if (await this.wouldCreateCircularReference(childZoneId, parentZoneId)) {
        throw new Error('Cannot add child zone - would create circular reference');
      }

      // Store previous states
      const parentPreviousState = parentZone.getStatus();
      const childPreviousState = childZone.getStatus();

      // Update relationships
      parentZone.addChildZone(childZoneId);
      parentZone.lastModified = new Date();
      parentZone.modifiedBy = userId;

      childZone.parentZoneId = parentZoneId;
      childZone.lastModified = new Date();
      childZone.modifiedBy = userId;

      // Save both zones
      await this.zoneRepository.save(parentZone);
      await this.zoneRepository.save(childZone);

      // Create event logs
      const parentEventLog = EventLog.createZoneHierarchyChangedEvent(
        parentZone, 'child_added', childZoneId, userId
      );
      const childEventLog = EventLog.createZoneHierarchyChangedEvent(
        childZone, 'parent_assigned', parentZoneId, userId
      );

      await this.eventLogRepository.save(parentEventLog);
      await this.eventLogRepository.save(childEventLog);

      // Publish domain events
      const parentDomainEvent = new ZoneStateChanged(
        parentZone.id,
        parentPreviousState,
        parentZone.getStatus(),
        userId,
        'updated'
      );

      const childDomainEvent = new ZoneStateChanged(
        childZone.id,
        childPreviousState,
        childZone.getStatus(),
        userId,
        'updated'
      );

      this.eventBus.publish(parentDomainEvent);
      this.eventBus.publish(childDomainEvent);

      return {
        success: true,
        message: `Zone '${childZone.name}' added as child of '${parentZone.name}'`,
        parentZone: parentZone.toJSON(),
        childZone: childZone.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async removeChildZone(parentZoneId, childZoneId, userId) {
    try {
      // Validate inputs
      if (!parentZoneId) {
        throw new Error('Parent zone ID is required');
      }

      if (!childZoneId) {
        throw new Error('Child zone ID is required');
      }

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Find both zones
      const parentZone = await this.zoneRepository.findById(parentZoneId);
      if (!parentZone) {
        throw new Error(`Parent zone with ID '${parentZoneId}' not found`);
      }

      const childZone = await this.zoneRepository.findById(childZoneId);
      if (!childZone) {
        throw new Error(`Child zone with ID '${childZoneId}' not found`);
      }

      // Verify parent-child relationship exists
      if (childZone.parentZoneId !== parentZoneId) {
        throw new Error(`Zone '${childZone.name}' is not a child of '${parentZone.name}'`);
      }

      // Store previous states
      const parentPreviousState = parentZone.getStatus();
      const childPreviousState = childZone.getStatus();

      // Remove relationships
      parentZone.removeChildZone(childZoneId);
      parentZone.lastModified = new Date();
      parentZone.modifiedBy = userId;

      childZone.parentZoneId = null;
      childZone.lastModified = new Date();
      childZone.modifiedBy = userId;

      // Save both zones
      await this.zoneRepository.save(parentZone);
      await this.zoneRepository.save(childZone);

      // Create event logs
      const parentEventLog = EventLog.createZoneHierarchyChangedEvent(
        parentZone, 'child_removed', childZoneId, userId
      );
      const childEventLog = EventLog.createZoneHierarchyChangedEvent(
        childZone, 'parent_removed', parentZoneId, userId
      );

      await this.eventLogRepository.save(parentEventLog);
      await this.eventLogRepository.save(childEventLog);

      // Publish domain events
      const parentDomainEvent = new ZoneStateChanged(
        parentZone.id,
        parentPreviousState,
        parentZone.getStatus(),
        userId,
        'updated'
      );

      const childDomainEvent = new ZoneStateChanged(
        childZone.id,
        childPreviousState,
        childZone.getStatus(),
        userId,
        'updated'
      );

      this.eventBus.publish(parentDomainEvent);
      this.eventBus.publish(childDomainEvent);

      return {
        success: true,
        message: `Zone '${childZone.name}' removed from parent '${parentZone.name}'`,
        parentZone: parentZone.toJSON(),
        childZone: childZone.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async moveZoneToParent(zoneId, newParentZoneId, userId) {
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

      const oldParentZoneId = zone.parentZoneId;

      // If moving to the same parent, no action needed
      if (oldParentZoneId === newParentZoneId) {
        return {
          success: true,
          message: `Zone '${zone.name}' is already in the specified parent`,
          zone: zone.toJSON()
        };
      }

      // Remove from old parent if exists
      if (oldParentZoneId) {
        await this.removeChildZone(oldParentZoneId, zoneId, userId);
      }

      // Add to new parent if specified
      if (newParentZoneId) {
        return await this.addChildZone(newParentZoneId, zoneId, userId);
      } else {
        // Moving to root level
        return {
          success: true,
          message: `Zone '${zone.name}' moved to root level`,
          zone: zone.toJSON()
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getZoneHierarchy(zoneId, includeAncestors = true, includeDescendants = true) {
    try {
      // Validate input
      if (!zoneId) {
        throw new Error('Zone ID is required');
      }

      // Find the zone
      const zone = await this.zoneRepository.findById(zoneId);
      if (!zone) {
        throw new Error(`Zone with ID '${zoneId}' not found`);
      }

      const hierarchy = {
        zone: zone.toJSON(),
        ancestors: [],
        descendants: []
      };

      // Get ancestors if requested
      if (includeAncestors) {
        hierarchy.ancestors = await this.getAncestors(zone);
      }

      // Get descendants if requested
      if (includeDescendants) {
        hierarchy.descendants = await this.getDescendants(zone);
      }

      // Calculate hierarchy statistics
      hierarchy.stats = {
        level: hierarchy.ancestors.length,
        totalDescendants: this.countDescendants(hierarchy.descendants),
        directChildren: hierarchy.descendants.length,
        isRoot: zone.isRootZone(),
        hasChildren: zone.hasChildZones()
      };

      return {
        success: true,
        hierarchy
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validateHierarchy() {
    try {
      const allZones = await this.zoneRepository.findAll();
      const issues = [];

      for (const zone of allZones) {
        // Check for orphaned child references
        for (const childZoneId of zone.getChildZones()) {
          const childZone = await this.zoneRepository.findById(childZoneId);
          if (!childZone) {
            issues.push({
              type: 'orphaned_child_reference',
              zoneId: zone.id,
              zoneName: zone.name,
              orphanedChildId: childZoneId
            });
          } else if (childZone.parentZoneId !== zone.id) {
            issues.push({
              type: 'inconsistent_parent_child_relationship',
              zoneId: zone.id,
              zoneName: zone.name,
              childZoneId: childZone.id,
              childZoneName: childZone.name
            });
          }
        }

        // Check for invalid parent references
        if (zone.parentZoneId) {
          const parentZone = await this.zoneRepository.findById(zone.parentZoneId);
          if (!parentZone) {
            issues.push({
              type: 'invalid_parent_reference',
              zoneId: zone.id,
              zoneName: zone.name,
              invalidParentId: zone.parentZoneId
            });
          } else if (!parentZone.getChildZones().includes(zone.id)) {
            issues.push({
              type: 'missing_child_reference',
              zoneId: zone.id,
              zoneName: zone.name,
              parentZoneId: parentZone.id,
              parentZoneName: parentZone.name
            });
          }
        }

        // Check for circular references
        if (await this.hasCircularReference(zone.id)) {
          issues.push({
            type: 'circular_reference',
            zoneId: zone.id,
            zoneName: zone.name
          });
        }
      }

      return {
        success: true,
        isValid: issues.length === 0,
        issues,
        totalZones: allZones.length,
        issueCount: issues.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async wouldCreateCircularReference(zoneId, potentialParentId) {
    const descendants = await this.getAllDescendantIds(zoneId);
    return descendants.includes(potentialParentId);
  }

  async hasCircularReference(zoneId) {
    const visited = new Set();
    let currentZoneId = zoneId;

    while (currentZoneId) {
      if (visited.has(currentZoneId)) {
        return true; // Circular reference detected
      }
      visited.add(currentZoneId);

      const zone = await this.zoneRepository.findById(currentZoneId);
      if (!zone) break;

      currentZoneId = zone.parentZoneId;
    }

    return false;
  }

  async getAncestors(zone) {
    const ancestors = [];
    let currentZone = zone;

    while (currentZone.parentZoneId) {
      const parentZone = await this.zoneRepository.findById(currentZone.parentZoneId);
      if (!parentZone) break;

      ancestors.unshift(parentZone.toJSON());
      currentZone = parentZone;
    }

    return ancestors;
  }

  async getDescendants(zone) {
    const descendants = [];
    const childZones = await this.zoneRepository.findByParentId(zone.id);

    for (const child of childZones) {
      const childData = child.toJSON();
      childData.children = await this.getDescendants(child);
      descendants.push(childData);
    }

    return descendants;
  }

  async getAllDescendantIds(zoneId) {
    const descendants = [];
    const childZones = await this.zoneRepository.findByParentId(zoneId);

    for (const child of childZones) {
      descendants.push(child.id);
      const grandChildren = await this.getAllDescendantIds(child.id);
      descendants.push(...grandChildren);
    }

    return descendants;
  }

  countDescendants(descendants) {
    let count = descendants.length;
    for (const descendant of descendants) {
      if (descendant.children) {
        count += this.countDescendants(descendant.children);
      }
    }
    return count;
  }
}

module.exports = ManageZoneHierarchyUseCase;