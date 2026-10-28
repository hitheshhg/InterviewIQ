from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:5173"
    
    # MongoDB settings (Phase 2)
    MONGODB_URI: str = ""
    MONGODB_DB_NAME: str = "interviewiq"
    
    # Firebase settings (Phase 3)
    FIREBASE_CREDENTIALS_PATH: str = "serviceAccountKey.json"
    
    # Gemini settings (Phase 5)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-1.5-flash"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
