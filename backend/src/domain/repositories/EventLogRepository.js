// Domain Repository Interface
class EventLogRepository {
  async save(eventLog) {
    throw new Error('Method not implemented');
  }

  async findAll() {
    throw new Error('Method not implemented');
  }

  async findRecent(limit) {
    throw new Error('Method not implemented');
  }

  async clear() {
    throw new Error('Method not implemented');
  }
}

module.exports = EventLogRepository;
