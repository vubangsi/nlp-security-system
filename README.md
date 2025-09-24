# 🛡️ Natural Language Security Control System

[▶ Watch Demo Video](./mercel_rec.mp4)

A comprehensive, enterprise-grade security control application built with Domain-Driven Design (DDD) and Event-Driven Architecture. Features advanced natural language command processing powered by Groq AI, complete zone management, automated scheduling, and real-time monitoring capabilities.

## ✨ Core Features

### 🔐 **Natural Language Processing**
- **AI-Powered Commands**: Control your security system using plain English
- **Groq API Integration**: Advanced NLP with multiple model support (LLaMA, Mixtral, GPT)
- **Intelligent Fallback**: Robust pattern-matching when AI is unavailable
- **Context Understanding**: Recognizes intent, entities, and command variations
- **Multi-language Support**: Extensible for international deployments

### 🏠 **Zone Management System**
- **Hierarchical Zones**: Create parent-child zone relationships
- **Individual Control**: Arm/disarm specific zones independently
- **Zone Status Monitoring**: Real-time status for each security zone
- **Bulk Operations**: Manage multiple zones simultaneously
- **Zone Permissions**: Role-based access control per zone

### ⏰ **Advanced Scheduling System**
- **Natural Language Scheduling**: "Arm system every weekday at 6 PM"
- **Flexible Time Expressions**: Support for various time formats
- **Recurring Tasks**: Daily, weekly, monthly, and custom patterns
- **Schedule Management**: Create, update, cancel, and monitor schedules
- **Automated Execution**: Reliable task execution with retry mechanisms
- **Schedule Dashboard**: Visual interface for managing all schedules

### 🎯 **Modern User Interface**
- **Glassmorphism Design**: Beautiful, modern UI with transparency effects
- **Real-time Updates**: Automatic UI refresh after command execution
- **Two-Column Layout**: Efficient command input and result display
- **Visual Feedback**: Loading indicators and status animations
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Dark/Light Themes**: Adaptive design for user preference

### 🔒 **Enterprise Security**
- **JWT Authentication**: Secure token-based authentication system
- **Role-based Access Control**: Admin and user roles with granular permissions
- **Rate Limiting**: Advanced protection against abuse and attacks
- **Input Sanitization**: Comprehensive XSS and injection protection
- **CSRF Protection**: Cross-site request forgery prevention
- **Audit Logging**: Complete trail of all system interactions
- **Session Management**: Secure session handling and timeout

### 📊 **Monitoring & Analytics**
- **Real-time Dashboard**: Live system status and metrics
- **Event Logging**: Comprehensive audit trail with timestamps
- **System Health**: Monitor application performance and status
- **User Activity**: Track user actions and command history
- **Error Tracking**: Detailed error logging and reporting
- **Performance Metrics**: Response times and system utilization

## 🚀 Quick Start

### 🐳 Docker (Recommended)

**Prerequisites:**
- Docker and Docker Compose installed
- 4GB+ RAM available
- Ports 3000 and 3001 available

**One-command startup:**
```bash
# Clone the repository
git clone https://github.com/vubangsi/nlp-security-system.git
cd nlp-security-system

# Start all services
docker-compose up --build
```

**Or use the startup script:**
```bash
chmod +x start.sh
./start.sh
```

**Access the application:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Default Admin PIN**: `0000`
- **Health Check**: http://localhost:3001/health

### 📦 Manual Installation

**Prerequisites:**
- Node.js 18+ (LTS recommended)
- npm 8+ or yarn 1.22+
- Git
- Groq API key (optional, fallback NLP available)

**Setup:**
1. **Clone and setup**:
   ```bash
   git clone https://github.com/vubangsi/nlp-security-system.git
   cd nlp-security-system
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (see Configuration section)
   ```

3. **Install and start backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

4. **Install and start frontend** (in new terminal):
   ```bash
   cd frontend
   npm install
   npm start
   ```

5. **Access the application**:
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:3001/api
   - **API Documentation**: http://localhost:3001/api-docs

## 🧪 Testing

### Comprehensive Test Suite
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run full test suite with coverage
./scripts/run-tests.sh

# Run core functionality tests
./scripts/test-core-functionality.sh
```

### Backend Testing
```bash
cd backend

# Unit tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# Integration tests
npm run test:integration

# Security tests
npm run test:security
```

### Frontend Testing
```bash
cd frontend

# Unit tests
npm test

# Coverage report
npm test -- --coverage

# E2E tests
npm run test:e2e

# Component tests
npm run test:components
```

### Docker Testing
```bash
# Run tests in Docker environment
docker-compose --profile test up --build

