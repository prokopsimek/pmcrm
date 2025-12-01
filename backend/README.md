# Personal Network CRM - Backend API

AI-powered relationship management system for maintaining and nurturing personal and professional networks.

## Tech Stack

- **Framework**: NestJS with TypeScript (Strict Mode)
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with BullMQ
- **Authentication**: JWT with Passport
- **API Documentation**: Swagger/OpenAPI
- **Containerization**: Docker & Docker Compose

## Architecture

This project follows a **Modular Monolith** pattern with clean separation of concerns:

```
src/
├── modules/              # Feature modules
│   ├── contacts/        # Contact management
│   ├── users/           # User management
│   ├── ai/              # AI insights & recommendations
│   ├── integrations/    # Third-party integrations
│   ├── notifications/   # Notification system
│   └── search/          # Search functionality
└── shared/              # Shared utilities
    ├── config/          # Configuration & validation
    ├── database/        # Prisma service
    ├── guards/          # Authentication guards
    ├── decorators/      # Custom decorators
    ├── filters/         # Exception filters
    ├── interceptors/    # Response interceptors
    ├── middleware/      # HTTP middleware
    └── pipes/           # Validation pipes
```

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker & Docker Compose (for local development)

## Quick Start

### 1. Clone and Install

```bash
cd backend
pnpm install
```

### 2. Start Local Infrastructure

Start PostgreSQL and Redis using Docker Compose:

```bash
pnpm docker:up
```

This starts:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- pgAdmin on `localhost:5050` (optional GUI)
- Redis Commander on `localhost:8081` (optional GUI)

### 3. Configure Environment

Copy the environment template:

```bash
cp .env.example .env
```

Update `.env` with your configuration (defaults work for local development).

### 4. Setup Database

Generate Prisma Client and run migrations:

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

Or use the all-in-one setup command:

```bash
pnpm setup
```

### 5. Start Development Server

```bash
pnpm start:dev
```

The API will be available at:
- API: http://localhost:3000/api/v1
- Swagger Docs: http://localhost:3000/api/docs
- Health Check: http://localhost:3000/health

## Available Scripts

### Development

```bash
pnpm start:dev          # Start with hot reload
pnpm start:debug        # Start in debug mode
```

### Database

```bash
pnpm prisma:generate    # Generate Prisma Client
pnpm prisma:migrate     # Run migrations
pnpm prisma:studio      # Open Prisma Studio GUI
pnpm db:push            # Push schema changes (dev only)
pnpm db:reset           # Reset database
```

### Docker

```bash
pnpm docker:up          # Start containers
pnpm docker:down        # Stop containers
pnpm docker:logs        # View container logs
```

### Testing

```bash
pnpm test               # Run unit tests
pnpm test:watch         # Run tests in watch mode
pnpm test:cov           # Run tests with coverage
pnpm test:e2e           # Run e2e tests
```

### Code Quality

```bash
pnpm lint               # Lint and fix code
pnpm format             # Format code with Prettier
```

### Build

```bash
pnpm build              # Build for production
pnpm start:prod         # Start production build
```

## Database Schema

The database schema is defined in `prisma/schema.prisma` with the following main entities:

- **User**: User accounts with role-based access
- **Contact**: Personal and professional contacts
- **ContactActivity**: Interaction history
- **Reminder**: Scheduled reminders
- **NetworkConnection**: Relationships between contacts
- **AIInsight**: AI-generated insights
- **Integration**: Third-party integrations
- **Notification**: User notifications
- **ActivityLog**: System audit logs

## API Documentation

Access interactive API documentation at http://localhost:3000/api/docs when the server is running.

The API uses JWT Bearer authentication. Include the token in requests:

```bash
Authorization: Bearer <your-jwt-token>
```

## Environment Variables

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | See `.env.example` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_REFRESH_SECRET` | Refresh token secret | Required |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:3000` |

See `.env.example` for complete list.

## Project Structure

### Shared Layer

- **Guards**: JWT authentication, role-based access control
- **Filters**: Global exception handling with Prisma error support
- **Interceptors**: Response transformation
- **Middleware**: HTTP logging
- **Pipes**: Request validation with class-validator

### Feature Modules

Each module follows a consistent structure:
- `*.module.ts` - Module definition
- `*.controller.ts` - HTTP endpoints
- `*.service.ts` - Business logic
- `*.dto.ts` - Data transfer objects
- `*.entity.ts` - Database entities

## Best Practices

1. **Type Safety**: Strict TypeScript mode enabled
2. **Validation**: All DTOs validated with class-validator
3. **Error Handling**: Global exception filter with proper error responses
4. **Logging**: Structured logging with context
5. **Security**: Helmet, CORS, rate limiting, JWT authentication
6. **Database**: Transactions, proper indexing, soft deletes where needed
7. **Testing**: Unit and E2E tests for critical paths

## Health Checks

The application exposes health check endpoints:

- `GET /health` - Comprehensive health check
- `GET /health/liveness` - Kubernetes liveness probe
- `GET /health/readiness` - Kubernetes readiness probe

## Troubleshooting

### Database Connection Issues

```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check database logs
pnpm docker:logs postgres
```

### Redis Connection Issues

```bash
# Verify Redis is running
docker ps | grep redis

# Check Redis logs
pnpm docker:logs redis
```

### Prisma Issues

```bash
# Regenerate Prisma Client
pnpm prisma:generate

# Reset database (WARNING: destroys data)
pnpm db:reset
```

## Production Deployment

### Build Docker Image

```bash
docker build -t pmcrm-backend .
```

### Run Container

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=<your-db-url> \
  -e REDIS_URL=<your-redis-url> \
  -e JWT_SECRET=<your-secret> \
  pmcrm-backend
```

### Before Deployment

1. Update all secrets in production environment
2. Run database migrations: `pnpm prisma:migrate:deploy`
3. Set `NODE_ENV=production`
4. Configure proper CORS origins
5. Enable application monitoring

## Contributing

This backend provides the foundation. Feature-specific implementations should be added by domain experts to their respective modules.

## License

UNLICENSED - Private project
