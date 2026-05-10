import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SUPABASE_URL = os.environ["SUPABASE_URL"]
    SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    JWT_SECRET = os.environ["JWT_SECRET"]
    JWT_ALGORITHM = "HS256"
    JWT_CLIENT_TTL_DAYS = 7
    JWT_ADMIN_TTL_HOURS = 8

    # Origens permitidas no CORS — separadas por vírgula, ou "*" para todas
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")

    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    FLASK_ENV = os.getenv("FLASK_ENV", "production")

    RATE_LIMIT_DEFAULT = os.getenv("RATE_LIMIT_DEFAULT", "200 per minute")
    RATE_LIMIT_AUTH = os.getenv("RATE_LIMIT_AUTH", "5 per minute")
    RATE_LIMIT_ADMIN_AUTH = os.getenv("RATE_LIMIT_ADMIN_AUTH", "3 per minute")
    RATE_LIMIT_EXPORT = os.getenv("RATE_LIMIT_EXPORT", "2 per minute")

    MAX_FAILED_LOGINS = 10
    LOCKOUT_MINUTES = 15

    # Bucket do Supabase Storage para fotos de briefing
    BRIEFINGS_BUCKET = os.getenv("BRIEFINGS_BUCKET", "briefings")

    @classmethod
    def cors_origins(cls) -> list[str] | str:
        if cls.ALLOWED_ORIGINS == "*":
            return "*"
        return [o.strip() for o in cls.ALLOWED_ORIGINS.split(",") if o.strip()]
