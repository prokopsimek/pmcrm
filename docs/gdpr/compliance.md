# GDPR Compliance Documentation

## Overview

This document outlines Personal Network CRM's compliance with the General Data Protection Regulation (GDPR) EU 2016/679. As a SaaS platform handling personal data of EU residents, we implement comprehensive measures to ensure full compliance.

## Table of Contents

1. [Legal Basis for Processing](#legal-basis-for-processing)
2. [Data Subject Rights](#data-subject-rights)
3. [Consent Management](#consent-management)
4. [Data Retention Policies](#data-retention-policies)
5. [Data Encryption](#data-encryption)
6. [EU Data Residency](#eu-data-residency)
7. [Data Breach Response](#data-breach-response)
8. [Privacy by Design](#privacy-by-design)
9. [Third-Party Processors](#third-party-processors)
10. [Compliance Checklist](#compliance-checklist)

---

## Legal Basis for Processing

Per GDPR Article 6, we process personal data under the following legal bases:

### Legitimate Interest (Article 6(1)(f))

**Use Case**: Processing business contact information for relationship management

**Legitimate Interest Assessment (LIA)**:
- **Purpose**: Enable users to manage business relationships effectively
- **Necessity**: Essential for the core functionality of the CRM
- **Balancing Test**:
  - User's interest: Business relationship management
  - Data subject's rights: Business contacts reasonably expect such processing
  - Mitigation: Data subjects can request deletion at any time

**Documentation**: LIA documented and reviewed annually

### Consent (Article 6(1)(a))

**Use Case**: Processing requiring explicit consent

**Scenarios**:
- Importing contacts from third-party services (LinkedIn, Google, Microsoft)
- AI processing of contact data for recommendations
- Marketing communications
- Data enrichment from third-party providers

**Requirements**:
- Freely given
- Specific and informed
- Unambiguous affirmative action
- Easily withdrawable

---

## Data Subject Rights

We implement all GDPR data subject rights with automated and manual processes.

### Right to Access (Article 15)

**Response Time**: Within 1 month of request

**Implementation**:

```typescript
// API Endpoint: GET /api/v1/gdpr/data-export
async exportPersonalData(userId: string): Promise<DataExport> {
  return {
    personalData: {
      profile: await this.getUserProfile(userId),
      contacts: await this.getUserContacts(userId),
      interactions: await this.getUserInteractions(userId),
      preferences: await this.getUserPreferences(userId),
    },
    processingInfo: {
      purposes: ['Relationship management', 'AI recommendations'],
      legalBasis: 'Legitimate interest + Consent',
      retentionPeriod: '2 years from last activity',
      recipients: ['Cloud providers (AWS/GCP)', 'AI providers (Anthropic)'],
    },
    format: 'JSON', // Also available: CSV, PDF
  };
}
```

**Delivery Format**: Machine-readable JSON, optionally CSV or PDF

### Right to Erasure (Article 17)

**Response Time**: Within 48 hours of request

**Implementation Strategy**:

| Data Category | Deletion Approach | Timeline | Backup Handling |
|---------------|-------------------|----------|-----------------|
| User Profile | Hard delete | Immediate | Mark for exclusion |
| Contacts | Cascade delete | 24-48 hours | Mark for exclusion |
| Interactions | Cascade delete | 24-48 hours | Mark for exclusion |
| Audit Logs | Anonymize | 30 days | Retain anonymized |
| AI Models | Retrain without data | Next training cycle | N/A |
| Backups | Tombstone marking | Immediate | Exclude from restores |

**Deletion Workflow**:

```typescript
async executeRightToErasure(userId: string): Promise<void> {
  // 1. Create deletion request record
  const request = await this.createDeletionRequest(userId);

  // 2. Mark all user data for deletion
  await this.markForDeletion(userId);

  // 3. Queue background job for hard deletion
  await this.queueDeletionJob(userId, {
    priority: 'high',
    delay: 0,
  });

  // 4. Anonymize audit logs
  await this.anonymizeAuditLogs(userId);

  // 5. Mark backups with tombstone
  await this.markBackupTombstone(userId);

  // 6. Notify user
  await this.sendDeletionConfirmation(request.email);
}
```

**Exceptions**: We may retain data when:
- Legal obligation requires retention (e.g., financial records for 7 years)
- Legal claims may be established, exercised, or defended
- Data is fully anonymized

### Right to Rectification (Article 16)

**Response Time**: Within 1 month

**Implementation**: Standard update APIs with audit logging

### Right to Data Portability (Article 20)

**Response Time**: Within 1 month

**Supported Formats**:
- JSON (complete data export)
- CSV (contacts and interactions)
- vCard (contact export compatible with other CRMs)

```typescript
async exportPortableData(userId: string, format: 'json' | 'csv' | 'vcard'): Promise<Buffer> {
  const data = await this.getUserData(userId);

  switch (format) {
    case 'json':
      return this.formatAsJSON(data);
    case 'csv':
      return this.formatAsCSV(data);
    case 'vcard':
      return this.formatAsVCard(data.contacts);
  }
}
```

### Right to Restriction of Processing (Article 18)

**Implementation**:

```typescript
async restrictProcessing(userId: string, scope: RestrictionScope): Promise<void> {
  await this.prisma.user.update({
    where: { id: userId },
    data: {
      processingRestricted: true,
      restrictionScope: scope, // 'all' | 'ai' | 'enrichment'
      restrictionDate: new Date(),
    },
  });

  // Disable restricted processing
  if (scope.includes('ai')) {
    await this.disableAIProcessing(userId);
  }
  if (scope.includes('enrichment')) {
    await this.disableEnrichment(userId);
  }
}
```

### Right to Object (Article 21)

**Implementation**: Users can object to specific processing activities

**Objection Form**:
```typescript
interface ProcessingObjection {
  userId: string;
  processingType: 'ai' | 'enrichment' | 'marketing' | 'profiling';
  reason?: string;
  timestamp: Date;
}
```

---

## Consent Management

### Consent Requirements

**GDPR-Compliant Consent**:
- ✅ Freely given (no bundled consent)
- ✅ Specific (separate consent per purpose)
- ✅ Informed (clear explanation)
- ✅ Unambiguous (affirmative action)
- ✅ Withdrawable (same ease as giving)

### Consent Granularity

```typescript
interface UserConsent {
  userId: string;
  consents: {
    // Required for account
    termsOfService: {
      given: boolean;
      version: string;
      timestamp: Date;
    };
    privacyPolicy: {
      given: boolean;
      version: string;
      timestamp: Date;
    };

    // Optional features
    googleContactsImport: {
      given: boolean;
      timestamp?: Date;
      withdrawnAt?: Date;
    };
    microsoftContactsImport: {
      given: boolean;
      timestamp?: Date;
      withdrawnAt?: Date;
    };
    aiRecommendations: {
      given: boolean;
      timestamp?: Date;
      withdrawnAt?: Date;
    };
    dataEnrichment: {
      given: boolean;
      timestamp?: Date;
      withdrawnAt?: Date;
    };

    // Marketing
    marketingEmails: {
      given: boolean;
      timestamp?: Date;
      withdrawnAt?: Date;
    };
  };
}
```

### Consent Collection UI

**Best Practices**:
1. **Granular Checkboxes**: Separate checkbox per purpose
2. **Clear Language**: Plain language explanations
3. **No Pre-Ticked Boxes**: User must actively opt-in
4. **Withdrawal Prominence**: Withdrawal as easy as giving consent
5. **Audit Trail**: Log all consent events with timestamps

**Example Consent Flow**:
```typescript
// Frontend component
<ConsentForm>
  <ConsentCheckbox
    name="googleContactsImport"
    required={false}
    label="Import contacts from Google"
    description="We'll sync your Google contacts to help manage your network. You can disconnect anytime."
    onChange={(granted) => updateConsent('googleContactsImport', granted)}
  />

  <ConsentCheckbox
    name="aiRecommendations"
    required={false}
    label="Enable AI-powered recommendations"
    description="Our AI will analyze your network to suggest who to contact and when. We use Anthropic Claude API."
    onChange={(granted) => updateConsent('aiRecommendations', granted)}
  />
</ConsentForm>
```

### Consent Withdrawal

**Implementation**:
```typescript
async withdrawConsent(userId: string, consentType: string): Promise<void> {
  // 1. Record withdrawal
  await this.prisma.consent.update({
    where: { userId_type: { userId, type: consentType } },
    data: {
      withdrawn: true,
      withdrawnAt: new Date(),
    },
  });

  // 2. Stop related processing
  switch (consentType) {
    case 'aiRecommendations':
      await this.disableAIProcessing(userId);
      break;
    case 'dataEnrichment':
      await this.stopEnrichmentJobs(userId);
      break;
    case 'googleContactsImport':
      await this.disconnectGoogleIntegration(userId);
      break;
  }

  // 3. Notify user
  await this.sendWithdrawalConfirmation(userId, consentType);
}
```

---

## Data Retention Policies

### Retention Schedule

| Data Category | Active Retention | Archive Period | Deletion |
|---------------|------------------|----------------|----------|
| **Active Contacts** | While account active | 90 days after deletion | After archive |
| **Inactive Contacts** | 2 years from last interaction | 90 days | After archive |
| **Interactions** | While contact active | 90 days after contact deletion | After archive |
| **AI Insights** | 90 days from creation | N/A | After 90 days |
| **Audit Logs** | 3 years | +4 years archived | 7 years total |
| **Consent Records** | Duration + 7 years | N/A | After 7 years |
| **Backups** | 30 days | N/A | After 30 days |
| **Deleted User Data** | 90 days (recovery window) | N/A | After 90 days |

### Automated Cleanup Jobs

```typescript
// Scheduled jobs for data retention
@Cron('0 2 * * *') // 2 AM daily
async cleanupExpiredData(): Promise<void> {
  // 1. Delete old AI insights
  await this.prisma.aiInsight.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  // 2. Archive old interactions
  await this.archiveOldInteractions();

  // 3. Delete inactive contacts
  await this.deleteInactiveContacts();

  // 4. Anonymize old audit logs
  await this.anonymizeOldAuditLogs();
}

async deleteInactiveContacts(): Promise<void> {
  const twoYearsAgo = subYears(new Date(), 2);

  await this.prisma.contact.updateMany({
    where: {
      lastContactDate: { lt: twoYearsAgo },
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}
```

---

## Data Encryption

### Encryption at Rest

**Application-Level Encryption**:
```typescript
// PII fields encrypted with AES-256-GCM
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    this.key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    });
  }

  decrypt(ciphertext: string): string {
    const { encrypted, iv, authTag } = JSON.parse(ciphertext);

    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

**Encrypted Fields**:
- Email addresses
- Phone numbers
- LinkedIn URLs
- Custom fields containing PII
- Interaction summaries

**Database-Level Encryption**:
- PostgreSQL Transparent Data Encryption (TDE)
- Encrypted storage volumes (AWS EBS encryption, GCP persistent disk encryption)
- Encrypted backups with separate keys

### Encryption in Transit

**Requirements**:
- TLS 1.3 minimum for all connections
- HSTS header enforced
- Certificate pinning for mobile apps
- No support for older TLS versions

**Configuration**:
```typescript
// NestJS main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    httpsOptions: {
      minVersion: 'TLSv1.3',
    },
  });

  // HSTS header
  app.use(helmet.hsts({
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  }));

  await app.listen(3000);
}
```

### Key Management

**Strategy**: AWS KMS or HashiCorp Vault

**Key Rotation**:
- Automatic annual rotation
- Separate keys per environment
- Versioned keys for backward compatibility

```typescript
// Key rotation process
async rotateEncryptionKeys(): Promise<void> {
  // 1. Generate new key version
  const newKey = await this.kms.generateKey();

  // 2. Re-encrypt data with new key
  const records = await this.prisma.contact.findMany();

  for (const record of records) {
    const decrypted = await this.decrypt(record.email, oldKey);
    const reencrypted = await this.encrypt(decrypted, newKey);

    await this.prisma.contact.update({
      where: { id: record.id },
      data: {
        email: reencrypted,
        keyVersion: newKey.version,
      },
    });
  }

  // 3. Mark old key for deprecation
  await this.kms.scheduleKeyDeletion(oldKey, 30);
}
```

---

## EU Data Residency

### Requirements

**GDPR Mandate**: Personal data of EU residents must be stored in EU data centers.

### Infrastructure Strategy

**Recommended EU Regions**:

| Provider | Regions | Location |
|----------|---------|----------|
| **GCP** | europe-west1 | Belgium |
| **GCP** | europe-west3 | Frankfurt, Germany |
| **AWS** | eu-central-1 | Frankfurt, Germany |
| **AWS** | eu-west-1 | Ireland |
| **Hetzner** | FSN1, NBG1 | Germany (100% EU) |

### Data Flow Controls

```typescript
// Ensure EU data stays in EU
class DataResidencyService {
  async storeUserData(user: User, data: any): Promise<void> {
    const region = this.determineRegion(user);

    if (region === 'EU') {
      // Store in EU database
      await this.euDatabase.insert(data);
    } else {
      // Store in US database
      await this.usDatabase.insert(data);
    }
  }

  private determineRegion(user: User): 'EU' | 'US' {
    // Determine based on user's country or explicit choice
    const euCountries = ['DE', 'FR', 'IT', 'ES', /* ... */];
    return euCountries.includes(user.country) ? 'EU' : 'US';
  }
}
```

### Standard Contractual Clauses (SCCs)

For US-based subprocessors (e.g., Anthropic, OpenAI):

**Required Documents**:
1. ✅ SCCs signed with all US data processors
2. ✅ Data Processing Addendum (DPA)
3. ✅ Transfer Impact Assessment (TIA)
4. ✅ Security measures documented

**Subprocessor List**:
| Processor | Purpose | Location | SCC Status |
|-----------|---------|----------|------------|
| Anthropic | AI/LLM | US | ✅ Signed |
| OpenAI | AI/LLM | US | ✅ Signed |
| Neon/Supabase | Database | EU | N/A (EU-based) |
| Vercel | Hosting | EU | N/A (EU region) |

---

## Data Breach Response

### Incident Response Plan

**Timeline**:
- **0-24 hours**: Detection and containment
- **24-72 hours**: Notification to supervisory authority (if required)
- **72+ hours**: Notification to affected data subjects (if high risk)

### Breach Detection

**Monitoring**:
```typescript
// Security monitoring
class BreachDetectionService {
  @Cron('*/5 * * * *') // Every 5 minutes
  async monitorForBreaches(): Promise<void> {
    // 1. Unusual access patterns
    const suspiciousAccess = await this.detectSuspiciousAccess();

    // 2. Failed authentication attempts
    const bruteForce = await this.detectBruteForce();

    // 3. Unauthorized data access
    const unauthorizedAccess = await this.detectUnauthorizedAccess();

    if (suspiciousAccess || bruteForce || unauthorizedAccess) {
      await this.triggerIncidentResponse();
    }
  }
}
```

### Notification Process

**Supervisory Authority Notification** (within 72 hours):

```typescript
interface BreachNotification {
  // Required by GDPR Article 33
  natureOfBreach: string;
  categoriesOfDataSubjects: string[];
  approximateNumberAffected: number;
  categoriesOfData: string[];
  likelyConsequences: string;
  measuresTaken: string;
  contactPoint: {
    name: string;
    email: string;
    phone: string;
  };
}
```

**Data Subject Notification** (if high risk):

```typescript
async notifyAffectedUsers(breachId: string): Promise<void> {
  const breach = await this.getBreach(breachId);
  const affectedUsers = await this.getAffectedUsers(breach);

  for (const user of affectedUsers) {
    await this.emailService.send({
      to: user.email,
      subject: 'Important: Security Incident Notification',
      template: 'breach-notification',
      data: {
        userName: user.name,
        natureOfBreach: breach.description,
        dataAffected: breach.affectedDataTypes,
        steps: breach.recommendedActions,
        supportContact: 'privacy@pmcrm.io',
      },
    });
  }
}
```

---

## Privacy by Design

### Principles

1. **Data Minimization**: Collect only necessary data
2. **Purpose Limitation**: Use data only for stated purposes
3. **Storage Limitation**: Retain data only as long as needed
4. **Accuracy**: Ensure data is accurate and up-to-date
5. **Confidentiality**: Protect data with appropriate security
6. **Transparency**: Clear privacy notices and policies

### Implementation Examples

**Data Minimization**:
```typescript
// Only collect necessary fields
interface ContactInput {
  firstName: string; // Required
  lastName?: string; // Optional
  email?: string; // Optional
  // No SSN, religion, health data, etc.
}
```

**Purpose Limitation**:
```typescript
// Tag data with processing purposes
interface ProcessingPurpose {
  purpose: 'relationship_management' | 'ai_recommendations' | 'analytics';
  legalBasis: 'consent' | 'legitimate_interest';
  consentGiven?: boolean;
  consentTimestamp?: Date;
}
```

---

## Third-Party Processors

### Data Processing Agreement (DPA)

All third-party processors must sign DPA covering:

1. ✅ Processing scope and duration
2. ✅ Nature and purpose of processing
3. ✅ Types of personal data
4. ✅ Categories of data subjects
5. ✅ Processor obligations and rights
6. ✅ Subprocessor requirements
7. ✅ Data subject rights assistance
8. ✅ Security measures
9. ✅ Breach notification
10. ✅ Deletion obligations

### Subprocessor Register

| Subprocessor | Service | Data Processed | Location | DPA Status |
|--------------|---------|----------------|----------|------------|
| Anthropic | LLM API | Contact data, message content | US | ✅ Signed |
| OpenAI | LLM API | Contact data, message content | US | ✅ Signed |
| Apollo.io | Enrichment | Email, LinkedIn URL | US | ✅ Signed |
| Neon | Database | All user data | EU | ✅ Signed |
| Vercel | Hosting | Frontend assets | EU | ✅ Signed |
| Upstash | Cache | Session data | EU | ✅ Signed |

---

## Compliance Checklist

### Pre-Launch

- [x] Privacy Policy published
- [x] Terms of Service published
- [x] Cookie Policy published
- [x] Consent management implemented
- [x] Data subject rights API endpoints
- [x] Encryption at rest and in transit
- [x] EU data residency configured
- [x] RLS policies enabled
- [x] Audit logging implemented
- [x] Data retention policies automated
- [x] DPAs signed with processors
- [ ] Data Protection Impact Assessment (DPIA) completed
- [ ] Privacy by Design review conducted
- [ ] Staff GDPR training completed

### Ongoing

- [ ] Quarterly security audits
- [ ] Annual privacy policy review
- [ ] Biannual data mapping exercise
- [ ] Quarterly breach simulation drills
- [ ] Annual DPA review with processors
- [ ] Continuous consent record audits

---

## Contact

**Data Protection Officer (DPO)**:
- Email: dpo@pmcrm.io
- Phone: +49 (0) 123 456 7890
- Address: [Physical EU address]

**Supervisory Authority**:
- Germany: BfDI (Bundesbeauftragte für den Datenschutz und die Informationsfreiheit)
- Website: https://www.bfdi.bund.de

---

**Last Updated**: 2025-01-15

**Next Review**: 2025-07-15 (6 months)
