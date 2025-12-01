# API Documentation

This directory contains the complete API documentation for the Personal Network CRM platform.

## Table of Contents

1. [OpenAPI Specification](./openapi.yaml) - Complete API specification in OpenAPI 3.0 format
2. [Authentication](./authentication.md) - Authentication and authorization flows
3. [Rate Limiting](./rate-limiting.md) - API rate limits and quotas
4. [Error Handling](./errors.md) - Standard error responses
5. [Webhooks](./webhooks.md) - Webhook events and payloads
6. [Integrations](./integrations.md) - Third-party integration endpoints

## Quick Start

### Base URL

```
Development: http://localhost:3000/api/v1
Production: https://api.pmcrm.io/v1
```

### Authentication

All API requests require authentication via Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://api.pmcrm.io/v1/contacts
```

### Request/Response Format

All requests and responses use JSON format:

```http
Content-Type: application/json
Accept: application/json
```

## Core Resources

### Contacts

Manage personal and professional contacts.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/contacts` | GET | List all contacts |
| `/contacts` | POST | Create a new contact |
| `/contacts/:id` | GET | Get contact details |
| `/contacts/:id` | PATCH | Update contact |
| `/contacts/:id` | DELETE | Delete contact |
| `/contacts/:id/interactions` | GET | List contact interactions |
| `/contacts/:id/score` | GET | Get relationship score |

### Organizations

Manage companies and organizations.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/organizations` | GET | List organizations |
| `/organizations` | POST | Create organization |
| `/organizations/:id` | GET | Get organization details |
| `/organizations/:id` | PATCH | Update organization |
| `/organizations/:id/contacts` | GET | List organization contacts |

### Interactions

Track communication and meeting history.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/interactions` | GET | List interactions |
| `/interactions` | POST | Create interaction |
| `/interactions/:id` | GET | Get interaction details |
| `/interactions/:id` | PATCH | Update interaction |
| `/interactions/:id` | DELETE | Delete interaction |

### AI Recommendations

Get AI-powered networking insights.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ai/recommendations` | GET | Get networking recommendations |
| `/ai/insights` | GET | Get AI insights |
| `/ai/suggestions` | POST | Generate contact suggestions |
| `/ai/message-generator` | POST | Generate personalized message |

### Integrations

Manage third-party integrations.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/integrations/google/auth` | POST | Initiate Google OAuth |
| `/integrations/google/sync` | POST | Sync Google contacts |
| `/integrations/microsoft/auth` | POST | Initiate Microsoft OAuth |
| `/integrations/microsoft/sync` | POST | Sync Microsoft contacts |
| `/integrations/whatsapp/send` | POST | Send WhatsApp message |

## Example Requests

### Create a Contact

```bash
POST /api/v1/contacts
Content-Type: application/json
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "organizationId": "550e8400-e29b-41d4-a716-446655440000",
  "tags": ["client", "vip"],
  "customFields": {
    "birthday": "1990-05-15",
    "interests": ["AI", "SaaS"]
  }
}
```

Response:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "organizationId": "550e8400-e29b-41d4-a716-446655440000",
  "relationshipStrength": 5,
  "lastContactDate": null,
  "tags": ["client", "vip"],
  "customFields": {
    "birthday": "1990-05-15",
    "interests": ["AI", "SaaS"]
  },
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

### Get AI Recommendations

```bash
GET /api/v1/ai/recommendations?limit=10&priority=high
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Response:
```json
{
  "recommendations": [
    {
      "id": "rec-001",
      "contactId": "123e4567-e89b-12d3-a456-426614174000",
      "type": "reconnect",
      "priority": "high",
      "title": "Reconnect with John Doe",
      "description": "It's been 45 days since your last interaction. John recently changed jobs to TechCorp.",
      "suggestedAction": "Send a congratulations message about their new role",
      "triggers": [
        {
          "type": "job_change",
          "source": "linkedin",
          "data": {
            "newCompany": "TechCorp",
            "newTitle": "VP of Engineering"
          }
        },
        {
          "type": "time_decay",
          "daysSinceLastContact": 45
        }
      ],
      "confidenceScore": 0.92,
      "messageTemplate": {
        "subject": "Congratulations on your new role!",
        "body": "Hi John,\\n\\nI saw you recently joined TechCorp as VP of Engineering - congratulations!..."
      },
      "expiresAt": "2025-01-20T10:30:00Z",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 23,
    "hasMore": true
  }
}
```

### Sync Google Contacts

```bash
POST /api/v1/integrations/google/sync
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "incremental": true,
  "syncContacts": true,
  "syncCalendar": true,
  "syncEmail": false
}
```

Response:
```json
{
  "jobId": "job-abc123",
  "status": "processing",
  "message": "Sync job started. You'll receive a notification when complete.",
  "estimatedDuration": "2-5 minutes"
}
```

## Pagination

List endpoints support cursor-based pagination:

```bash
GET /api/v1/contacts?limit=50&cursor=eyJpZCI6IjEyMyJ9
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "limit": 50,
    "hasMore": true,
    "nextCursor": "eyJpZCI6IjE3MyJ9"
  }
}
```

## Filtering and Sorting

### Filtering

Use query parameters for filtering:

```bash
GET /api/v1/contacts?relationshipStrength[gte]=7&tags=vip,client
```

Supported operators:
- `eq` - Equal
- `ne` - Not equal
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `in` - In array
- `contains` - Contains string

### Sorting

Use the `sort` parameter:

```bash
GET /api/v1/contacts?sort=-lastContactDate,firstName
```

Prefix with `-` for descending order.

## Rate Limiting

See [Rate Limiting Documentation](./rate-limiting.md) for details.

Default limits:
- Authenticated users: 100 requests/minute
- Unauthenticated: 20 requests/minute
- AI endpoints: 10 requests/minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642345678
```

## Error Handling

See [Error Handling Documentation](./errors.md) for details.

All errors follow this format:
```json
{
  "error": {
    "code": "CONTACT_NOT_FOUND",
    "message": "Contact with id '123' not found",
    "statusCode": 404,
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "req-abc123",
    "details": {}
  }
}
```

## Webhooks

See [Webhooks Documentation](./webhooks.md) for details on event subscriptions.

## SDKs and Client Libraries

- **JavaScript/TypeScript**: `npm install @pmcrm/sdk`
- **Python**: `pip install pmcrm-sdk`
- **Go**: `go get github.com/pmcrm/go-sdk`

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:
- Development: http://localhost:3000/api/docs
- Production: https://api.pmcrm.io/docs
- YAML file: [openapi.yaml](./openapi.yaml)

## Support

For API support:
- Documentation: https://docs.pmcrm.io
- Email: api-support@pmcrm.io
- Discord: https://discord.gg/pmcrm
