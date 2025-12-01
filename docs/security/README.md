# Security Documentation

## Overview

This directory contains comprehensive security documentation for the Personal Network CRM platform, covering authentication, authorization, encryption, vulnerability management, and compliance with security best practices.

## Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimum necessary access for all users and systems
3. **Zero Trust**: Never trust, always verify
4. **Security by Default**: Secure configurations out of the box
5. **Fail Secure**: System failures default to secure state

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Encryption](#encryption)
3. [API Security](#api-security)
4. [OWASP Top 10 Mitigation](#owasp-top-10-mitigation)
5. [Rate Limiting & DDoS Protection](#rate-limiting--ddos-protection)
6. [Audit Logging](#audit-logging)
7. [Vulnerability Management](#vulnerability-management)
8. [Incident Response](#incident-response)
9. [Security Testing](#security-testing)
10. [SOC 2 Compliance](#soc-2-compliance)

---

## Authentication & Authorization

### Authentication Flow

We use **OAuth 2.0 with PKCE** (Proof Key for Code Exchange) for secure authentication.

#### Authorization Code Flow with PKCE

```typescript
// 1. Generate code verifier and challenge
const codeVerifier = generateRandomString(128);
const codeChallenge = base64URLEncode(sha256(codeVerifier));

// 2. Authorization request
GET /auth/authorize?
  response_type=code&
  client_id=CLIENT_ID&
  redirect_uri=REDIRECT_URI&
  code_challenge=CODE_CHALLENGE&
  code_challenge_method=S256&
  scope=contacts:read contacts:write

// 3. Token exchange
POST /auth/token
{
  grant_type: "authorization_code",
  code: "AUTHORIZATION_CODE",
  redirect_uri: "REDIRECT_URI",
  client_id: "CLIENT_ID",
  code_verifier: "CODE_VERIFIER"
}
```

### Token Configuration

| Token Type | Algorithm | Expiry | Storage |
|------------|-----------|--------|---------|
| Access Token | RS256 (RSA) | 1 hour | Memory only |
| Refresh Token | HS256 (HMAC) | 30 days | HttpOnly cookie |
| ID Token | RS256 (RSA) | 1 hour | Memory only |

**Token Claims**:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "roles": ["user"],
  "tenant_id": "tenant-uuid",
  "iat": 1642345678,
  "exp": 1642349278,
  "iss": "https://pmcrm.io",
  "aud": "pmcrm-api"
}
```

### Multi-Factor Authentication (MFA)

#### Supported Methods

1. **TOTP (Time-based One-Time Password)** - Preferred
   - Authenticator apps: Google Authenticator, Authy, 1Password
   - Implementation: `speakeasy` library
   - Backup codes: 10 single-use codes

2. **WebAuthn/FIDO2** - Preferred
   - Hardware keys: YubiKey, Titan Security Key
   - Platform authenticators: Touch ID, Face ID, Windows Hello
   - Implementation: `@simplewebauthn/server`

3. **SMS** - Fallback only (discouraged)
   - Use only for account recovery
   - Clear warnings about SMS security risks

4. **Email OTP** - Low-risk operations
   - 6-digit code valid for 10 minutes
   - Rate limited to 3 attempts

#### MFA Enrollment Flow

```typescript
// 1. Generate TOTP secret
const secret = authenticator.generateSecret();

// 2. Generate QR code
const qrCode = await QRCode.toDataURL(
  authenticator.keyuri(user.email, 'PMCRM', secret)
);

// 3. Verify initial code
const verified = authenticator.verify({
  token: userProvidedCode,
  secret: secret,
});

// 4. Save to database (encrypted)
if (verified) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encrypt(secret),
      mfaEnabled: true,
    },
  });
}
```

### Role-Based Access Control (RBAC)

#### Roles and Permissions

```typescript
enum Role {
  OWNER = 'owner',       // Full access
  ADMIN = 'admin',       // Manage users & settings
  MEMBER = 'member',     // Standard access
  READONLY = 'readonly', // Read-only access
}

const PERMISSIONS = {
  [Role.OWNER]: ['*'],
  [Role.ADMIN]: [
    'users:manage',
    'settings:manage',
    'contacts:*',
    'integrations:manage',
    'billing:view',
  ],
  [Role.MEMBER]: [
    'contacts:read',
    'contacts:write',
    'contacts:delete:own',
    'interactions:*',
    'reminders:*',
  ],
  [Role.READONLY]: [
    'contacts:read',
    'interactions:read',
    'reports:view',
  ],
};
```

#### Permission Checking

```typescript
// Decorator for endpoint protection
@RequirePermission('contacts:write')
@Post('/contacts')
async createContact(@Body() dto: CreateContactDto) {
  // Implementation
}

// Permission guard
@Injectable()
export class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requiredPermission = this.reflector.get<string>(
      'permission',
      context.getHandler()
    );

    return this.hasPermission(user, requiredPermission);
  }

  private hasPermission(user: User, permission: string): boolean {
    const userPermissions = PERMISSIONS[user.role];

    // Wildcard permission
    if (userPermissions.includes('*')) return true;

    // Exact match
    if (userPermissions.includes(permission)) return true;

    // Wildcard domain (e.g., 'contacts:*')
    const domain = permission.split(':')[0];
    if (userPermissions.includes(`${domain}:*`)) return true;

    return false;
  }
}
```

---

## Encryption

### At Rest

**Application-Level Encryption (AES-256-GCM)**:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits

  encrypt(plaintext: string, key: Buffer): EncryptedData {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(data: EncryptedData, key: Buffer): string {
    const decipher = createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(data.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

**Encrypted Fields**:
- Email addresses
- Phone numbers
- Personal notes
- Integration tokens
- Custom PII fields

**Database-Level Encryption**:
- PostgreSQL TDE (Transparent Data Encryption)
- Encrypted storage volumes
- Encrypted backups

### In Transit

**TLS Configuration**:

```typescript
// NestJS with strict TLS settings
const httpsOptions = {
  minVersion: 'TLSv1.3',
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
  ].join(':'),
  honorCipherOrder: true,
};

// HSTS header
app.use(helmet.hsts({
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true,
}));
```

**Certificate Pinning (Mobile Apps)**:

```typescript
// React Native SSL pinning
import { fetch } from 'react-native-ssl-pinning';

const response = await fetch('https://api.pmcrm.io/contacts', {
  method: 'GET',
  sslPinning: {
    certs: ['api_pmcrm_io'], // Certificate in assets
  },
});
```

### Key Management

**AWS KMS Integration**:

```typescript
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';

export class KMSService {
  private kms = new KMSClient({ region: 'eu-central-1' });
  private masterKeyId = process.env.KMS_MASTER_KEY_ID;

  async generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: string }> {
    const command = new GenerateDataKeyCommand({
      KeyId: this.masterKeyId,
      KeySpec: 'AES_256',
    });

    const result = await this.kms.send(command);

    return {
      plaintext: Buffer.from(result.Plaintext),
      ciphertext: Buffer.from(result.CiphertextBlob).toString('base64'),
    };
  }

  async decryptDataKey(ciphertext: string): Promise<Buffer> {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(ciphertext, 'base64'),
    });

    const result = await this.kms.send(command);
    return Buffer.from(result.Plaintext);
  }
}
```

**Key Rotation**:
- Automatic rotation: Annually
- Manual rotation: On security incident
- Old keys retained for 30 days post-rotation

---

## API Security

### OWASP API Security Top 10 Mitigation

#### 1. Broken Object Level Authorization (BOLA)

**Mitigation**:

```typescript
// Always verify ownership
@Get('/contacts/:id')
async getContact(@Param('id') id: string, @User() user: UserEntity) {
  const contact = await this.contactsService.findOne(id);

  // CRITICAL: Verify user owns this contact
  if (contact.userId !== user.id) {
    throw new ForbiddenException();
  }

  return contact;
}

