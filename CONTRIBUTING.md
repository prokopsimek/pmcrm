# Contributing to Personal Network CRM

Thank you for your interest in contributing to Personal Network CRM! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing Requirements](#testing-requirements)
6. [Commit Guidelines](#commit-guidelines)
7. [Pull Request Process](#pull-request-process)
8. [Documentation](#documentation)
9. [Security](#security)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, gender, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

### Our Standards

**Positive behavior includes**:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes**:
- Harassment, trolling, or derogatory comments
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Violations of the Code of Conduct can be reported to conduct@pmcrm.io. All complaints will be reviewed and investigated.

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- Node.js 20.x or later
- PostgreSQL 16+ with pgvector extension
- Redis 7.x or later
- Git
- A GitHub account

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/pmcrm.git
cd pmcrm
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/dxheroes/pmcrm.git
```

### Environment Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Set up the database:

```bash
# Create database
createdb pmcrm_dev

# Install pgvector
psql pmcrm_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

4. Start development servers:

```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend

# Terminal 3: Redis
redis-server
```

---

## Development Workflow

### Branching Strategy

We use Git Flow branching model:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical production fixes
- `release/*` - Release preparation

### Creating a Feature Branch

```bash
# Update develop branch
git checkout develop
git pull upstream develop

# Create feature branch
git checkout -b feature/add-whatsapp-integration

# Make your changes...

# Push to your fork
git push origin feature/add-whatsapp-integration
```

### Branch Naming Convention

- `feature/short-description` - New features
- `bugfix/issue-number-description` - Bug fixes
- `hotfix/critical-issue-description` - Critical fixes
- `docs/what-is-documented` - Documentation updates
- `refactor/what-is-refactored` - Code refactoring
- `test/what-is-tested` - Test additions

**Examples**:
- `feature/whatsapp-integration`
- `bugfix/123-fix-contact-deletion`
- `docs/api-authentication`
- `refactor/contact-service`

---

## Coding Standards

### TypeScript Style Guide

We follow the [Airbnb TypeScript Style Guide](https://github.com/airbnb/javascript) with some modifications.

#### Key Principles

1. **Explicit Types**: Always use explicit types, avoid `any`

```typescript
// Good
function getUserById(id: string): Promise<User> {
  return this.prisma.user.findUnique({ where: { id } });
}

// Bad
function getUserById(id: any): Promise<any> {
  return this.prisma.user.findUnique({ where: { id } });
}
```

2. **Immutability**: Prefer `const` over `let`, never use `var`

```typescript
// Good
const users = await this.getUsers();
const activeUsers = users.filter(u => u.active);

// Bad
let users = await this.getUsers();
var activeUsers = users.filter(u => u.active);
```

3. **Async/Await**: Prefer async/await over promises

```typescript
// Good
async createContact(dto: CreateContactDto): Promise<Contact> {
  const contact = await this.prisma.contact.create({ data: dto });
  await this.auditService.log('contact.created', contact.id);
  return contact;
}

// Bad
createContact(dto: CreateContactDto): Promise<Contact> {
  return this.prisma.contact.create({ data: dto })
    .then(contact => {
      return this.auditService.log('contact.created', contact.id)
        .then(() => contact);
    });
}
```

4. **Error Handling**: Always handle errors appropriately

```typescript
// Good
async deleteContact(id: string): Promise<void> {
  try {
    await this.prisma.contact.delete({ where: { id } });
  } catch (error) {
    if (error.code === 'P2025') {
      throw new NotFoundException(`Contact ${id} not found`);
    }
    throw new InternalServerErrorException('Failed to delete contact');
  }
}

// Bad
async deleteContact(id: string): Promise<void> {
  await this.prisma.contact.delete({ where: { id } });
}
```

### Linting and Formatting

We use ESLint and Prettier for code quality:

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

**Pre-commit Hook**: Husky automatically runs linting and formatting on commit.

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| **Files** | kebab-case | `contact.service.ts` |
| **Classes** | PascalCase | `ContactService` |
| **Interfaces** | PascalCase (no I prefix) | `Contact`, `CreateContactDto` |
| **Functions** | camelCase | `getUserById()` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE` |
| **Enums** | PascalCase | `Role`, `ContactStatus` |
| **Type Aliases** | PascalCase | `UserId`, `ContactFilter` |

### Module Structure

Follow the modular monolith structure:

```
src/modules/contacts/
├── contacts.module.ts
├── contacts.controller.ts
├── contacts.service.ts
├── contacts.repository.ts
├── dto/
│   ├── create-contact.dto.ts
│   ├── update-contact.dto.ts
│   └── contact-response.dto.ts
├── entities/
│   └── contact.entity.ts
├── interfaces/
│   └── contact.interface.ts
└── tests/
    ├── contacts.controller.spec.ts
    └── contacts.service.spec.ts
```

---

## Testing Requirements

### Test Coverage

We require **minimum 80% code coverage** for all new code.

### Test Types

1. **Unit Tests**: Test individual functions/methods

```typescript
// contacts.service.spec.ts
describe('ContactsService', () => {
  describe('findOne', () => {
    it('should return a contact when found', async () => {
      const contact = { id: '123', firstName: 'John' };
      mockPrisma.contact.findUnique.mockResolvedValue(contact);

      const result = await service.findOne('123');

      expect(result).toEqual(contact);
      expect(mockPrisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.findOne('123')).rejects.toThrow(NotFoundException);
    });
  });
});
```

2. **Integration Tests**: Test API endpoints

```typescript
// contacts.e2e-spec.ts
describe('ContactsController (e2e)', () => {
  it('/contacts (POST)', () => {
    return request(app.getHttpServer())
      .post('/contacts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.firstName).toBe('John');
      });
  });
});
```

3. **E2E Tests**: Test complete user flows

### Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

### Test Requirements for PRs

- All tests must pass
- New features must have tests
- Bug fixes must include regression tests
- Coverage must not decrease

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no code change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

### Examples

```
feat(contacts): add WhatsApp integration

Implement WhatsApp Business API integration for sending messages
to contacts. Includes webhook handling for message status updates.

Closes #123
```

```
fix(auth): prevent token refresh race condition

Add mutex lock to token refresh to prevent multiple simultaneous
refresh attempts causing invalid token errors.

Fixes #456
```

```
docs(api): update authentication examples

Add examples for OAuth 2.0 flow and refresh token usage.
```

### Commit Message Rules

1. Use imperative mood ("add" not "added" or "adds")
2. First line max 72 characters
3. Body wrapped at 72 characters
4. Reference issues in footer
5. Breaking changes noted in footer with `BREAKING CHANGE:`

---

## Pull Request Process

### Before Submitting

1. **Update from upstream**:
```bash
git checkout develop
git pull upstream develop
git checkout your-feature-branch
git rebase develop
```

2. **Run all checks**:
```bash
npm run validate  # Runs lint, type-check, and tests
```

3. **Update documentation** if needed

4. **Add changelog entry** in `CHANGELOG.md`

### PR Template

When creating a PR, use this template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to break)
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added for new functionality
- [ ] All tests pass
- [ ] CHANGELOG.md updated
```

### Review Process

1. **Automated Checks**: All CI/CD checks must pass
2. **Code Review**: At least one approval required
3. **Testing**: Reviewer verifies tests are adequate
4. **Documentation**: Reviewer checks documentation updates

### Review Guidelines for Reviewers

- Be constructive and respectful
- Explain why, not just what
- Suggest alternatives
- Approve if changes are optional
- Request changes if issues must be fixed

### Merging

- Squash and merge for feature branches
- Merge commit for release branches
- Delete branch after merge

---

## Documentation

### When to Update Documentation

Update documentation when:
- Adding new features
- Changing APIs
- Modifying configuration
- Updating dependencies
- Changing deployment process

### Documentation Types

1. **Code Comments**: Explain complex logic

```typescript
/**
 * Calculate relationship strength based on interaction history.
 *
 * Uses weighted scoring algorithm:
 * - Recent interactions weighted higher
 * - Different interaction types have different weights
 * - Applies exponential decay for older interactions
 *
 * @param contactId - UUID of the contact
 * @param timeWindow - Number of days to consider (default 90)
 * @returns Relationship strength score (1-10)
 */
async calculateRelationshipStrength(
  contactId: string,
  timeWindow = 90
): Promise<number> {
  // Implementation
}
```

2. **API Documentation**: Update OpenAPI spec

3. **Architecture Decisions**: Create ADR for significant changes

4. **README Updates**: Keep setup instructions current

---

## Security

### Reporting Security Vulnerabilities

**DO NOT** create public issues for security vulnerabilities.

Instead, email security@pmcrm.io with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours.

### Security Guidelines

1. **Never commit secrets**: No API keys, passwords, or tokens
2. **Validate input**: All user input must be validated
3. **Use parameterized queries**: Prevent SQL injection
4. **Encrypt sensitive data**: PII must be encrypted
5. **Follow OWASP guidelines**: Check OWASP Top 10

### Security Checklist for PRs

- [ ] No hardcoded secrets
- [ ] Input validation implemented
- [ ] SQL injection prevented
- [ ] XSS prevention in place
- [ ] CSRF tokens used for state-changing operations
- [ ] Proper error handling (no stack traces leaked)
- [ ] Authentication/authorization checked

---

## Getting Help

### Resources

- **Documentation**: https://docs.pmcrm.io
- **API Reference**: https://api.pmcrm.io/docs
- **Discord**: https://discord.gg/pmcrm
- **Email**: developers@pmcrm.io

### Questions?

- **General Questions**: Discord #dev-help channel
- **Bug Reports**: GitHub Issues
- **Feature Requests**: GitHub Discussions
- **Security Issues**: security@pmcrm.io

---

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Annual contributor highlights

Thank you for contributing to Personal Network CRM!

---

**Last Updated**: 2025-01-15
