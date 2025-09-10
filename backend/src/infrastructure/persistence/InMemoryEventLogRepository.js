const EventLogRepository = require('../../domain/repositories/EventLogRepository');

class InMemoryEventLogRepository extends EventLogRepository {
  constructor() {
    super();
    this.eventLogs = [];
  }

  async save(eventLog) {
    this.eventLogs.unshift(eventLog); // Add to beginning for newest first
    
    // Keep only last 100 events
    if (this.eventLogs.length > 100) {
      this.eventLogs = this.eventLogs.slice(0, 100);
    }
    
    return eventLog;
  }

  async findAll() {
    return [...this.eventLogs]; // Return copy
  }

  async findRecent(limit = 50) {
    return this.eventLogs.slice(0, limit);
  }

  async clear() {
    this.eventLogs = [];
    return true;
  }
}

module.exports = InMemoryEventLogRepository;
