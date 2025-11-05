#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mipyme_backup_$TIMESTAMP.sql.gz"

echo "🔒 Starting backup at $(date)"

# Backup using Django dumpdata
docker-compose -f docker-compose.prod.yml exec -T backend \
    python manage.py dumpdata \
    --natural-foreign \
    --natural-primary \
    -e contenttypes \
    -e auth.Permission | gzip > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    echo "✅ Backup created: $BACKUP_FILE"
    echo "📏 Size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    echo "❌ Backup failed"
    exit 1
fi

# Cleanup old backups
echo "🧹 Removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "mipyme_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "✅ Backup completed"
