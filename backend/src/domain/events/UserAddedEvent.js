const DomainEvent = require('./DomainEvent');

class UserAddedEvent extends DomainEvent {
  constructor(userId, userName, requestingUserId) {
    super('UserAdded', userId, { userName, requestingUserId });
    this.userName = userName;
    this.requestingUserId = requestingUserId;
  }
}

module.exports = UserAddedEvent;
