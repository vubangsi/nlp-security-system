class EventLog {
  constructor(id, eventType, details, userId = null, data = {}) {
    this.id = id;
    this.eventType = eventType;
    this.details = details;
    this.userId = userId;
    this.data = data;
    this.timestamp = new Date();
  }

  static createSystemArmedEvent(mode, userId) {
    return new EventLog(
      Date.now().toString(),
      'SYSTEM_ARMED',
      `System armed in ${mode} mode`,
      userId,
      { mode }
    );
  }

  static createSystemDisarmedEvent(userId) {
    return new EventLog(
      Date.now().toString(),
      'SYSTEM_DISARMED',
      'System disarmed',
      userId,
      {}
    );
  }

  static createUserAddedEvent(addedUser, requestingUserId) {
    return new EventLog(
      Date.now().toString(),
      'USER_ADDED',
      `User ${addedUser.name} added`,
      requestingUserId,
      { addedUserId: addedUser.id, addedUserName: addedUser.name }
    );
  }

  static createCommandProcessedEvent(command, intent, userId) {
    return new EventLog(
      Date.now().toString(),
      'COMMAND_PROCESSED',
      `Command processed: ${command}`,
      userId,
      { command, intent }
    );
  }

  static createZoneCreatedEvent(zone, userId) {
    return new EventLog(
      Date.now().toString(),
      'ZONE_CREATED',
      `Zone '${zone.name}' created`,
      userId,
      { 
        zoneId: zone.id, 
        zoneName: zone.name, 
        description: zone.description,
        parentZoneId: zone.parentZoneId 
      }
    );
  }

  static createZoneArmedEvent(zone, mode, userId) {
    return new EventLog(
      Date.now().toString(),
      'ZONE_ARMED',
      `Zone '${zone.name}' armed in ${mode} mode`,
      userId,
      { 
        zoneId: zone.id, 
        zoneName: zone.name, 
        mode,
        previousMode: zone.mode 
      }
    );
  }

  static createZoneDisarmedEvent(zone, userId) {
    return new EventLog(
      Date.now().toString(),
      'ZONE_DISARMED',
      `Zone '${zone.name}' disarmed`,
      userId,
      { 
        zoneId: zone.id, 
        zoneName: zone.name, 
        previousMode: zone.mode 
      }
    );
  }

  static createZoneUpdatedEvent(zone, updates, userId) {
    return new EventLog(
      Date.now().toString(),
      'ZONE_UPDATED',
      `Zone '${zone.name}' updated`,
      userId,
      { 
        zoneId: zone.id, 
        zoneName: zone.name, 
        updates 
      }
    );
  }

  static createZoneDeletedEvent(zoneState, userId, childrenHandled) {
    return new EventLog(
      Date.now().toString(),
      'ZONE_DELETED',
      `Zone '${zoneState.name}' deleted`,
      userId,
      { 
        zoneId: zoneState.id, 
        zoneName: zoneState.name, 
        childrenHandled,
        zoneState 
      }
    );
  }

  static createZoneMovedEvent(zone, oldParentZoneId, newParentZoneId, userId) {
    return new EventLog(
      Date.now().toString(),
      'ZONE_MOVED',
      `Zone '${zone.name}' moved to new parent`,
      userId,
      { 
        zoneId: zone.id, 
        zoneName: zone.name, 
        oldParentZoneId,
        newParentZoneId 
      }
    );
  }

  static createZoneParentChangedEvent(zone, oldParentZoneId, newParentZoneId, userId) {
    return new EventLog(
      Date.now().toString(),
      'ZONE_PARENT_CHANGED',
      `Zone '${zone.name}' parent changed`,
      userId,
      { 
        zoneId: zone.id, 
        zoneName: zone.name, 
        oldParentZoneId,
        newParentZoneId 
      }
    );
  }

  static createZoneHierarchyChangedEvent(zone, changeType, relatedZoneId, userId) {
    return new EventLog(
      Date.now().toString(),
      'ZONE_HIERARCHY_CHANGED',
      `Zone '${zone.name}' hierarchy changed: ${changeType}`,
      userId,
      { 
        zoneId: zone.id, 
        zoneName: zone.name, 
        changeType,
        relatedZoneId 
      }
    );
  }

  toJSON() {
    return {
      id: this.id,
      eventType: this.eventType,
      details: this.details,
      userId: this.userId,
      data: this.data,
      timestamp: this.timestamp
    };
  }
}

module.exports = EventLog;
