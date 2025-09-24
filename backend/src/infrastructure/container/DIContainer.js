// Domain
const User = require('../../domain/entities/User');
const SystemState = require('../../domain/entities/SystemState');
const EventLog = require('../../domain/entities/EventLog');
const AuthenticationService = require('../../domain/services/AuthenticationService');

// Infrastructure
const InMemoryUserRepository = require('../persistence/InMemoryUserRepository');
const InMemorySystemStateRepository = require('../persistence/InMemorySystemStateRepository');
const InMemoryEventLogRepository = require('../persistence/InMemoryEventLogRepository');
const InMemoryZoneRepository = require('../persistence/InMemoryZoneRepository');
const InMemoryScheduledTaskRepository = require('../persistence/InMemoryScheduledTaskRepository');
const GroqNlpAdapter = require('../adapters/GroqNlpAdapter');
const FallbackNlpAdapter = require('../adapters/FallbackNlpAdapter');
const eventBus = require('../eventBus/EventBus');

// Scheduler Infrastructure
const SchedulingEngine = require('../services/SchedulingEngine');
const TaskExecutor = require('../services/TaskExecutor');
const SchedulerBootstrap = require('../bootstrap/SchedulerBootstrap');
const SchedulerConfig = require('../config/SchedulerConfig');

// Application
const NlpService = require('../../application/services/NlpService');
const LoginUseCase = require('../../application/useCases/LoginUseCase');
const ArmSystemUseCase = require('../../application/useCases/ArmSystemUseCase');
const DisarmSystemUseCase = require('../../application/useCases/DisarmSystemUseCase');
const AddUserUseCase = require('../../application/useCases/AddUserUseCase');
const ListUsersUseCase = require('../../application/useCases/ListUsersUseCase');
const GetSystemStatusUseCase = require('../../application/useCases/GetSystemStatusUseCase');
const CreateZoneUseCase = require('../../application/useCases/CreateZoneUseCase');
const ArmZoneUseCase = require('../../application/useCases/ArmZoneUseCase');
const DisarmZoneUseCase = require('../../application/useCases/DisarmZoneUseCase');
const ListZonesUseCase = require('../../application/useCases/ListZonesUseCase');
const GetZoneUseCase = require('../../application/useCases/GetZoneUseCase');
const UpdateZoneUseCase = require('../../application/useCases/UpdateZoneUseCase');
const DeleteZoneUseCase = require('../../application/useCases/DeleteZoneUseCase');
const ManageZoneHierarchyUseCase = require('../../application/useCases/ManageZoneHierarchyUseCase');
const ProcessCommandUseCase = require('../../application/useCases/ProcessCommandUseCase');
const CreateScheduledTaskUseCase = require('../../application/useCases/CreateScheduledTaskUseCase');
const UpdateScheduledTaskUseCase = require('../../application/useCases/UpdateScheduledTaskUseCase');
const CancelScheduledTaskUseCase = require('../../application/useCases/CancelScheduledTaskUseCase');
const ListScheduledTasksUseCase = require('../../application/useCases/ListScheduledTasksUseCase');
const ExecuteScheduledTaskUseCase = require('../../application/useCases/ExecuteScheduledTaskUseCase');
const EventLogHandler = require('../../application/handlers/EventLogHandler');

