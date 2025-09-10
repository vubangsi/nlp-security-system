const DomainEvent = require('./DomainEvent');

class CommandProcessedEvent extends DomainEvent {
  constructor(commandId, command, intent, userId, result) {
    super('CommandProcessed', commandId, { command, intent, userId, result });
    this.command = command;
    this.intent = intent;
    this.userId = userId;
    this.result = result;
  }
}

module.exports = CommandProcessedEvent;
