# Deployment Documentation

## Overview

This document covers deployment strategies for the Personal Network CRM platform, from MVP deployment to production-scale infrastructure.

## Deployment Strategies

### MVP Deployment (Recommended for Initial Launch)

**Target**: Fast deployment with minimal operational overhead
**Cost**: ~$200-500/month
**Suitable for**: Up to 1,000 active users

#### Infrastructure

| Component | Provider | Service | Region | Estimated Cost |
|-----------|----------|---------|--------|----------------|
| **Frontend** | Vercel | Serverless | Global CDN | $20/mo (Pro) |
| **Backend** | Railway / Render | Container | EU-West | $50-100/mo |
| **Database** | Neon / Supabase | Managed PostgreSQL | EU-Central | $25-50/mo |
| **Cache** | Upstash | Managed Redis | EU-West | $10-30/mo |
| **Object Storage** | Cloudflare R2 | S3-compatible | EU | $5-15/mo |
| **Email** | Resend / SendGrid | Transactional | Global | $10/mo |
| **Monitoring** | BetterStack | Logging + Uptime | Global | $20/mo |

**Total**: ~$140-245/month

#### Deployment Steps

##### 1. Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd frontend
vercel --prod

# Set environment variables
vercel env add DATABASE_URL production
vercel env add REDIS_URL production
vercel env add NEXT_PUBLIC_API_URL production
```

**Configuration** (`vercel.json`):
```json
{
  "version": 2,
  "regions": ["fra1", "cdg1"],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.pmcrm.io"
  },
  "build": {
    "env": {
      "NODE_ENV": "production"
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

##### 2. Backend (Railway)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to project
railway link

# Set environment variables
railway variables set DATABASE_URL=postgresql://...
railway variables set REDIS_URL=redis://...
railway variables set JWT_SECRET=...

# Deploy
railway up
```

**Configuration** (`railway.json`):
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run start:prod",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**Dockerfile** (if using custom container):
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/main"]
```

##### 3. Database (Neon)

```bash
# Create Neon project
# Via UI: https://neon.tech

# Install pgvector extension
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

**Connection Configuration**:
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // For migrations
}

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}
```

**Environment Variables**:
```env
# Neon provides both connection pooler and direct connection
DATABASE_URL="postgresql://user:pass@ep-xxxx.eu-central-1.aws.neon.tech/pmcrm?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxxx.eu-central-1.aws.neon.tech/pmcrm?sslmode=require"
```

##### 4. Redis (Upstash)

```bash
# Create Upstash Redis instance
# Via UI: https://upstash.com

# Get connection URL
export REDIS_URL="redis://default:****@eu1-******.upstash.io:6379"
```

**Configuration**:
```typescript
// src/config/redis.config.ts
import { RedisOptions } from 'ioredis';

export const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  tls: {
    // Required for Upstash
    rejectUnauthorized: true,
  },
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    return Math.min(times * 50, 2000);
  },
};
```

---

### Production Deployment (Kubernetes)

**Target**: High availability, horizontal scaling
**Cost**: ~$1,000-3,000/month
**Suitable for**: 10,000+ active users

#### Infrastructure

**Kubernetes Cluster** (GKE):
- 3 node pools: app, workers, monitoring
- EU regions: europe-west1 (Belgium) or europe-west3 (Frankfurt)
- Autoscaling: 3-20 nodes

#### Prerequisites

```bash
# Install required tools
brew install kubectl
brew install helm
brew install terraform
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

#### Terraform Infrastructure

**Directory Structure**:
```
infrastructure/
├── terraform/
│   ├── environments/
│   │   ├── production/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── terraform.tfvars
│   │   └── staging/
│   ├── modules/
│   │   ├── gke-cluster/
│   │   ├── database/
│   │   ├── redis/
│   │   └── networking/
│   └── backend.tf
└── kubernetes/
    ├── base/
    ├── overlays/
    │   ├── production/
    │   └── staging/
    └── helm-charts/
```

**GKE Cluster** (`modules/gke-cluster/main.tf`):
```hcl
resource "google_container_cluster" "primary" {
  name     = "pmcrm-${var.environment}"
  location = var.region

  # Use autopilot for easier management
  enable_autopilot = true

  # Or manual node pools for more control
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  # Security
  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }

  # Private cluster
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block = "172.16.0.0/28"
  }

  # Workload identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Maintenance window
  maintenance_policy {
    daily_maintenance_window {
      start_time = "03:00"
    }
  }
}

