import time
from urllib.parse import urlparse
from flask import request, g, jsonify
from functools import wraps

# Cache em memória: slug → (tenant_dict, expiry_timestamp)
_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 60  # segundos


def _cached_tenant(slug: str) -> dict | None:
    entry = _cache.get(slug)
    if entry and entry[1] > time.time():
        return entry[0]
    _cache.pop(slug, None)
    return None


def _store_cache(slug: str, tenant: dict):
    _cache[slug] = (tenant, time.time() + _CACHE_TTL)


def _slug_from_request() -> str | None:
    # 1. Header explícito (dev local e apps móveis)
    slug = request.headers.get("X-Tenant-Slug", "").strip()
    if slug:
        return slug

    # 2. Extrai do hostname da Origin
    origin = request.headers.get("Origin", "")
    if origin:
        hostname = urlparse(origin).hostname or ""
        if hostname not in ("localhost", "127.0.0.1", ""):
            parts = hostname.split(".")
            # subdomain.dominio.tld  → slug = subdomain
            if len(parts) >= 3:
                return parts[0]
            # dominio.tld sem subdomain → usa o próprio hostname como slug
            if len(parts) == 2:
                return parts[0]

    return None


def resolve_tenant():
    """Hook before_request: popula g.tenant_id / g.tenant_config / g.tenant_slug."""
    g.tenant_id = None
    g.tenant_config = {}
    g.tenant_slug = None

    slug = _slug_from_request()
    if not slug:
        return

    tenant = _cached_tenant(slug)
    if tenant is None:
        try:
            from database import get_db
            res = (
                get_db()
                .table("tenants")
                .select("id, slug, nome, config")
                .eq("slug", slug)
                .eq("ativo", True)
                .maybe_single()
                .execute()
            )
            tenant = res.data if (res and res.data) else None
            if tenant:
                _store_cache(slug, tenant)
        except Exception:
            # Tabela não existe ou banco indisponível — g.tenant_id permanece None
            pass

    if tenant:
        g.tenant_id = tenant["id"]
        g.tenant_config = tenant.get("config") or {}
        g.tenant_slug = tenant["slug"]


def require_tenant(f):
    """Decorator: exige tenant resolvido. Retorna 400 se ausente."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not g.get("tenant_id"):
            return jsonify({"error": "Tenant não identificado. Envie o header X-Tenant-Slug."}), 400
        return f(*args, **kwargs)
    return decorated
