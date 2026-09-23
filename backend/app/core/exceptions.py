"""
FinSight Standardized Exceptions and Error Code Catalog.

Format: FS_{DOMAIN}_{HTTP_STATUS}{OPTIONAL_SUBCODE}
Examples:
  FS_AUTH_4010 - Missing or invalid JWT
  FS_QUOTA_4290 - Monthly quota exceeded
  FS_FEATURE_4031 - Feature disabled for current subscription/user
"""

from enum import Enum
from typing import Any, Dict, Optional


class ErrorCode(str, Enum):
    # Authentication & Authorization (401x, 403x)
    FS_AUTH_4010 = "FS_AUTH_4010"       # Missing or invalid token
    FS_AUTH_4011 = "FS_AUTH_4011"       # Token expired
    FS_AUTHZ_4030 = "FS_AUTHZ_4030"     # Permission denied
    FS_FEATURE_4031 = "FS_FEATURE_4031" # Feature flag disabled for plan or user

    # Quota & Rate Limiting (429x)
    FS_QUOTA_4290 = "FS_QUOTA_4290"     # Quota exhausted (e.g. max uploads/queries per month)
    FS_QUOTA_4291 = "FS_QUOTA_4291"     # Rate limit (too many requests per minute)

    # Resource & Validation (400x, 404x, 422x)
    FS_NOT_FOUND_4040 = "FS_NOT_FOUND_4040"
    FS_VALIDATION_4220 = "FS_VALIDATION_4220"
    FS_FILE_4000 = "FS_FILE_4000"       # Unsupported file type
    FS_FILE_4001 = "FS_FILE_4001"       # File size exceeds limit
    FS_FILE_4002 = "FS_FILE_4002"       # Password required or incorrect for encrypted file


    # AI & External Providers (503x)
    FS_AI_5030 = "FS_AI_5030"           # LLM provider unavailable
    FS_AI_5031 = "FS_AI_5031"           # LLM response parse failure
    FS_MARKET_5032 = "FS_MARKET_5032"   # Market data provider unavailable

    # Internal & Database (500x)
    FS_DB_5000 = "FS_DB_5000"           # Database error
    FS_INTERNAL_5001 = "FS_INTERNAL_5001" # Internal unhandled server error


class FinSightException(Exception):
    """
    Base domain exception for all expected operational errors in FinSight.
    Contains error code, http status code, user-facing message, and arbitrary details.
    """
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        http_status: int = 400,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status
        self.details = details or {}


class QuotaExceededException(FinSightException):
    def __init__(self, quota_key: str, used: int, limit: int, resets_at: Optional[str] = None):
        super().__init__(
            code=ErrorCode.FS_QUOTA_4290,
            message=f"Usage quota exceeded for '{quota_key}'. Used: {used}/{limit}. Please upgrade plan for higher limits.",
            http_status=429,
            details={
                "quota_key": quota_key,
                "used": used,
                "limit": limit,
                "resets_at": resets_at,
            },
        )


class FeatureDisabledException(FinSightException):
    def __init__(self, feature_key: str, reason: str = "Feature not enabled for this user or subscription tier."):
        super().__init__(
            code=ErrorCode.FS_FEATURE_4031,
            message=reason,
            http_status=403,
            details={"feature_key": feature_key},
        )
