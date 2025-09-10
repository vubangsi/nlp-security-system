class DomainEvent {
  constructor(eventType, aggregateId, data = {}) {
    this.eventType = eventType;
    this.aggregateId = aggregateId;
    this.data = data;
    this.timestamp = new Date();
    this.eventId = Date.now().toString();
  }
}

module.exports = DomainEvent;
