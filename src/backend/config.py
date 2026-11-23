import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application configuration loaded from environment variables."""

    def __init__(self) -> None:
        self.app_name: str = "Smart Menu Assistant API"
        self.app_version: str = "0.1.0"
        self.app_env: str = os.getenv("APP_ENV", "development")
        self.app_host: str = os.getenv("APP_HOST", "127.0.0.1")
        self.app_port: int = int(os.getenv("APP_PORT", "8000"))
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./smart_menu.db")

        self.llm_provider: str = os.getenv("LLM_PROVIDER", "gemini")
        self.llm_api_key: str = os.getenv("LLM_API_KEY", "")
        self.llm_model: str = os.getenv("LLM_MODEL", "gemini-2.5-flash")

        raw_origins = os.getenv("CORS_ORIGINS", "*")
        self.cors_origins: list[str] = [
            origin.strip() for origin in raw_origins.split(",") if origin.strip()
        ]


settings = Settings()
