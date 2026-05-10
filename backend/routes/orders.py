from flask import Blueprint, request, jsonify, g
from pydantic import BaseModel
from database import get_db
from middleware.auth import require_client, require_admin
from middleware.tenant import require_tenant

orders_bp = Blueprint("orders", __name__)


class OrderItemSchema(BaseModel):
    produto_id: str
    quantidade: int
    preco_unitario: float


class CreateOrderSchema(BaseModel):
    agendamento_id: str | None = None
    itens: list[OrderItemSchema]
    total: float
    metodo_pagamento: str

    class Config:
        coerce_numbers_to_str = False


@orders_bp.route("", methods=["POST"])
@require_tenant
@require_client
def create_order():
    try:
        body = CreateOrderSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    if not body.itens:
        return jsonify({"error": "Pedido sem itens"}), 400

    db = get_db()
    pedido_res = db.table("pedidos").insert({
        "tenant_id": g.tenant_id,
        "agendamento_id": body.agendamento_id,
        "cliente_id": g.cliente_id,
        "total": round(body.total, 2),
        "metodo_pagamento": body.metodo_pagamento,
        "status_pagamento": "pendente",
    }).execute()

    pedido = pedido_res.data[0] if pedido_res.data else {}
    itens_rows = [
        {
            "tenant_id": g.tenant_id,
            "pedido_id": pedido["id"],
            "produto_id": item.produto_id,
            "quantidade": item.quantidade,
            "preco_unitario": item.preco_unitario,
        }
        for item in body.itens
    ]
    db.table("pedido_itens").insert(itens_rows).execute()

    for item in body.itens:
        try:
            db.rpc("decrementar_estoque", {"p_produto_id": item.produto_id, "p_quantidade": item.quantidade}).execute()
        except Exception:
            pass

    return jsonify(pedido), 201


@orders_bp.route("", methods=["GET"])
@require_tenant
@require_admin
def list_orders():
    db = get_db()
    res = (
        db.table("pedidos")
        .select(
            "id, total, status_pagamento, metodo_pagamento, criado_em, "
            "clientes(nome, telefone), "
            "pedido_itens(quantidade, preco_unitario, produtos(nome))"
        )
        .eq("tenant_id", g.tenant_id)
        .order("criado_em", desc=True)
        .execute()
    )
    return jsonify(res.data)


@orders_bp.route("/<order_id>/confirm", methods=["PUT"])
@require_tenant
@require_admin
def confirm_payment(order_id):
    db = get_db()
    res = (
        db.table("pedidos")
        .update({"status_pagamento": "pago"})
        .eq("id", order_id)
        .eq("tenant_id", g.tenant_id)
        .select("id, status_pagamento")
        .execute()
    )
    if not res.data:
        return jsonify({"error": "Pedido não encontrado"}), 404
    return jsonify(res.data[0])
