"""
FinSight Standardized API Response Envelopes.

Every endpoint returns one of these envelopes:
- SuccessResponse[T]
- ErrorResponse
"""

from datetime import datetime, timezone
from typing import Any, Dict, Generic, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str = Field(..., description="Machine-readable FinSight error code (e.g. FS_QUOTA_4290)")
    http_status: int = Field(..., description="HTTP status code")
    message: str = Field(..., description="Human-readable explanation of error")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Contextual debugging or quota limits")


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    request_id: str
    path: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    data: Optional[T] = None
    error: Optional[ErrorDetail] = None


class SuccessResponse(ApiResponse[T], Generic[T]):
    success: bool = True
    error: Optional[ErrorDetail] = None


class ErrorResponse(ApiResponse[None]):
    success: bool = False
    data: Optional[None] = None
    error: ErrorDetail
