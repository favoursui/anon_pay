"""
All configuration is read from environment variables / .env file.
No secret is ever hardcoded here.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    #  Privy 
    PRIVY_APP_ID: str
    PRIVY_SECRET_KEY: str

    #  Database 
    DATABASE_URL: str

    #  Blockchain RPCs 
    BASE_RPC_URL: str
    ARC_RPC_URL: str

    #  Encryption (Fernet symmetric key for wallet address at rest) 
    ENCRYPTION_KEY: str

    #  CORS 
    FRONTEND_URL: str = "http://localhost:3000"

    #  App meta 
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_VERSION: str = "v1"
    PROJECT_NAME: str = "AnonPay"

    #  Derived helpers 
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def async_database_url(self) -> str:
        """Convert sync postgres:// → async postgresql+asyncpg://"""
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Cached singleton – safe to call anywhere."""
    return Settings()