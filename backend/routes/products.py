from flask import Blueprint, request, jsonify, g
from pydantic import BaseModel, field_validator
from database import get_db
from middleware.auth import require_admin
from middleware.tenant import require_tenant

products_bp = Blueprint("products", __name__)


class ProductSchema(BaseModel):
    nome: str
    preco: float
    quantidade: int
    alerta_minimo: int = 5

    @field_validator("nome")
    @classmethod
    def nome_ok(cls, v):
        return v.strip()

    @field_validator("preco")
    @classmethod
    def preco_ok(cls, v):
        if v < 0:
            raise ValueError("Preço não pode ser negativo")
        return round(v, 2)


@products_bp.route("", methods=["GET"])
@require_tenant
def list_products():
    db = get_db()
    res = (
        db.table("produtos")
        .select("id, nome, preco, quantidade, alerta_minimo")
        .eq("tenant_id", g.tenant_id)
        .eq("ativo", True)
        .order("nome")
        .execute()
    )
    return jsonify(res.data)


@products_bp.route("", methods=["POST"])
@require_tenant
@require_admin
def create_product():
    try:
        body = ProductSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    res = db.table("produtos").insert({**body.model_dump(), "tenant_id": g.tenant_id}).execute()
    return jsonify(res.data[0] if res.data else {}), 201


@products_bp.route("/<product_id>", methods=["PUT"])
@require_tenant
@require_admin
def update_product(product_id):
    try:
        body = ProductSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    res = (
        db.table("produtos")
        .update(body.model_dump())
        .eq("id", product_id)
        .eq("tenant_id", g.tenant_id)
        .execute()
    )
    if not res.data:
        return jsonify({"error": "Produto não encontrado"}), 404
    return jsonify(res.data[0])


@products_bp.route("/<product_id>/stock", methods=["PUT"])
@require_tenant
@require_admin
def update_stock(product_id):
    body = request.get_json(force=True) or {}
    quantidade = body.get("quantidade")
    if quantidade is None or not isinstance(quantidade, int) or quantidade < 0:
        return jsonify({"error": "Quantidade inválida"}), 400

    db = get_db()
    db.table("produtos").update({"quantidade": quantidade}).eq("id", product_id).eq("tenant_id", g.tenant_id).execute()
    return jsonify({"ok": True})


@products_bp.route("/<product_id>", methods=["DELETE"])
@require_tenant
@require_admin
def delete_product(product_id):
    db = get_db()
    db.table("produtos").update({"ativo": False}).eq("id", product_id).eq("tenant_id", g.tenant_id).execute()
    return jsonify({"ok": True})
