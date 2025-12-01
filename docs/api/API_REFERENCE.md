# API Reference

**Personal Network CRM API v1.0**
**Base URL:** `https://api.personalnetworkcrm.com/api/v1`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Contacts](#contacts)
3. [Integrations](#integrations)
4. [Dashboard](#dashboard)
5. [Search](#search)
6. [AI Recommendations](#ai-recommendations)
7. [Reminders](#reminders)
8. [Users](#users)
9. [Teams](#teams)
10. [Error Codes](#error-codes)

---

## Authentication

All API requests (except login/register) require authentication via JWT Bearer token.

### POST /auth/login

Authenticate user with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

**Errors:**
- `401` - Invalid credentials
- `422` - Validation error

### POST /auth/refresh

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

### GET /auth/google

Initiate Google OAuth flow. Redirects to Google login page.

**Response:**
- Redirect to Google OAuth consent screen

### GET /auth/google/callback

Google OAuth callback endpoint.

**Query Parameters:**
- `code` - Authorization code from Google

**Response:**
- Redirect to frontend with tokens in URL

### GET /auth/microsoft

Initiate Microsoft OAuth flow.

### GET /auth/microsoft/callback

Microsoft OAuth callback endpoint.

---

## Contacts

### GET /contacts

List contacts with pagination and filtering.

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page
- `search` (string) - Search by name or email
- `tags` (string[]) - Filter by tags
- `workspaceId` (string) - Filter by workspace

**Request:**
```
GET /contacts?page=1&limit=20&search=John&tags=client,vip
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+1-555-0100",
      "company": "Acme Corp",
      "jobTitle": "CEO",
      "tags": ["client", "vip"],
      "lastContactedAt": "2025-11-29T10:00:00Z",
      "createdAt": "2025-01-15T08:00:00Z",
      "updatedAt": "2025-11-29T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 247,
    "totalPages": 13
  }
}
```

### GET /contacts/:id

Get contact by ID.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1-555-0100",
  "company": "Acme Corp",
  "jobTitle": "CEO",
  "location": "San Francisco, CA",
  "linkedin": "https://linkedin.com/in/johndoe",
  "twitter": "johndoe",
  "notes": "Met at conference 2024",
  "tags": ["client", "vip"],
  "reminderFrequency": "MONTHLY",
  "lastContactedAt": "2025-11-29T10:00:00Z",
  "createdAt": "2025-01-15T08:00:00Z",
  "updatedAt": "2025-11-29T10:00:00Z"
}
```

**Errors:**
- `404` - Contact not found
- `403` - Unauthorized access

### POST /contacts

Create a new contact.

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "+1-555-0200",
  "company": "TechCorp",
  "jobTitle": "VP of Engineering",
  "location": "New York, NY",
  "tags": ["investor", "hot-lead"],
  "reminderFrequency": "WEEKLY",
  "notes": "Interested in our product"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "createdAt": "2025-11-30T12:00:00Z"
}
```

**Errors:**
- `422` - Validation error
- `409` - Duplicate email

### PUT /contacts/:id

Update existing contact.

**Request:**
```json
{
  "jobTitle": "CEO",
  "company": "NewCorp",
  "tags": ["investor", "vip"]
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "firstName": "Jane",
  "lastName": "Smith",
  "jobTitle": "CEO",
  "company": "NewCorp",
  "updatedAt": "2025-11-30T12:30:00Z"
}
```

### DELETE /contacts/:id

Delete contact (soft delete).

**Response (204 No Content)**

**Errors:**
- `404` - Contact not found

---

## Integrations

### Google Contacts

#### POST /integrations/google-contacts/connect

Initiate Google Contacts OAuth flow.

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### POST /integrations/google-contacts/import

Import contacts from Google.

**Request:**
```json
{
  "importAll": true,
  "tags": ["google-import"],
  "deduplicateStrategy": "UPDATE"
}
```

**Response (202 Accepted):**
```json
{
  "jobId": "uuid",
  "status": "PENDING",
  "message": "Import job started"
}
```

#### GET /integrations/google-contacts/sync

Get sync status.

**Response (200 OK):**
```json
{
  "status": "SYNCING",
  "lastSyncAt": "2025-11-30T10:00:00Z",
  "contactsImported": 145,
  "contactsUpdated": 12,
  "errors": 0
}
```

### Microsoft 365

#### POST /integrations/microsoft-contacts/connect

Initiate Microsoft OAuth flow.

#### POST /integrations/microsoft-contacts/import

Import contacts from Microsoft 365.

**Request:**
```json
{
  "importAll": true,
  "folders": ["Contacts"],
  "tags": ["microsoft-import"]
}
```

#### GET /integrations/microsoft-contacts/sync

Get sync status.

### Email Sync

#### POST /integrations/email-sync/connect

Connect email account (Gmail or Outlook).

**Request:**
```json
{
  "provider": "GMAIL",
  "trackInteractions": true
}
```

#### GET /integrations/email-sync/interactions

Get email interactions for a contact.

**Query Parameters:**
- `contactId` (string, required)
- `page` (number)
- `limit` (number)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "subject": "Re: Partnership discussion",
      "sentAt": "2025-11-29T14:30:00Z",
      "from": "user@example.com",
      "to": "contact@example.com",
      "type": "SENT"
    }
  ],
  "meta": {
    "total": 45
  }
}
```

---

## Dashboard

### GET /dashboard/stats

Get dashboard statistics.

**Response (200 OK):**
```json
{
  "totalContacts": 247,
  "contactsAddedThisWeek": 12,
  "contactsAddedThisMonth": 45,
  "pendingFollowups": 18,
  "overdueFollowups": 3,
  "activeIntegrations": 3,
  "aiRecommendations": 5
}
```

### GET /dashboard/followups

Get pending follow-ups.

**Query Parameters:**
- `status` (string) - PENDING, OVERDUE, COMPLETED
- `limit` (number)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "contact": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "dueDate": "2025-11-30T00:00:00Z",
      "status": "PENDING",
      "reason": "No contact in 30 days",
      "priority": "HIGH"
    }
  ]
}
```

### GET /dashboard/recommendations

Get AI recommendations.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "REACH_OUT",
      "contact": {
        "id": "uuid",
        "name": "Sarah Chen"
      },
      "reason": "Haven't spoken in 87 days",
      "priority": "HIGH",
      "suggestedAction": "Schedule a call",
      "createdAt": "2025-11-30T08:00:00Z"
    }
  ]
}
```

### GET /dashboard/activity

Get recent activity timeline.

**Query Parameters:**
- `limit` (number, default: 50)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "CONTACT_ADDED",
      "description": "Added John Doe",
      "createdAt": "2025-11-30T10:00:00Z",
      "metadata": {
        "contactId": "uuid",
        "contactName": "John Doe"
      }
    }
  ]
}
```

---

## Search

### GET /search

Basic keyword search.

**Query Parameters:**
- `q` (string, required) - Search query
- `limit` (number)

**Response (200 OK):**
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "company": "Acme Corp",
      "score": 0.95
    }
  ]
}
```

### GET /search/semantic

Semantic search using natural language.

**Query Parameters:**
- `q` (string, required) - Natural language query
- `limit` (number, default: 20)

**Example:**
```
GET /search/semantic?q=investors I met in 2024 at conferences
```

**Response (200 OK):**
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "Jane Investor",
      "email": "jane@vc.com",
      "relevance": 0.92,
      "reason": "Met at TechCrunch Disrupt 2024, investor at XYZ Ventures"
    }
  ],
  "query": "investors I met in 2024 at conferences",
  "total": 8
}
```

