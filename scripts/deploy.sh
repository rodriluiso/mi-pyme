#!/bin/bash
set -euo pipefail

echo "🚀 MI-PYME Deployment Script"

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running"
    exit 1
fi

# Load environment
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | xargs)
fi

# Backup database
echo "💾 Creating backup..."
mkdir -p backups
BACKUP_FILE="backups/pre_deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
docker-compose -f docker-compose.prod.yml exec -T backend \
    python manage.py dumpdata --indent 2 | gzip > "$BACKUP_FILE" || true

# Pull images
echo "📦 Pulling images..."
docker-compose -f docker-compose.prod.yml pull

# Build backend
echo "🔨 Building backend..."
docker-compose -f docker-compose.prod.yml build backend

# Run migrations
echo "🗄️  Running migrations..."
docker-compose -f docker-compose.prod.yml run --rm backend python manage.py migrate --noinput

# Restart services
echo "🔄 Restarting services..."
docker-compose -f docker-compose.prod.yml up -d

# Health check
echo "🏥 Checking health..."
sleep 10
for i in {1..5}; do
    if curl -f http://localhost/api/health/ > /dev/null 2>&1; then
        echo "✅ Deployment successful!"
        docker-compose -f docker-compose.prod.yml ps
        exit 0
    fi
    echo "⏳ Waiting for services... ($i/5)"
    sleep 5
done

echo "❌ Health check failed"
exit 1
