from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "profilermx"
    postgres_url: str = "postgresql://profilermx:profilermx_pass@localhost:5432/profilermx"
    ofac_api_key: str = ""
    cache_ttl_seconds: int = 86400  # 24 hours

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
