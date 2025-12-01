# Changelog

All notable changes to Personal Network CRM will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- WhatsApp Business API integration
- LinkedIn enrichment via Apollo.io
- Mobile app (React Native with Expo)
- Advanced analytics dashboard
- Team collaboration features
- Bulk operations improvements
- Custom fields and forms
- API webhooks

---

## [1.0.0] - 2025-12-01

### Added

#### Authentication & User Management
- Email and password authentication with bcrypt hashing (12 rounds)
- Google OAuth 2.0 integration with PKCE
- Microsoft OAuth 2.0 integration with PKCE
- JWT-based authentication with access and refresh tokens
- Email verification flow
- Multi-factor authentication (TOTP-based)
- Password reset functionality
- User profile management
- Account deletion with GDPR compliance

#### Onboarding
- 5-step onboarding wizard for new users
- Profile setup with avatar upload
- Workspace creation and configuration
- Import preferences selection
- Reminder frequency configuration
- AI preferences customization

#### Contact Management
- Full CRUD operations for contacts
- Rich contact profiles with 20+ fields (name, email, phone, company, job title, location, social media, notes, tags)
- Contact tags and categories
- Notes and interaction history
- Contact search and filtering
- Bulk operations (tag, delete, export)
- Contact deduplication and merging
- Import from CSV and VCF files

#### Integrations
- Google Contacts integration
  - One-click OAuth authentication
  - Import all or selected contacts
  - Bidirectional sync with conflict resolution
  - Incremental sync using sync tokens
  - Sync frequency options (manual, hourly, daily)
- Microsoft 365 integration
  - Outlook contacts import
  - Exchange server support
  - Corporate directory access
  - Calendar integration
  - Bidirectional sync
- Gmail integration
  - Email interaction tracking
  - Automatic contact creation from emails
  - Link emails to existing contacts
  - Metadata-only storage (no email content)
- Outlook integration
  - Email interaction tracking via Microsoft Graph API
  - Calendar event tracking
- Google Calendar integration
  - Automatic meeting tracking
  - Update last contact date from meetings
  - Suggest follow-ups after meetings
- Microsoft Calendar integration
  - Similar features to Google Calendar

#### AI Features
- AI-powered follow-up recommendations
- Relationship strength scoring
- Communication pattern analysis
- Contact prioritization
- Introduction suggestions
- Best time to reach out predictions
- Semantic search using pgvector
  - Natural language queries
  - Vector-based similarity search
  - Hybrid search combining keyword and semantic
- "Find similar contacts" functionality
- Relationship health monitoring
- Communication gap detection

#### Reminders & Follow-Ups
- Contact-specific reminder frequencies (weekly, bi-weekly, monthly, quarterly, custom)
- Follow-up queue with pending and overdue reminders
- Snooze functionality for reminders
- Quick action buttons for completing follow-ups
- Email and in-app notifications
- Customizable notification schedule
- Quiet hours support
- Reminder completion tracking

#### Dashboard
- Comprehensive overview widget
  - Total contacts, weekly/monthly growth
  - Pending and overdue follow-ups
  - Active integrations count
- AI recommendations widget (top 5 suggested actions)
- Activity timeline widget
- Quick stats widget (emails sent/received, meetings, new contacts)
- Follow-up queue widget
- Network health widget
- Customizable dashboard (drag-and-drop widgets, resize, show/hide)
- Quick actions (add contact, import, search)

#### Search & Discovery
- Keyword search across all contact fields
- Advanced filters (tags, company, location, last contact date, reminder status)
- Saved searches (smart lists)
- Semantic search with natural language queries
- Similar contacts finder
- Search within integration data

#### Settings & Configuration
- User profile settings
- Workspace settings
- Privacy settings (GDPR compliance)
- Notification preferences (email, in-app, push)
- Integration management
- Tag management
- Data export (JSON, CSV)
- Data deletion (GDPR right to erasure)

### Security

