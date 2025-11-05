#!/bin/bash
# Comprehensive security audit script for MI-PYME
set -euo pipefail

echo "🔐 MI-PYME Security Audit"
echo "======================================="
echo ""

ERRORS=0
WARNINGS=0
CRITICAL=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

critical() {
    echo -e "${PURPLE}🔴 CRITICAL: $1${NC}"
    ((CRITICAL++))
}

error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ((ERRORS++))
}

warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    ((WARNINGS++))
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

info() {
    echo "ℹ️  $1"
}

# Function to check env variable
check_env_var() {
    local var_name=$1
    local env_file=$2
    local is_critical=${3:-false}

    if [ ! -f "$env_file" ]; then
        if [ "$is_critical" = true ]; then
            critical "$env_file not found"
        else
            error "$env_file not found"
        fi
        return 1
    fi

    if ! grep -q "^${var_name}=" "$env_file"; then
        if [ "$is_critical" = true ]; then
            critical "${var_name} not set in $env_file"
        else
            error "${var_name} not set in $env_file"
        fi
        return 1
    fi

    # Check if value is empty or placeholder
    local value=$(grep "^${var_name}=" "$env_file" | cut -d '=' -f 2-)
    if [ -z "$value" ] || [[ "$value" == *"CHANGE_ME"* ]] || [[ "$value" == *"your-"* ]]; then
        if [ "$is_critical" = true ]; then
            critical "${var_name} contains placeholder value"
        else
            error "${var_name} contains placeholder value"
        fi
        return 1
    fi

    success "${var_name} is configured"
    return 0
}

# 1. Environment Variables Check
echo "📋 1. ENVIRONMENT VARIABLES"
echo "-----------------------------------"

ENV_FILE="backend/.env"

