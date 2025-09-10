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