# Test with production-like setup
docker-compose up -d --build
./scripts/test-core-functionality.sh
docker-compose down
```

### Test Coverage
- **Backend**: 85%+ coverage across all modules
- **Frontend**: 80%+ coverage for components and services
- **Integration**: Full API endpoint testing
- **E2E**: Critical user journey testing

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GROQ_API_KEY` | Groq API key for NLP processing | - | No* |
| `GROQ_MODEL` | Groq model to use | `llama3-8b-8192` | No |
| `ADMIN_PIN` | Admin user PIN | `0000` | Yes |
| `JWT_SECRET` | JWT signing secret | auto-generated | No |
| `PORT` | Backend server port | `3001` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `RATE_LIMIT_WINDOW` | Rate limiting window (ms) | `900000` | No |
| `RATE_LIMIT_MAX` | Max requests per window | `100` | No |
| `SESSION_TIMEOUT` | JWT session timeout | `1h` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `ENABLE_CORS` | Enable CORS | `true` | No |
| `SCHEDULER_ENABLED` | Enable task scheduler | `true` | No |

*Fallback NLP adapter is used if Groq API key is not provided

### Available AI Models

**Groq Models (Recommended):**
- `llama3-8b-8192` (default, fast and efficient)
- `llama3-70b-8192` (more capable, slower)
- `mixtral-8x7b-32768` (good balance of speed/capability)
- `gemma-7b-it` (Google's Gemma model)

**OpenAI Compatible:**
- `openai/gpt-4o-mini` (OpenAI GPT-4 mini)
- `openai/gpt-3.5-turbo` (OpenAI GPT-3.5)
- `openai/gpt-oss-20b` (Open source alternative)

### Model Configuration

```bash
# Show available models and current configuration
./scripts/change-model.sh

# Change to a specific model
./scripts/change-model.sh llama3-70b-8192

# Use OpenAI models (requires OpenAI API key)
export OPENAI_API_KEY="your-openai-key"
./scripts/change-model.sh openai/gpt-4o-mini

# Restart services to apply changes
docker-compose restart backend
```

## 📖 Usage Guide

### 🔐 Authentication
- **Admin PIN**: `0000` (configurable via `ADMIN_PIN` environment variable)
- **User Roles**: Admin (full access) and User (limited access)
- **Session Management**: Automatic logout after inactivity
- **Multi-device**: Same user can login from multiple devices

### 🗣️ Natural Language Commands

**System Control:**
```
"arm the system"              → Arms in default mode
"arm system in away mode"     → Arms in away mode
"arm in home mode"            → Arms in home mode
"disarm the system"           → Disarms the system
"sesame open"                 → Disarms (alternative phrase)
"sesame close"                → Arms (alternative phrase)
"lock down"                   → Emergency arm mode
"unlock"                      → Quick disarm
"secure the building"         → Arms all zones
"status" / "system status"    → Get current status
```

**Zone Management:**
```
"arm zone kitchen"            → Arms specific zone
"disarm zone living room"     → Disarms specific zone
"list all zones"              → Shows all zones
"create zone bedroom"         → Creates new zone
"delete zone garage"          → Removes zone
"show zone status"            → Zone status overview
```

**User Management (Admin only):**
```
"add user John with pin 1234" → Creates new user
"add user Sarah pin 5678"     → Alternative syntax
"list all users"              → Shows all users
"remove user John"            → Deletes user
"change user John pin 9999"   → Updates user PIN
```

**Scheduling:**
```
"arm system every day at 6 PM"           → Daily schedule
"disarm every weekday at 8 AM"           → Weekday schedule
"arm zone kitchen at 10 PM on weekends"  → Zone + time schedule
"list all schedules"                     → Show schedules
"cancel schedule 1"                      → Remove schedule
"arm system in 30 minutes"               → One-time delay
```

**System Information:**
```
"show event logs"             → Recent activity
"system health"               → System diagnostics
"show statistics"             → Usage statistics
"help" / "commands"           → Available commands
```

### 🎯 Interface Overview

**Dashboard Layout:**
- **Header**: System status, user info, and navigation
- **Left Panel**: Command input with smart suggestions
- **Right Panel**: Real-time results and system feedback
- **Footer**: Quick actions and system health indicators

**Real-time Features:**
- **Auto-refresh**: System state updates every 5 seconds
- **Visual feedback**: Loading indicators and status animations
- **Instant updates**: UI refreshes immediately after commands
- **Error handling**: Clear error messages and recovery suggestions

## 🏗️ Architecture

### Domain-Driven Design (DDD)

```
backend/src/
├── domain/                    # 🏛️ Business Logic Layer
│   ├── entities/             # Core business objects (User, SystemState, Zone, ScheduledTask)
│   ├── events/               # Domain events (SystemArmed, UserAdded, etc.)
│   ├── services/             # Domain services (AuthenticationService, ScheduleParser)
│   ├── repositories/         # Repository interfaces
│   └── valueObjects/         # Value objects (Time, DayOfWeek, ScheduleExpression)
├── application/              # 📋 Application Layer
│   ├── useCases/             # Business use cases (ArmSystem, ProcessCommand, etc.)
│   ├── services/             # Application services (NlpService, SchedulingService)
│   └── handlers/             # Event handlers (EventLogHandler)
├── infrastructure/           # 🔧 Infrastructure Layer
│   ├── persistence/          # Data storage (InMemory repositories)
│   ├── adapters/             # External API adapters (Groq, Fallback NLP)
│   ├── controllers/          # HTTP controllers
│   ├── middleware/           # Security, validation, rate limiting
│   ├── services/             # Infrastructure services (SchedulingEngine, TaskExecutor)
│   ├── bootstrap/            # Application bootstrap
│   ├── config/               # Configuration management
│   └── container/            # Dependency injection
└── presentation/             # 🌐 Presentation Layer
    └── routes/               # API routes and middleware
```

### Event-Driven Architecture

**Event Flow:**
```
User Command → Use Case → Domain Event → Event Handler → Side Effects
     ↓              ↓           ↓             ↓            ↓
  "arm system" → ArmSystem → SystemArmed → LogEvent → Audit Trail
```

**Key Components:**
- **Domain Events**: System state changes trigger events automatically
- **Event Bus**: Centralized event distribution system
- **Event Handlers**: Automatic logging, notifications, and side effects
- **Real-time Updates**: UI reflects changes immediately via WebSocket-like polling
- **Audit Trail**: Complete history of all system interactions
- **Event Sourcing**: Reconstruct system state from event history

### Microservices-Ready Design

**Service Boundaries:**
- **Authentication Service**: User management and JWT handling
- **Command Processing Service**: NLP and command execution
- **Zone Management Service**: Zone operations and hierarchy
- **Scheduling Service**: Task scheduling and execution
- **Notification Service**: Alerts and communications
- **Audit Service**: Logging and compliance

**Integration Patterns:**
- **API Gateway**: Centralized routing and authentication
- **Event Bus**: Asynchronous communication between services
- **Circuit Breaker**: Fault tolerance and resilience
- **Health Checks**: Service monitoring and discovery

## 🔌 API Reference

### Authentication Endpoints
```http
POST /api/login                    # User authentication
GET  /api/auth/verify              # Verify JWT token
POST /api/auth/refresh             # Refresh JWT token
POST /api/auth/logout              # Logout user
```

### Command Processing
```http
POST /api/command                  # Process natural language command
GET  /api/command/history          # Get command history
GET  /api/command/suggestions      # Get command suggestions
```

### System Management
```http
GET  /api/system/state             # Get current system state
GET  /api/system/events            # Get event logs (with pagination)
DELETE /api/system/events          # Clear event logs (admin only)
GET  /api/system/health            # System health check
GET  /api/system/metrics           # System performance metrics
```

### User Management (Admin only)
```http
GET    /api/users                  # List all users
POST   /api/users                  # Add new user
PUT    /api/users/:id              # Update user
DELETE /api/users/:id              # Delete user
GET    /api/users/:id/activity     # Get user activity log
```

### Zone Management
```http
GET    /api/zones                  # List all zones
POST   /api/zones                  # Create new zone
GET    /api/zones/:id              # Get specific zone
PUT    /api/zones/:id              # Update zone
DELETE /api/zones/:id              # Delete zone
POST   /api/zones/:id/arm          # Arm specific zone
POST   /api/zones/:id/disarm       # Disarm specific zone
GET    /api/zones/:id/status       # Get zone status
GET    /api/zones/hierarchy        # Get zone hierarchy
```

### Scheduling System
```http
GET    /api/schedules              # List all schedules
POST   /api/schedules              # Create new schedule
GET    /api/schedules/:id          # Get specific schedule
PUT    /api/schedules/:id          # Update schedule
DELETE /api/schedules/:id          # Cancel schedule
POST   /api/schedules/:id/execute  # Execute schedule manually
GET    /api/schedules/upcoming     # Get upcoming schedules
```

### API Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2025-09-24T19:56:02.852Z",
  "requestId": "req_123456789"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "details": { ... }
  },
  "timestamp": "2025-09-24T19:56:02.852Z",
  "requestId": "req_123456789"
}
```

## 🐳 Docker Deployment

### Production Deployment

**Quick Start:**
```bash
# Clone and start
git clone https://github.com/vubangsi/nlp-security-system.git
cd nlp-security-system
docker-compose up --build -d
```

**Environment Setup:**
```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with production values

