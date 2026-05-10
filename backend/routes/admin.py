from datetime import date, timedelta
from flask import Blueprint, request, jsonify, g
from database import get_db
from middleware.auth import require_admin
from middleware.tenant import require_tenant

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/clients", methods=["GET"])
@require_tenant
@require_admin
def list_clients():
    db = get_db()
    res = (
        db.table("clientes")
        .select("id, nome, telefone, email, notas_admin, data_cadastro, ativo")
        .eq("tenant_id", g.tenant_id)
        .order("nome")
        .execute()
    )
    return jsonify(res.data)


@admin_bp.route("/clients/<client_id>/notes", methods=["PUT"])
@require_tenant
@require_admin
def update_client_notes(client_id):
    body = request.get_json(force=True) or {}
    notas = str(body.get("notas", ""))[:500]
    db = get_db()
    db.table("clientes").update({"notas_admin": notas}).eq("id", client_id).eq("tenant_id", g.tenant_id).execute()
    return jsonify({"ok": True})


@admin_bp.route("/clients/<client_id>/toggle", methods=["PUT"])
@require_tenant
@require_admin
def toggle_client(client_id):
    db = get_db()
    cliente = (
        db.table("clientes")
        .select("ativo")
        .eq("id", client_id)
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )
    if not cliente.data:
        return jsonify({"error": "Cliente não encontrado"}), 404
    novo = not cliente.data["ativo"]
    db.table("clientes").update({"ativo": novo}).eq("id", client_id).execute()
    return jsonify({"ativo": novo})


@admin_bp.route("/dashboard", methods=["GET"])
@require_tenant
@require_admin
def dashboard():
    db = get_db()
    hoje = date.today().isoformat()
    semana_passada = (date.today() - timedelta(days=7)).isoformat()

    ags_hoje = (
        db.table("agendamentos")
        .select("id, status")
        .eq("tenant_id", g.tenant_id)
        .eq("data", hoje)
        .execute()
    )
    clientes = (
        db.table("clientes")
        .select("id", count="exact")
        .eq("tenant_id", g.tenant_id)
        .eq("ativo", True)
        .execute()
    )
    receita_semana = (
        db.table("pedidos")
        .select("total")
        .eq("tenant_id", g.tenant_id)
        .eq("status_pagamento", "pago")
        .gte("criado_em", semana_passada)
        .execute()
    )
    alertas = (
        db.table("produtos")
        .select("id, nome, quantidade, alerta_minimo")
        .eq("tenant_id", g.tenant_id)
        .eq("ativo", True)
        .execute()
    )

    total_receita = sum(p["total"] for p in (receita_semana.data or []))
    produtos_alerta = [p for p in (alertas.data or []) if p["quantidade"] <= p["alerta_minimo"]]

    ags = ags_hoje.data or []
    return jsonify({
        "hoje": {
            "total": len(ags),
            "pendentes": sum(1 for a in ags if a["status"] == "pendente"),
            "confirmados": sum(1 for a in ags if a["status"] == "confirmado"),
            "concluidos": sum(1 for a in ags if a["status"] == "concluido"),
        },
        "total_clientes": clientes.count or 0,
        "receita_7_dias": round(total_receita, 2),
        "alertas_estoque": produtos_alerta,
    })
