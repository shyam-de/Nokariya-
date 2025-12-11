# AWS Deployment Files

This directory contains AWS-specific deployment configurations and scripts.

## Files

- `ec2-user-data-free-tier.sh` - EC2 user data script for free tier setup
- `scripts/deploy-aws-free-tier.sh` - Automated deployment script
- `free-tier-optimization.md` - Optimization guide for free tier
- `README.md` - This file

## Usage

### Quick Deployment

1. Create RDS and EC2 instances in AWS Console
2. SSH into EC2 instance
3. Run deployment script:
   ```bash
   bash aws/scripts/deploy-aws-free-tier.sh
   ```

### Manual Setup

1. Use `ec2-user-data-free-tier.sh` as EC2 user data
2. Follow steps in `DEPLOY_AWS_FREE_TIER.md`

## Free Tier Resources

- EC2 t2.micro: 750 hours/month
- RDS db.t2.micro: 750 hours/month
- Route 53: First hosted zone free
- Data Transfer: 15GB out/month

## Documentation

- **Complete Guide**: See `../DEPLOY_AWS_FREE_TIER.md`
- **Quick Start**: See `../QUICK_START_AWS_FREE_TIER.md`
- **Optimization**: See `free-tier-optimization.md`

