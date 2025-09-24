class ListZonesUseCase {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  async execute(includeHierarchy = true, userId = null) {
    try {
      // Get all zones
      const zones = await this.zoneRepository.findAll();
      
      if (!includeHierarchy) {
        return {
          success: true,
          zones: zones.map(zone => zone.toJSON()),
          count: zones.length
        };
      }

      // Build hierarchical structure
      const hierarchicalZones = this.buildHierarchy(zones);

      return {
        success: true,
        zones: hierarchicalZones,
        count: zones.length,
        rootZones: hierarchicalZones.filter(zone => zone.parentZoneId === null).length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  buildHierarchy(zones) {
    // Convert zones to JSON format
    const zoneData = zones.map(zone => zone.toJSON());
    
    // Create a map for quick lookup
    const zoneMap = new Map();
    zoneData.forEach(zone => {
      zone.children = [];
      zoneMap.set(zone.id, zone);
    });

    // Build parent-child relationships
    const rootZones = [];
    zoneData.forEach(zone => {
      if (zone.parentZoneId === null) {
        rootZones.push(zone);
      } else {
        const parent = zoneMap.get(zone.parentZoneId);
        if (parent) {
          parent.children.push(zone);
        } else {
          // Parent not found, treat as root zone
          rootZones.push(zone);
        }
      }
    });

    // Sort zones by name at each level
    this.sortZonesRecursively(rootZones);

    return rootZones;
  }

  sortZonesRecursively(zones) {
    zones.sort((a, b) => a.name.localeCompare(b.name));
    zones.forEach(zone => {
      if (zone.children && zone.children.length > 0) {
        this.sortZonesRecursively(zone.children);
      }
    });
  }

  async executeByParent(parentZoneId, userId = null) {
    try {
      let zones;
      
      if (parentZoneId === null || parentZoneId === 'root') {
        // Get root zones (zones with no parent)
        zones = await this.zoneRepository.findByParentId(null);
      } else {
        // Validate parent zone exists
        const parentZone = await this.zoneRepository.findById(parentZoneId);
        if (!parentZone) {
          throw new Error(`Parent zone with ID '${parentZoneId}' not found`);
        }

        // Get child zones
        zones = await this.zoneRepository.findByParentId(parentZoneId);
      }

      return {
        success: true,
        zones: zones.map(zone => zone.toJSON()),
        count: zones.length,
        parentZoneId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeArmedZones(userId = null) {
    try {
      // Get all zones and filter armed ones
      const allZones = await this.zoneRepository.findAll();
      const armedZones = allZones.filter(zone => zone.isArmed());

      return {
        success: true,
        zones: armedZones.map(zone => zone.toJSON()),
        count: armedZones.length,
        totalZones: allZones.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ListZonesUseCase;