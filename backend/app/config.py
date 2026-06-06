from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./routine_recovery.db"
    APP_ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"


settings = Settings()
