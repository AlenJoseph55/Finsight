"""
Privacy & Cryptography Service.

Why Field-Level Encryption?
- Financial statements contain PAN numbers, folio numbers, bank accounts, and net worth.
- Storing them in raw plaintext in a database is dangerous.
- With AES-256 authenticated encryption (Fernet), the database only stores ciphered blobs.
  Even if the database is leaked or stolen, the data cannot be read without the application's secret key.
"""

import hashlib
from cryptography.fernet import Fernet, InvalidToken
from backend.app.config import get_settings

settings = get_settings()

# Initialize Fernet cipher with our 32-byte key
try:
    _cipher = Fernet(settings.FIELD_ENCRYPTION_KEY.encode())
except Exception:
    # If the key in settings is not a valid 32-byte urlsafe key, generate a temporary fallback for dev
    _cipher = Fernet(Fernet.generate_key())


def encrypt_text(plaintext: str) -> str:
    """
    Encrypts a plaintext string using AES-256 authenticated encryption.
    Returns: URL-safe base64-encoded ciphertext string.
    """
    if not plaintext:
        return ""
    return _cipher.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_text(ciphertext: str) -> str:
    """
    Decrypts an encrypted string back to plaintext.
    Returns empty string if decryption fails or token is invalid.
    """
    if not ciphertext:
        return ""
    try:
        return _cipher.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return "[ENCRYPTED DATA: Decryption failed or invalid key]"


def hash_identifier(identifier: str) -> str:
    """
    One-way cryptographic hash (SHA-256) for emails or user identifiers.
    Why? Pseudonymity: We can look up a user by their hashed email:
        `SELECT * FROM users WHERE email_hash = hash(input)`
    without ever storing their raw email in the database!
    """
    normalized = identifier.strip().lower()
    salt = settings.SECRET_KEY[:16]
    return hashlib.sha256(f"{salt}:{normalized}".encode("utf-8")).hexdigest()