- AES-256-GCM encryption for sensitive PII fields
- TLS 1.3 for data in transit
- Row-Level Security (RLS) in PostgreSQL for multi-tenancy
- CSRF protection on all state-changing endpoints
- Input validation and sanitization
- Rate limiting (100 requests/minute/user)
- Security audit logging (7-year retention)
- OAuth 2.0 with PKCE flow
- Session management with Redis
- XSS protection
- SQL injection prevention via Prisma ORM
- Helmet.js security headers

### Performance

- Database query optimization with strategic indexes
- Connection pooling with PgBouncer (10 connections)
- Redis caching for frequent queries
- Lazy loading and pagination for large lists
- Image optimization and CDN support
- Server-side rendering with Next.js
- Code splitting and lazy loading
- API response compression
- Cursor-based pagination for efficiency
- Average API response time: p95 < 500ms, p99 < 1s

### Testing

- 211+ end-to-end tests using Playwright
- Unit tests with Jest (98%+ coverage)
- Integration tests for critical paths
- Automated CI/CD pipeline with GitHub Actions
- Performance testing
- Security testing
- Accessibility testing with axe-playwright
- Cross-browser testing (Chrome, Firefox, Safari, Edge)

### Infrastructure

- PostgreSQL 16 with pgvector extension
- Redis 7 for caching and session management
- NestJS backend (TypeScript)
- Next.js 14 frontend with App Router
- Prisma ORM for type-safe database access
- Docker support for local development
- Docker Compose for multi-service orchestration
- Prometheus metrics endpoint
- Sentry error tracking integration
- Health check endpoints
- Database migrations with Prisma
- Row-Level Security policies
- Database indexes and performance optimizations
- Automated backups (daily, 90-day retention)

### Documentation

- Comprehensive user guide (50+ pages)
- Quick start guide (5-minute setup)
- Admin guide for system administrators
- Developer guide for contributors
- API reference documentation
- Operations runbook
- Architecture decision records (ADRs)
- Security documentation
- GDPR compliance documentation
- Deployment documentation
- Testing documentation

### Compliance

- GDPR compliant
  - Data export (Subject Access Request)
  - Data deletion (Right to Erasure)
  - Data portability
  - Consent management
  - Cookie consent
  - 7-year audit log retention
- Privacy policy
- Terms of service
- Cookie policy
- EU data residency support

---

## [0.1.0] - 2025-11-01 (Internal Beta)

### Added

- Initial internal beta release
- Basic contact CRUD operations
- Google Contacts import (one-way)
- Simple dashboard
- Email/password authentication

### Changed

- N/A (initial release)

### Deprecated

- N/A (initial release)

### Removed

- N/A (initial release)

### Fixed

- N/A (initial release)

### Security

- Basic authentication with JWT
- Password hashing with bcrypt

---

## Version History

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** version: Incompatible API changes
- **MINOR** version: New functionality (backward compatible)
- **PATCH** version: Bug fixes (backward compatible)

### Release Schedule

- **Major releases**: Annually
- **Minor releases**: Quarterly
- **Patch releases**: As needed (security, critical bugs)

### Support Policy

- **Current version (1.x)**: Full support
- **Previous version (0.x)**: Security updates for 6 months
- **End of life**: Announced 90 days in advance

---

## Migration Guides

### Migrating to 1.0.0

This is the first public release. No migration needed.

### Future Migrations

Migration guides will be provided for each major version update.

---

## Links

- [Documentation](https://docs.personalnetworkcrm.com)
- [API Reference](/docs/api/API_REFERENCE.md)
- [GitHub Repository](https://github.com/dxheroes/pmcrm)
- [Issue Tracker](https://github.com/dxheroes/pmcrm/issues)
- [Release Notes](/docs/releases/)

---

**Note:** For detailed information about each release, see the corresponding release notes in `/docs/releases/`.

[Unreleased]: https://github.com/dxheroes/pmcrm/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/dxheroes/pmcrm/releases/tag/v1.0.0
[0.1.0]: https://github.com/dxheroes/pmcrm/releases/tag/v0.1.0
