# Natural Language Security Control System - Architecture Diagram

## System Overview

The application is a **Natural Language Security Control System** built with Domain-Driven Design (DDD) and Event-Driven Architecture, featuring natural language command processing powered by Groq AI.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      React Frontend (Port 3000)                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │ LoginPage   │  │ CommandPage │  │ Dashboard   │  │ System      │  │ │
│  │  │             │  │             │  │ Page        │  │ Status      │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │ │
│  │                                                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    Services Layer                               │ │ │
│  │  │  • apiService.js    • authService.js    • commandService.js    │ │ │
│  │  │  • systemService.js                                             │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                               HTTP/REST API
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVER LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    Express.js Backend (Port 3001)                   │ │
│  │                                                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                   PRESENTATION LAYER                            │ │ │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │ │ │
│  │  │  │ API Routes  │  │ Middleware  │  │ HTTP Controllers        │  │ │ │
│  │  │  │             │  │ • Auth      │  │ • AuthController        │  │ │ │
│  │  │  │ /api/login  │  │ • Error     │  │ • CommandController     │  │ │ │
│  │  │  │ /api/command│  │ • CORS      │  │ • SystemController      │  │ │ │
│  │  │  │ /api/system │  │             │  │ • UserController        │  │ │ │
│  │  │  │ /api/users  │  │             │  │                         │  │ │ │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                   APPLICATION LAYER                             │ │ │
│  │  │  ┌─────────────────────────┐    ┌─────────────────────────────┐ │ │ │
│  │  │  │      Use Cases          │    │     Application Services    │ │ │ │
│  │  │  │ • LoginUseCase          │    │ • NlpService               │ │ │ │
│  │  │  │ • ProcessCommandUseCase │    │                            │ │ │ │
│  │  │  │ • ArmSystemUseCase      │    │     Event Handlers         │ │ │ │
│  │  │  │ • DisarmSystemUseCase   │    │ • EventLogHandler          │ │ │ │
│  │  │  │ • AddUserUseCase        │    │                            │ │ │ │
│  │  │  │ • ListUsersUseCase      │    │                            │ │ │ │
│  │  │  │ • GetSystemStatusUseCase│    │                            │ │ │ │
│  │  │  └─────────────────────────┘    └─────────────────────────────┘ │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                     DOMAIN LAYER                                │ │ │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │ │ │
│  │  │  │   Entities      │  │   Domain Events │  │ Domain Services │  │ │ │
│  │  │  │ • User          │  │ • SystemArmed   │  │ • Authentication│  │ │ │
│  │  │  │ • SystemState   │  │ • SystemDisarmed│  │   Service       │  │ │ │
│  │  │  │ • EventLog      │  │ • UserAdded     │  │                 │  │ │ │
│  │  │  │                 │  │ • CommandProcess│  │                 │  │ │ │
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │ │ │
│  │  │                                                                 │ │ │
│  │  │  ┌─────────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │                Repository Interfaces                        │ │ │ │
│  │  │  │ • UserRepository  • SystemStateRepository  • EventLogRepo   │ │ │ │
│  │  │  └─────────────────────────────────────────────────────────────┘ │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                 INFRASTRUCTURE LAYER                            │ │ │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │ │ │
│  │  │  │  Data Access    │  │    Adapters     │  │  Cross-Cutting  │  │ │ │
│  │  │  │ • InMemoryUser  │  │ • GroqNlpAdapter│  │ • EventBus      │  │ │ │
│  │  │  │   Repository    │  │ • FallbackNlp   │  │ • DIContainer   │  │ │ │
│  │  │  │ • InMemorySystem│  │   Adapter       │  │                 │  │ │ │
│  │  │  │   StateRepo     │  │                 │  │                 │  │ │ │
│  │  │  │ • InMemoryEvent │  │                 │  │                 │  │ │ │
│  │  │  │   LogRepo       │  │                 │  │                 │  │ │ │
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                             External Services
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                               │
│  ┌─────────────────┐                    ┌─────────────────────────────┐  │
│  │   Groq AI API   │                    │      Fallback NLP           │  │
│  │                 │                    │   (Local Processing)        │  │
│  │ • llama3-8b     │                    │                             │  │
│  │ • llama3-70b    │                    │ • Pattern Matching          │  │
│  │ • mixtral-8x7b  │                    │ • Local Intent Recognition  │  │
│  │ • gemma-7b      │                    │                             │  │
│  │ • gpt-4o-mini   │                    │                             │  │
│  └─────────────────┘                    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            DATA FLOW                                    │
│                                                                         │
│  User Input (Natural Language)                                         │
│            │                                                           │
│            ▼                                                           │
│  ┌─────────────────┐                                                   │
│  │  React Frontend │                                                   │
│  │  Command Input  │                                                   │
│  └─────────────────┘                                                   │
│            │                                                           │
│            ▼ HTTP POST /api/command                                    │
│  ┌─────────────────┐                                                   │
│  │ CommandController│                                                   │
│  └─────────────────┘                                                   │
│            │                                                           │
│            ▼                                                           │
│  ┌─────────────────────┐                                               │
│  │ ProcessCommandUseCase│                                               │
│  └─────────────────────┘                                               │
│            │                                                           │
│            ▼                                                           │
│  ┌─────────────────┐                                                   │
│  │   NLP Service   │                                                   │
│  │                 │                                                   │
│  │ ┌─────────────┐ │ ┌─────────────────┐                             │
│  │ │ Groq Adapter│ │ │ Fallback Adapter│                             │
│  │ └─────────────┘ │ └─────────────────┘                             │
│  └─────────────────┘                                                   │
│            │                                                           │
│            ▼ Intent & Entities                                         │
│  ┌─────────────────────┐                                               │
│  │   Domain Use Cases  │                                               │
│  │ • ArmSystemUseCase  │                                               │
│  │ • DisarmSystemUse   │                                               │
│  │ • AddUserUseCase    │                                               │
│  │ • ListUsersUseCase  │                                               │
│  └─────────────────────┘                                               │
│            │                                                           │
│            ▼                                                           │
│  ┌─────────────────────┐                                               │
│  │   Domain Entities   │                                               │
│  │ • SystemState       │                                               │
│  │ • User              │                                               │
│  │ • EventLog          │                                               │
│  └─────────────────────┘                                               │
│            │                                                           │
│            ▼                                                           │
│  ┌─────────────────────┐                                               │
│  │   Event Bus         │                                               │
│  │ (Publish Events)    │                                               │
│  └─────────────────────┘                                               │
│            │                                                           │
│            ▼                                                           │
│  ┌─────────────────────┐                                               │
│  │  Event Handlers     │                                               │
│  │ (Logging, Auditing) │                                               │
│  └─────────────────────┘                                               │
│            │                                                           │
│            ▼                                                           │
│  ┌─────────────────────┐                                               │
│  │  Response to Client │                                               │
│  │ (JSON with Result)  │                                               │
│  └─────────────────────┘                                               │
│            │                                                           │
│            ▼                                                           │
│  ┌─────────────────────┐                                               │
│  │ Frontend Updates UI │                                               │
│  │ • Status Display    │                                               │
│  │ • Command Results   │                                               │
│  │ • System State      │                                               │
│  └─────────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Dependencies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DEPENDENCY INJECTION                               │
│                                                                         │
│  ┌─────────────────────┐                                               │
│  │    DIContainer      │                                               │
│  │                     │                                               │
│  │ Manages all deps:   │                                               │
│  │ • Repositories      │                                               │
│  │ • Use Cases         │                                               │
│  │ • Services          │                                               │
│  │ • Controllers       │                                               │
│  │ • Event Handlers    │                                               │
│  └─────────────────────┘                                               │
│                                                                         │
│  Dependencies Flow:                                                     │
│                                                                         │
│  Controllers ──depends──▶ Use Cases ──depends──▶ Domain Services       │
│      │                       │                       │                 │
│      │                       ▼                       ▼                 │
│      │                  Repositories ──────────▶ Domain Entities       │
│      │                       │                                         │
│      ▼                       ▼                                         │
│  HTTP Layer               Data Layer                                    │
│                                                                         │
│  Event Bus ◀──publishes── Use Cases ──triggers──▶ Event Handlers       │
│                                                                         │
│  NLP Service ──uses──▶ External Adapters (Groq/Fallback)              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Architectural Patterns

