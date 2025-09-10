const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Increase limit for multiple handlers
  }

  publish(event) {
    console.log(`Publishing event: ${event.eventType}`, {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      timestamp: event.timestamp
    });
    
    this.emit(event.eventType, event);
    this.emit('*', event); // Wildcard for logging all events
  }

  subscribe(eventType, handler) {
    this.on(eventType, handler);
    console.log(`Subscribed to event: ${eventType}`);
  }

  subscribeToAll(handler) {
    this.on('*', handler);
    console.log('Subscribed to all events');
  }

  unsubscribe(eventType, handler) {
    this.off(eventType, handler);
  }
}

// Singleton instance
const eventBus = new EventBus();

module.exports = eventBus;
