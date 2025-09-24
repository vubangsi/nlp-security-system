class GetZoneUseCase {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  async execute(zoneId, includeChildren = false, userId = null) {
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

      const result = {
        success: true,
        zone: zone.toJSON()
      };

      // Include children if requested
      if (includeChildren) {
        const childZones = await this.zoneRepository.findByParentId(zoneId);
        result.zone.children = childZones.map(child => child.toJSON());
        result.zone.childrenCount = childZones.length;
      }

      // Include parent information if zone has a parent
      if (zone.parentZoneId) {
        const parentZone = await this.zoneRepository.findById(zone.parentZoneId);
        if (parentZone) {
          result.zone.parent = {
            id: parentZone.id,
            name: parentZone.name,
            armed: parentZone.isArmed(),
            mode: parentZone.mode
          };
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeByName(zoneName, userId = null) {
    try {
      // Validate input
      if (!zoneName) {
        throw new Error('Zone name is required');
      }

      // Find the zone by name
      const zone = await this.zoneRepository.findByName(zoneName);
      if (!zone) {
        throw new Error(`Zone with name '${zoneName}' not found`);
      }

      return {
        success: true,
        zone: zone.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeWithHierarchy(zoneId, userId = null) {
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

      const result = {
        success: true,
        zone: zone.toJSON()
      };

      // Get full hierarchy path (ancestors)
      result.zone.ancestors = await this.getAncestors(zone);

      // Get all descendants
      result.zone.descendants = await this.getDescendants(zone);

      // Calculate hierarchy stats
      result.zone.hierarchyStats = {
        level: result.zone.ancestors.length,
        totalDescendants: this.countDescendants(result.zone.descendants),
        armedDescendants: this.countArmedDescendants(result.zone.descendants)
      };

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAncestors(zone) {
    const ancestors = [];
    let currentZone = zone;

    while (currentZone.parentZoneId) {
      const parentZone = await this.zoneRepository.findById(currentZone.parentZoneId);
      if (!parentZone) break;

      ancestors.unshift({
        id: parentZone.id,
        name: parentZone.name,
        armed: parentZone.isArmed(),
        mode: parentZone.mode
      });

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

  countDescendants(descendants) {
    let count = descendants.length;
    for (const descendant of descendants) {
      if (descendant.children) {
        count += this.countDescendants(descendant.children);
      }
    }
    return count;
  }

  countArmedDescendants(descendants) {
    let count = 0;
    for (const descendant of descendants) {
      if (descendant.armed) {
        count++;
      }
      if (descendant.children) {
        count += this.countArmedDescendants(descendant.children);
      }
    }
    return count;
  }
}

module.exports = GetZoneUseCase;