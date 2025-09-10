const CommandProcessedEvent = require('../../domain/events/CommandProcessedEvent');
const EventLog = require('../../domain/entities/EventLog');

class ProcessCommandUseCase {
  constructor(
    nlpService,
    armSystemUseCase,
    disarmSystemUseCase,
    addUserUseCase,
    listUsersUseCase,
    getSystemStatusUseCase,
    eventLogRepository,
    eventBus
  ) {
    this.nlpService = nlpService;
    this.armSystemUseCase = armSystemUseCase;
    this.disarmSystemUseCase = disarmSystemUseCase;
    this.addUserUseCase = addUserUseCase;
    this.listUsersUseCase = listUsersUseCase;
    this.getSystemStatusUseCase = getSystemStatusUseCase;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
  }

  async execute(command, userId) {
    try {
      // Interpret the command using NLP
      const interpretation = await this.nlpService.interpretCommand(command);
      
      if (!interpretation.success) {
        throw new Error(interpretation.error || 'Could not understand command');
      }

      let result;
      const { intent, entities } = interpretation;

      // Execute the appropriate use case based on intent
      switch (intent) {
        case 'ARM_SYSTEM':
          const mode = entities.mode || 'away';
          result = await this.armSystemUseCase.execute(mode, userId);
          break;

        case 'DISARM_SYSTEM':
          result = await this.disarmSystemUseCase.execute(userId);
          break;

        case 'ADD_USER':
          if (!entities.name || !entities.pin) {
            throw new Error('User name and PIN are required for adding a user');
          }
          result = await this.addUserUseCase.execute(entities.name, entities.pin, userId);
          break;

        case 'LIST_USERS':
          result = await this.listUsersUseCase.execute(userId);
          break;

        case 'GET_STATUS':
          result = await this.getSystemStatusUseCase.execute();
          break;

        default:
          throw new Error(`Unknown intent: ${intent}`);
      }

      // Log the command processing
      const eventLog = EventLog.createCommandProcessedEvent(command, intent, userId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new CommandProcessedEvent(
        Date.now().toString(),
        command,
        intent,
        userId,
        result
      );
      this.eventBus.publish(domainEvent);

      return {
        success: true,
        command,
        intent,
        interpretation,
        result
      };
    } catch (error) {
      return {
        success: false,
        command,
        error: error.message
      };
    }
  }
}

module.exports = ProcessCommandUseCase;
