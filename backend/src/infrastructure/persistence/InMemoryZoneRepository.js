const ZoneRepository = require('../../domain/repositories/ZoneRepository');
const Zone = require('../../domain/entities/Zone');

class InMemoryZoneRepository extends ZoneRepository {
  constructor() {
    super();
    this.zones = new Map(); // Main storage indexed by ID
    this.nameIndex = new Map(); // Name to ID mapping for fast name lookups
    this.parentIndex = new Map(); // Parent ID to child IDs mapping
    this.rootZones = new Set(); // Root zone IDs for fast root zone queries
    this.nextId = 1;
    
    this.initializeDefaultZones();
  }

  initializeDefaultZones() {
    // Create default zones
    const defaultZones = [
      { name: 'Living Room', description: 'Main living area' },
      { name: 'Garage', description: 'Vehicle storage area' },
      { name: 'Bedroom', description: 'Primary sleeping area' }
    ];

    defaultZones.forEach(zoneData => {
      const zone = new Zone(
        this.generateId(),
        zoneData.name,
        zoneData.description,
        null // Root zones have no parent
      );
      
      this.zones.set(zone.id, zone);
      this.nameIndex.set(zone.name.toLowerCase(), zone.id);
      this.rootZones.add(zone.id);
      this.parentIndex.set(zone.id, new Set());
    });
  }

  generateId() {
    return `zone_${this.nextId++}`;
  }

  async save(zone) {
    try {
      if (!zone || !zone.id) {
        throw new Error('Invalid zone: Zone must have an ID');
      }

      // Validate zone name uniqueness
      const existingZone = this.zones.get(zone.id);
      const nameConflictId = this.nameIndex.get(zone.name.toLowerCase());
      
      if (nameConflictId && nameConflictId !== zone.id) {
        throw new Error(`Zone with name '${zone.name}' already exists`);
      }

      // Handle hierarchy changes
      if (existingZone) {
        this._updateHierarchyIndexes(existingZone, zone);
      } else {
        this._addToHierarchyIndexes(zone);
      }

      // Update main storage and name index
      this.zones.set(zone.id, zone);
      
      // Update name index if name changed
      if (existingZone && existingZone.name !== zone.name) {
        this.nameIndex.delete(existingZone.name.toLowerCase());
      }
      this.nameIndex.set(zone.name.toLowerCase(), zone.id);

      return zone;
    } catch (error) {
      throw new Error(`Failed to save zone: ${error.message}`);
    }
  }

  async findById(id) {
    if (!id) {
      return null;
    }
    return this.zones.get(id) || null;
  }

  async findByName(name) {
    if (!name || typeof name !== 'string') {
      return null;
    }
    const zoneId = this.nameIndex.get(name.toLowerCase());
    return zoneId ? this.zones.get(zoneId) : null;
  }

  async findAll() {
    return Array.from(this.zones.values());
  }

  async findRootZones() {
    return Array.from(this.rootZones).map(id => this.zones.get(id));
  }

  async findChildZones(parentZoneId) {
    if (!parentZoneId) {
      return [];
    }

    const childIds = this.parentIndex.get(parentZoneId);
    if (!childIds) {
      return [];
    }

    return Array.from(childIds).map(id => this.zones.get(id));
  }

  async findArmedZones() {
    return Array.from(this.zones.values()).filter(zone => zone.isArmed());
  }

  async findDisarmedZones() {
    return Array.from(this.zones.values()).filter(zone => !zone.isArmed());
  }

  async findZonesByMode(mode) {
    if (!mode) {
      return [];
    }
    return Array.from(this.zones.values()).filter(zone => zone.mode === mode);
  }

  async delete(id) {
    try {
      if (!id) {
        return false;
      }

      const zone = this.zones.get(id);
      if (!zone) {
        return false;
      }

      // Check if zone has children
      const hasChildren = await this.hasChildZones(id);
      if (hasChildren) {
        throw new Error('Cannot delete zone with child zones');
      }

      // Remove from parent's children if it has a parent
      if (zone.parentZoneId) {
        const parentChildren = this.parentIndex.get(zone.parentZoneId);
        if (parentChildren) {
          parentChildren.delete(id);
        }
      } else {
        // Remove from root zones if it's a root zone
        this.rootZones.delete(id);
      }

      // Remove from all indexes
      this.zones.delete(id);
      this.nameIndex.delete(zone.name.toLowerCase());
      this.parentIndex.delete(id);

      return true;
    } catch (error) {
      throw new Error(`Failed to delete zone: ${error.message}`);
    }
  }

  async exists(id) {
    if (!id) {
      return false;
    }
    return this.zones.has(id);
  }

  async nameExists(name, excludeId = null) {
    if (!name || typeof name !== 'string') {
      return false;
    }
    
    const existingId = this.nameIndex.get(name.toLowerCase());
    if (!existingId) {
      return false;
    }
    
    return excludeId ? existingId !== excludeId : true;
  }

