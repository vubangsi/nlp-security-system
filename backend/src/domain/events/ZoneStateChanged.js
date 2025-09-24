const DomainEvent = require('./DomainEvent');

class ZoneStateChanged extends DomainEvent {
  constructor(zoneId, previousState, newState, userId, changeType) {
    super('ZoneStateChanged', zoneId, { 
      previousState, 
      newState, 
      userId, 
      changeType 
    });
    
    this.zoneId = zoneId;
    this.previousState = previousState;
    this.newState = newState;
    this.userId = userId;
    this.changeType = changeType; // 'armed', 'disarmed', 'updated', 'created'
  }

  isArmingEvent() {
    return this.changeType === 'armed';
  }

  isDisarmingEvent() {
    return this.changeType === 'disarmed';
  }

  isUpdateEvent() {
    return this.changeType === 'updated';
  }

  isCreationEvent() {
    return this.changeType === 'created';
  }

  getZoneId() {
    return this.zoneId;
  }

  getUserId() {
    return this.userId;
  }

  getPreviousArmedState() {
    return this.previousState ? this.previousState.armed : false;
  }

  getNewArmedState() {
    return this.newState ? this.newState.armed : false;
  }

  getPreviousMode() {
    return this.previousState ? this.previousState.mode : null;
  }

  getNewMode() {
    return this.newState ? this.newState.mode : null;
  }
}

module.exports = ZoneStateChanged;