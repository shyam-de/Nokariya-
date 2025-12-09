#!/bin/bash

# KaamKart Database Backup Script
# Usage: ./backup-database.sh
# Add to crontab: 0 2 * * * /path/to/backup-database.sh

set -e

# Configuration
DB_NAME="kaamkart"
DB_USER="kaamkart_user"
DB_PASS="${DB_PASSWORD}"  # Set this as environment variable
BACKUP_DIR="/backup/kaamkart"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/kaamkart_backup_$TIMESTAMP.sql"

# Perform backup
echo "Creating database backup: $BACKUP_FILE"
mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "Backup created: $BACKUP_FILE"
echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"

# Remove old backups
echo "Removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "kaamkart_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed successfully!"

