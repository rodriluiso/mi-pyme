#!/bin/bash

echo "🔍 MI-PYME Pre-Deployment Checklist"
echo "===================================="
echo

ERRORS=0
WARNINGS=0

check_file() {
    if [ -f "$1" ]; then
        echo "✅ $1 exists"
    else
        echo "❌ $1 missing"
        ((ERRORS++))
    fi
}

check_env_var() {
    if grep -q "^$1=" .env.production 2>/dev/null; then
        value=$(grep "^$1=" .env.production | cut -d'=' -f2)
        if [ -z "$value" ] || [[ "$value" == *"CHANGE"* ]] || [[ "$value" == *"your-"* ]]; then
            echo "⚠️  $1 needs configuration"
            ((WARNINGS++))
        else
            echo "✅ $1 configured"
        fi
    else
        echo "❌ $1 missing in .env.production"
        ((ERRORS++))
    fi
}

echo "📁 Checking files..."
check_file "backend/Dockerfile"
check_file "backend/gunicorn.conf.py"
check_file "docker-compose.prod.yml"
check_file "infra/nginx/nginx.conf"
check_file ".env.production"
check_file "frontend/dist/index.html"
echo

echo "🔧 Checking environment variables..."
check_env_var "DJANGO_SECRET_KEY"
check_env_var "DATABASE_URL"
check_env_var "DJANGO_ALLOWED_HOSTS"
check_env_var "CORS_ALLOWED_ORIGINS"
echo

echo "🐳 Checking Docker..."
if command -v docker &> /dev/null; then
    echo "✅ Docker installed"
    if docker info &> /dev/null; then
        echo "✅ Docker running"
    else
        echo "❌ Docker not running"
        ((ERRORS++))
    fi
else
    echo "❌ Docker not installed"
    ((ERRORS++))
fi
echo

echo "📦 Checking frontend build..."
if [ -d "frontend/dist" ] && [ -f "frontend/dist/index.html" ]; then
    echo "✅ Frontend built"
else
    echo "⚠️  Frontend not built - run: cd frontend && npm run build"
    ((WARNINGS++))
fi
echo

echo "===================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed! Ready to deploy."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  $WARNINGS warnings found. Review before deploying."
    exit 0
else
    echo "❌ $ERRORS errors and $WARNINGS warnings found. Fix before deploying."
    exit 1
fi
