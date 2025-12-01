# Terraform Variables

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either staging or production"
  }
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "pmcrm"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

# Database Variables
variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "16"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage (GB)"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for autoscaling (GB)"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "pmcrm"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "pmcrm_app"
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "db_backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

# Redis Variables
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t4g.micro"
}

# Logging Variables
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

# Tags
variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project   = "Personal Network CRM"
    ManagedBy = "Terraform"
  }
}
