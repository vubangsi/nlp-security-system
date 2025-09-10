const SystemStateRepository = require('../../domain/repositories/SystemStateRepository');
const SystemState = require('../../domain/entities/SystemState');

class InMemorySystemStateRepository extends SystemStateRepository {
  constructor() {
    super();
    this.systemState = new SystemState();
  }

  async get() {
    return this.systemState;
  }

  async save(systemState) {
    this.systemState = systemState;
    return systemState;
  }
}

module.exports = InMemorySystemStateRepository;
