#!/bin/bash

# -----------------------------------------------------------------------------
# Script: load_env_from_aws.sh
# Usage: ./scripts/load_env_from_aws.sh [env]
# Example: ./scripts/load_env_from_aws.sh staging
# -----------------------------------------------------------------------------

set -e

# Input environment (default to 'prod' if not provided)
ENV=${1:-prod}

# AWS Secrets Manager secret name convention (customize if needed)
SECRET_NAME="mobilys/${ENV}/env"
ENV_FILE=".env"

echo "🔐 Fetching environment variables for '${ENV}' from AWS Secrets Manager..."

# Fetch secret from AWS and write to .env
aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --query SecretString \
  --output text > "$ENV_FILE"

echo "✅ Environment written to $ENV_FILE"

# Optional debug output
# echo "--- Contents of $ENV_FILE ---"
# cat "$ENV_FILE"
