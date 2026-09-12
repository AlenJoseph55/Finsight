"""
FinSight Core Infrastructure Package.
Includes: Exceptions, Response Envelopes, Structured Logging, Contextvars.
"""
from backend.app.core.exceptions import FinSightException, ErrorCode, QuotaExceededException, FeatureDisabledException
from backend.app.core.responses import ApiResponse, SuccessResponse, ErrorResponse, ErrorDetail
from backend.app.core.logging import logger, anonymize_ip, get_client_ip
from backend.app.core.context import request_id_ctx, client_ip_ctx, user_id_ctx

__all__ = [
    "FinSightException",
    "ErrorCode",
    "QuotaExceededException",
    "FeatureDisabledException",
    "ApiResponse",
    "SuccessResponse",
    "ErrorResponse",
    "ErrorDetail",
    "logger",
    "anonymize_ip",
    "get_client_ip",
    "request_id_ctx",
    "client_ip_ctx",
    "user_id_ctx",
]