// Better: Use RLS to automatically enforce
@Get('/contacts/:id')
async getContact(@Param('id') id: string) {
  // RLS automatically filters by current_user_id
  return this.contactsService.findOne(id);
}
```

#### 2. Broken Authentication

**Mitigation**:
- OAuth 2.0 with PKCE
- MFA enforcement for sensitive operations
- Rate limiting on auth endpoints
- Account lockout after failed attempts

```typescript
@Throttle(5, 900) // 5 attempts per 15 minutes
@Post('/auth/login')
async login(@Body() credentials: LoginDto) {
  const user = await this.authService.validateUser(credentials);

  if (!user) {
    await this.recordFailedAttempt(credentials.email);
    throw new UnauthorizedException('Invalid credentials');
  }

  if (await this.isAccountLocked(credentials.email)) {
    throw new UnauthorizedException('Account locked due to multiple failed attempts');
  }

  return this.authService.login(user);
}
```

#### 3. Excessive Data Exposure

**Mitigation**:

```typescript
// Use DTOs to control response shape
export class ContactResponseDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  // Exclude sensitive fields
  // No: mfaSecret, encryptionKey, etc.
}

// Transform responses
@Get('/contacts')
async findAll(): Promise<ContactResponseDto[]> {
  const contacts = await this.contactsService.findAll();
  return plainToClass(ContactResponseDto, contacts, {
    excludeExtraneousValues: true,
  });
}
```

#### 4. Lack of Resources & Rate Limiting

**Mitigation**:

```typescript
const rateLimits = {
  // Standard endpoints
  default: {
    ttl: 60, // 1 minute
    limit: 100,
  },

  // Auth endpoints (stricter)
  auth: {
    ttl: 900, // 15 minutes
    limit: 5,
  },

  // AI endpoints (expensive)
  ai: {
    ttl: 60,
    limit: 10,
  },

  // By IP (unauthenticated)
  ip: {
    ttl: 60,
    limit: 20,
  },
};

