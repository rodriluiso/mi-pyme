#!/bin/bash
# Restore database from backup
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"

echo "🔄 MI-PYME Database Restore"
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# List available backups
echo "📦 Available backups:"
backups=($(ls -t "$BACKUP_DIR"/mipyme_backup_*.sql.gz 2>/dev/null || true))

if [ ${#backups[@]} -eq 0 ]; then
    echo "❌ No backups found in $BACKUP_DIR"
    exit 1
fi

# Display backups with numbers
for i in "${!backups[@]}"; do
    backup_file="${backups[$i]}"
    size=$(du -h "$backup_file" | cut -f1)
    timestamp=$(basename "$backup_file" | sed 's/mipyme_backup_\(.*\)\.sql\.gz/\1/')
    echo "  [$i] $timestamp ($size)"
done

echo ""
echo -n "Select backup number to restore (0-$((${#backups[@]}-1))): "
read -r selection

# Validate selection
if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -ge "${#backups[@]}" ]; then
    echo "❌ Invalid selection"
    exit 1
fi

BACKUP_FILE="${backups[$selection]}"
echo ""
echo "⚠️  WARNING: This will REPLACE all current data!"
echo "📁 Backup file: $BACKUP_FILE"
echo ""
echo -n "Are you sure? Type 'YES' to continue: "
read -r confirmation

if [ "$confirmation" != "YES" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

# Create a safety backup of current state
echo ""
echo "💾 Creating safety backup of current state..."
SAFETY_BACKUP="$BACKUP_DIR/safety_before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
docker-compose -f docker-compose.prod.yml exec -T backend \
    python manage.py dumpdata \
    --natural-foreign \
    --natural-primary \
    -e contenttypes \
    -e auth.Permission | gzip > "$SAFETY_BACKUP" || true

echo "✅ Safety backup created: $SAFETY_BACKUP"
echo ""

# Restore from backup
echo "🔄 Restoring from backup..."
echo "⏳ Step 1/3: Flushing current database..."
docker-compose -f docker-compose.prod.yml exec -T backend \
    python manage.py flush --noinput

echo "⏳ Step 2/3: Loading backup data..."
gunzip -c "$BACKUP_FILE" | docker-compose -f docker-compose.prod.yml exec -T backend \
    python manage.py loaddata --format=json -

echo "⏳ Step 3/3: Running migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend \
    python manage.py migrate --noinput

echo ""
echo "✅ Database restored successfully!"
echo ""
echo "🔍 Verify the restore:"
echo "   docker-compose -f docker-compose.prod.yml exec backend python manage.py shell"
echo ""
echo "⚠️  If something went wrong, restore from safety backup:"
echo "   BACKUP_FILE='$SAFETY_BACKUP' $0"
