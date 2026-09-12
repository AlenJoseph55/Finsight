"""
Request Context variables for FinSight.
Allows any module, logger, or database query hook to access the current
request_id, client_ip, and authenticated user_id without passing them through every function argument.
"""

from contextvars import ContextVar
from typing import Optional

request_id_ctx: ContextVar[str] = ContextVar("request_id_ctx", default="")
client_ip_ctx: ContextVar[str] = ContextVar("client_ip_ctx", default="")
user_id_ctx: ContextVar[Optional[int]] = ContextVar("user_id_ctx", default=None)
