from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "profilermx"
    postgres_url: str = "postgresql://profilermx:profilermx_pass@localhost:5432/profilermx"
    anthropic_api_key: str = ""
    google_api_key: str = ""
    google_cx: str = ""
    ofac_api_key: str = ""
    valida_curp_token: str = "pruebas"
    rapidapi_curp_key: str = ""
    curp_key_api: str = ""
    cache_ttl_seconds: int = 86400  # 24 hours

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
