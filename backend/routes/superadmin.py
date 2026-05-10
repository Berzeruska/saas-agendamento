from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
import bcrypt
import jwt
from pydantic import BaseModel, field_validator
from database import get_db
from config import Config
from middleware.auth import require_superadmin

superadmin_bp = Blueprint("superadmin", __name__)


class SuperadminLoginSchema(BaseModel):
    usuario: str
    senha: str


class TenantCreateSchema(BaseModel):
    slug: str
    nome: str
    config: dict = {}

    @field_validator("slug")
    @classmethod
    def slug_valido(cls, v):
        import re
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$", v):
            raise ValueError("Slug inválido. Use apenas letras minúsculas, números e hífens (3–64 chars).")
        return v

    @field_validator("nome")
    @classmethod
    def nome_ok(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Nome muito curto")
        return v


@superadmin_bp.route("/login", methods=["POST"])
def superadmin_login():
    try:
        body = SuperadminLoginSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    res = db.table("superadmin").select("id, usuario, senha_hash").eq("usuario", body.usuario.strip()).maybe_single().execute()
    if not res or not res.data:
        return jsonify({"error": "Credenciais inválidas"}), 401

    sa = res.data
    if not bcrypt.checkpw(body.senha.encode(), sa["senha_hash"].encode()):
        return jsonify({"error": "Credenciais inválidas"}), 401

    exp = datetime.now(timezone.utc) + timedelta(hours=Config.JWT_ADMIN_TTL_HOURS)
    token = jwt.encode(
        {"sub": sa["id"], "role": "superadmin", "exp": exp},
        Config.JWT_SECRET,
        algorithm=Config.JWT_ALGORITHM,
    )
    return jsonify({"token": token, "superadmin": {"id": sa["id"], "usuario": sa["usuario"]}})


@superadmin_bp.route("/tenants", methods=["GET"])
@require_superadmin
def list_tenants():
    db = get_db()
    res = db.table("tenants").select("id, slug, nome, ativo, criado_em").order("criado_em", desc=True).execute()
    return jsonify(res.data or [])


@superadmin_bp.route("/tenants", methods=["POST"])
@require_superadmin
def create_tenant():
    try:
        body = TenantCreateSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    existente = db.table("tenants").select("id").eq("slug", body.slug).maybe_single().execute()
    if existente and existente.data:
        return jsonify({"error": f"Slug '{body.slug}' já está em uso"}), 409

    res = db.table("tenants").insert({
        "slug": body.slug,
        "nome": body.nome,
        "config": body.config,
    }).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@superadmin_bp.route("/tenants/<tenant_id>", methods=["PUT"])
@require_superadmin
def update_tenant(tenant_id):
    body = request.get_json(force=True) or {}
    allowed = {k: body[k] for k in ("nome", "config", "ativo") if k in body}
    if not allowed:
        return jsonify({"error": "Nenhum campo para atualizar"}), 400

    db = get_db()
    res = db.table("tenants").update(allowed).eq("id", tenant_id).execute()
    if not res.data:
        return jsonify({"error": "Tenant não encontrado"}), 404
    return jsonify(res.data[0])
