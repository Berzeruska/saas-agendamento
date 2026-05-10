from supabase import create_client, Client
from config import Config

# Singleton — service_role key nunca sai deste módulo
_client: Client | None = None


def get_db() -> Client:
    global _client
    if _client is None:
        _client = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_ROLE_KEY)
    return _client
