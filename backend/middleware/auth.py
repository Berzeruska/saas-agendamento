from functools import wraps
from flask import request, jsonify, g
import jwt
from config import Config


def _extract_token() -> str | None:
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:]
    return None


def require_client(f):
    """Decorator: exige JWT de cliente válido e tenant correspondente."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({"error": "Autenticação necessária"}), 401
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
            if payload.get("role") != "cliente":
                return jsonify({"error": "Acesso não autorizado"}), 403
            # Valida que o token pertence ao tenant ativo
            if g.get("tenant_id") and payload.get("tenant_id") != g.tenant_id:
                return jsonify({"error": "Token inválido para este tenant"}), 403
            g.cliente_id = payload["sub"]
            g.cliente_nome = payload.get("nome", "")
            if not g.get("tenant_id"):
                g.tenant_id = payload.get("tenant_id")
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Sessão expirada. Faça login novamente."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token inválido"}), 401
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """Decorator: exige JWT de admin válido e tenant correspondente."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({"error": "Autenticação necessária"}), 401
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
            if payload.get("role") != "admin":
                return jsonify({"error": "Acesso restrito ao administrador"}), 403
            if g.get("tenant_id") and payload.get("tenant_id") != g.tenant_id:
                return jsonify({"error": "Token inválido para este tenant"}), 403
            g.admin_id = payload["sub"]
            if not g.get("tenant_id"):
                g.tenant_id = payload.get("tenant_id")
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Sessão expirada"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token inválido"}), 401
        return f(*args, **kwargs)
    return decorated


def require_superadmin(f):
    """Decorator: exige JWT de superadmin (global, sem tenant)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({"error": "Autenticação necessária"}), 401
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
            if payload.get("role") != "superadmin":
                return jsonify({"error": "Acesso restrito ao superadmin"}), 403
            g.superadmin_id = payload["sub"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Sessão expirada"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token inválido"}), 401
        return f(*args, **kwargs)
    return decorated
