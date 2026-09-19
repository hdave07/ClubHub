from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""

    dropbox_app_key: str = ""
    dropbox_app_secret: str = ""
    dropbox_refresh_token: str = ""
    dropbox_inbox_path: str = "/CampusCompass/Inbox"

    sop_base_url: str = "https://sop.utoronto.ca/wp-json"
    sop_campus: str = "St. George"
    sop_user_agent: str = "CampusCompass/0.1"

    database_url: str = "sqlite:///./data/campus_compass.db"
    chroma_persist_dir: str = "./data/chroma"


settings = Settings()
