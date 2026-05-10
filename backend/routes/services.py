from flask import Blueprint, request, jsonify, g
from pydantic import BaseModel, field_validator
from database import get_db
from middleware.auth import require_admin
from middleware.tenant import require_tenant

services_bp = Blueprint("services", __name__)


class ServiceSchema(BaseModel):
    nome: str
    descricao: str = ""
    preco: float
    duracao_minutos: int
    categoria: str = ""

    @field_validator("nome")
    @classmethod
    def nome_ok(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Nome obrigatório")
        return v

    @field_validator("preco")
    @classmethod
    def preco_ok(cls, v):
        if v <= 0:
            raise ValueError("Preço deve ser positivo")
        return round(v, 2)

    @field_validator("duracao_minutos")
    @classmethod
    def dur_ok(cls, v):
        if v < 5 or v > 600:
            raise ValueError("Duração deve ser entre 5 e 600 minutos")
        return v


@services_bp.route("", methods=["GET"])
@require_tenant
def list_services():
    db = get_db()
    res = (
        db.table("servicos")
        .select("id, nome, descricao, preco, duracao_minutos, categoria")
        .eq("tenant_id", g.tenant_id)
        .eq("ativo", True)
        .order("preco")
        .execute()
    )
    return jsonify(res.data)


@services_bp.route("", methods=["POST"])
@require_tenant
@require_admin
def create_service():
    try:
        body = ServiceSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    res = db.table("servicos").insert({**body.model_dump(), "tenant_id": g.tenant_id}).execute()
    return jsonify(res.data), 201


@services_bp.route("/<service_id>", methods=["PUT"])
@require_tenant
@require_admin
def update_service(service_id):
    try:
        body = ServiceSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    res = (
        db.table("servicos")
        .update(body.model_dump())
        .eq("id", service_id)
        .eq("tenant_id", g.tenant_id)
        .execute()
    )
    if not res.data:
        return jsonify({"error": "Serviço não encontrado"}), 404
    return jsonify(res.data)


@services_bp.route("/<service_id>", methods=["DELETE"])
@require_tenant
@require_admin
def delete_service(service_id):
    db = get_db()
    db.table("servicos").update({"ativo": False}).eq("id", service_id).eq("tenant_id", g.tenant_id).execute()
    return jsonify({"ok": True})
