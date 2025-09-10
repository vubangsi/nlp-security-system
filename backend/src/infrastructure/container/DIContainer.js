// Domain
const User = require('../../domain/entities/User');
const SystemState = require('../../domain/entities/SystemState');
const EventLog = require('../../domain/entities/EventLog');
const AuthenticationService = require('../../domain/services/AuthenticationService');

// Infrastructure
const InMemoryUserRepository = require('../persistence/InMemoryUserRepository');
const InMemorySystemStateRepository = require('../persistence/InMemorySystemStateRepository');
const InMemoryEventLogRepository = require('../persistence/InMemoryEventLogRepository');
const GroqNlpAdapter = require('../adapters/GroqNlpAdapter');
const FallbackNlpAdapter = require('../adapters/FallbackNlpAdapter');
const eventBus = require('../eventBus/EventBus');

// Application
const NlpService = require('../../application/services/NlpService');
const LoginUseCase = require('../../application/useCases/LoginUseCase');
const ArmSystemUseCase = require('../../application/useCases/ArmSystemUseCase');
const DisarmSystemUseCase = require('../../application/useCases/DisarmSystemUseCase');
const AddUserUseCase = require('../../application/useCases/AddUserUseCase');
const ListUsersUseCase = require('../../application/useCases/ListUsersUseCase');
const GetSystemStatusUseCase = require('../../application/useCases/GetSystemStatusUseCase');
const ProcessCommandUseCase = require('../../application/useCases/ProcessCommandUseCase');
const EventLogHandler = require('../../application/handlers/EventLogHandler');

// Controllers
const AuthController = require('../controllers/AuthController');
const CommandController = require('../controllers/CommandController');
const SystemController = require('../controllers/SystemController');
const UserController = require('../controllers/UserController');

class DIContainer {
  constructor() {
    this.dependencies = new Map();
    this.setupDependencies();
  }

  setupDependencies() {
    // Repositories
    this.register('userRepository', new InMemoryUserRepository());
    this.register('systemStateRepository', new InMemorySystemStateRepository());
    this.register('eventLogRepository', new InMemoryEventLogRepository());

    // Event Bus
    this.register('eventBus', eventBus);

    // Domain Services
    this.register('authService', new AuthenticationService(process.env.JWT_SECRET));

    // NLP Adapters
    const groqApiKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL || 'llama3-8b-8192';
    if (groqApiKey) {
      this.register('groqNlpAdapter', new GroqNlpAdapter(groqApiKey, groqModel));
    }
    this.register('fallbackNlpAdapter', new FallbackNlpAdapter());

    // Application Services
    const primaryAdapter = this.get('groqNlpAdapter') || this.get('fallbackNlpAdapter');
    this.register('nlpService', new NlpService(primaryAdapter, this.get('fallbackNlpAdapter')));

    // Use Cases
    this.register('loginUseCase', new LoginUseCase(
      this.get('userRepository'),
      this.get('authService')
    ));

    this.register('armSystemUseCase', new ArmSystemUseCase(
      this.get('systemStateRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('disarmSystemUseCase', new DisarmSystemUseCase(
      this.get('systemStateRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('addUserUseCase', new AddUserUseCase(
      this.get('userRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('listUsersUseCase', new ListUsersUseCase(
      this.get('userRepository')
    ));

    this.register('getSystemStatusUseCase', new GetSystemStatusUseCase(
      this.get('systemStateRepository')
    ));

    this.register('processCommandUseCase', new ProcessCommandUseCase(
      this.get('nlpService'),
      this.get('armSystemUseCase'),
      this.get('disarmSystemUseCase'),
      this.get('addUserUseCase'),
      this.get('listUsersUseCase'),
      this.get('getSystemStatusUseCase'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    // Controllers
    this.register('authController', new AuthController(this.get('loginUseCase')));
    this.register('commandController', new CommandController(this.get('processCommandUseCase')));
    this.register('systemController', new SystemController(
      this.get('systemStateRepository'),
      this.get('eventLogRepository')
    ));
    this.register('userController', new UserController(
      this.get('addUserUseCase'),
      this.get('listUsersUseCase')
    ));

    // Event Handlers
    this.register('eventLogHandler', new EventLogHandler(this.get('eventBus')));
  }

  register(name, dependency) {
    this.dependencies.set(name, dependency);
  }

  get(name) {
    return this.dependencies.get(name);
  }

  getControllers() {
    return {
      authController: this.get('authController'),
      commandController: this.get('commandController'),
      systemController: this.get('systemController'),
      userController: this.get('userController')
    };
  }
}

module.exports = DIContainer;
