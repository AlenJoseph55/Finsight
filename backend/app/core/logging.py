"""
FinSight Structured JSON Logging and IP Privacy Module.

Design Highlights:
- Outputs machine-readable JSON logs for production observability (Grafana/Datadog/CloudWatch).
- Anonymizes IP addresses by masking the last octet (e.g., 103.21.244.12 -> 103.21.244.x)
  to ensure strict compliance with India's DPDP Act 2023 & GDPR while retaining geolocation utility.
- Correlates logs using RequestContext (request_id, user_id).
"""

import json
import logging
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import Request

from backend.app.core.context import request_id_ctx, client_ip_ctx, user_id_ctx


def anonymize_ip(ip: Optional[str]) -> str:
    """
    Masks the last octet of an IPv4 address (e.g. 192.168.1.50 -> 192.168.1.x)
    or masks IPv6 suffix, protecting user privacy.
    """
    if not ip or ip in ("unknown", "testclient"):
        return ip or "unknown"

    # Match standard IPv4
    ipv4_match = re.match(r"^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$", ip.strip())
    if ipv4_match:
        return f"{ipv4_match.group(1)}.x"

    # Match IPv6
    if ":" in ip:
        parts = ip.split(":")
        if len(parts) >= 4:
            return ":".join(parts[:3]) + ":*:*:*:*"

    return ip


def get_client_ip(request: Request) -> str:
    """
    Extracts the client IP from proxy headers (X-Forwarded-For) or the direct connection.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in X-Forwarded-For is the real client IP
        raw_ip = forwarded.split(",")[0].strip()
    elif request.client and request.client.host:
        raw_ip = request.client.host
    else:
        raw_ip = "unknown"
    return raw_ip


class JSONFormatter(logging.Formatter):
    """
    Formats standard python log records into single-line JSON records.
    """
    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": "finsight-backend",
            "request_id": request_id_ctx.get(),
            "ip": client_ip_ctx.get(),
            "user_id": user_id_ctx.get(),
        }

        # Include custom extra fields if provided
        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            log_entry.update(record.extra_data)

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)


def setup_logger(name: str = "finsight") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger


logger = setup_logger("finsight")