// Controllers
const AuthController = require('../controllers/AuthController');
const CommandController = require('../controllers/CommandController');
const SystemController = require('../controllers/SystemController');
const UserController = require('../controllers/UserController');
const ZoneController = require('../controllers/ZoneController');

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
    this.register('zoneRepository', new InMemoryZoneRepository());
    this.register('scheduledTaskRepository', new InMemoryScheduledTaskRepository());

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

    // Zone Use Cases
    this.register('createZoneUseCase', new CreateZoneUseCase(
      this.get('zoneRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('armZoneUseCase', new ArmZoneUseCase(
      this.get('zoneRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('disarmZoneUseCase', new DisarmZoneUseCase(
      this.get('zoneRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('listZonesUseCase', new ListZonesUseCase(
      this.get('zoneRepository')
    ));

    this.register('getZoneUseCase', new GetZoneUseCase(
      this.get('zoneRepository')
    ));

    this.register('updateZoneUseCase', new UpdateZoneUseCase(
      this.get('zoneRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('deleteZoneUseCase', new DeleteZoneUseCase(
      this.get('zoneRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('manageZoneHierarchyUseCase', new ManageZoneHierarchyUseCase(
      this.get('zoneRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    // Scheduled Task Use Cases
    this.register('createScheduledTaskUseCase', new CreateScheduledTaskUseCase(
      this.get('scheduledTaskRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('updateScheduledTaskUseCase', new UpdateScheduledTaskUseCase(
      this.get('scheduledTaskRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('cancelScheduledTaskUseCase', new CancelScheduledTaskUseCase(
      this.get('scheduledTaskRepository'),
      this.get('eventLogRepository'),
      this.get('eventBus')
    ));

    this.register('listScheduledTasksUseCase', new ListScheduledTasksUseCase(
      this.get('scheduledTaskRepository')
    ));

    this.register('executeScheduledTaskUseCase', new ExecuteScheduledTaskUseCase(
      this.get('scheduledTaskRepository'),
      this.get('armSystemUseCase'),
      this.get('disarmSystemUseCase'),
      this.get('eventLogRepository'),
      this.get('eventBus'),
      this.get('systemStateRepository')
    ));

    // Scheduler Infrastructure Services
    this.register('schedulerConfig', SchedulerConfig);

    this.register('taskExecutor', new TaskExecutor(
      this.get('executeScheduledTaskUseCase'),
      SchedulerConfig.getTaskExecutorConfig()
    ));

    this.register('schedulingEngine', new SchedulingEngine(
      this.get('scheduledTaskRepository'),
      this.get('executeScheduledTaskUseCase'),
      this.get('taskExecutor'),
      SchedulerConfig.getSchedulingEngineConfig()
    ));

    this.register('schedulerBootstrap', new SchedulerBootstrap(
      this.get('schedulingEngine'),
      this.get('taskExecutor'),
      this.get('scheduledTaskRepository'),
      this.get('eventBus'),
      SchedulerConfig.getBootstrapConfig()
    ));

    this.register('processCommandUseCase', new ProcessCommandUseCase(
      this.get('nlpService'),
      this.get('armSystemUseCase'),
      this.get('disarmSystemUseCase'),
      this.get('addUserUseCase'),
      this.get('listUsersUseCase'),
      this.get('getSystemStatusUseCase'),
      this.get('createZoneUseCase'),
      this.get('armZoneUseCase'),
      this.get('disarmZoneUseCase'),
      this.get('listZonesUseCase'),
      this.get('getZoneUseCase'),
      this.get('updateZoneUseCase'),
      this.get('deleteZoneUseCase'),
      this.get('manageZoneHierarchyUseCase'),
      this.get('scheduledTaskRepository'),
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
    this.register('zoneController', new ZoneController(
      this.get('createZoneUseCase'),
      this.get('getZoneUseCase'),
      this.get('updateZoneUseCase'),
      this.get('deleteZoneUseCase'),
      this.get('listZonesUseCase'),
      this.get('armZoneUseCase'),
      this.get('disarmZoneUseCase'),
      this.get('manageZoneHierarchyUseCase')
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
      userController: this.get('userController'),
      zoneController: this.get('zoneController')
    };
  }

  getSchedulerComponents() {
    return {
      schedulerConfig: this.get('schedulerConfig'),
      schedulerBootstrap: this.get('schedulerBootstrap'),
      schedulingEngine: this.get('schedulingEngine'),
      taskExecutor: this.get('taskExecutor'),
      scheduledTaskRepository: this.get('scheduledTaskRepository'),
      createScheduledTaskUseCase: this.get('createScheduledTaskUseCase'),
      updateScheduledTaskUseCase: this.get('updateScheduledTaskUseCase'),
      cancelScheduledTaskUseCase: this.get('cancelScheduledTaskUseCase'),
      listScheduledTasksUseCase: this.get('listScheduledTasksUseCase'),
      executeScheduledTaskUseCase: this.get('executeScheduledTaskUseCase')
    };
  }
}

module.exports = DIContainer;
