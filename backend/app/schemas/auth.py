"""
Authentication & Authorization Schemas.
"""

from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class UserOut(BaseModel):
    id: int
    email_hash: str
    display_name: Optional[str] = None
    auth_method: str = "jwt"
    role: str = "investor"
    is_demo: bool = False
    preferences: Optional[dict] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: Optional[UserOut] = None


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., description="Google OAuth ID Token received by frontend")


class DemoLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Email address for demo login (stored only as hash)")


class DevOAuthRequest(BaseModel):
    email: EmailStr = Field("investor@demo.finsight.internal", description="Simulated email for development OAuth")
    display_name: Optional[str] = Field("Demo Investor", description="Display name for the session")
    role: Literal["investor", "super_admin"] = Field("investor", description="User role ('investor' or 'super_admin')")

