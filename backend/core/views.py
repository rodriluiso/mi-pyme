"""
Core views for health checks and system monitoring.
"""

from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from django.conf import settings
import os


def health_check(request):
    """
    Health check endpoint for load balancers and monitoring.
    Returns 200 if healthy, 503 if unhealthy.

    Usage: GET /api/health/
    """
    status = {
        "status": "healthy",
        "version": os.getenv("APP_VERSION", "1.0.0"),
        "environment": os.getenv("DJANGO_SETTINGS_MODULE", "unknown").split('.')[-1],
    }

    # Check database connectivity
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        status["database"] = "ok"
    except Exception as e:
        status["database"] = f"error: {str(e)}"
        status["status"] = "unhealthy"

    # Check cache (Redis) if configured
    try:
        cache_key = "health_check_test"
        cache.set(cache_key, "ok", 10)
        if cache.get(cache_key) == "ok":
            status["cache"] = "ok"
        else:
            status["cache"] = "error: cache read failed"
            # Cache failure is not critical for basic operation
    except Exception as e:
        status["cache"] = f"unavailable: {str(e)}"
        # Don't mark as unhealthy if cache is just not configured

    # Return appropriate status code
    status_code = 200 if status["status"] == "healthy" else 503
    return JsonResponse(status, status=status_code)


def readiness_check(request):
    """
    Readiness check for Kubernetes/orchestration.
    Similar to health check but can include additional startup checks.

    Usage: GET /api/ready/
    """
    # For now, use same logic as health check
    # In future, could add checks for:
    # - Migrations applied
    # - Required files present
    # - External services available
    return health_check(request)