resource "google_container_node_pool" "app_nodes" {
  name       = "app-node-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name
  node_count = var.min_node_count

  autoscaling {
    min_node_count = var.min_node_count
    max_node_count = var.max_node_count
  }

  node_config {
    preemptible  = false
    machine_type = "e2-standard-4"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      app = "pmcrm"
      env = var.environment
    }

    tags = ["pmcrm", var.environment]
  }
}
```

**Cloud SQL** (`modules/database/main.tf`):
```hcl
resource "google_sql_database_instance" "main" {
  name             = "pmcrm-${var.environment}"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier = "db-custom-4-16384" # 4 vCPU, 16 GB RAM

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_id
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 3
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "database" {
  name     = "pmcrm"
  instance = google_sql_database_instance.main.name
}
```

#### Kubernetes Manifests

**Namespace**:
```yaml
# kubernetes/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: pmcrm
  labels:
    name: pmcrm
```

**Backend Deployment**:
```yaml
# kubernetes/base/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pmcrm-backend
  namespace: pmcrm
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pmcrm-backend
  template:
    metadata:
      labels:
        app: pmcrm-backend
    spec:
      containers:
      - name: backend
        image: gcr.io/PROJECT_ID/pmcrm-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: pmcrm-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: pmcrm-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Service & Ingress**:
```yaml
# kubernetes/base/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: pmcrm-backend
  namespace: pmcrm
spec:
  selector:
    app: pmcrm-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
# kubernetes/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pmcrm-ingress
  namespace: pmcrm
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.pmcrm.io
    secretName: pmcrm-tls
  rules:
  - host: api.pmcrm.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: pmcrm-backend
            port:
              number: 80
```

**Horizontal Pod Autoscaler**:
```yaml
# kubernetes/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pmcrm-backend-hpa
  namespace: pmcrm
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pmcrm-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### CI/CD Pipeline

**GitHub Actions** (`.github/workflows/deploy-production.yml`):
```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

env:
  GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  GKE_CLUSTER: pmcrm-production
  GKE_ZONE: europe-west1-b
  IMAGE: pmcrm-backend

jobs:
  setup-build-deploy:
    name: Setup, Build, and Deploy
    runs-on: ubuntu-latest

    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Authenticate to Google Cloud
      uses: google-github-actions/auth@v1
      with:
        credentials_json: ${{ secrets.GCP_SA_KEY }}

    - name: Set up Cloud SDK
      uses: google-github-actions/setup-gcloud@v1

    - name: Configure Docker
      run: gcloud auth configure-docker

    - name: Build Docker image
      run: |
        docker build -t gcr.io/$GCP_PROJECT_ID/$IMAGE:$GITHUB_SHA \
          -t gcr.io/$GCP_PROJECT_ID/$IMAGE:latest .

    - name: Push Docker image
      run: |
        docker push gcr.io/$GCP_PROJECT_ID/$IMAGE:$GITHUB_SHA
        docker push gcr.io/$GCP_PROJECT_ID/$IMAGE:latest

    - name: Get GKE credentials
      run: |
        gcloud container clusters get-credentials $GKE_CLUSTER \
          --zone $GKE_ZONE

    - name: Deploy to GKE
      run: |
        kubectl set image deployment/pmcrm-backend \
          backend=gcr.io/$GCP_PROJECT_ID/$IMAGE:$GITHUB_SHA \
          -n pmcrm

    - name: Verify deployment
      run: |
        kubectl rollout status deployment/pmcrm-backend -n pmcrm
```

---

## Monitoring & Observability

### Application Monitoring

**Datadog** (Recommended for production):

```typescript
// Install Datadog APM
npm install dd-trace

// src/main.ts
import tracer from 'dd-trace';

tracer.init({
  hostname: process.env.DD_AGENT_HOST,
  port: process.env.DD_TRACE_AGENT_PORT,
  service: 'pmcrm-backend',
  env: process.env.NODE_ENV,
  version: process.env.APP_VERSION,
  logInjection: true,
});

// Metrics
import { StatsD } from 'node-dogstatsd';

const dogstatsd = new StatsD({
  host: process.env.DD_AGENT_HOST,
  port: 8125,
});

// Track custom metrics
dogstatsd.increment('contacts.created');
dogstatsd.histogram('ai.recommendation.latency', 234);
```

### Health Checks

```typescript
// src/health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('cache'),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('cache'),
      () => this.checkMigrations(),
    ]);
  }
}
```

### Logging

**Structured Logging with Pino**:

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['req.headers.authorization', 'password', 'email'],
});

// Usage
logger.info({ userId: '123', action: 'contact.created' }, 'Contact created');
logger.error({ err, userId: '123' }, 'Failed to create contact');
```

---

## Disaster Recovery

### Backup Strategy

**Database Backups**:
- Automated daily snapshots
- Point-in-time recovery enabled (7 days)
- Cross-region replication for critical data
- Quarterly restore testing

**Application State**:
- Configuration stored in version control
- Secrets in GCP Secret Manager
- Infrastructure as code (Terraform)

### Recovery Procedures

**RTO (Recovery Time Objective)**: 2 hours
**RPO (Recovery Point Objective)**: 1 hour

**Steps**:
1. Provision infrastructure from Terraform
2. Restore database from backup
3. Deploy application from container registry
4. Verify health checks
5. Update DNS to point to new infrastructure

---

## Environment Variables

### Required Variables

```env
# Application
NODE_ENV=production
PORT=3000
APP_VERSION=1.0.0

# Database
DATABASE_URL=postgresql://user:pass@host:5432/pmcrm
DIRECT_URL=postgresql://user:pass@host:5432/pmcrm

# Redis
REDIS_URL=redis://default:pass@host:6379

# Authentication
JWT_SECRET=your-secret-key
JWT_ACCESS_TOKEN_EXPIRY=1h
JWT_REFRESH_TOKEN_EXPIRY=30d

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# AI/ML
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Third-party
APOLLO_API_KEY=
WHATSAPP_API_TOKEN=

# Encryption
ENCRYPTION_KEY=

# Monitoring
DD_API_KEY=
DD_AGENT_HOST=
```

---

## Rollback Procedures

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/pmcrm-backend -n pmcrm

# Rollback to previous version
kubectl rollout undo deployment/pmcrm-backend -n pmcrm

# Rollback to specific revision
kubectl rollout undo deployment/pmcrm-backend --to-revision=2 -n pmcrm
```

### Database Migration Rollback

```bash
# Rollback last migration
npm run db:migrate:rollback

# Rollback to specific migration
npm run db:migrate:rollback -- --to 20250115_add_contacts
```

---

**Last Updated**: 2025-01-15

**Next Review**: 2025-04-15 (quarterly)