if [ -f "$ENV_FILE" ]; then
    info "Checking $ENV_FILE"

    # Critical variables
    check_env_var "DJANGO_SECRET_KEY" "$ENV_FILE" true
    check_env_var "DJANGO_SETTINGS_MODULE" "$ENV_FILE" true

    # Check SECRET_KEY length
    if grep -q "^DJANGO_SECRET_KEY=" "$ENV_FILE"; then
        SECRET_KEY=$(grep "^DJANGO_SECRET_KEY=" "$ENV_FILE" | cut -d '=' -f 2-)
        if [ ${#SECRET_KEY} -lt 50 ]; then
            critical "DJANGO_SECRET_KEY is too short (${#SECRET_KEY} chars, needs 50+)"
        else
            success "DJANGO_SECRET_KEY length is adequate (${#SECRET_KEY} chars)"
        fi
    fi

    # Production-specific checks
    if grep -q "DJANGO_SETTINGS_MODULE=core.settings.prod" "$ENV_FILE"; then
        info "Production environment detected"

        check_env_var "DATABASE_URL" "$ENV_FILE" true
        check_env_var "DJANGO_ALLOWED_HOSTS" "$ENV_FILE" true
        check_env_var "CORS_ALLOWED_ORIGINS" "$ENV_FILE" true
        check_env_var "FERNET_KEY" "$ENV_FILE" true

        # Check for wildcard in ALLOWED_HOSTS
        if grep -q "DJANGO_ALLOWED_HOSTS=.*\*" "$ENV_FILE"; then
            critical "ALLOWED_HOSTS contains wildcard (*) - MAJOR SECURITY RISK!"
        fi

        # Check for wildcard in CORS
        if grep -q "CORS_ALLOWED_ORIGINS=.*\*" "$ENV_FILE"; then
            critical "CORS_ALLOWED_ORIGINS contains wildcard (*) - MAJOR SECURITY RISK!"
        fi

        # Check DEBUG is not True
        if grep -q "^DJANGO_DEBUG=True" "$ENV_FILE"; then
            critical "DEBUG=True in production - CRITICAL SECURITY ISSUE!"
        fi

        # Check FERNET_KEY format
        if grep -q "^FERNET_KEY=" "$ENV_FILE"; then
            FERNET_KEY=$(grep "^FERNET_KEY=" "$ENV_FILE" | cut -d '=' -f 2-)
            if [ ${#FERNET_KEY} -ne 44 ]; then
                error "FERNET_KEY has incorrect length (should be 44 chars base64)"
            else
                success "FERNET_KEY format looks correct"
            fi
        fi
    fi

    # Check file permissions
    PERMS=$(stat -c "%a" "$ENV_FILE" 2>/dev/null || stat -f "%A" "$ENV_FILE" 2>/dev/null || echo "unknown")
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "unknown" ]; then
        warning "$ENV_FILE permissions are $PERMS (should be 600)"
        info "Run: chmod 600 $ENV_FILE"
    else
        success "$ENV_FILE has correct permissions"
    fi
else
    critical "$ENV_FILE not found - cannot deploy without environment configuration"
fi

echo ""

# 2. Git Security Check
echo "🔐 2. GIT REPOSITORY SECURITY"
echo "-----------------------------------"

# Check for sensitive files in git
if git ls-files | grep -qE "\.(env|secret|key|pem|p12|pfx)$"; then
    critical "Sensitive files found in git repository:"
    git ls-files | grep -E "\.(env|secret|key|pem|p12|pfx)$"
else
    success "No sensitive files in git"
fi

# Check .gitignore
if [ ! -f .gitignore ]; then
    error ".gitignore not found"
else
    if grep -q "^\.env$" .gitignore || grep -q "^\*\*\/\.env$" .gitignore; then
        success ".env is in .gitignore"
    else
        critical ".env is NOT in .gitignore - sensitive data may be exposed!"
    fi

    if grep -q "db\.sqlite3" .gitignore; then
        success "SQLite database excluded from git"
    else
        warning "SQLite database not explicitly in .gitignore"
    fi
fi

echo ""

# 3. Docker Security
echo "🐋 3. DOCKER SECURITY"
echo "-----------------------------------"

if [ -f backend/Dockerfile ]; then
    # Check for non-root user
    if grep -q "USER.*appuser" backend/Dockerfile || grep -q "USER.*[0-9]" backend/Dockerfile; then
        success "Dockerfile uses non-root user"
    else
        warning "Dockerfile may be running as root"
    fi

    # Check for healthcheck
    if grep -q "HEALTHCHECK" backend/Dockerfile; then
        success "Dockerfile has healthcheck"
    else
        warning "Dockerfile missing healthcheck"
    fi

    # Check for secrets
    if grep -iE "(password|secret|key).*=" backend/Dockerfile; then
        error "Dockerfile may contain hardcoded secrets"
    else
        success "No obvious secrets in Dockerfile"
    fi
else
    error "backend/Dockerfile not found"
fi

# Check .dockerignore
if [ ! -f backend/.dockerignore ]; then
    warning "backend/.dockerignore not found"
else
    if grep -q "\.env" backend/.dockerignore; then
        success ".env is in .dockerignore"
    else
        warning ".env not in .dockerignore"
    fi
fi

echo ""

# 4. Database Security
echo "🗄️  4. DATABASE SECURITY"
echo "-----------------------------------"

if [ -f "$ENV_FILE" ] && grep -q "^DATABASE_URL=" "$ENV_FILE"; then
    DB_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f 2-)

    # Check if using SQLite in production
    if [[ "$DB_URL" == *"sqlite"* ]] && grep -q "core.settings.prod" "$ENV_FILE"; then
        critical "Using SQLite in production - use PostgreSQL instead!"
    fi

    # Check for weak database passwords
    if [[ "$DB_URL" =~ :([^@]+)@ ]]; then
        DB_PASS="${BASH_REMATCH[1]}"
        if [ ${#DB_PASS} -lt 20 ]; then
            warning "Database password is short (${#DB_PASS} chars, recommended 20+)"
        else
            success "Database password length is adequate"
        fi

        # Check for common weak passwords
        if [[ "$DB_PASS" =~ ^(password|123456|admin|postgres|root)$ ]]; then
            critical "Database password is a common weak password!"
        fi
    fi

    # Check if database is exposed publicly
    if [[ "$DB_URL" =~ @([^:/]+) ]]; then
        DB_HOST="${BASH_REMATCH[1]}"
        if [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ] && [ "$DB_HOST" != "db" ]; then
            warning "Database host is $DB_HOST - ensure it's not publicly accessible"
        else
            success "Database host is localhost/private"
        fi
    fi
fi

echo ""

# 5. Dependencies Security
echo "📦 5. DEPENDENCIES SECURITY"
echo "-----------------------------------"

if [ -f backend/requirements.txt ]; then
    # Check for outdated packages (if pip-audit is available)
    if command -v pip-audit &> /dev/null; then
        info "Running pip-audit..."
        cd backend
        if pip-audit -r requirements.txt --format=json > /tmp/audit.json 2>&1; then
            success "No known vulnerabilities in dependencies"
        else
            VULN_COUNT=$(cat /tmp/audit.json | grep -o "\"dependency\"" | wc -l)
            if [ "$VULN_COUNT" -gt 0 ]; then
                error "Found $VULN_COUNT vulnerabilities in dependencies"
                info "Run: cd backend && pip-audit"
            fi
        fi
        cd ..
    else
        info "pip-audit not installed (run: pip install pip-audit)"
    fi

    # Check for Django version
    DJANGO_VERSION=$(grep "^Django==" backend/requirements.txt | cut -d '=' -f 3 | cut -d '.' -f 1-2)
    if [ ! -z "$DJANGO_VERSION" ]; then
        success "Django version: $DJANGO_VERSION"
    fi
else
    error "backend/requirements.txt not found"
fi

echo ""

# 6. Backup Configuration
echo "💾 6. BACKUP CONFIGURATION"
echo "-----------------------------------"

if [ -f scripts/backup_db.sh ]; then
    success "Backup script exists"

    if [ -x scripts/backup_db.sh ]; then
        success "Backup script is executable"
    else
        warning "Backup script is not executable (run: chmod +x scripts/backup_db.sh)"
    fi
else
    error "Backup script not found"
fi

if [ -d backups ]; then
    BACKUP_COUNT=$(ls -1 backups/*.sql.gz 2>/dev/null | wc -l || echo 0)
    if [ "$BACKUP_COUNT" -gt 0 ]; then
        success "Found $BACKUP_COUNT backup(s)"

        # Check last backup age
        LATEST_BACKUP=$(ls -t backups/*.sql.gz 2>/dev/null | head -n 1)
        if [ ! -z "$LATEST_BACKUP" ]; then
            AGE_SECONDS=$(( $(date +%s) - $(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || stat -f %m "$LATEST_BACKUP") ))
            AGE_HOURS=$(( AGE_SECONDS / 3600 ))

            if [ $AGE_HOURS -gt 48 ]; then
                warning "Last backup is $AGE_HOURS hours old (>48h)"
            else
                success "Last backup is recent ($AGE_HOURS hours ago)"
            fi
        fi
    else
        warning "No backups found in backups/"
    fi
else
    warning "backups/ directory does not exist"
fi

# Check for cron job
if crontab -l 2>/dev/null | grep -q "backup_db.sh"; then
    success "Backup cron job is configured"
else
    warning "No backup cron job found (run: ./scripts/setup_backup_cron.sh)"
fi

echo ""

# Summary
echo "======================================="
echo "📊 SECURITY AUDIT SUMMARY"
echo "======================================="
echo -e "${PURPLE}🔴 CRITICAL ISSUES: $CRITICAL${NC}"
echo -e "${RED}❌ ERRORS: $ERRORS${NC}"
echo -e "${YELLOW}⚠️  WARNINGS: $WARNINGS${NC}"
echo ""

if [ $CRITICAL -gt 0 ]; then
    echo "⛔ CRITICAL ISSUES FOUND - DO NOT DEPLOY!"
    echo "Fix all critical issues immediately."
    exit 2
elif [ $ERRORS -gt 0 ]; then
    echo "❌ ERRORS FOUND - DO NOT DEPLOY!"
    echo "Fix all errors before deploying."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo "⚠️  WARNINGS FOUND - Review before deploying"
    echo "Address warnings for better security."
    exit 0
else
    echo "✅ SECURITY AUDIT PASSED!"
    echo "System is ready for deployment."
    exit 0
fi
