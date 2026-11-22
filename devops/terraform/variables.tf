variable "aws_region" {
  type        = string
  default     = "ap-south-1"
  description = "AWS deployment region (Mumbai)"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Target deployment environment"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  type        = string
  default     = "10.0.1.0/24"
}

variable "private_subnet_cidr" {
  type        = string
  default     = "10.0.2.0/24"
}