### GET /search/hybrid

Hybrid search combining keyword and semantic.

### GET /search/contacts/:id/similar

Find similar contacts.

**Response (200 OK):**
```json
{
  "similar": [
    {
      "id": "uuid",
      "name": "Similar Contact",
      "similarity": 0.87,
      "reason": "Same industry and location"
    }
  ]
}
```

---

## AI Recommendations

### GET /ai/recommendations

Get all AI recommendations.

**Query Parameters:**
- `type` (string) - REACH_OUT, INTRODUCTION, FOLLOW_UP
- `priority` (string) - HIGH, MEDIUM, LOW
- `status` (string) - PENDING, DISMISSED, ACTED

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "REACH_OUT",
      "priority": "HIGH",
      "contact": {
        "id": "uuid",
        "name": "Alex Rodriguez"
      },
      "reason": "Relationship weakening - no contact in 90 days",
      "suggestedAction": "Send a check-in email",
      "confidence": 0.89,
      "createdAt": "2025-11-30T06:00:00Z"
    }
  ]
}
```

### POST /ai/recommendations/:id/dismiss

Dismiss a recommendation.

**Request:**
```json
{
  "reason": "ALREADY_CONTACTED"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "DISMISSED"
}
```

### POST /ai/recommendations/:id/snooze

Snooze recommendation.

**Request:**
```json
{
  "snoozeUntil": "2025-12-07T00:00:00Z",
  "reason": "Will contact next week"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "SNOOZED",
  "snoozeUntil": "2025-12-07T00:00:00Z"
}
```

### POST /ai/recommendations/:id/feedback

Provide feedback on recommendation.

**Request:**
```json
{
  "rating": 5,
  "helpful": true,
  "comment": "Great suggestion!"
}
```

**Response (201 Created):**
```json
{
  "message": "Feedback recorded. Thank you!"
}
```

---

## Reminders

### GET /reminders

Get all reminders.

**Query Parameters:**
- `status` (string) - PENDING, COMPLETED, SNOOZED
- `dueDate` (string) - Filter by due date

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "contact": {
        "id": "uuid",
        "name": "John Doe"
      },
      "dueDate": "2025-12-01T00:00:00Z",
      "frequency": "MONTHLY",
      "status": "PENDING",
      "notes": "Follow up on project"
    }
  ]
}
```

