# Modules AGENTS.md

## Overview

This directory contains all NestJS feature modules following a modular monolith pattern. Each module encapsulates a specific domain with its controllers, services, DTOs, and sub-services.

## Module Structure

```
modules/
├── admin/              # Admin panel functionality
├── ai/                 # AI features (summaries, icebreakers)
├── auth/               # Authentication (better-auth)
├── contacts/           # Contact CRUD and enrichment
├── dashboard/          # Dashboard aggregations
├── gdpr/               # GDPR compliance
├── health/             # Health checks
├── integrations/       # External service integrations
│   ├── calendar-sync/  # Google/Outlook calendar
│   ├── email-sync/     # Gmail/Outlook email
│   ├── gmail/          # Gmail OAuth
│   ├── google-contacts/# Google Contacts import
│   ├── microsoft-contacts/ # Microsoft Contacts
│   └── shared/         # Shared integration utilities
├── notes/              # Contact notes
├── notifications/      # Push notifications
├── organizations/      # Multi-tenancy
├── reminders/          # Follow-up reminders
├── search/             # Full-text and semantic search
└── users/              # User management
```

## Standard Module Layout

Each module follows this structure:

```
{module-name}/
├── {module-name}.module.ts        # Module definition
├── {module-name}.controller.ts    # REST endpoints
├── {module-name}.controller.spec.ts # Controller tests
├── {module-name}.service.ts       # Main business logic
├── {module-name}.service.spec.ts  # Service tests
├── dto/                           # Data Transfer Objects
│   ├── index.ts                   # Re-exports
│   ├── create-{entity}.dto.ts
│   └── update-{entity}.dto.ts
├── services/                      # Sub-services (optional)
│   └── {feature}.service.ts
├── jobs/                          # BullMQ jobs (optional)
│   └── {job-name}.job.ts
└── index.ts                       # Public exports
```

## Example Files by Module

### Contacts Module (Reference Implementation)

This is the primary reference for module structure:

| File | Purpose |
|------|---------|
| [contacts.controller.ts](contacts/contacts.controller.ts) | REST API with Swagger docs |
| [contacts.service.ts](contacts/contacts.service.ts) | Business logic with transactions |
| [contacts.service.spec.ts](contacts/contacts.service.spec.ts) | Unit tests with mocking |
| [dto/create-contact.dto.ts](contacts/dto/create-contact.dto.ts) | Input validation |
| [services/linkedin-enrichment.service.ts](contacts/services/linkedin-enrichment.service.ts) | External API integration |

### Search Module (Semantic Search)

Advanced search with pgvector:

| File | Purpose |
|------|---------|
| [search.controller.ts](search/search.controller.ts) | Search endpoints |
| [search.service.ts](search/search.service.ts) | Search orchestration |
| [services/semantic-search.service.ts](search/services/semantic-search.service.ts) | Vector similarity search |
| [services/embedding.service.ts](search/services/embedding.service.ts) | OpenAI embeddings |

### Reminders Module (Background Jobs)

Scheduled notifications with BullMQ:

| File | Purpose |
|------|---------|
| [reminders.controller.ts](reminders/reminders.controller.ts) | CRUD endpoints |
| [reminders.service.ts](reminders/reminders.service.ts) | Reminder logic |
| [jobs/reminder-notification.job.ts](reminders/jobs/reminder-notification.job.ts) | Background job |
| [services/notification-dispatcher.service.ts](reminders/services/notification-dispatcher.service.ts) | Push notifications |

### Integrations Module (OAuth + External APIs)

External service integrations:

| File | Purpose |
|------|---------|
| [google-contacts/google-contacts.service.ts](integrations/google-contacts/google-contacts.service.ts) | Google People API |
| [microsoft-contacts/microsoft-contacts.service.ts](integrations/microsoft-contacts/microsoft-contacts.service.ts) | Microsoft Graph API |
| [shared/oauth.service.ts](integrations/shared/oauth.service.ts) | Token management |
| [shared/deduplication.service.ts](integrations/shared/deduplication.service.ts) | Contact deduplication |

## Module Conventions

### 1. Module Registration

```typescript
// {module-name}.module.ts
import { Module } from '@nestjs/common';
import { FeatureController } from './feature.controller';
import { FeatureService } from './feature.service';

@Module({
  imports: [],           // Other modules needed
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],  // Export for use by other modules
})
export class FeatureModule {}
```

### 2. Controller Pattern

```typescript
@ApiTags('Feature')
@ApiBearerAuth()
@Controller('feature')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Get()
  @ApiOperation({ summary: 'List all features' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findAll(@Request() req: any) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.featureService.findAll(req.user.id);
  }
}
```

### 3. Service Pattern

```typescript
@Injectable()
export class FeatureService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.feature.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateFeatureDto) {
    return this.prisma.$transaction(async (tx) => {
      // Transaction logic
    });
  }
}
```

### 4. DTO Pattern

```typescript
// dto/create-feature.dto.ts
import { IsString, IsOptional, IsEmail, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateFeatureDto {
  @ApiProperty({ description: 'Name of the feature' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ type: () => NestedDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NestedDto)
  nested?: NestedDto;
}
```

### 5. Test Pattern

```typescript
// feature.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { FeatureService } from './feature.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('FeatureService', () => {
  let service: FeatureService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      feature: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
    prisma = module.get(PrismaService);
  });

  it('should find all features for user', async () => {
    const userId = 'user-123';
    prisma.feature.findMany.mockResolvedValue([]);

    const result = await service.findAll(userId);

    expect(prisma.feature.findMany).toHaveBeenCalledWith({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  });
});
```

## Adding a New Module

1. Create module directory: `mkdir src/modules/new-feature`
2. Create files following the standard layout
3. Register in `app.module.ts`:
   ```typescript
   imports: [
     // ...existing modules
     NewFeatureModule,
   ],
   ```
4. Add routes in controller with `/new-feature` prefix
5. Write unit tests in `*.spec.ts` files

## Inter-Module Communication

Modules communicate through exported services:

```typescript
// In FeatureAModule
@Module({
  exports: [FeatureAService],
})
export class FeatureAModule {}

// In FeatureBModule
@Module({
  imports: [FeatureAModule],  // Import the module
  providers: [FeatureBService],
})
export class FeatureBModule {}

// In FeatureBService
@Injectable()
export class FeatureBService {
  constructor(
    private readonly featureAService: FeatureAService,  // Inject
  ) {}
}
```







