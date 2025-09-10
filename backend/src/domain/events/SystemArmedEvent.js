const DomainEvent = require('./DomainEvent');

class SystemArmedEvent extends DomainEvent {
  constructor(systemId, mode, userId) {
    super('SystemArmed', systemId, { mode, userId });
    this.mode = mode;
    this.userId = userId;
  }
}

module.exports = SystemArmedEvent;
