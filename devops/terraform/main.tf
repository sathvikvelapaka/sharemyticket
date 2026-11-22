terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# 1. Isolated Virtual Private Cloud (VPC)
resource "aws_vpc" "trustpass_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "trustpass-vpc"
    Environment = var.environment
  }
}

# 2. Public Subnet (for Application Load Balancer and Nginx)
resource "aws_subnet" "public_subnet" {
  vpc_id                  = aws_vpc.trustpass_vpc.id
  cidr_block              = var.public_subnet_cidr
  map_public_ip_on_launch = true
  availability_zone       = "${var.aws_region}a"

  tags = {
    Name = "trustpass-public-subnet"
  }
}

# 3. Private Subnet (for Backend Services & Database)
resource "aws_subnet" "private_subnet" {
  vpc_id            = aws_vpc.trustpass_vpc.id
  cidr_block        = var.private_subnet_cidr
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "trustpass-private-subnet"
  }
}

# 4. Internet Gateway
resource "aws_internet_gateway" "trustpass_igw" {
  vpc_id = aws_vpc.trustpass_vpc.id

  tags = {
    Name = "trustpass-igw"
  }
}

# 5. Security Group for Public Ingress
resource "aws_security_group" "alb_sg" {
  name        = "trustpass-alb-sg"
  description = "Allows inbound HTTPS and HTTP traffic"
  vpc_id      = aws_vpc.trustpass_vpc.id

  ingress {
    description = "Allow HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 6. Security Group for Private Backend Application
resource "aws_security_group" "backend_sg" {
  name        = "trustpass-backend-sg"
  description = "Allows traffic only from ALB"
  vpc_id      = aws_vpc.trustpass_vpc.id

  ingress {
    description     = "Allow backend port 4000 from ALB"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 7. Private Encrypted Amazon S3 Bucket for Ticket Evidence (Section 28 & 32)
resource "aws_s3_bucket" "evidence_bucket" {
  bucket        = "trustpass-ticket-evidence-${var.environment}"
  force_destroy = false

  tags = {
    Name        = "TrustPass Private Ticket Evidence"
    Environment = var.environment
  }
}

# Enforce SSE-KMS / AES256 Encryption at Rest
resource "aws_s3_bucket_server_side_encryption_configuration" "evidence_encryption" {
  bucket = aws_s3_bucket.evidence_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Strictly block all public access to ticket evidence (No public QR leaks!)
resource "aws_s3_bucket_public_access_block" "block_public" {
  bucket = aws_s3_bucket.evidence_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
