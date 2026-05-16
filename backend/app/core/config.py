from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    #  Privy 
    PRIVY_APP_ID: str
    PRIVY_SECRET_KEY: str

    #  Database 
    DATABASE_URL: str

    #  Blockchain 
    CHAIN_RPC_URL: str
    CHAIN_ID: int
    CHAIN_NAME: str
    USDC_CONTRACT_ADDRESS: str

    #  Encryption 
    ENCRYPTION_KEY: str

    #  CORS 
    FRONTEND_URL: str = "http://localhost:3000"

    #  App 
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_VERSION: str = "v1"
    PROJECT_NAME: str = "AnonPay"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def async_database_url(self) -> str:
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
    return Settings()