### 1. Domain-Driven Design (DDD)
- **Domain Layer**: Core business logic and entities
- **Application Layer**: Use cases and application services
- **Infrastructure Layer**: External concerns (persistence, adapters)
- **Presentation Layer**: HTTP controllers and routes

### 2. Event-Driven Architecture
- **Domain Events**: System state changes trigger events
- **Event Bus**: Centralized event publishing and subscription
- **Event Handlers**: Automatic logging and side effects
- **Audit Trail**: Complete history of system interactions

### 3. Dependency Injection
- **DIContainer**: Manages all dependencies
- **Interface Segregation**: Repository interfaces in domain
- **Inversion of Control**: Dependencies injected into constructors

### 4. Adapter Pattern
- **NLP Adapters**: Groq API and Fallback implementations
- **Repository Adapters**: In-memory implementations
- **Service Adapters**: External service integrations

## Security Architecture

### Authentication & Authorization
```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SECURITY FLOW                                  │
│                                                                         │
│  User Login (PIN) ──▶ AuthenticationService ──▶ JWT Token Generation   │
│                                │                                        │
│                                ▼                                        │
│  Token Stored in Frontend ──▶ HTTP Headers (Authorization: Bearer)     │
│                                │                                        │
│                                ▼                                        │
│  Auth Middleware ──▶ Token Validation ──▶ User Context                 │
│                                │                                        │
│                                ▼                                        │
│  Role-Based Access Control ──▶ Admin/User Permissions                  │
│                                                                         │
│  Features:                                                              │
│  • JWT-based authentication                                            │
│  • Role-based access (Admin/User)                                      │
│  • PIN-based login                                                     │
│  • Token expiration handling                                           │
│  • Audit logging for all actions                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

### Docker Configuration
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DOCKER DEPLOYMENT                                │
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │
│  │  Frontend       │    │   Backend       │    │   Test Service      │  │
│  │  Container      │    │   Container     │    │   (Optional)        │  │
│  │                 │    │                 │    │                     │  │
│  │ • React App     │    │ • Express.js    │    │ • Test Runner       │  │
│  │ • Nginx         │    │ • Node.js       │    │ • Same Backend      │  │
│  │ • Port 3000     │    │ • Port 3001     │    │   Image             │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────┘  │
│           │                       │                       │             │
│           └───────────────────────┼───────────────────────┘             │
│                                   │                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     Docker Network                                  │ │
│  │                    (app-network)                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Features:                                                              │
│  • Multi-stage builds                                                  │
│  • Health checks                                                       │
│  • Volume mounting for development                                     │
│  • Environment variable configuration                                  │
│  • Network isolation                                                   │
│  • Restart policies                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack Summary

### Frontend
- **Framework**: React 18
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Styling**: CSS3 with Glassmorphism design
- **Build Tool**: Create React App

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Architecture**: DDD + Event-Driven
- **Authentication**: JWT
- **NLP**: Groq AI API with Fallback
- **Testing**: Jest
- **Documentation**: JSDoc

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Storage**: In-Memory (Development)
- **Logging**: Console with Event Bus
- **Health Checks**: Built-in endpoints
- **Process Management**: PM2 (Production)

This architecture provides a robust, scalable, and maintainable foundation for the Natural Language Security Control System with clear separation of concerns, proper dependency management, and comprehensive event-driven capabilities.