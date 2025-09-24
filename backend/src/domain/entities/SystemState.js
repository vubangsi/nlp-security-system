class SystemState {
  constructor() {
    this.armed = false;
    this.mode = null; // 'away' or 'stay'
    this.zones = new Map(); // zoneId -> zone status
    this.lastModified = new Date();
    this.modifiedBy = null;
  }

  arm(mode, userId) {
    if (!['away', 'stay'].includes(mode)) {
      throw new Error('Invalid arm mode. Must be "away" or "stay"');
    }
    
    this.armed = true;
    this.mode = mode;
    this.lastModified = new Date();
    this.modifiedBy = userId;
  }

  disarm(userId) {
    this.armed = false;
    this.mode = null;
    this.lastModified = new Date();
    this.modifiedBy = userId;
  }

  isArmed() {
    return this.armed;
  }

  addZone(zoneId, zoneStatus) {
    if (!zoneId) {
      throw new Error('Zone ID is required');
    }
    
    if (!zoneStatus) {
      throw new Error('Zone status is required');
    }
    
    this.zones.set(zoneId, {
      id: zoneStatus.id,
      name: zoneStatus.name,
      armed: zoneStatus.armed,
      mode: zoneStatus.mode,
      parentZoneId: zoneStatus.parentZoneId,
      lastModified: zoneStatus.lastModified
    });
  }

  removeZone(zoneId) {
    return this.zones.delete(zoneId);
  }

  updateZoneStatus(zoneId, zoneStatus) {
    if (!this.zones.has(zoneId)) {
      throw new Error(`Zone ${zoneId} not found in system state`);
    }
    
    this.zones.set(zoneId, {
      id: zoneStatus.id,
      name: zoneStatus.name,
      armed: zoneStatus.armed,
      mode: zoneStatus.mode,
      parentZoneId: zoneStatus.parentZoneId,
      lastModified: zoneStatus.lastModified
    });
  }

  getZoneStatus(zoneId) {
    return this.zones.get(zoneId);
  }

  getAllZones() {
    return Array.from(this.zones.values());
  }

  getArmedZones() {
    return Array.from(this.zones.values()).filter(zone => zone.armed);
  }

  getDisarmedZones() {
    return Array.from(this.zones.values()).filter(zone => !zone.armed);
  }

  getZonesByMode(mode) {
    return Array.from(this.zones.values()).filter(zone => zone.mode === mode);
  }

  hasArmedZones() {
    return Array.from(this.zones.values()).some(zone => zone.armed);
  }

  hasZones() {
    return this.zones.size > 0;
  }

  isZoneBasedSystem() {
    return this.hasZones();
  }

  armAllZones(mode, userId) {
    if (!['away', 'stay'].includes(mode)) {
      throw new Error('Invalid arm mode. Must be "away" or "stay"');
    }
    
    for (const [zoneId, zone] of this.zones) {
      zone.armed = true;
      zone.mode = mode;
      zone.lastModified = new Date();
    }
    
    this.armed = true;
    this.mode = mode;
    this.lastModified = new Date();
    this.modifiedBy = userId;
  }

  disarmAllZones(userId) {
    for (const [zoneId, zone] of this.zones) {
      zone.armed = false;
      zone.mode = null;
      zone.lastModified = new Date();
    }
    
    this.armed = false;
    this.mode = null;
    this.lastModified = new Date();
    this.modifiedBy = userId;
  }

  getStatus() {
    return {
      armed: this.armed,
      mode: this.mode,
      zones: this.getAllZones(),
      armedZoneCount: this.getArmedZones().length,
      totalZoneCount: this.zones.size,
      lastModified: this.lastModified,
      modifiedBy: this.modifiedBy
    };
  }
}

module.exports = SystemState;
