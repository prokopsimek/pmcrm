# Search Module

**Personal Network CRM - Intelligent Contact Search System**

Full-text search implementation with AI-powered semantic search using PostgreSQL tsvector, pgvector, and OpenAI embeddings.

## Features

### ✅ Full-Text Search
- **Full-text search** using PostgreSQL tsvector and GIN indexes
- **Fuzzy search** with typo tolerance using pg_trgm
- **Result highlighting** with matched term markup
- **Relevance ranking** based on multiple factors
- **Search history** tracking for recent queries
- **Performance optimized** (< 100ms response time)

### ✅ Semantic Search (US-060 - Sprint 2)
- **AI-powered vector similarity** using pgvector extension
- **Natural language queries** ("software engineers in Prague")
- **Context-aware matching** beyond keyword search
- **OpenAI embeddings** (text-embedding-ada-002, 1536 dimensions)
- **Hybrid search** combining full-text + semantic
- **Similar contacts discovery** using vector similarity

> 📖 **Comprehensive Documentation**: See [SEMANTIC_SEARCH_IMPLEMENTATION.md](./SEMANTIC_SEARCH_IMPLEMENTATION.md) and [SEMANTIC_SEARCH_QUICKSTART.md](./SEMANTIC_SEARCH_QUICKSTART.md)

## Architecture

```
SearchModule
├── SearchController (REST API)
├── SearchService (orchestration)
├── FullTextSearchService (PostgreSQL tsvector queries)
├── SemanticSearchService (pgvector similarity queries) ⭐ NEW
├── EmbeddingService (OpenAI API integration) ⭐ NEW
├── RankingService (relevance scoring)
└── HighlightingService (result formatting)
```

## API Endpoints

### 1. Full-Text Search (Keyword Matching)

```http
GET /api/v1/search/contacts
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query (min 2 chars) |
| `fields` | string | No | all | Comma-separated fields to search |
| `fuzzy` | boolean | No | false | Enable fuzzy search |
| `highlight` | boolean | No | true | Enable term highlighting |
| `limit` | number | No | 20 | Max results to return |

**Valid Fields:**
- `name` - First name and last name
- `email` - Email address
- `company` - Company name
- `tags` - Contact tags
- `notes` - Contact notes

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/search/contacts?q=john&fields=name,email&highlight=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "results": [
    {
      "id": "contact-123",
      "userId": "user-456",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "company": "Acme Corp",
      "tags": ["important", "client"],
      "rank": 0.95,
      "highlighted": {
        "firstName": "<mark>John</mark>",
        "email": "<mark>john</mark>.doe@example.com"
      },
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-29T15:30:00Z"
    }
  ],
  "total": 15,
  "query": "john",
  "duration": 42
}
```

### 2. Semantic Search (AI-Powered) ⭐ NEW

```http
GET /api/v1/search/semantic
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Natural language query |
| `limit` | number | No | 20 | Max results to return |
| `threshold` | number | No | 0.7 | Min similarity score (0-1) |

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/search/semantic?q=software+engineers+in+Prague&threshold=0.75" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "results": [
    {
      "id": "contact-123",
      "firstName": "John",
      "lastName": "Doe",
      "position": "Senior Software Engineer",
      "company": "Tech Corp",
      "location": "Prague",
      "similarity": 0.89,
      "distance": 0.22
    }
  ],
  "total": 1,
  "query": "software engineers in Prague",
  "duration": 156
}
```

### 3. Hybrid Search (Combined) ⭐ NEW

