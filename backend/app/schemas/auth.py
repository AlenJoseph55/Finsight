"""
Authentication & Authorization Schemas.
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., description="Google OAuth ID Token received by frontend")


class DemoLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Email address for demo login (stored only as hash)")
