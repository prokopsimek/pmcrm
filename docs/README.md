# Personal Network CRM Documentation

Welcome to the Personal Network CRM documentation hub. This directory contains comprehensive documentation covering all aspects of the platform.

## Quick Links

### Getting Started
- [Project README](../README.md) - Project overview and quick start
- [Developer Onboarding](./ONBOARDING.md) - Complete onboarding guide for new developers
- [Contributing Guidelines](../CONTRIBUTING.md) - How to contribute to the project

### Architecture & Design
- [Architecture Decision Records (ADRs)](./adr/README.md) - Key architectural decisions
  - [ADR-001: Modular Monolith Architecture](./adr/001-modular-monolith-architecture.md)
  - [ADR-004: Row-Level Security for Multi-tenancy](./adr/004-row-level-security-multi-tenancy.md)
- [Database Schema](./database/schema.md) - Complete database documentation with ER diagrams

### API & Integration
- [API Documentation](./api/README.md) - REST API reference
- [OpenAPI Specification](./api/openapi.yaml) - Machine-readable API spec
- [Third-Party Integrations](../DEF.md#2-integrace---technické-možnosti-a-omezení) - Integration guides

### Security & Compliance
- [Security Documentation](./security/README.md) - Security practices and controls
  - Authentication & Authorization
  - Encryption (at rest and in transit)
  - OWASP Top 10 Mitigation
  - API Security
  - Audit Logging
- [GDPR Compliance](./gdpr/compliance.md) - GDPR compliance measures
  - Data Subject Rights
  - Consent Management
  - Data Retention Policies
  - EU Data Residency
  - Breach Response

### Operations
- [Deployment Guide](./deployment/README.md) - Deployment strategies and procedures
  - MVP Deployment (Vercel + Railway)
  - Production Deployment (Kubernetes)
  - CI/CD Pipelines
  - Monitoring & Observability
  - Disaster Recovery

## Documentation Structure

```
docs/
├── README.md                    # This file - Documentation hub
├── ONBOARDING.md               # Developer onboarding guide
├── adr/                        # Architecture Decision Records
│   ├── README.md
│   ├── 001-modular-monolith-architecture.md
│   └── 004-row-level-security-multi-tenancy.md
├── api/                        # API Documentation
│   ├── README.md
│   └── openapi.yaml
├── database/                   # Database Documentation
│   └── schema.md
├── gdpr/                       # GDPR Compliance
│   └── compliance.md
├── security/                   # Security Documentation
│   └── README.md
└── deployment/                 # Deployment Documentation
    └── README.md
```

## Documentation by Role

### For New Developers
1. Start with [Developer Onboarding](./ONBOARDING.md)
2. Read [Project README](../README.md)
3. Review [Contributing Guidelines](../CONTRIBUTING.md)
4. Study [Architecture Overview](./adr/001-modular-monolith-architecture.md)
5. Understand [Database Schema](./database/schema.md)

### For Backend Developers
1. [API Documentation](./api/README.md)
2. [Database Schema](./database/schema.md)
3. [Security Practices](./security/README.md)
4. [GDPR Implementation](./gdpr/compliance.md)
5. [Technical Specification](../DEF.md)

### For Frontend Developers
1. [API Documentation](./api/README.md)
2. [Authentication Flow](./security/README.md#authentication--authorization)
3. [Contributing Guidelines](../CONTRIBUTING.md)

### For DevOps Engineers
1. [Deployment Guide](./deployment/README.md)
2. [Security Documentation](./security/README.md)
3. [Database Schema](./database/schema.md)
4. [Monitoring Setup](./deployment/README.md#monitoring--observability)

### For Product Managers
1. [Technical Specification](../DEF.md)
2. [GDPR Compliance](./gdpr/compliance.md)
3. [API Documentation](./api/README.md)

### For Security Auditors
1. [Security Documentation](./security/README.md)
2. [GDPR Compliance](./gdpr/compliance.md)
3. [Architecture Decisions](./adr/README.md)
4. [Database Security](./database/schema.md#row-level-security-policies)

## Key Concepts

### Architecture
- **Modular Monolith**: Single deployment with clear module boundaries
- **Multi-Tenant**: Row-Level Security (RLS) for data isolation
- **Event-Driven**: Background jobs via BullMQ
- **API-First**: RESTful API with OpenAPI specification

### Technology Stack
- **Backend**: NestJS (TypeScript)
- **Frontend**: Next.js 14+ (App Router)
- **Database**: PostgreSQL 16+ with pgvector
- **Cache**: Redis (managed via Upstash)
- **Queue**: BullMQ (Redis-based)
- **AI/ML**: Claude API (Anthropic)

### Security
- **Authentication**: OAuth 2.0 + PKCE
- **Authorization**: Role-Based Access Control (RBAC)
- **Encryption**: AES-256-GCM at rest, TLS 1.3 in transit
- **Multi-Factor**: TOTP, WebAuthn/FIDO2

### Compliance
- **GDPR**: Full compliance with EU regulations
- **Data Residency**: EU data stored in EU regions
- **Audit Logging**: 7-year retention for compliance
- **SOC 2**: Planned certification

## Contributing to Documentation

Documentation is as important as code! When contributing:

1. **Keep it Current**: Update docs with code changes
2. **Be Clear**: Write for your audience (developer, ops, PM)
3. **Add Examples**: Code snippets and diagrams help
4. **Link Liberally**: Connect related documentation
5. **Version Control**: Document changes in git commits

### Documentation Standards

- **Markdown**: Use GitHub-flavored markdown
- **Code Blocks**: Include language hints for syntax highlighting
- **Diagrams**: Use Mermaid for diagrams
- **Screenshots**: Store in `docs/images/` directory
- **Links**: Use relative links for internal docs

### Adding New Documentation

1. Create file in appropriate directory
2. Update this README with link
3. Update relevant index files
4. Submit PR with documentation changes

## External Resources

### Official Documentation
- [NestJS Docs](https://docs.nestjs.com/)
- [Next.js Docs](https://nextjs.org/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Prisma Docs](https://www.prisma.io/docs/)

### Standards & Best Practices
- [REST API Guidelines](https://github.com/microsoft/api-guidelines)
- [OpenAPI Specification](https://swagger.io/specification/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GDPR Official Text](https://gdpr.eu/)

### Learning Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Clean Code](https://github.com/ryanmcdermott/clean-code-javascript)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)

## Getting Help

### Documentation Issues
If you find documentation that is:
- Outdated or incorrect
- Confusing or unclear
- Missing important information

Please:
1. Open a GitHub issue with label `documentation`
2. Or submit a PR with improvements
3. Or ask in #dev-team Slack channel

### Contact
- **Technical Questions**: #dev-help on Slack
- **Documentation Lead**: [Name] (@slack-handle)
- **Email**: docs@pmcrm.io

## Documentation Versioning

This documentation follows the main codebase version. Major changes are noted in:
- Git commit history
- CHANGELOG.md
- Release notes

**Current Version**: 1.0.0 (MVP)

**Last Updated**: 2025-01-15

**Next Review**: 2025-04-15 (Quarterly review cycle)

---

## Documentation Roadmap

### Planned Documentation

- [ ] Troubleshooting Guide
- [ ] Performance Optimization Guide
- [ ] Testing Best Practices
- [ ] Mobile App Development Guide
- [ ] AI/ML Pipeline Deep Dive
- [ ] Scaling Guide (10K+ users)
- [ ] Incident Response Runbooks
- [ ] Customer Support Playbook

### Documentation Metrics

We track documentation quality through:
- **Freshness**: How recently updated
- **Completeness**: Coverage of features
- **Clarity**: Feedback from developers
- **Accuracy**: Technical correctness

Help us improve by providing feedback!

---

**Happy Coding!**
