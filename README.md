# Natural Language Security Control System

A modern security control application built with Domain-Driven Design (DDD) and Event-Driven Architecture, featuring natural language command processing powered by Groq AI.

## Features

- 🔐 **Natural Language Commands**: Control your security system using plain English
- 🎯 **Two-Column Interface**: Efficient command input and real-time result display
- 📊 **Real-time System Status**: Immediate visibility of system state for all users
- 🛡️ **Role-based Access**: Admin and user roles with appropriate permissions
- 🎨 **Modern UI**: Glassmorphism design with responsive layout
- ⚡ **Event-Driven Architecture**: Real-time updates and comprehensive audit logging
- 🤖 **AI-Powered NLP**: Groq API integration with intelligent fallback processing

## Quick Start

### 🐳 Docker (Recommended)

**Prerequisites:**
- Docker and Docker Compose installed

**One-command startup:**
```bash
docker-compose up --build
```

**Or use the startup script:**
```bash
./start.sh
```

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Default PIN: `0000`

### 📦 Manual Installation

**Prerequisites:**
- Node.js 16+
- npm or yarn
- Groq API key (optional, fallback NLP available)

**Setup:**
1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd textsecurity-control-app
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install and start backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

4. **Install and start frontend**:
   ```bash
   cd ../frontend
   npm install
   npm start
   ```

5. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Testing

### Run All Tests
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run comprehensive test suite
./scripts/run-tests.sh
```

### Run Core Functionality Tests
```bash
# Test essential features
./scripts/test-core-functionality.sh
```

### Run Individual Test Suites

**Backend Tests:**
```bash
cd backend
npm test                    # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage
```

**Frontend Tests:**
```bash
cd frontend
npm test                   # Run unit tests
npm test -- --coverage    # Run tests with coverage
```

**Docker-based Integration Tests:**
```bash
# Run backend tests in Docker
docker-compose --profile test run test

# Test with Docker services
docker-compose up -d --build
./scripts/test-core-functionality.sh
docker-compose down
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GROQ_API_KEY` | Groq API key for NLP processing | - | No* |
| `GROQ_MODEL` | Groq model to use | `llama3-8b-8192` | No |
| `ADMIN_PIN` | Admin user PIN | `0000` | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `PORT` | Backend server port | `3001` | No |
| `NODE_ENV` | Environment mode | `development` | No |

*Fallback NLP adapter is used if Groq API key is not provided

### Available Groq Models

- `llama3-8b-8192` (default, fast and efficient)
- `llama3-70b-8192` (more capable, slower)
- `mixtral-8x7b-32768` (good balance)
- `gemma-7b-it` (Google's model)
- `openai/gpt-oss-20b` (OpenAI compatible)
- `openai/gpt-4o-mini` (OpenAI GPT-4 mini)
- `openai/gpt-3.5-turbo` (OpenAI GPT-3.5)

### Changing Models

Use the provided script to easily switch between models:

```bash
# Show available models
./scripts/change-model.sh

# Change to a specific model
./scripts/change-model.sh openai/gpt-4o-mini

# Restart backend to apply changes
cd backend && npm start
```

## Usage

### Login
- **Admin PIN**: `0000` (configurable via `ADMIN_PIN`)
- **Auto-redirect**: All users start at the command interface

### Natural Language Commands

**System Control**:
- "arm the system" / "sesame close"
- "arm the system in away mode"
- "disarm the system" / "sesame open"
- "lock" / "unlock"
- "secure" / "unsecure"

**User Management** (Admin only):
- "add user John with pin 1234"
- "list all users"

### Interface Layout

- **Left Column**: Command input with examples and status messages
- **Right Column**: Real-time command results with detailed JSON output
- **Top Bar**: System status visible to all users

## Architecture

### Domain-Driven Design (DDD)

```
src/
├── domain/           # Business logic and rules
│   ├── entities/     # Core business objects
│   ├── events/       # Domain events
│   ├── services/     # Domain services
│   └── repositories/ # Repository interfaces
├── application/      # Use cases and application services
│   ├── useCases/     # Business use cases
│   ├── services/     # Application services
│   └── handlers/     # Event handlers
├── infrastructure/   # External concerns
│   ├── persistence/  # Data storage
│   ├── adapters/     # External API adapters
│   ├── controllers/  # HTTP controllers
│   └── container/    # Dependency injection
└── presentation/     # API routes and middleware
```

### Event-Driven Architecture

- **Domain Events**: System state changes trigger events
- **Event Handlers**: Automatic logging and side effects
- **Real-time Updates**: UI reflects changes immediately
- **Audit Trail**: Complete history of all system interactions

## API Endpoints

### Authentication
- `POST /api/login` - User authentication

### Commands
- `POST /api/command` - Process natural language command

### System
- `GET /api/system/state` - Get current system state
- `GET /api/system/events` - Get event logs

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Add new user

## Docker Deployment

### 🐳 Production Deployment

**Build and run:**
```bash
docker-compose up --build -d
```

**View logs:**
```bash
docker-compose logs -f
```

**Stop services:**
```bash
docker-compose down
```

**Rebuild specific service:**
```bash
docker-compose build backend
docker-compose build frontend
```

### 🔧 Docker Development

**Development with hot reload:**
```bash
# Backend with nodemon
docker-compose exec backend npm run dev

# Frontend with hot reload (already enabled)
docker-compose up frontend
```

**Access container shell:**
```bash
docker-compose exec backend sh
docker-compose exec frontend sh
```

## Development

### Backend Development
```bash
cd backend
npm run dev  # Start with nodemon
npm test     # Run tests
```

### Frontend Development
```bash
cd frontend
npm start    # Start development server
npm test     # Run tests
npm run build # Build for production
```

## Security Features

- 🔐 **JWT Authentication**: Secure token-based authentication
- 🛡️ **Role-based Access**: Admin and user permissions
- 📝 **Audit Logging**: Complete event trail
- 🔒 **PIN-based Login**: Simple but secure authentication
- 🚫 **Input Validation**: Comprehensive request validation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
