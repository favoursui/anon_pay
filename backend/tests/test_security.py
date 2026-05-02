"""
tests/test_security.py

Unit tests for encryption layer and config loading.
"""
import pytest
from app.core.security import decrypt_wallet, encrypt_wallet


def test_encrypt_decrypt_roundtrip():
    address = "0xabc123def456abc123def456abc123def456abc1"
    token = encrypt_wallet(address)
    assert token != address                        # must not store plaintext
    assert decrypt_wallet(token) == address        # roundtrip


def test_encrypt_produces_different_tokens():
    address = "0xabc123def456abc123def456abc123def456abc1"
    t1 = encrypt_wallet(address)
    t2 = encrypt_wallet(address)
    # Fernet adds randomised IV so same plaintext → different ciphertexts
    assert t1 != t2


def test_decrypt_invalid_raises():
    with pytest.raises(ValueError):
        decrypt_wallet("not-a-valid-fernet-token")


#  Config 

def test_settings_loads_from_env():
    from app.core.config import get_settings
    s = get_settings()
    assert s.PRIVY_APP_ID == "test_app_id"
    assert s.ENVIRONMENT == "test"
    assert not s.is_production


def test_async_db_url_transform():
    from app.core.config import get_settings
    s = get_settings()
    # The DATABASE_URL set in conftest starts with postgresql+asyncpg already
    assert "asyncpg" in s.async_database_url