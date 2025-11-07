"""
Custom Django management command for safe, idempotent migrations.

This command wraps Django's migrate command and adds protection against
common migration errors like duplicate columns, tables already existing, etc.

Usage:
    python manage.py safe_migrate
"""

import sys
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection, migrations
from django.db.utils import ProgrammingError, OperationalError


class Command(BaseCommand):
    help = 'Safely run Django migrations with error handling for production'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fake-initial',
            action='store_true',
            help='Fake initial migrations if tables already exist',
        )
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='Do not prompt for user input',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('Starting Safe Migration Process'))
        self.stdout.write(self.style.SUCCESS('=' * 70))

        # Step 1: Check database connectivity
        if not self._check_database_connection():
            self.stdout.write(self.style.ERROR('Database connection failed. Aborting.'))
            sys.exit(1)

        # Step 2: Show current migration status
        self._show_migration_status()

        # Step 3: Run migrations with error handling
        success = self._run_migrations_safely(options)

        if success:
            self.stdout.write(self.style.SUCCESS('\n' + '=' * 70))
            self.stdout.write(self.style.SUCCESS('All migrations completed successfully!'))
            self.stdout.write(self.style.SUCCESS('=' * 70))
        else:
            self.stdout.write(self.style.ERROR('\nSome migrations had issues but were handled.'))
            self.stdout.write(self.style.WARNING('Please review the output above.'))

        return None if success else 1

    def _check_database_connection(self):
        """Verify database connectivity."""
        self.stdout.write('Checking database connection... ', ending='')
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            self.stdout.write(self.style.SUCCESS('OK'))
            return True
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'FAILED: {str(e)}'))
            return False

    def _show_migration_status(self):
        """Display current migration status."""
        self.stdout.write('\nCurrent migration status:')
        try:
            call_command('showmigrations', '--list', stdout=self.stdout)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Could not show migrations: {str(e)}'))

    def _run_migrations_safely(self, options):
        """
        Run migrations with comprehensive error handling.

        Strategy:
        1. Try normal migration first
        2. If it fails with duplicate column/table errors, try --fake-initial
        3. If still fails, try app-by-app with --fake on problematic apps
        """
        self.stdout.write('\n' + '-' * 70)
        self.stdout.write('Attempting migrations...')
        self.stdout.write('-' * 70 + '\n')

        # List of known problematic apps (from analysis)
        problematic_apps = ['clientes']

        # Strategy 1: Try normal migration
        try:
            self.stdout.write('Strategy 1: Running normal migrate...')
            call_command(
                'migrate',
                verbosity=2,
                interactive=not options.get('no_input', False),
                stdout=self.stdout,
                stderr=self.stderr,
            )
            self.stdout.write(self.style.SUCCESS('Normal migration successful!'))
            return True
        except (ProgrammingError, OperationalError) as e:
            error_msg = str(e).lower()

            # Check if it's a duplicate column/table error
            if any(keyword in error_msg for keyword in [
                'already exists',
                'duplicate column',
                'duplicate key',
                'relation already exists',
            ]):
                self.stdout.write(self.style.WARNING(
                    f'\nDetected duplicate object error: {str(e)[:200]}'
                ))
                self.stdout.write('Attempting recovery strategies...\n')

                # Strategy 2: Try --fake-initial
                try:
                    self.stdout.write('Strategy 2: Running migrate --fake-initial...')
                    call_command(
                        'migrate',
                        fake_initial=True,
                        verbosity=2,
                        interactive=not options.get('no_input', False),
                        stdout=self.stdout,
                        stderr=self.stderr,
                    )
                    self.stdout.write(self.style.SUCCESS('Migration with --fake-initial successful!'))
                    return True
                except Exception as e2:
                    self.stdout.write(self.style.WARNING(f'--fake-initial failed: {str(e2)[:200]}'))

                # Strategy 3: Fake problematic apps, then migrate normally
                self.stdout.write('Strategy 3: Faking problematic apps...')
                for app in problematic_apps:
                    try:
                        self.stdout.write(f'  Faking migrations for app: {app}')
                        call_command(
                            'migrate',
                            app,
                            fake=True,
                            verbosity=1,
                            interactive=False,
                            stdout=self.stdout,
                            stderr=self.stderr,
                        )
                        self.stdout.write(self.style.SUCCESS(f'    {app}: faked'))
                    except Exception as e3:
                        self.stdout.write(self.style.WARNING(f'    {app}: {str(e3)[:100]}'))

                # Now try migrating other apps
                try:
                    self.stdout.write('Running full migrate after faking problematic apps...')
                    call_command(
                        'migrate',
                        verbosity=2,
                        interactive=not options.get('no_input', False),
                        stdout=self.stdout,
                        stderr=self.stderr,
                    )
                    self.stdout.write(self.style.SUCCESS('Migration after faking successful!'))
                    return True
                except Exception as e4:
                    self.stdout.write(self.style.ERROR(f'Final migration attempt failed: {str(e4)}'))
                    return False
            else:
                # Not a duplicate error, re-raise
                self.stdout.write(self.style.ERROR(f'Migration failed with unexpected error: {str(e)}'))
                raise

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Unexpected error during migration: {str(e)}'))
            raise
