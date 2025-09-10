const { v4: uuidv4 } = require('uuid');
const User = require('../../domain/entities/User');
const UserAddedEvent = require('../../domain/events/UserAddedEvent');
const EventLog = require('../../domain/entities/EventLog');

class AddUserUseCase {
  constructor(userRepository, eventLogRepository, eventBus) {
    this.userRepository = userRepository;
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
  }

  async execute(name, pin, requestingUserId) {
    try {
      // Validate inputs
      if (!name || !pin) {
        throw new Error('Name and PIN are required');
      }

      if (!/^\d{4,6}$/.test(pin)) {
        throw new Error('PIN must be 4-6 digits');
      }

      // Check if PIN already exists
      const existingUser = await this.userRepository.findByPin(pin);
      if (existingUser) {
        throw new Error('PIN already exists');
      }

      // Create new user
      const userId = uuidv4();
      const user = new User(userId, name, pin, 'user');
      
      // Save user
      await this.userRepository.save(user);

      // Create and save event log
      const eventLog = EventLog.createUserAddedEvent(user, requestingUserId);
      await this.eventLogRepository.save(eventLog);

      // Publish domain event
      const domainEvent = new UserAddedEvent(user.id, user.name, requestingUserId);
      this.eventBus.publish(domainEvent);

      return {
        success: true,
        message: `User ${name} added successfully`,
        user: user.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AddUserUseCase;