// Implementation
@Injectable()
export class ThrottlerGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = request.user?.id || request.ip;

    const throttler = this.getThrottlerConfig(context);
    const { totalHits } = await this.storageService.increment(key, throttler.ttl);

    if (totalHits > throttler.limit) {
      throw new ThrottlerException();
    }

    return true;
  }
}
```

#### 5. Broken Function Level Authorization

**Mitigation**:

```typescript
// Enforce permissions at function level
@Delete('/users/:id')
@RequirePermission('users:delete')
async deleteUser(@Param('id') id: string, @User() user: UserEntity) {
  // Additional check: can't delete yourself
  if (id === user.id) {
    throw new BadRequestException('Cannot delete your own account');
  }

  // Additional check: can't delete owner
  const targetUser = await this.usersService.findOne(id);
  if (targetUser.role === Role.OWNER) {
    throw new ForbiddenException('Cannot delete account owner');
  }

  return this.usersService.delete(id);
}
```

#### 6. Mass Assignment

**Mitigation**:

```typescript
// Use explicit DTOs with validation
export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  firstName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Explicitly exclude dangerous fields
  // No: userId, createdAt, deletedAt
}

@Patch('/contacts/:id')
async update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
  // Only fields in DTO can be updated
  return this.contactsService.update(id, dto);
}
```

#### 7. Security Misconfiguration

**Mitigation Checklist**:

- [x] Error messages don't expose stack traces in production
- [x] CORS configured with specific origins
- [x] Security headers enabled (Helmet.js)
- [x] Unnecessary HTTP methods disabled
- [x] Directory listing disabled
- [x] Default passwords changed
- [x] Admin interfaces secured

```typescript
// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

