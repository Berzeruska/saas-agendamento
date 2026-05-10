import csv
import io
import zipfile
from datetime import datetime
from flask import Blueprint, jsonify, send_file, g
from database import get_db
from middleware.auth import require_admin
from middleware.tenant import require_tenant

export_bp = Blueprint("export", __name__)


def _make_csv(headers: list[str], rows: list[dict]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=headers, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


@export_bp.route("/csv", methods=["GET"])
@require_tenant
@require_admin
def export_all_csv():
    """Retorna ZIP com 4 CSVs: clientes, agendamentos, pedidos, estoque."""
    db = get_db()
    tid = g.tenant_id

    clientes_data = (
        db.table("clientes")
        .select("nome, telefone, email, data_cadastro, ativo")
        .eq("tenant_id", tid)
        .order("nome")
        .execute()
        .data or []
    )
    clientes_csv = _make_csv(["nome", "telefone", "email", "data_cadastro", "ativo"], clientes_data)

    ags_data = (
        db.table("agendamentos")
        .select("data, hora, status, notas, criado_em, clientes(nome, telefone), servicos(nome, preco)")
        .eq("tenant_id", tid)
        .order("data", desc=True)
        .execute()
        .data or []
    )
    ags_rows = [
        {
            "data": a.get("data"),
            "hora": a.get("hora"),
            "status": a.get("status"),
            "cliente": (a.get("clientes") or {}).get("nome", ""),
            "telefone": (a.get("clientes") or {}).get("telefone", ""),
            "servico": (a.get("servicos") or {}).get("nome", ""),
            "preco": (a.get("servicos") or {}).get("preco", ""),
            "notas": a.get("notas", ""),
            "criado_em": a.get("criado_em"),
        }
        for a in ags_data
    ]
    ags_csv = _make_csv(["data", "hora", "status", "cliente", "telefone", "servico", "preco", "notas", "criado_em"], ags_rows)

    pedidos_data = (
        db.table("pedidos")
        .select("total, status_pagamento, metodo_pagamento, criado_em, clientes(nome)")
        .eq("tenant_id", tid)
        .order("criado_em", desc=True)
        .execute()
        .data or []
    )
    pedidos_rows = [
        {
            "data": p.get("criado_em", "")[:10],
            "cliente": (p.get("clientes") or {}).get("nome", ""),
            "total": p.get("total"),
            "status": p.get("status_pagamento"),
            "metodo": p.get("metodo_pagamento"),
        }
        for p in pedidos_data
    ]
    pedidos_csv = _make_csv(["data", "cliente", "total", "status", "metodo"], pedidos_rows)

    estoque_data = (
        db.table("produtos")
        .select("nome, preco, quantidade, alerta_minimo")
        .eq("tenant_id", tid)
        .eq("ativo", True)
        .order("nome")
        .execute()
        .data or []
    )
    estoque_csv = _make_csv(["nome", "preco", "quantidade", "alerta_minimo"], estoque_data)

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        zf.writestr(f"clientes_{ts}.csv",    clientes_csv.encode("utf-8-sig"))
        zf.writestr(f"agendamentos_{ts}.csv", ags_csv.encode("utf-8-sig"))
        zf.writestr(f"financeiro_{ts}.csv",  pedidos_csv.encode("utf-8-sig"))
        zf.writestr(f"estoque_{ts}.csv",     estoque_csv.encode("utf-8-sig"))
    zip_buf.seek(0)

    filename = f"backup_{datetime.now().strftime('%Y%m%d_%H%M')}.zip"
    return send_file(zip_buf, mimetype="application/zip", as_attachment=True, download_name=filename)
