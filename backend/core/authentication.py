"""
Custom authentication classes for Django REST Framework.
"""
from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Session authentication without CSRF validation.

    Use this for cross-domain scenarios where CSRF cookies may not work
    reliably. Security is still maintained through:
    - SameSite=None cookies with Secure flag
    - CORS restrictions (only allowed origins can make requests)
    - Session-based authentication
    """

    def enforce_csrf(self, request):
        """
        Override to skip CSRF validation.
        """
        return  # Do nothing, skip CSRF check
