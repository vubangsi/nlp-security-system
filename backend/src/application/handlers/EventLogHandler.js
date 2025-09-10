class EventLogHandler {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Log all domain events
    this.eventBus.subscribeToAll((event) => {
      console.log(`[EVENT] ${event.eventType}:`, {
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        timestamp: event.timestamp,
        data: event.data
      });
    });

    // Specific event handlers can be added here
    this.eventBus.subscribe('SystemArmed', this.handleSystemArmed.bind(this));
    this.eventBus.subscribe('SystemDisarmed', this.handleSystemDisarmed.bind(this));
    this.eventBus.subscribe('UserAdded', this.handleUserAdded.bind(this));
    this.eventBus.subscribe('CommandProcessed', this.handleCommandProcessed.bind(this));
  }

  handleSystemArmed(event) {
    console.log(`System armed in ${event.mode} mode by user ${event.userId}`);
  }

  handleSystemDisarmed(event) {
    console.log(`System disarmed by user ${event.userId}`);
  }

  handleUserAdded(event) {
    console.log(`User ${event.userName} added by user ${event.requestingUserId}`);
  }

  handleCommandProcessed(event) {
    console.log(`Command processed: "${event.command}" -> ${event.intent}`);
  }
}

module.exports = EventLogHandler;
