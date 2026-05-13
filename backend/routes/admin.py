import uuid
from datetime import date, datetime, timedelta
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


@admin_bp.route("/clients/<client_id>/briefings", methods=["GET"])
@require_tenant
@require_admin
def client_briefings(client_id):
    try:
        from uuid import UUID
        UUID(str(client_id))
    except ValueError:
        return jsonify({"error": "ID inválido"}), 400
    db = get_db()
    res = (
        db.table("briefings")
        .select("id, estilo, local_corpo, tamanho_aprox, status, criado_em, data_proposta, hora_proposta")
        .eq("cliente_id", client_id)
        .eq("tenant_id", g.tenant_id)
        .order("criado_em", desc=True)
        .limit(20)
        .execute()
    )
    return jsonify(res.data or [])


@admin_bp.route("/clients/<client_id>/profile", methods=["GET"])
@require_tenant
@require_admin
def client_profile(client_id):
    db = get_db()
    cliente = (
        db.table("clientes")
        .select("id, nome, telefone, email, data_cadastro")
        .eq("id", client_id)
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )
    if not cliente.data:
        return jsonify({"error": "Cliente não encontrado"}), 404

    ags_concluidos = (
        db.table("agendamentos")
        .select("id", count="exact")
        .eq("cliente_id", client_id)
        .eq("tenant_id", g.tenant_id)
        .eq("status", "concluido")
        .execute()
    )
    briefings_ok = (
        db.table("briefings")
        .select("id, estilo")
        .eq("cliente_id", client_id)
        .eq("tenant_id", g.tenant_id)
        .in_("status", ["confirmado", "concluido"])
        .execute()
    )

    estilos = list({b["estilo"] for b in (briefings_ok.data or []) if b.get("estilo")})
    sessoes = (ags_concluidos.count or 0) + len(briefings_ok.data or [])

    return jsonify({
        **cliente.data,
        "sessoes_feitas": sessoes,
        "estilos": estilos,
        "total_gasto": 0,
    })


@admin_bp.route("/materiais/gastos", methods=["GET"])
@require_tenant
@require_admin
def listar_gastos_materiais():
    hoje = datetime.now()
    mes = request.args.get("mes", type=int, default=hoje.month)
    ano = request.args.get("ano", type=int, default=hoje.year)
    start = f"{ano}-{mes:02d}-01"
    end   = f"{ano+1}-01-01" if mes == 12 else f"{ano}-{mes+1:02d}-01"

    db = get_db()
    res = (
        db.table("gastos_materiais")
        .select("id, valor, descricao, briefing_id, criado_em")
        .eq("tenant_id", g.tenant_id)
        .gte("criado_em", start)
        .lt("criado_em", end)
        .order("criado_em", desc=True)
        .execute()
    )
    return jsonify(res.data or [])


@admin_bp.route("/materiais/gasto", methods=["PUT"])
@require_tenant
@require_admin
def registrar_gasto_materiais():
    body = request.get_json(force=True) or {}
    try:
        valor = float(body.get("valor", 0))
        if valor <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"error": "Valor inválido"}), 400

    briefing_id = body.get("briefing_id") or None
    if briefing_id:
        try:
            uuid.UUID(str(briefing_id))
        except ValueError:
            briefing_id = None

    descricao = str(body.get("descricao", ""))[:300] or None

    db = get_db()
    db.table("gastos_materiais").insert({
        "tenant_id":   g.tenant_id,
        "valor":       valor,
        "briefing_id": briefing_id,
        "descricao":   descricao,
    }).execute()
    return jsonify({"ok": True})


@admin_bp.route("/financeiro", methods=["GET"])
@require_tenant
@require_admin
def financeiro():
    hoje = datetime.now()
    mes = request.args.get("mes", type=int, default=hoje.month)
    ano = request.args.get("ano", type=int, default=hoje.year)

    start = f"{ano}-{mes:02d}-01"
    end   = f"{ano+1}-01-01" if mes == 12 else f"{ano}-{mes+1:02d}-01"

    db = get_db()

    pagamentos_mes = (
        db.table("briefings")
        .select("valor_combinado, data_pagamento, estilo, clientes(nome)")
        .eq("tenant_id", g.tenant_id)
        .eq("pago", True)
        .gte("data_pagamento", start)
        .lt("data_pagamento", end)
        .order("data_pagamento", desc=True)
        .execute()
    )
    todos_pagos = (
        db.table("briefings")
        .select("valor_combinado")
        .eq("tenant_id", g.tenant_id)
        .eq("pago", True)
        .execute()
    )
    gastos_mes = (
        db.table("gastos_materiais")
        .select("valor")
        .eq("tenant_id", g.tenant_id)
        .gte("criado_em", start)
        .lt("criado_em", end)
        .execute()
    )

    lista         = pagamentos_mes.data or []
    total_mes     = round(sum(float(row.get("valor_combinado") or 0) for row in lista), 2)
    total_geral   = round(sum(float(row.get("valor_combinado") or 0) for row in (todos_pagos.data or [])), 2)
    total_gastos  = round(sum(float(row.get("valor") or 0) for row in (gastos_mes.data or [])), 2)
    lucro_liquido = round(total_mes - total_gastos, 2)

    return jsonify({
        "total_mes":     total_mes,
        "total_geral":   total_geral,
        "total_gastos":  total_gastos,
        "lucro_liquido": lucro_liquido,
        "pagamentos":    lista,
    })


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
