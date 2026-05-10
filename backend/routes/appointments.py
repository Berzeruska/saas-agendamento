from flask import Blueprint, request, jsonify, g
from pydantic import BaseModel, field_validator
from database import get_db
from middleware.auth import require_client, require_admin
from middleware.tenant import require_tenant

appointments_bp = Blueprint("appointments", __name__)


class CreateAppointmentSchema(BaseModel):
    servico_id: str
    data: str
    hora: str
    notas: str = ""

    @field_validator("data")
    @classmethod
    def data_ok(cls, v):
        import re
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("Data inválida (use YYYY-MM-DD)")
        return v

    @field_validator("hora")
    @classmethod
    def hora_ok(cls, v):
        import re
        if not re.match(r"^\d{2}:\d{2}(:\d{2})?$", v):
            raise ValueError("Hora inválida (use HH:MM)")
        return v[:5]


class SlotSchema(BaseModel):
    data: str
    horas: list[str]

    @field_validator("horas")
    @classmethod
    def horas_ok(cls, v):
        import re
        for h in v:
            if not re.match(r"^\d{2}:\d{2}$", h):
                raise ValueError(f"Hora inválida: {h}")
        return v


@appointments_bp.route("/slots", methods=["GET"])
@require_tenant
def get_slots():
    data = request.args.get("date")
    if not data:
        return jsonify({"error": "Parâmetro 'date' obrigatório"}), 400
    db = get_db()
    res = (
        db.table("horarios_disponiveis")
        .select("id, hora")
        .eq("tenant_id", g.tenant_id)
        .eq("data", data)
        .eq("disponivel", True)
        .order("hora")
        .execute()
    )
    return jsonify(res.data)


@appointments_bp.route("/slots", methods=["POST"])
@require_tenant
@require_admin
def add_slots():
    try:
        body = SlotSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    rows = [{"tenant_id": g.tenant_id, "data": body.data, "hora": h, "disponivel": True} for h in body.horas]
    db.table("horarios_disponiveis").upsert(rows, on_conflict="data,hora,tenant_id").execute()
    return jsonify({"ok": True, "adicionados": len(rows)}), 201


@appointments_bp.route("/slots/<slot_id>", methods=["DELETE"])
@require_tenant
@require_admin
def delete_slot(slot_id):
    db = get_db()
    db.table("horarios_disponiveis").delete().eq("id", slot_id).eq("tenant_id", g.tenant_id).execute()
    return jsonify({"ok": True})


@appointments_bp.route("/admin", methods=["POST"])
@require_tenant
@require_admin
def admin_create_appointment():
    """Admin lança sessão manualmente (fluxo solo, sem portal cliente)."""
    import re, bcrypt, secrets
    body = request.get_json(force=True) or {}
    nome     = body.get("nome", "").strip()
    telefone = body.get("telefone", "").strip()
    servico_id = body.get("servico_id", "")
    data     = body.get("data", "")
    hora     = body.get("hora", "")
    notas    = body.get("notas", "")

    if not all([nome, telefone, servico_id, data, hora]):
        return jsonify({"error": "nome, telefone, servico_id, data e hora são obrigatórios"}), 400
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", data):
        return jsonify({"error": "Data inválida (use YYYY-MM-DD)"}), 400
    if not re.match(r"^\d{2}:\d{2}", hora):
        return jsonify({"error": "Hora inválida (use HH:MM)"}), 400

    db = get_db()
    cliente_res = (
        db.table("clientes")
        .select("id, nome")
        .eq("telefone", telefone)
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )
    if cliente_res and cliente_res.data:
        cliente_id = cliente_res.data["id"]
    else:
        senha_hash = bcrypt.hashpw(secrets.token_bytes(32), bcrypt.gensalt()).decode()
        novo = db.table("clientes").insert({
            "tenant_id": g.tenant_id,
            "nome": nome,
            "telefone": telefone,
            "senha_hash": senha_hash,
        }).execute()
        if not novo.data:
            return jsonify({"error": "Erro ao registrar cliente"}), 500
        cliente_id = novo.data[0]["id"]

    ag_res = db.table("agendamentos").insert({
        "tenant_id": g.tenant_id,
        "cliente_id": cliente_id,
        "servico_id": servico_id,
        "data": data,
        "hora": hora[:5],
        "notas": notas,
        "status": "confirmado",
    }).select("id, data, hora, status, notas, clientes(nome, telefone), servicos(nome, preco)").execute()

    return jsonify(ag_res.data[0] if ag_res.data else {}), 201