```http
GET /api/v1/search/hybrid
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query |
| `limit` | number | No | 20 | Max results to return |
| `semanticWeight` | number | No | 0.5 | Semantic vs full-text weight (0-1) |

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/search/hybrid?q=CTOs+in+fintech&semanticWeight=0.6" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Find Similar Contacts ⭐ NEW

```http
GET /api/v1/search/contacts/:id/similar
```

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/search/contacts/contact-123/similar?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Generate Embedding ⭐ NEW

```http
POST /api/v1/search/contacts/:id/generate-embedding
```

### 6. Get Recent Searches

```http
GET /api/v1/search/recent
```

**Example Response:**
```json
[
  {
    "id": "search-1",
    "query": "john doe",
    "resultCount": 5,
    "createdAt": "2025-01-29T10:30:00Z"
  },
  {
    "id": "search-2",
    "query": "acme corp",
    "resultCount": 12,
    "createdAt": "2025-01-29T09:15:00Z"
  }
]
```

### Clear Search History

```http
DELETE /api/v1/search/recent/:id    # Clear specific search
DELETE /api/v1/search/recent         # Clear all history
```

## Usage in Code

### Import the Module

```typescript
import { SearchModule } from '@/modules/search/search.module';

@Module({
  imports: [SearchModule],
})
export class AppModule {}
```

### Inject the Service

```typescript
import { SearchService } from '@/modules/search/search.service';

@Injectable()
export class YourService {
  constructor(private readonly searchService: SearchService) {}

  async findContacts(userId: string, query: string) {
    return this.searchService.searchContacts(userId, {
      query,
      fields: ['name', 'email'],
      fuzzy: true,
      highlight: true,
      limit: 20,
    });
  }
}
```

## Database Setup

### Required Extensions

```sql
-- Full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Semantic search (US-060)
CREATE EXTENSION IF NOT EXISTS vector;
```

### Schema Updates

The `contacts` table requires:

1. **search_vector column** (tsvector)
2. **Trigger** to auto-update search_vector
3. **GIN indexes** for performance

Run the migration:

```bash
psql $DATABASE_URL < src/shared/database/migrations/20250129_add_search_indexes.sql
```

### Manual Index Rebuild

If search results are inconsistent:

```sql
-- Rebuild search vectors
UPDATE contacts
SET search_vector = to_tsvector('english',
  COALESCE(first_name, '') || ' ' ||
  COALESCE(last_name, '') || ' ' ||
  COALESCE(email, '') || ' ' ||
  COALESCE(company, '') || ' ' ||
  COALESCE(notes, '') || ' ' ||
  COALESCE(array_to_string(tags, ' '), '')
)
WHERE search_vector IS NULL;

-- Rebuild indexes
REINDEX INDEX idx_contacts_search_vector;
REINDEX INDEX idx_contacts_first_name_trgm;
```

## Ranking Algorithm

Results are ranked based on:

1. **Text Rank** - PostgreSQL ts_rank or similarity score
2. **Exact Match Boost** (+1.0)
3. **Prefix Match Boost** (+0.5)
4. **Recent Contact Boost** (+0.2 if updated in last 30 days)
5. **Tag Match Boost** (+0.3)
6. **Important Tag Boost** (+0.5 for VIP/important contacts)

Example ranking calculation:

```typescript
const rankingService = new RankingService();

const contacts = [
  { firstName: 'John', rank: 0.8, updatedAt: new Date(), tags: ['important'] },
  { firstName: 'Johnny', rank: 0.7, updatedAt: oldDate, tags: [] },
];

const ranked = rankingService.rankResults(contacts, 'john');
// Result: John (2.5) > Johnny (0.7)
```

## Performance

### Benchmarks

- **Target:** < 100ms response time (p95)
- **Typical:** 30-60ms for standard queries
- **Large datasets:** < 100ms with proper indexing

### Optimization Tips

1. **Use field filtering** to search specific fields
2. **Limit results** to reduce data transfer
3. **Enable caching** on the client side
4. **Monitor index health** regularly

### Query Analysis

Check query performance:

```sql
EXPLAIN ANALYZE
SELECT *
FROM contacts
WHERE search_vector @@ plainto_tsquery('english', 'john')
  AND user_id = 'user-123'
  AND deleted_at IS NULL
