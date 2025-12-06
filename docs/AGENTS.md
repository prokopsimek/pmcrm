# Documentation AGENTS.md

## Overview

Comprehensive documentation for the Personal Network CRM covering setup, development, operations, and user guides.

## Directory Structure

```
docs/
├── AGENTS.md                      # You are here
├── README.md                      # Documentation index
├── ONBOARDING.md                  # New developer onboarding
├── TESTING.md                     # Testing guide
├── admin/
│   └── ADMIN_GUIDE.md             # Administrator guide
├── adr/                           # Architecture Decision Records
│   ├── README.md
│   ├── 001-modular-monolith-architecture.md
│   └── 004-row-level-security-multi-tenancy.md
├── api/
│   ├── README.md
│   ├── API_REFERENCE.md           # REST API documentation
│   └── openapi.yaml               # OpenAPI specification
├── database/
│   └── schema.md                  # Database schema documentation
├── deployment/
│   └── README.md                  # Deployment procedures
├── developers/
│   └── DEVELOPER_GUIDE.md         # Development setup guide
├── gdpr/
│   └── compliance.md              # GDPR compliance docs
├── launch/
│   └── LAUNCH_CHECKLIST.md        # Production launch checklist
├── marketing/
│   ├── DEMO_VIDEO_SCRIPT.md       # Demo script
│   ├── FEATURE_COMPARISON.md      # Feature comparison
│   └── PRODUCT_DESCRIPTION.md     # Marketing copy
├── ops/
│   └── RUNBOOK.md                 # Operations runbook
├── quick-start/
│   └── QUICK_START.md             # Quick start guide
├── releases/
│   └── v1.0.0.md                  # Release notes
├── security/
│   └── README.md                  # Security documentation
└── user-guide/
    └── USER_GUIDE.md              # End-user documentation
```

## Document Categories

### For Developers

| Document | Purpose |
|----------|---------|
| [ONBOARDING.md](ONBOARDING.md) | New developer setup |
| [developers/DEVELOPER_GUIDE.md](developers/DEVELOPER_GUIDE.md) | Development workflow |
| [TESTING.md](TESTING.md) | Testing practices |
| [api/API_REFERENCE.md](api/API_REFERENCE.md) | API documentation |
| [database/schema.md](database/schema.md) | Database schema |

### For Operations

| Document | Purpose |
|----------|---------|
| [deployment/README.md](deployment/README.md) | Deployment guide |
| [ops/RUNBOOK.md](ops/RUNBOOK.md) | Incident response |
| [admin/ADMIN_GUIDE.md](admin/ADMIN_GUIDE.md) | Admin operations |
| [launch/LAUNCH_CHECKLIST.md](launch/LAUNCH_CHECKLIST.md) | Launch checklist |

### For Users

| Document | Purpose |
|----------|---------|
| [user-guide/USER_GUIDE.md](user-guide/USER_GUIDE.md) | End-user guide |
| [quick-start/QUICK_START.md](quick-start/QUICK_START.md) | Getting started |

### Architecture

| Document | Purpose |
|----------|---------|
| [adr/001-modular-monolith-architecture.md](adr/001-modular-monolith-architecture.md) | Architecture decision |
| [adr/004-row-level-security-multi-tenancy.md](adr/004-row-level-security-multi-tenancy.md) | RLS decision |

### Compliance

| Document | Purpose |
|----------|---------|
| [gdpr/compliance.md](gdpr/compliance.md) | GDPR compliance |
| [security/README.md](security/README.md) | Security practices |

## Key Documents

### Developer Guide

Reference: [developers/DEVELOPER_GUIDE.md](developers/DEVELOPER_GUIDE.md)

Covers:
- Local environment setup
- Development workflow
- Code conventions
- PR process

### API Reference

Reference: [api/API_REFERENCE.md](api/API_REFERENCE.md)

Covers:
- Authentication
- Endpoint documentation
- Request/response examples
- Error codes

OpenAPI spec: [api/openapi.yaml](api/openapi.yaml)

### Operations Runbook

Reference: [ops/RUNBOOK.md](ops/RUNBOOK.md)

Covers:
- Common incidents
- Troubleshooting steps
- Escalation procedures
- Recovery procedures

### Admin Guide

Reference: [admin/ADMIN_GUIDE.md](admin/ADMIN_GUIDE.md)

Covers:
- User management
- System configuration
- Monitoring
- Backup procedures

## Architecture Decision Records (ADRs)

ADRs document significant architecture decisions:

```
docs/adr/
├── README.md                      # ADR template and index
├── 001-modular-monolith-architecture.md
└── 004-row-level-security-multi-tenancy.md
```

### ADR Format

```markdown
# ADR-XXX: Title

## Status
Accepted | Proposed | Deprecated | Superseded

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult because of this change?
```

### Creating New ADRs

1. Copy template from `adr/README.md`
2. Create new file: `adr/XXX-short-title.md`
3. Fill in all sections
4. Submit for review

## Documentation Conventions

### File Naming

- Use `SCREAMING_SNAKE_CASE.md` for top-level docs
- Use `lowercase.md` for nested docs
- Use `kebab-case.md` for ADRs

### Structure

Each document should include:
1. Title (H1)
2. Overview section
3. Table of contents (for long docs)
4. Clear section headers

### Updates

- Keep docs in sync with code changes
- Add changelog entries for major features
- Update release notes for each version

## Quick Links

| What you need | Document |
|---------------|----------|
| Set up development environment | [developers/DEVELOPER_GUIDE.md](developers/DEVELOPER_GUIDE.md) |
| Understand the API | [api/API_REFERENCE.md](api/API_REFERENCE.md) |
| Deploy to production | [deployment/README.md](deployment/README.md) |
| Handle incidents | [ops/RUNBOOK.md](ops/RUNBOOK.md) |
| Learn the product | [user-guide/USER_GUIDE.md](user-guide/USER_GUIDE.md) |









