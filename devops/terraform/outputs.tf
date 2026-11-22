output "vpc_id" {
  value       = aws_vpc.trustpass_vpc.id
  description = "The ID of the TrustPass VPC"
}

output "evidence_bucket_name" {
  value       = aws_s3_bucket.evidence_bucket.id
  description = "Private S3 bucket name for encrypted ticket evidence"
}
