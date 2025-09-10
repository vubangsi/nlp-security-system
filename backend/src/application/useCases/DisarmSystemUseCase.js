const SystemDisarmedEvent = require('../../domain/events/SystemDisarmedEvent');
const EventLog = require('../../domain/entities/EventLog');

class DisarmSystemUseCase {
  constructor(systemStateRepository, eventLogRepository, eventBus) {
    this.systemStateRepository = systemStateRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
  }

  async execute(userId) {
    try {
      const systemState = await this.systemStateRepository.get();
      
      if (!systemState.isArmed()) {
        throw new Error('System is already disarmed');
      }

      // Disarm the system
      systemState.disarm(userId);
      await this.systemStateRepository.save(systemState);

      // Create and save event log
      const eventLog = EventLog.createSystemDisarmedEvent(userId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new SystemDisarmedEvent('system', userId);
      this.eventBus.publish(domainEvent);

      return {
        success: true,
        message: 'System disarmed',
        systemState: systemState.getStatus()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DisarmSystemUseCase;
