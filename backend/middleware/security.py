from flask import Response
from config import Config


def apply_security_headers(response: Response) -> Response:
    """Injeta headers de segurança em todas as respostas."""

    # Impede que o browser adivinhe o Content-Type
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Impede que o site seja embutido em iframes (clickjacking)
    response.headers["X-Frame-Options"] = "DENY"

    # XSS protection legado (ainda útil em browsers antigos)
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Não vaza URL de referência para terceiros
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Desativa features sensíveis do browser
    response.headers["Permissions-Policy"] = (
        "geolocation=(), camera=(), microphone=(), payment=()"
    )

    # Content Security Policy — restringe origens de scripts, estilos, etc.
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )
    response.headers["Content-Security-Policy"] = csp

    # HSTS — força HTTPS em produção
    if not Config.DEBUG:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )

    # Remove o header que revela que estamos usando Flask
    response.headers.pop("Server", None)
    response.headers.pop("X-Powered-By", None)

    return response