# Start with custom environment
docker-compose --env-file .env.production up -d
```

**Service Management:**
```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

**Health Monitoring:**
```bash
# Check service health
docker-compose ps

# Monitor resource usage
docker stats

# View service logs in real-time
docker-compose logs -f --tail=100
```

### Development with Docker

**Hot Reload Development:**
```bash
# Start in development mode
docker-compose -f docker-compose.dev.yml up

# Backend with nodemon
docker-compose exec backend npm run dev

# Frontend with hot reload (enabled by default)
docker-compose up frontend
```

**Development Tools:**
```bash
# Access container shell
docker-compose exec backend sh
docker-compose exec frontend sh

# Run tests in container
docker-compose exec backend npm test
docker-compose exec frontend npm test

# Install new packages
docker-compose exec backend npm install package-name
docker-compose exec frontend npm install package-name
```

**Database and Persistence:**
```bash
# Backup data (if using persistent storage)
docker-compose exec backend npm run backup

# Restore data
docker-compose exec backend npm run restore

# Reset to clean state
docker-compose down -v && docker-compose up --build
```

## 💻 Development

### Backend Development
```bash
cd backend

# Development with hot reload
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Linting and formatting
npm run lint
npm run lint:fix
npm run format

# Build for production
npm run build

# Database operations
npm run migrate
npm run seed
```

