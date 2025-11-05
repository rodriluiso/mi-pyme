#!/bin/bash
# Setup automated backup cron job for MI-PYME
# Run this script once on the server to configure automatic backups

set -euo pipefail

echo "🔧 Setting up automated backup cron job for MI-PYME"

# Determine script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_db.sh"

# Check if backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "❌ Backup script not found: $BACKUP_SCRIPT"
    exit 1
fi

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"

# Create cron job entry
# Default: Daily at 2:00 AM
CRON_SCHEDULE="${BACKUP_CRON_SCHEDULE:-0 2 * * *}"
CRON_JOB="$CRON_SCHEDULE cd $PROJECT_DIR && $BACKUP_SCRIPT >> /var/log/mipyme-backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "⚠️  Backup cron job already exists. Skipping..."
    echo "Current cron jobs:"
    crontab -l | grep mipyme || true
    exit 0
fi

# Add cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Backup cron job installed successfully!"
echo ""
echo "📋 Backup Schedule:"
echo "   Schedule: $CRON_SCHEDULE ($(echo $CRON_SCHEDULE | awk '{print "Daily at " $2 ":00"}'))"
echo "   Script: $BACKUP_SCRIPT"
echo "   Log: /var/log/mipyme-backup.log"
echo ""
echo "🔍 To view current cron jobs:"
echo "   crontab -l"
echo ""
echo "📝 To edit cron schedule:"
echo "   export BACKUP_CRON_SCHEDULE='0 3 * * *'  # 3 AM daily"
echo "   $0"
echo ""
echo "🗑️  To remove cron job:"
echo "   crontab -l | grep -v '$BACKUP_SCRIPT' | crontab -"
