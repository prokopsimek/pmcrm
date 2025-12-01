# AWS Deployment Setup

Complete guide for deploying Personal Network CRM to Amazon Web Services (AWS).

## Overview

AWS deployment provides full control over infrastructure using:
- **ECS Fargate**: Container orchestration
- **RDS PostgreSQL**: Managed database
- **ElastiCache Redis**: Managed cache
- **Application Load Balancer**: Traffic distribution
- **CloudWatch**: Logging and monitoring
- **S3**: File storage
- **CloudFront**: CDN (optional)

## Prerequisites

- AWS Account
- AWS CLI installed and configured
- Terraform installed (recommended)
- Docker installed

## Architecture

```
Internet → CloudFront (CDN) → ALB → ECS Fargate (Frontend + Backend)
                                        ↓
                                   RDS PostgreSQL
                                        ↓
                                   ElastiCache Redis
```

## Deployment Options

### Option 1: Using Terraform (Recommended)

#### 1. Install Terraform

```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

#### 2. Configure AWS Credentials

```bash
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region: us-east-1
# Default output format: json
```

#### 3. Initialize Terraform

```bash
cd infrastructure/terraform

# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize Terraform
terraform init

# Review execution plan
terraform plan

# Apply configuration
terraform apply
```

#### 4. Deploy Application

After Terraform provisions infrastructure:

```bash
# Build and push Docker images to ECR
./deploy-aws.sh production
```

### Option 2: Manual Setup via AWS Console

#### Step 1: Create VPC

1. Go to VPC Dashboard
2. Create VPC with:
   - CIDR: 10.0.0.0/16
   - Enable DNS hostnames
   - Enable DNS resolution
3. Create subnets:
   - Public subnet 1: 10.0.1.0/24 (us-east-1a)
   - Public subnet 2: 10.0.2.0/24 (us-east-1b)
   - Private subnet 1: 10.0.11.0/24 (us-east-1a)
   - Private subnet 2: 10.0.12.0/24 (us-east-1b)
4. Create Internet Gateway and attach to VPC
5. Create NAT Gateway in public subnet
6. Configure route tables

#### Step 2: Create RDS PostgreSQL

1. Go to RDS Dashboard
2. Create database:
   - Engine: PostgreSQL 16
   - Template: Production
   - Instance class: db.t4g.micro (or larger)
   - Storage: 20 GB (auto-scaling enabled)
   - Multi-AZ: Yes (for production)
   - VPC: Select your VPC
   - Subnet group: Create new in private subnets
   - Public access: No
   - Security group: Create new
   - Database name: pmcrm
   - Master username: pmcrm_app
   - Master password: (generate secure password)
   - Backup retention: 7 days
   - Enable automated backups
   - Enable encryption

3. Note the endpoint and credentials

#### Step 3: Create ElastiCache Redis

1. Go to ElastiCache Dashboard
2. Create Redis cluster:
   - Engine: Redis 7.0
   - Node type: cache.t4g.micro (or larger)
   - Number of replicas: 1 (for production)
   - Subnet group: Create in private subnets
   - Security group: Create new
   - Enable encryption at rest
   - Enable encryption in transit

3. Note the endpoint

#### Step 4: Create ECR Repositories

```bash
# Create repositories for Docker images
aws ecr create-repository --repository-name pmcrm/backend
aws ecr create-repository --repository-name pmcrm/frontend

# Get login credentials
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

#### Step 5: Build and Push Docker Images

```bash
# Build images
docker build -t pmcrm/backend:latest -f backend/Dockerfile.prod backend/
docker build -t pmcrm/frontend:latest -f frontend/Dockerfile.prod frontend/

# Tag images
docker tag pmcrm/backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pmcrm/backend:latest
docker tag pmcrm/frontend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pmcrm/frontend:latest

# Push images
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pmcrm/backend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pmcrm/frontend:latest
```

#### Step 6: Create ECS Cluster

1. Go to ECS Dashboard
2. Create cluster:
   - Name: pmcrm-cluster
   - Infrastructure: AWS Fargate
   - VPC: Select your VPC
   - Subnets: Select private subnets

#### Step 7: Create Task Definitions

**Backend Task Definition:**