// CORS
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
});
```

#### 8. Injection

**Mitigation**:

```typescript
// Use ORM with parameterized queries (Prisma)
// GOOD: Prisma automatically parameterizes
const contacts = await prisma.contact.findMany({
  where: {
    email: userInput, // Safe: parameterized
  },
});

// BAD: Raw SQL without parameterization
const contacts = await prisma.$queryRaw`
  SELECT * FROM contacts WHERE email = ${userInput}
`; // Vulnerable to SQL injection!

// GOOD: Parameterized raw query
const contacts = await prisma.$queryRaw`
  SELECT * FROM contacts WHERE email = ${Prisma.sql([userInput])}
`;

// Input validation
export class CreateContactDto {
  @IsString()
  @Matches(/^[a-zA-Z\s-']+$/)
  @MaxLength(255)
  firstName: string;

  @IsEmail()
  email: string;
}
```

#### 9. Improper Assets Management

**Mitigation**:

- [x] API versioning (`/api/v1/`)
- [x] Deprecated endpoints documented
- [x] Old API versions sunset schedule
- [x] Inventory of all API endpoints
- [x] Documentation always current

#### 10. Insufficient Logging & Monitoring

See [Audit Logging](#audit-logging) section below.

---

## Rate Limiting & DDoS Protection

### Application-Level Rate Limiting

```typescript
// Redis-based rate limiter
import { RateLimiterRedis } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 300, // Block for 5 minutes if exceeded
});

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const key = req.user?.id || req.ip;

    try {
      await rateLimiter.consume(key);
      next();
    } catch (error) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: error.msBeforeNext / 1000,
        },
      });
    }
  }
}
```

### DDoS Protection

**Infrastructure Layer**:
- Cloudflare DDoS protection
- Rate limiting at edge
- Bot detection and mitigation

**Application Layer**:
- Connection limits
- Payload size limits
- Slow HTTP attack protection

```typescript
// Payload size limits
app.use(express.json({ limit: '100kb' }));

// Timeout middleware
app.use(timeout('30s'));

// Slow HTTP protection
app.use(slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: 500,
}));
```

---

## Audit Logging

### Required Events

All security-sensitive events are logged:

```typescript
enum AuditEventType {
  // Authentication
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  LOGIN_FAILED = 'user.login.failed',
  MFA_ENABLED = 'user.mfa.enabled',
  MFA_DISABLED = 'user.mfa.disabled',
  PASSWORD_CHANGED = 'user.password.changed',

  // Data Access
  CONTACT_VIEWED = 'contact.viewed',
  CONTACT_EXPORTED = 'contact.exported',
  BULK_EXPORT = 'data.bulk_export',

  // Data Modification
  CONTACT_CREATED = 'contact.created',
  CONTACT_UPDATED = 'contact.updated',
  CONTACT_DELETED = 'contact.deleted',

  // GDPR
  DATA_ACCESS_REQUEST = 'gdpr.access_request',
  DATA_ERASURE_REQUEST = 'gdpr.erasure_request',
  CONSENT_GIVEN = 'gdpr.consent.given',
  CONSENT_WITHDRAWN = 'gdpr.consent.withdrawn',

  // Security
  PERMISSION_DENIED = 'security.permission_denied',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit',
  SUSPICIOUS_ACTIVITY = 'security.suspicious',
}
```

### Audit Log Implementation

```typescript
interface AuditLog {
  id: string;
  userId?: string;
  eventType: AuditEventType;
  resource?: string;
  resourceId?: string;
  action: string;
  outcome: 'success' | 'failure';
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

@Injectable()
export class AuditService {
  async log(event: Partial<AuditLog>): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        ...event,
        timestamp: new Date(),
      },
    });

    // Also send to centralized logging (e.g., Datadog, CloudWatch)
    this.logger.info('Audit event', event);
  }
}

