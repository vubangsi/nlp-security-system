const DomainEvent = require('./DomainEvent');

class SystemDisarmedEvent extends DomainEvent {
  constructor(systemId, userId) {
    super('SystemDisarmed', systemId, { userId });
    this.userId = userId;
  }
}

module.exports = SystemDisarmedEvent;
