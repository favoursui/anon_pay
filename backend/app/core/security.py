"""
Fernet-based encryption for wallet addresses stored at rest.
Key comes exclusively from settings (ENCRYPTION_KEY env var).
"""
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import get_settings


def _cipher() -> Fernet:
    settings = get_settings()
    return Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_wallet(address: str) -> str:
    """Encrypt a wallet address before storing in DB."""
    return _cipher().encrypt(address.encode()).decode()


def decrypt_wallet(token: str) -> str:
    """Decrypt a stored wallet token back to plain address."""
    try:
        return _cipher().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Wallet address decryption failed – key mismatch?") from exc