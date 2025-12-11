# AWS Free Tier Optimization Guide

Tips to maximize free tier usage and optimize for t2.micro (1GB RAM).

## Memory Optimization

### Java Heap Size
- **Default**: 512MB-1024MB max
- **For t2.micro**: 256-384MB max
- **Update in systemd service**: `-Xmx384m`
- **Update in application-prod.properties**: Already optimized

### Node.js Build
- **Next.js build** uses significant memory
- **Option 1**: Build on local machine, deploy built files
- **Option 2**: Use smaller build options
- **Option 3**: Build on EC2 during off-peak hours

### Swap Space
- **Add 2GB swap** (already in user-data script)
- **Helps with memory pressure**
- **Check**: `free -h` and `swapon --show`

## Database Optimization

### RDS db.t2.micro
- **1GB RAM, 1 vCPU**
- **Optimize queries** (indexes already added)
- **Limit connections**: `max_connections=50` (default is fine)
- **Connection pooling**: HikariCP `maximum-pool-size=5` (instead of 20)

### Update Connection Pool (application-prod.properties)

```properties
# Optimize for free tier
spring.datasource.hikari.maximum-pool-size=5
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.connection-timeout=20000
```

## Application Optimization

### Disable Unnecessary Features
- **Reduce logging verbosity** (already done)
- **Disable debug endpoints** in production
- **Optimize static assets** (compression enabled)

### Caching
- **Use Nginx caching** (already configured)
- **Cache static assets** (already configured)
- **Reduce database queries** (use indexes)

### Build Optimization
- **Build frontend locally** and deploy built files
- **Or use smaller build** on EC2
- **Remove dev dependencies** after build

## Cost Monitoring

### Set Up Billing Alerts

1. **AWS Billing** → **Budgets** → **Create Budget**
2. **Budget Type**: Cost budget
3. **Amount**: $1
4. **Alert Thresholds**: 
   - 80% ($0.80)
   - 100% ($1.00)
5. **Email notifications**: Your email
6. **Create**

### Daily Checks

- **Check Cost Explorer** daily
- **Verify free tier usage**
- **Monitor data transfer**
- **Check for unexpected services**

### Free Tier Usage

Monitor in **AWS Billing** → **Free Tier**:
- EC2: Should show 750 hours used
- RDS: Should show 750 hours used
- Data Transfer: Should be under 15GB

## Performance Tips

1. **Use CloudFront** (free tier: 50GB transfer)
2. **Enable gzip** compression (already done)
3. **Optimize images** before upload
4. **Use CDN** for static assets
5. **Database query optimization** (indexes added)

## Resource Limits

### EC2 t2.micro
- **CPU Credits**: Burstable performance
- **Memory**: 1GB (limited)
- **Network**: Low to Moderate

### RDS db.t2.micro
- **CPU Credits**: Burstable performance
- **Memory**: 1GB (limited)
- **Connections**: ~50 max recommended

## Monitoring

### CloudWatch (Free Tier)

1. **Basic Monitoring**: Free (5-minute intervals)
2. **Detailed Monitoring**: Free (1-minute intervals for first 10 metrics)
3. **Alarms**: 10 alarms free

### Set Up Alarms

1. **CloudWatch** → **Alarms** → **Create Alarm**
2. **Metrics**:
   - EC2: CPUUtilization > 80%
   - EC2: StatusCheckFailed
   - RDS: CPUUtilization > 80%
   - RDS: FreeableMemory < 100MB
3. **Actions**: Email notification

## After Free Tier Expires

### Migration Options

1. **Continue with AWS** (pay ~$24/month)
2. **Migrate to Railway + Vercel** (free)
3. **Use Reserved Instances** (save 30-40%)
4. **Use Spot Instances** (save up to 90%, but can be interrupted)

### Cost Optimization

1. **Reserved Instances**: 1-year or 3-year commitment
2. **Savings Plans**: Flexible pricing
3. **Right-sizing**: Use appropriate instance sizes
4. **Data Transfer**: Minimize outbound data

## Troubleshooting Performance

### High Memory Usage

```bash
# Check memory
free -h

# Check Java processes
ps aux | grep java

# Check swap
swapon --show

# If needed, increase swap
sudo fallocate -l 2G /swapfile2
sudo chmod 600 /swapfile2
sudo mkswap /swapfile2
sudo swapon /swapfile2
```

### High CPU Usage

```bash
# Check CPU
top

# Check what's using CPU
htop

# Check Java GC
sudo journalctl -u kaamkart-api | grep GC
```

### Database Performance

```bash
# Check connections
mysql -h RDS_ENDPOINT -u kaamkart_admin -p -e "SHOW PROCESSLIST;"

# Check slow queries (if enabled)
mysql -h RDS_ENDPOINT -u kaamkart_admin -p -e "SHOW VARIABLES LIKE 'slow_query%';"
```

## Best Practices

1. ✅ **Monitor costs daily**
2. ✅ **Set up billing alerts**
3. ✅ **Use free tier eligible resources only**
4. ✅ **Optimize for low memory**
5. ✅ **Use swap space**
6. ✅ **Limit database connections**
7. ✅ **Cache aggressively**
8. ✅ **Compress responses**
9. ✅ **Monitor CloudWatch**
10. ✅ **Regular security updates**

---

**Remember**: Free tier is perfect for development and small production deployments. Monitor costs and optimize accordingly!