@appointments_bp.route("", methods=["POST"])
@require_tenant
@require_client
def create_appointment():
    try:
        body = CreateAppointmentSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    slot = (
        db.table("horarios_disponiveis")
        .select("id")
        .eq("tenant_id", g.tenant_id)
        .eq("data", body.data)
        .eq("hora", body.hora)
        .eq("disponivel", True)
        .maybe_single()
        .execute()
    )
    if not slot or not slot.data:
        return jsonify({"error": "Horário não disponível"}), 409

    ag_res = (
        db.table("agendamentos")
        .insert({
            "tenant_id": g.tenant_id,
            "cliente_id": g.cliente_id,
            "servico_id": body.servico_id,
            "data": body.data,
            "hora": body.hora,
            "notas": body.notas,
            "status": "pendente",
        })
        .select("id, data, hora, status, servicos(nome, preco)")
        .execute()
    )

    db.table("horarios_disponiveis").update({"disponivel": False}).eq("tenant_id", g.tenant_id).eq("data", body.data).eq("hora", body.hora).execute()
    return jsonify(ag_res.data), 201


@appointments_bp.route("/mine", methods=["GET"])
@require_tenant
@require_client
def my_appointments():
    db = get_db()
    res = (
        db.table("agendamentos")
        .select("id, data, hora, status, notas, criado_em, servicos(nome, preco, duracao_minutos)")
        .eq("tenant_id", g.tenant_id)
        .eq("cliente_id", g.cliente_id)
        .order("data", desc=True)
        .execute()
    )
    return jsonify(res.data)


@appointments_bp.route("/day", methods=["GET"])
@require_tenant
@require_admin
def appointments_by_day():
    data = request.args.get("date")
    if not data:
        return jsonify({"error": "Parâmetro 'date' obrigatório"}), 400
    db = get_db()
    res = (
        db.table("agendamentos")
        .select("id, data, hora, status, notas, deposito, clientes(nome, telefone), servicos(nome, preco, duracao_minutos)")
        .eq("tenant_id", g.tenant_id)
        .eq("data", data)
        .order("hora")
        .execute()
    )
    return jsonify(res.data)


@appointments_bp.route("/<ag_id>/status", methods=["PUT"])
@require_tenant
@require_admin
def update_status(ag_id):
    body = request.get_json(force=True) or {}
    status = body.get("status")
    if status not in ("pendente", "confirmado", "concluido", "cancelado"):
        return jsonify({"error": "Status inválido"}), 400

    db = get_db()
    res = db.table("agendamentos").update({"status": status}).eq("id", ag_id).eq("tenant_id", g.tenant_id).execute()
    if not res.data:
        return jsonify({"error": "Agendamento não encontrado"}), 404

    if status == "cancelado":
        ag = db.table("agendamentos").select("data, hora").eq("id", ag_id).maybe_single().execute()
        if ag and ag.data:
            db.table("horarios_disponiveis").update({"disponivel": True}).eq("tenant_id", g.tenant_id).eq("data", ag.data["data"]).eq("hora", ag.data["hora"]).execute()

    return jsonify(res.data)


@appointments_bp.route("/<ag_id>", methods=["DELETE"])
@require_tenant
@require_client
def cancel_appointment(ag_id):
    db = get_db()
    ag = (
        db.table("agendamentos")
        .select("id, cliente_id, data, hora, status")
        .eq("id", ag_id)
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )
    if not ag or not ag.data:
        return jsonify({"error": "Agendamento não encontrado"}), 404
    if ag.data["cliente_id"] != g.cliente_id:
        return jsonify({"error": "Não autorizado"}), 403
    if ag.data["status"] == "concluido":
        return jsonify({"error": "Agendamento já concluído não pode ser cancelado"}), 400

    db.table("agendamentos").update({"status": "cancelado"}).eq("id", ag_id).execute()
    db.table("horarios_disponiveis").update({"disponivel": True}).eq("tenant_id", g.tenant_id).eq("data", ag.data["data"]).eq("hora", ag.data["hora"]).execute()
    return jsonify({"ok": True})
