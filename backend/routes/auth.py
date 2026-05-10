from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify, g
import bcrypt
import jwt
from pydantic import BaseModel, field_validator
from database import get_db
from config import Config
from middleware.tenant import require_tenant

auth_bp = Blueprint("auth", __name__)


class RegisterSchema(BaseModel):
    nome: str
    telefone: str
    senha: str

    @field_validator("nome")
    @classmethod
    def nome_valido(cls, v):
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Nome deve ter entre 2 e 100 caracteres")
        return v

    @field_validator("telefone")
    @classmethod
    def tel_valido(cls, v):
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) < 10 or len(digits) > 11:
            raise ValueError("Telefone inválido (inclua DDD)")
        return digits

    @field_validator("senha")
    @classmethod
    def senha_forte(cls, v):
        if len(v) < 6:
            raise ValueError("Senha deve ter no mínimo 6 caracteres")
        return v


class LoginSchema(BaseModel):
    telefone: str
    senha: str

    @field_validator("telefone")
    @classmethod
    def tel_valido(cls, v):
        return "".join(c for c in v if c.isdigit())


class AdminLoginSchema(BaseModel):
    usuario: str
    senha: str


def _get_client_ip() -> str:
    return request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()


def _check_brute_force(ip: str) -> bool:
    db = get_db()
    res = db.table("login_tentativas").select("*").eq("ip", ip).maybe_single().execute()
    if not res or not res.data:
        return False
    row = res.data
    if row.get("bloqueado_ate"):
        bloqueado_ate = datetime.fromisoformat(row["bloqueado_ate"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) < bloqueado_ate:
            return True
        db.table("login_tentativas").delete().eq("ip", ip).execute()
    return False


def _register_failed_login(ip: str):
    db = get_db()
    res = db.table("login_tentativas").select("*").eq("ip", ip).maybe_single().execute()
    if not res or not res.data:
        db.table("login_tentativas").insert({"ip": ip, "tentativas": 1}).execute()
        return
    tentativas = res.data["tentativas"] + 1
    update = {"tentativas": tentativas, "ultima_vez": datetime.now(timezone.utc).isoformat()}
    if tentativas >= Config.MAX_FAILED_LOGINS:
        update["bloqueado_ate"] = (
            datetime.now(timezone.utc) + timedelta(minutes=Config.LOCKOUT_MINUTES)
        ).isoformat()
    db.table("login_tentativas").update(update).eq("ip", ip).execute()


def _clear_failed_logins(ip: str):
    get_db().table("login_tentativas").delete().eq("ip", ip).execute()


def _issue_token(sub: str, role: str, extra: dict = None) -> str:
    if role == "admin":
        exp = datetime.now(timezone.utc) + timedelta(hours=Config.JWT_ADMIN_TTL_HOURS)
    else:
        exp = datetime.now(timezone.utc) + timedelta(days=Config.JWT_CLIENT_TTL_DAYS)
    payload = {"sub": sub, "role": role, "exp": exp, **(extra or {})}
    return jwt.encode(payload, Config.JWT_SECRET, algorithm=Config.JWT_ALGORITHM)


def _audit(acao: str, detalhes: dict = None, ip: str = None):
    try:
        get_db().table("audit_log").insert({
            "tenant_id": g.get("tenant_id"),
            "acao": acao,
            "detalhes": detalhes or {},
            "ip": ip or _get_client_ip(),
        }).execute()
    except Exception:
        pass


@auth_bp.route("/register", methods=["POST"])
@require_tenant
def register():
    try:
        body = RegisterSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    existente = (
        db.table("clientes")
        .select("id")
        .eq("telefone", body.telefone)
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )
    if existente and existente.data:
        return jsonify({"error": "Este telefone já está cadastrado"}), 409

    senha_hash = bcrypt.hashpw(body.senha.encode(), bcrypt.gensalt(rounds=12)).decode()
    db.table("clientes").insert({
        "tenant_id": g.tenant_id,
        "nome": body.nome,
        "telefone": body.telefone,
        "senha_hash": senha_hash,
    }).execute()

    res2 = (
        db.table("clientes")
        .select("id, nome, telefone")
        .eq("telefone", body.telefone)
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )
    cliente = res2.data if res2 else None
    if not cliente:
        return jsonify({"error": "Erro ao criar conta"}), 500
    token = _issue_token(cliente["id"], "cliente", {"nome": cliente["nome"], "tenant_id": g.tenant_id})
    return jsonify({
        "token": token,
        "cliente": {"id": cliente["id"], "nome": cliente["nome"], "telefone": cliente["telefone"]},
    }), 201


@auth_bp.route("/login", methods=["POST"])
@require_tenant
def login():
    ip = _get_client_ip()
    if _check_brute_force(ip):
        return jsonify({"error": f"Muitas tentativas. Tente novamente em {Config.LOCKOUT_MINUTES} minutos."}), 429

    try:
        body = LoginSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    res = (
        db.table("clientes")
        .select("id, nome, telefone, senha_hash")
        .eq("telefone", body.telefone)
        .eq("tenant_id", g.tenant_id)
        .eq("ativo", True)
        .maybe_single()
        .execute()
    )

    if not res or not res.data:
        _register_failed_login(ip)
        return jsonify({"error": "Telefone ou senha incorretos"}), 401

    cliente = res.data
    if not bcrypt.checkpw(body.senha.encode(), cliente["senha_hash"].encode()):
        _register_failed_login(ip)
        return jsonify({"error": "Telefone ou senha incorretos"}), 401

    _clear_failed_logins(ip)
    token = _issue_token(cliente["id"], "cliente", {"nome": cliente["nome"], "tenant_id": g.tenant_id})
    return jsonify({
        "token": token,
        "cliente": {"id": cliente["id"], "nome": cliente["nome"], "telefone": cliente["telefone"]},
    })


@auth_bp.route("/admin/login", methods=["POST"])
@require_tenant
def admin_login():
    ip = _get_client_ip()
    if _check_brute_force(ip):
        return jsonify({"error": f"Muitas tentativas. Tente em {Config.LOCKOUT_MINUTES} min."}), 429

    try:
        body = AdminLoginSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    res = (
        db.table("admin")
        .select("id, usuario, senha_hash")
        .eq("usuario", body.usuario.strip())
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )

    if not res or not res.data:
        _register_failed_login(ip)
        _audit("admin_login_falhou", {"usuario": body.usuario}, ip)
        return jsonify({"error": "Credenciais inválidas"}), 401

    admin = res.data
    if not bcrypt.checkpw(body.senha.encode(), admin["senha_hash"].encode()):
        _register_failed_login(ip)
        _audit("admin_login_falhou", {"usuario": body.usuario}, ip)
        return jsonify({"error": "Credenciais inválidas"}), 401

    _clear_failed_logins(ip)
    _audit("admin_login_ok", {"usuario": admin["usuario"]}, ip)
    token = _issue_token(admin["id"], "admin", {"tenant_id": g.tenant_id})
    return jsonify({"token": token, "admin": {"id": admin["id"], "usuario": admin["usuario"]}})