  async hasChildZones(zoneId) {
    if (!zoneId) {
      return false;
    }
    
    const childIds = this.parentIndex.get(zoneId);
    return childIds ? childIds.size > 0 : false;
  }

  async getZoneHierarchy(rootZoneId) {
    try {
      if (!rootZoneId) {
        throw new Error('Root zone ID is required');
      }

      const rootZone = await this.findById(rootZoneId);
      if (!rootZone) {
        throw new Error(`Zone with ID '${rootZoneId}' not found`);
      }

      return await this._buildHierarchy(rootZone);
    } catch (error) {
      throw new Error(`Failed to get zone hierarchy: ${error.message}`);
    }
  }

  async validateZoneHierarchy(parentZoneId, childZoneId) {
    try {
      if (!parentZoneId || !childZoneId) {
        throw new Error('Both parent and child zone IDs are required');
      }

      if (parentZoneId === childZoneId) {
        throw new Error('Zone cannot be its own parent');
      }

      // Check if both zones exist
      const parentZone = await this.findById(parentZoneId);
      const childZone = await this.findById(childZoneId);

      if (!parentZone) {
        throw new Error(`Parent zone with ID '${parentZoneId}' not found`);
      }

      if (!childZone) {
        throw new Error(`Child zone with ID '${childZoneId}' not found`);
      }

      // Check for circular dependency
      const wouldCreateCircle = await this._wouldCreateCircularDependency(parentZoneId, childZoneId);
      if (wouldCreateCircle) {
        throw new Error('Adding this relationship would create a circular dependency');
      }

      return true;
    } catch (error) {
      throw new Error(`Zone hierarchy validation failed: ${error.message}`);
    }
  }

  async countZones() {
    return this.zones.size;
  }

  async findZonesModifiedAfter(timestamp) {
    if (!timestamp || !(timestamp instanceof Date)) {
      return [];
    }

    return Array.from(this.zones.values()).filter(zone => 
      zone.lastModified && zone.lastModified > timestamp
    );
  }

  async findZonesModifiedBy(userId) {
    if (!userId) {
      return [];
    }

    return Array.from(this.zones.values()).filter(zone => 
      zone.modifiedBy === userId
    );
  }

  // Private helper methods

  _updateHierarchyIndexes(oldZone, newZone) {
    // Handle parent changes
    if (oldZone.parentZoneId !== newZone.parentZoneId) {
      // Remove from old parent's children
      if (oldZone.parentZoneId) {
        const oldParentChildren = this.parentIndex.get(oldZone.parentZoneId);
        if (oldParentChildren) {
          oldParentChildren.delete(oldZone.id);
        }
      } else {
        this.rootZones.delete(oldZone.id);
      }

      // Add to new parent's children
      if (newZone.parentZoneId) {
        let newParentChildren = this.parentIndex.get(newZone.parentZoneId);
        if (!newParentChildren) {
          newParentChildren = new Set();
          this.parentIndex.set(newZone.parentZoneId, newParentChildren);
        }
        newParentChildren.add(newZone.id);
        this.rootZones.delete(newZone.id);
      } else {
        this.rootZones.add(newZone.id);
      }
    }
  }

  _addToHierarchyIndexes(zone) {
    // Add to parent's children or root zones
    if (zone.parentZoneId) {
      let parentChildren = this.parentIndex.get(zone.parentZoneId);
      if (!parentChildren) {
        parentChildren = new Set();
        this.parentIndex.set(zone.parentZoneId, parentChildren);
      }
      parentChildren.add(zone.id);
    } else {
      this.rootZones.add(zone.id);
    }

    // Initialize empty children set for this zone
    if (!this.parentIndex.has(zone.id)) {
      this.parentIndex.set(zone.id, new Set());
    }
  }

  async _buildHierarchy(zone) {
    const hierarchy = {
      zone: zone,
      children: []
    };

    const childZones = await this.findChildZones(zone.id);
    for (const childZone of childZones) {
      const childHierarchy = await this._buildHierarchy(childZone);
      hierarchy.children.push(childHierarchy);
    }

    return hierarchy;
  }

  async _wouldCreateCircularDependency(parentZoneId, childZoneId) {
    // Check if the proposed parent is actually a descendant of the proposed child
    const childZone = await this.findById(childZoneId);
    if (!childZone) {
      return false;
    }

    const visited = new Set();
    const stack = [childZoneId];

    while (stack.length > 0) {
      const currentZoneId = stack.pop();
      
      if (visited.has(currentZoneId)) {
        continue;
      }
      
      visited.add(currentZoneId);

      if (currentZoneId === parentZoneId) {
        return true; // Found circular dependency
      }

      // Add all children to the stack
      const childIds = this.parentIndex.get(currentZoneId);
      if (childIds) {
        stack.push(...Array.from(childIds));
      }
    }

    return false;
  }
}

module.exports = InMemoryZoneRepository;