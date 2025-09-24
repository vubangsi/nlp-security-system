class Zone {
  constructor(id, name, description = '', parentZoneId = null) {
    this.validateName(name);
    
    this.id = id;
    this.name = name;
    this.description = description;
    this.parentZoneId = parentZoneId;
    this.armed = false;
    this.mode = null; // 'away' or 'stay'
    this.childZones = new Set();
    this.createdAt = new Date();
    this.lastModified = new Date();
    this.modifiedBy = null;
  }

  validateName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Zone name is required and must be a string');
    }
    
    if (name.trim().length === 0) {
      throw new Error('Zone name cannot be empty');
    }
    
    if (name.length > 50) {
      throw new Error('Zone name cannot exceed 50 characters');
    }
    
    // Check for valid characters (alphanumeric, spaces, hyphens, underscores)
    const validNamePattern = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validNamePattern.test(name)) {
      throw new Error('Zone name can only contain letters, numbers, spaces, hyphens, and underscores');
    }
  }

  addChildZone(childZoneId) {
    if (!childZoneId) {
      throw new Error('Child zone ID is required');
    }
    
    if (childZoneId === this.id) {
      throw new Error('Zone cannot be its own child');
    }
    
    this.childZones.add(childZoneId);
  }

  removeChildZone(childZoneId) {
    this.childZones.delete(childZoneId);
  }

  hasChildZones() {
    return this.childZones.size > 0;
  }

  getChildZones() {
    return Array.from(this.childZones);
  }

  isRootZone() {
    return this.parentZoneId === null;
  }

  arm(mode, userId) {
    if (!['away', 'stay'].includes(mode)) {
      throw new Error('Invalid arm mode. Must be "away" or "stay"');
    }
    
    if (!userId) {
      throw new Error('User ID is required for arming');
    }
    
    this.armed = true;
    this.mode = mode;
    this.lastModified = new Date();
    this.modifiedBy = userId;
  }

  disarm(userId) {
    if (!userId) {
      throw new Error('User ID is required for disarming');
    }
    
    this.armed = false;
    this.mode = null;
    this.lastModified = new Date();
    this.modifiedBy = userId;
  }

  isArmed() {
    return this.armed;
  }

  updateName(newName, userId) {
    this.validateName(newName);
    
    if (!userId) {
      throw new Error('User ID is required for updates');
    }
    
    this.name = newName;
    this.lastModified = new Date();
    this.modifiedBy = userId;
  }

  updateDescription(newDescription, userId) {
    if (newDescription && typeof newDescription !== 'string') {
      throw new Error('Description must be a string');
    }
    
    if (newDescription && newDescription.length > 200) {
      throw new Error('Description cannot exceed 200 characters');
    }
    
    if (!userId) {
      throw new Error('User ID is required for updates');
    }
    
    this.description = newDescription || '';
    this.lastModified = new Date();
    this.modifiedBy = userId;
  }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      parentZoneId: this.parentZoneId,
      armed: this.armed,
      mode: this.mode,
      childZones: this.getChildZones(),
      createdAt: this.createdAt,
      lastModified: this.lastModified,
      modifiedBy: this.modifiedBy
    };
  }

  toJSON() {
    return this.getStatus();
  }
}

module.exports = Zone;