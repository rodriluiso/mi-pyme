"""
Django settings module auto-detection.

Automatically loads the appropriate settings module based on DJANGO_SETTINGS_MODULE.
If not set, defaults to development settings.
"""

import os

# Determine which settings module to use
settings_module = os.getenv('DJANGO_SETTINGS_MODULE', 'core.settings.dev')

# Extract the environment name
if settings_module.endswith('.prod'):
    from .prod import *
elif settings_module.endswith('.desktop'):
    from .desktop import *
elif settings_module.endswith('.test'):
    from .test import *
else:
    from .dev import *
