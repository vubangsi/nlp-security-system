const SystemArmedEvent = require('../../domain/events/SystemArmedEvent');
const EventLog = require('../../domain/entities/EventLog');

class ArmSystemUseCase {
  constructor(systemStateRepository, eventLogRepository, eventBus) {
    this.systemStateRepository = systemStateRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
  }

  async execute(mode, userId) {
    try {
      const systemState = await this.systemStateRepository.get();
      
      if (systemState.isArmed()) {
        throw new Error('System is already armed');
      }

      // Validate mode
      if (!['away', 'stay'].includes(mode)) {
        throw new Error('Invalid arm mode. Must be "away" or "stay"');
      }

      // Arm the system
      systemState.arm(mode, userId);
      await this.systemStateRepository.save(systemState);

      // Create and save event log
      const eventLog = EventLog.createSystemArmedEvent(mode, userId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new SystemArmedEvent('system', mode, userId);
      this.eventBus.publish(domainEvent);

      return {
        success: true,
        message: `System armed in ${mode} mode`,
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

module.exports = ArmSystemUseCase;