// Usage example
@Post('/contacts')
async createContact(@Body() dto: CreateContactDto, @User() user: UserEntity) {
  const contact = await this.contactsService.create(dto, user.id);

  await this.auditService.log({
    userId: user.id,
    eventType: AuditEventType.CONTACT_CREATED,
    resource: 'contact',
    resourceId: contact.id,
    action: 'create',
    outcome: 'success',
    metadata: { contactEmail: contact.email },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return contact;
}
```

### Log Retention

- **Active logs**: 3 years in hot storage
- **Archived logs**: 4 years in cold storage
- **Total retention**: 7 years (compliance requirement)

---

## Vulnerability Management

### Dependency Scanning

```bash
# NPM audit
npm audit

# Automated scanning (GitHub Dependabot)
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
```

### Code Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # SAST (Static Application Security Testing)
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1

      # Dependency check
      - name: Run npm audit
        run: npm audit --audit-level=moderate

      # Secret scanning
      - name: TruffleHog
        uses: trufflesecurity/trufflehog@main
```

### Penetration Testing

- **Frequency**: Quarterly
- **Scope**: Full application + infrastructure
- **Provider**: Third-party security firm
- **Follow-up**: All findings remediated within SLA

---

## Security Testing

### Unit Tests

```typescript
describe('ContactsController - Security', () => {
  it('should prevent unauthorized access to other user contacts', async () => {
    const userA = createUser();
    const userB = createUser();

    const contactA = await createContact(userA);

    // User B tries to access User A's contact
    const response = await request(app)
      .get(`/contacts/${contactA.id}`)
      .set('Authorization', `Bearer ${userB.token}`);

    expect(response.status).toBe(403);
  });

  it('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE contacts; --";

    const response = await request(app)
      .post('/contacts')
      .send({ firstName: maliciousInput });

    expect(response.status).not.toBe(500);
    // Verify table still exists
    const contacts = await prisma.contact.findMany();
    expect(contacts).toBeDefined();
  });
});
```

### Integration Tests

```typescript
describe('Rate Limiting', () => {
  it('should rate limit excessive requests', async () => {
    const requests = [];

    // Send 150 requests (limit is 100)
    for (let i = 0; i < 150; i++) {
      requests.push(request(app).get('/contacts'));
    }

    const responses = await Promise.all(requests);

    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

---

## SOC 2 Compliance

### Security Controls

SOC 2 Type II requires demonstrating security controls over time (minimum 6 months).

#### Control Categories

1. **Security**: Protection against unauthorized access
2. **Availability**: System is available for operation and use
3. **Processing Integrity**: System processing is complete, valid, accurate
4. **Confidentiality**: Confidential information is protected
5. **Privacy**: Personal information is collected, used, retained, disclosed per privacy notice

#### Key Controls

| Control ID | Description | Implementation |
|------------|-------------|----------------|
| CC6.1 | Logical access controls | RBAC, MFA, SSO |
| CC6.6 | Encryption | AES-256, TLS 1.3 |
| CC7.2 | System monitoring | Audit logs, alerts |
| CC7.3 | Change management | PR reviews, staging env |
| CC8.1 | Vulnerability management | Dependency scanning, pen tests |

### Audit Preparation

**Evidence Collection**:
- Access logs and reviews
- Change management tickets
- Vulnerability scan reports
- Incident response records
- Vendor assessments (DPAs)
- Security training completion

---

## Incident Response

### Incident Response Plan

**Phases**:
1. **Preparation**: Tools, runbooks, training
2. **Detection & Analysis**: Monitoring, alerts
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threat
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Post-mortem

### Security Contacts

- **Security Team Email**: security@pmcrm.io
- **PGP Key**: [Link to public key]
- **Bug Bounty**: HackerOne program

### Responsible Disclosure

We welcome security researchers to report vulnerabilities responsibly:

1. Email security@pmcrm.io with details
2. Allow 90 days for remediation
3. Don't access user data beyond proof of concept
4. Eligible for bug bounty rewards

---

**Last Updated**: 2025-01-15

**Next Review**: 2025-04-15 (quarterly)