```json
{
  "family": "pmcrm-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pmcrm/backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/pmcrm-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Step 8: Create Application Load Balancer

1. Go to EC2 Dashboard → Load Balancers
2. Create ALB:
   - Type: Application Load Balancer
   - Scheme: Internet-facing
   - VPC: Select your VPC
   - Subnets: Select public subnets
   - Security group: Allow HTTP/HTTPS
   - Target group: Create new (port 3001 for backend)
   - Health check: /health

#### Step 9: Create ECS Services

1. Create backend service:
   - Launch type: Fargate
   - Task definition: pmcrm-backend
   - Desired tasks: 2
   - Subnets: Private subnets
   - Load balancer: Select created ALB
   - Target group: backend-tg
   - Auto-scaling: Enable

2. Create frontend service similarly

## Environment Variables Management

### Using AWS Secrets Manager

```bash
# Create secrets
aws secretsmanager create-secret \
  --name pmcrm/production/database-url \
  --secret-string "postgresql://user:pass@host:5432/db"

aws secretsmanager create-secret \
  --name pmcrm/production/jwt-secret \
  --secret-string "your-secret-key"

# Get secret ARN
aws secretsmanager describe-secret --secret-id pmcrm/production/database-url
```

Reference in task definition:
```json
"secrets": [
  {
    "name": "DATABASE_URL",
    "valueFrom": "arn:aws:secretsmanager:region:account:secret:pmcrm/production/database-url"
  }
]
```

## Database Migrations

### Run Migrations on ECS

```bash
# Create one-time task
aws ecs run-task \
  --cluster pmcrm-cluster \
  --task-definition pmcrm-backend \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides": [{"name": "backend","command": ["npx", "prisma", "migrate", "deploy"]}]}'
```

## Monitoring and Logging

### CloudWatch Logs

View logs:
```bash
aws logs tail /ecs/pmcrm-backend --follow
```

### CloudWatch Metrics

Set up alarms for:
- CPU utilization > 80%
- Memory utilization > 80%
- Database connections > 90%
- ALB 5xx errors > 10

### CloudWatch Dashboard

Create dashboard with:
- ECS metrics
- ALB metrics
- RDS metrics
- ElastiCache metrics

## Auto-Scaling

### ECS Service Auto-Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/pmcrm-cluster/pmcrm-backend-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/pmcrm-cluster/pmcrm-backend-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

## Backup and Recovery

### RDS Automated Backups

- Configured during RDS creation
- 7-day retention
- Daily automated snapshots
- Point-in-time recovery

### Manual Snapshots

```bash
aws rds create-db-snapshot \
  --db-instance-identifier pmcrm-db \
  --db-snapshot-identifier pmcrm-db-snapshot-$(date +%Y%m%d)
```

### Restore from Snapshot

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier pmcrm-db-restored \
  --db-snapshot-identifier pmcrm-db-snapshot-20240101
```

## Cost Optimization

### Estimated Monthly Costs (us-east-1)

- **ECS Fargate**: ~$30/month (2 tasks, 0.5 vCPU, 1GB each)
- **RDS PostgreSQL** (db.t4g.micro): ~$15/month
- **ElastiCache Redis** (cache.t4g.micro): ~$12/month
- **ALB**: ~$16/month
- **Data Transfer**: ~$10/month
- **CloudWatch**: ~$5/month

**Total**: ~$88/month

### Cost Reduction Tips

1. Use Savings Plans for ECS Fargate
2. Use Reserved Instances for RDS (save up to 60%)
3. Enable RDS auto-scaling storage
4. Use CloudWatch Logs retention policies
5. Implement S3 lifecycle policies
6. Use Spot Instances for non-critical workloads

## Troubleshooting

### Task Fails to Start

```bash
# Check task logs
aws logs tail /ecs/pmcrm-backend --follow

# Describe task
aws ecs describe-tasks --cluster pmcrm-cluster --tasks <task-id>
```

### Database Connection Issues

```bash
# Test from ECS task
aws ecs execute-command \
  --cluster pmcrm-cluster \
  --task <task-id> \
  --container backend \
  --interactive \
  --command "/bin/sh"

# Inside container
npx prisma db execute --stdin <<< "SELECT 1"
```

## Additional Resources

- AWS Documentation: https://docs.aws.amazon.com
- ECS Best Practices: https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/
- RDS Best Practices: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html
- AWS Architecture Center: https://aws.amazon.com/architecture/