ORDER BY ts_rank(search_vector, plainto_tsquery('english', 'john')) DESC
LIMIT 20;
```

Expected output should show:
- `Bitmap Index Scan` on `idx_contacts_search_vector`
- Execution time < 50ms

## Testing

### Run Unit Tests

```bash
npm test -- search.service.spec.ts
npm test -- search.controller.spec.ts
```

### Run E2E Tests

```bash
npm run test:e2e -- search.e2e-spec.ts
```

### Test Coverage

- ✅ Basic search functionality
- ✅ Field filtering
- ✅ Fuzzy search with typos
- ✅ Result highlighting
- ✅ Search history management
- ✅ Ranking algorithm
- ✅ Performance benchmarks
- ✅ Tenant isolation

## Troubleshooting

### No Results Returned

**Problem:** Search returns empty results

**Solutions:**
1. Verify `search_vector` is populated:
   ```sql
   SELECT id, search_vector FROM contacts WHERE search_vector IS NULL;
   ```
2. Rebuild search vectors (see Database Setup)
3. Check query is at least 2 characters

### Slow Search Performance

**Problem:** Queries take > 100ms

**Solutions:**
1. Check indexes exist:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'contacts';
   ```
2. Analyze query plan (see Performance section)
3. Reduce result limit
4. Use field filtering

### Wrong Results Ranking

**Problem:** Irrelevant results ranked highly

**Solutions:**
1. Adjust boost values in `RankingService`
2. Update search_vector trigger to include/exclude fields
3. Add custom ranking factors

### Fuzzy Search Too Broad

**Problem:** Fuzzy search returns too many unrelated results

**Solutions:**
1. Reduce similarity threshold in `FullTextSearchService`
2. Disable fuzzy search for specific queries
3. Combine with exact match filtering

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/pmcrm

# Semantic Search (US-060) - REQUIRED for semantic/hybrid search
OPENAI_API_KEY=sk-...

# Search settings (optional)
SEARCH_HISTORY_LIMIT=50        # Max recent searches per user
SEARCH_DEFAULT_LIMIT=20         # Default result limit
SEARCH_MIN_QUERY_LENGTH=2       # Minimum query length
```

### Customization

Modify constants in `SearchService`:

```typescript
export class SearchService {
  private readonly MAX_HISTORY = 50;  // Change history limit
  // ...
}
```

## Security

### SQL Injection Prevention

All queries use parameterized statements or Prisma ORM:

```typescript
// ❌ NEVER do this
await prisma.$queryRaw`SELECT * FROM contacts WHERE name = '${userInput}'`;

// ✅ Always parameterize
await prisma.$queryRaw`SELECT * FROM contacts WHERE name = ${userInput}`;
```

### Authorization

All endpoints require JWT authentication:

```typescript
@UseGuards(JwtAuthGuard)
export class SearchController {
  // Endpoints automatically check user authentication
}
```

Tenant isolation is enforced:

```typescript
// User can only search their own contacts
WHERE user_id = ${userId} AND deleted_at IS NULL
```

## Documentation Files

| File | Description |
|------|-------------|
| [README.md](./README.md) | This file - module overview |
| [SEMANTIC_SEARCH_IMPLEMENTATION.md](./SEMANTIC_SEARCH_IMPLEMENTATION.md) | Complete technical documentation for semantic search |
| [SEMANTIC_SEARCH_QUICKSTART.md](./SEMANTIC_SEARCH_QUICKSTART.md) | Quick start guide and examples |

## Future Enhancements

### Phase 1: Background Jobs (Recommended)
- [x] ~~AI-powered semantic search~~ ✅ Implemented (US-060)
- [ ] Async embedding generation with BullMQ
- [ ] Retry logic and error handling
- [ ] Progress tracking dashboard

### Phase 2: Advanced Features
- [ ] Elasticsearch integration for scaling
- [ ] Semantic caching (GPTCache)
- [ ] Query suggestions/autocomplete
- [ ] Search analytics dashboard
- [ ] Multi-language support
- [ ] Advanced filtering (date ranges, custom fields)
- [ ] Natural language query parsing (US-062)

## References

- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [pg_trgm Extension](https://www.postgresql.org/docs/current/pgtrgm.html)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
