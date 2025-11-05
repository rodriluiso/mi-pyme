#!/usr/bin/env python
"""
Validate production environment variables for MI-PYME
Run this before deploying to production to catch configuration errors early
"""

import os
import sys
from pathlib import Path

# Color codes for terminal
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
GREEN = '\033[0;32m'
BLUE = '\033[0;34m'
PURPLE = '\033[0;35m'
NC = '\033[0m'  # No Color


class EnvValidator:
    def __init__(self, env_file):
        self.env_file = Path(env_file)
        self.errors = []
        self.warnings = []
        self.critical = []
        self.env_vars = {}

    def load_env(self):
        """Load environment variables from file"""
        if not self.env_file.exists():
            self.critical.append(f"Environment file not found: {self.env_file}")
            return False

        with open(self.env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    self.env_vars[key.strip()] = value.strip()
        return True

    def check_required_var(self, var_name, min_length=None, is_critical=False):
        """Check if a required variable exists and is not a placeholder"""
        if var_name not in self.env_vars:
            msg = f"{var_name} is not set"
            if is_critical:
                self.critical.append(msg)
            else:
                self.errors.append(msg)
            return False

        value = self.env_vars[var_name]

        # Check for empty or placeholder values
        placeholders = ['CHANGE_ME', 'your-', 'example', 'localhost', '127.0.0.1']
        if not value or any(p in value for p in placeholders):
            msg = f"{var_name} contains placeholder value: '{value}'"
            if is_critical:
                self.critical.append(msg)
            else:
                self.errors.append(msg)
            return False

        # Check minimum length if specified
        if min_length and len(value) < min_length:
            msg = f"{var_name} is too short ({len(value)} chars, needs {min_length}+)"
            if is_critical:
                self.critical.append(msg)
            else:
                self.errors.append(msg)
            return False

        print(f"{GREEN}✅ {var_name} is configured{NC}")
        return True

    def check_security_settings(self):
        """Validate security-related settings"""
        print(f"\n{BLUE}🔐 SECURITY SETTINGS{NC}")
        print("-" * 50)

        # Check DEBUG is False
        debug = self.env_vars.get('DJANGO_DEBUG', '').lower()
        if debug == 'true':
            self.critical.append("DJANGO_DEBUG=True in production - CRITICAL SECURITY ISSUE!")
        elif debug == 'false':
            print(f"{GREEN}✅ DEBUG is False{NC}")
        else:
            self.warnings.append(f"DJANGO_DEBUG not explicitly set to False (current: '{debug}')")

        # Check SECRET_KEY
        if self.check_required_var('DJANGO_SECRET_KEY', min_length=50, is_critical=True):
            secret_key = self.env_vars['DJANGO_SECRET_KEY']
            if len(secret_key) >= 50:
                print(f"{GREEN}   Length: {len(secret_key)} characters{NC}")

        # Check FERNET_KEY
        if self.check_required_var('FERNET_KEY', is_critical=True):
            fernet_key = self.env_vars['FERNET_KEY']
            if len(fernet_key) == 44:
                print(f"{GREEN}   Valid Fernet key format{NC}")
            else:
                self.errors.append(f"FERNET_KEY has incorrect length ({len(fernet_key)}, should be 44)")

        # Check ALLOWED_HOSTS
        if 'DJANGO_ALLOWED_HOSTS' in self.env_vars:
            allowed_hosts = self.env_vars['DJANGO_ALLOWED_HOSTS']
            if '*' in allowed_hosts:
                self.critical.append("DJANGO_ALLOWED_HOSTS contains wildcard (*) - MAJOR SECURITY RISK!")
            elif 'localhost' in allowed_hosts or '127.0.0.1' in allowed_hosts:
                self.errors.append("DJANGO_ALLOWED_HOSTS contains localhost - replace with production domain")
            else:
                print(f"{GREEN}✅ DJANGO_ALLOWED_HOSTS configured: {allowed_hosts}{NC}")
        else:
            self.critical.append("DJANGO_ALLOWED_HOSTS not set - required for production")

        # Check CORS
        if 'CORS_ALLOWED_ORIGINS' in self.env_vars:
            cors = self.env_vars['CORS_ALLOWED_ORIGINS']
            if '*' in cors:
                self.critical.append("CORS_ALLOWED_ORIGINS contains wildcard (*) - MAJOR SECURITY RISK!")
            elif 'localhost' in cors:
                self.errors.append("CORS_ALLOWED_ORIGINS contains localhost - replace with production domain")
            elif not cors.startswith('https://'):
                self.warnings.append("CORS_ALLOWED_ORIGINS should use HTTPS in production")
            else:
                print(f"{GREEN}✅ CORS_ALLOWED_ORIGINS configured{NC}")
        else:
            self.critical.append("CORS_ALLOWED_ORIGINS not set - required for production")

    def check_database(self):
        """Validate database configuration"""
        print(f"\n{BLUE}🗄️  DATABASE CONFIGURATION{NC}")
        print("-" * 50)

        if 'DATABASE_URL' not in self.env_vars:
            self.critical.append("DATABASE_URL not set - required for production")
            return

        db_url = self.env_vars['DATABASE_URL']

        # Check for SQLite (not recommended for production)
        if 'sqlite' in db_url.lower():
            self.critical.append("Using SQLite in production - use PostgreSQL instead!")
            return

        # Check for placeholder
        if 'CHANGE_ME' in db_url or 'password' in db_url.lower():
            self.critical.append("DATABASE_URL contains placeholder password")
            return

        # Check for PostgreSQL
        if not db_url.startswith('postgresql://') and not db_url.startswith('postgres://'):
            self.errors.append(f"DATABASE_URL should use PostgreSQL (current: {db_url[:20]}...)")
            return

        # Check password strength (extract from URL)
        if '://' in db_url and '@' in db_url:
            try:
                # Extract password from postgresql://user:password@host/db
                credentials = db_url.split('://')[1].split('@')[0]
                if ':' in credentials:
                    password = credentials.split(':')[1]
                    if len(password) < 20:
                        self.warnings.append(f"Database password is short ({len(password)} chars, recommended 20+)")
                    else:
                        print(f"{GREEN}✅ DATABASE_URL configured with strong password{NC}")

                    # Check for common weak passwords
                    weak_passwords = ['password', '123456', 'admin', 'postgres', 'root', '12345678']
                    if password.lower() in weak_passwords:
                        self.critical.append("Database password is a common weak password!")
            except Exception:
                self.warnings.append("Could not validate database password strength")

        print(f"{GREEN}✅ PostgreSQL database configured{NC}")

    def check_optional_settings(self):
        """Check optional but recommended settings"""
        print(f"\n{BLUE}⚙️  OPTIONAL SETTINGS{NC}")
        print("-" * 50)

        # Redis
        if 'REDIS_URL' in self.env_vars and self.env_vars['REDIS_URL']:
            print(f"{GREEN}✅ Redis cache configured (recommended for performance){NC}")
        else:
            self.warnings.append("REDIS_URL not configured - performance may be reduced")

        # Email
        if 'EMAIL_HOST_USER' in self.env_vars and self.env_vars['EMAIL_HOST_USER']:
            if 'your-email' in self.env_vars['EMAIL_HOST_USER']:
                self.warnings.append("Email not configured - password reset won't work")
            else:
                print(f"{GREEN}✅ Email configured{NC}")
        else:
            self.warnings.append("Email not configured - password reset won't work")

        # Sentry
        if 'SENTRY_DSN' in self.env_vars and self.env_vars['SENTRY_DSN']:
            print(f"{GREEN}✅ Sentry error tracking configured (recommended){NC}")
        else:
            self.warnings.append("Sentry not configured - error tracking disabled")

    def check_file_security(self):
        """Check file permissions and security"""
        print(f"\n{BLUE}📁 FILE SECURITY{NC}")
        print("-" * 50)

        # Check file permissions (Unix-like systems)
        try:
            import stat
            file_stat = os.stat(self.env_file)
            mode = file_stat.st_mode

            # Check if readable by others
            if mode & stat.S_IROTH:
                self.warnings.append(f"{self.env_file} is readable by others (chmod 600 recommended)")
            else:
                print(f"{GREEN}✅ File permissions are secure{NC}")
        except Exception:
            # Windows or permission check failed
            print(f"{YELLOW}⚠️  Could not check file permissions (Windows system){NC}")

    def run_validation(self):
        """Run all validation checks"""
        print(f"\n{PURPLE}{'=' * 50}{NC}")
        print(f"{PURPLE}🔍 MI-PYME Production Environment Validation{NC}")
        print(f"{PURPLE}{'=' * 50}{NC}")
        print(f"File: {self.env_file}\n")

        if not self.load_env():
            self.print_summary()
            return False

        self.check_security_settings()
        self.check_database()
        self.check_optional_settings()
        self.check_file_security()

        self.print_summary()

        # Return True if no critical errors
        return len(self.critical) == 0

    def print_summary(self):
        """Print validation summary"""
        print(f"\n{PURPLE}{'=' * 50}{NC}")
        print(f"{PURPLE}📊 VALIDATION SUMMARY{NC}")
        print(f"{PURPLE}{'=' * 50}{NC}\n")

        if self.critical:
            print(f"{PURPLE}🔴 CRITICAL ISSUES: {len(self.critical)}{NC}")
            for issue in self.critical:
                print(f"   {RED}• {issue}{NC}")
            print()

        if self.errors:
            print(f"{RED}❌ ERRORS: {len(self.errors)}{NC}")
            for error in self.errors:
                print(f"   {RED}• {error}{NC}")
            print()

        if self.warnings:
            print(f"{YELLOW}⚠️  WARNINGS: {len(self.warnings)}{NC}")
            for warning in self.warnings:
                print(f"   {YELLOW}• {warning}{NC}")
            print()

        if self.critical:
            print(f"{RED}⛔ VALIDATION FAILED - DO NOT DEPLOY!{NC}")
            print(f"{RED}   Fix all critical issues before deploying to production{NC}\n")
            return False
        elif self.errors:
            print(f"{RED}❌ VALIDATION FAILED{NC}")
            print(f"{RED}   Fix all errors before deploying{NC}\n")
            return False
        elif self.warnings:
            print(f"{YELLOW}⚠️  VALIDATION PASSED WITH WARNINGS{NC}")
            print(f"{YELLOW}   Review warnings before deploying{NC}\n")
            return True
        else:
            print(f"{GREEN}✅ VALIDATION PASSED!{NC}")
            print(f"{GREEN}   Environment is properly configured for production{NC}\n")
            return True


def main():
    """Main entry point"""
    # Determine environment file
    env_file = 'backend/.env.production'

    # Allow override from command line
    if len(sys.argv) > 1:
        env_file = sys.argv[1]

    validator = EnvValidator(env_file)
    success = validator.run_validation()

    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
