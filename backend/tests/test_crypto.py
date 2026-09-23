"""
Unit Tests for the Privacy & Field-Level Encryption Service.
"""

from backend.app.services.crypto import encrypt_text, decrypt_text, hash_identifier


def test_encryption_roundtrip():
    secret_note = "User PAN: ABCDE1234F, Folio: 987654321, Invested: ₹8,40,000"
    encrypted = encrypt_text(secret_note)

    # Must be encrypted (not plaintext)
    assert encrypted != secret_note
    assert "ABCDE1234F" not in encrypted
    assert "8,40,000" not in encrypted

    # Decryption must restore original exact text
    decrypted = decrypt_text(encrypted)
    assert decrypted == secret_note


def test_empty_string_encryption():
    assert encrypt_text("") == ""
    assert decrypt_text("") == ""


def test_identifier_hashing_pseudonymity():
    email = "investor@example.com"
    hashed1 = hash_identifier(email)
    hashed2 = hash_identifier("  INVESTOR@example.com  ")  # whitespace & case insensitive

    # Hashing must be deterministic and case-normalized
    assert hashed1 == hashed2
    assert len(hashed1) == 64  # SHA-256 is 64 hex characters
    assert "investor" not in hashed1