### POST /reminders

Create a reminder.

**Request:**
```json
{
  "contactId": "uuid",
  "dueDate": "2025-12-05T00:00:00Z",
  "frequency": "WEEKLY",
  "notes": "Check in about partnership"
}
```

### PUT /reminders/:id/complete

Mark reminder as complete.

**Request:**
```json
{
  "notes": "Called and discussed next steps"
}
```

### POST /reminders/:id/snooze

Snooze a reminder.

**Request:**
```json
{
  "snoozeUntil": "2025-12-03T00:00:00Z"
}
```

---

## Users

### GET /users/me

Get current user profile.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "USER",
  "mfaEnabled": true,
  "emailVerified": true,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### PUT /users/me

Update user profile.

**Request:**
```json
{
  "name": "John Smith",
  "jobTitle": "CEO",
  "company": "Startup Inc"
}
```

### POST /users/me/change-password

Change password.

**Request:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

### GET /users/me/export

Export user data (GDPR).

**Response (200 OK):**
```json
{
  "user": {...},
  "contacts": [...],
  "integrations": [...],
  "auditLogs": [...]
}
```

---

## Teams

### POST /teams/invite

Invite team member.

**Request:**
```json
{
  "email": "teammate@example.com",
  "role": "TEAM_MEMBER"
}
```

### GET /teams/members

List team members.

### DELETE /teams/members/:id

Remove team member.

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 204 | No Content - Request successful, no content to return |
| 400 | Bad Request - Invalid request format |
| 401 | Unauthorized - Authentication required or failed |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation errors |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Service temporarily unavailable |

### Error Response Format

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2025-11-30T12:00:00Z",
  "path": "/api/v1/contacts"
}
```

---

## Rate Limiting

- **Default:** 100 requests per minute per user
- **Burst:** 200 requests per minute (short bursts allowed)
- **Headers:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Pagination

List endpoints support cursor-based pagination:

**Request:**
```
GET /contacts?page=1&limit=20
```

**Response Headers:**
```
X-Total-Count: 247
X-Page: 1
X-Per-Page: 20
X-Total-Pages: 13
```

---

**API Version:** 1.0.0
**Last Updated:** November 30, 2025

For questions or issues, contact: api-support@personalnetworkcrm.com