### Frontend Development
```bash
cd frontend

# Start development server
npm start

# Run tests
npm test
npm run test:coverage

# Build for production
npm run build

# Analyze bundle
npm run analyze

# Linting and formatting
npm run lint
npm run lint:fix
npm run format
```

### Development Workflow
```bash
# 1. Setup development environment
git clone https://github.com/vubangsi/nlp-security-system.git
cd nlp-security-system
cp .env.example .env

# 2. Install dependencies
npm run install:all

# 3. Start development servers
npm run dev

# 4. Run tests
npm run test:all

# 5. Build for production
npm run build:all
```

## 🔒 Security Features

### Authentication & Authorization
- 🔐 **JWT Authentication**: Secure token-based authentication with refresh tokens
- 🛡️ **Role-based Access Control**: Granular permissions for admin and user roles
- 🔒 **PIN-based Login**: Simple but secure authentication method
- 🚪 **Session Management**: Automatic logout and session timeout
- 🔑 **Multi-factor Authentication**: Optional 2FA support

### Input Security
- 🚫 **Input Validation**: Comprehensive request validation and sanitization
- 🛡️ **XSS Protection**: HTML sanitization and content security policies
- 💉 **SQL Injection Prevention**: Parameterized queries and input escaping
- 🔒 **CSRF Protection**: Cross-site request forgery prevention
- 📝 **Rate Limiting**: Advanced protection against abuse and DDoS

### Data Protection
- 📝 **Audit Logging**: Complete event trail with tamper detection
- 🔐 **Data Encryption**: Sensitive data encryption at rest and in transit
- 🗄️ **Secure Storage**: Encrypted local storage and secure cookies
- 🔄 **Data Backup**: Automated backup and recovery procedures
- 🗑️ **Data Retention**: Configurable data retention policies

### Network Security
- 🌐 **HTTPS Enforcement**: TLS/SSL encryption for all communications
- 🔒 **CORS Configuration**: Proper cross-origin resource sharing setup
- 🛡️ **Security Headers**: Comprehensive security headers implementation
- 🚫 **IP Filtering**: Optional IP whitelist/blacklist functionality
- 📊 **Security Monitoring**: Real-time security event monitoring

## 🤝 Contributing

### Getting Started
1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** from `main`
4. **Make your changes** following our coding standards
5. **Add tests** for new functionality
6. **Run the test suite** to ensure everything works
7. **Submit a pull request** with a clear description

### Development Guidelines
- **Code Style**: Follow ESLint and Prettier configurations
- **Testing**: Maintain 80%+ test coverage
- **Documentation**: Update README and inline documentation
- **Commits**: Use conventional commit messages
- **Security**: Follow security best practices

### Pull Request Process
1. Update documentation for any new features
2. Add tests for new functionality
3. Ensure all tests pass
4. Update the CHANGELOG.md
5. Request review from maintainers

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Groq AI** for providing advanced NLP capabilities
- **React Community** for the excellent frontend framework
- **Node.js Community** for the robust backend platform
- **Docker** for containerization support
- **Contributors** who have helped improve this project

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/vubangsi/nlp-security-system/wiki)
- **Issues**: [GitHub Issues](https://github.com/vubangsi/nlp-security-system/issues)
- **Discussions**: [GitHub Discussions](https://github.com/vubangsi/nlp-security-system/discussions)
- **Security**: Report security issues to [security@example.com](mailto:security@example.com)

---

**Built with ❤️ by the NLP Security System Team**
