import uuid
import io
from flask import Blueprint, request, jsonify, g
from pydantic import BaseModel
from database import get_db
from config import Config
from middleware.auth import require_client, require_admin
from middleware.tenant import require_tenant

briefings_bp = Blueprint("briefings", __name__)


class CreateBriefingSchema(BaseModel):
    descricao: str = ""
    estilo: str = ""
    local_corpo: str = ""
    tamanho_aprox: str = ""
    periodo_sugerido: str = ""


class PropostaBriefingSchema(BaseModel):
    valor_proposto: float
    periodo_sugerido: str = ""


def _upload_foto(tenant_slug: str, briefing_id: str, file_bytes: bytes, content_type: str) -> str | None:
    """Faz upload para Supabase Storage e retorna a URL pública."""
    try:
        db = get_db()
        bucket = Config.BRIEFINGS_BUCKET
        ext = "jpg" if "jpeg" in content_type else content_type.split("/")[-1]
        path = f"{tenant_slug}/{briefing_id}/foto.{ext}"
        db.storage.from_(bucket).upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        res = db.storage.from_(bucket).get_public_url(path)
        return res
    except Exception as e:
        return None


@briefings_bp.route("", methods=["POST"])
@require_tenant
@require_client
def create_briefing():
    """Cliente envia briefing. Aceita multipart/form-data ou JSON."""
    foto_url = None

    if request.content_type and "multipart/form-data" in request.content_type:
        data = request.form
        foto = request.files.get("foto")
        if foto and foto.filename:
            briefing_id = str(uuid.uuid4())
            foto_bytes = foto.read()
            foto_url = _upload_foto(g.tenant_slug, briefing_id, foto_bytes, foto.content_type or "image/jpeg")
        else:
            briefing_id = str(uuid.uuid4())
        try:
            body = CreateBriefingSchema.model_validate(dict(data))
        except Exception as e:
            return jsonify({"error": str(e)}), 400
    else:
        briefing_id = str(uuid.uuid4())
        raw = request.get_json(force=True) or {}
        foto_url = raw.pop("foto_url", None)
        try:
            body = CreateBriefingSchema.model_validate(raw)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    db = get_db()
    res = db.table("briefings").insert({
        "id": briefing_id,
        "tenant_id": g.tenant_id,
        "cliente_id": g.cliente_id,
        "descricao": body.descricao,
        "foto_url": foto_url,
        "estilo": body.estilo,
        "local_corpo": body.local_corpo,
        "tamanho_aprox": body.tamanho_aprox,
        "periodo_sugerido": body.periodo_sugerido,
        "status": "aguardando",
    }).execute()

    return jsonify(res.data[0] if res.data else {}), 201


@briefings_bp.route("", methods=["GET"])
@require_tenant
@require_admin
def list_briefings():
    """Admin lista todos os briefings do tenant."""
    db = get_db()
    status = request.args.get("status")
    query = (
        db.table("briefings")
        .select("*, clientes(nome, telefone)")
        .eq("tenant_id", g.tenant_id)
        .order("criado_em", desc=True)
    )
    if status:
        query = query.eq("status", status)
    res = query.execute()
    return jsonify(res.data or [])


@briefings_bp.route("/mine", methods=["GET"])
@require_tenant
@require_client
def my_briefings():
    """Cliente vê seus próprios briefings."""
    db = get_db()
    res = (
        db.table("briefings")
        .select("id, descricao, estilo, local_corpo, tamanho_aprox, periodo_sugerido, valor_proposto, status, foto_url, criado_em")
        .eq("tenant_id", g.tenant_id)
        .eq("cliente_id", g.cliente_id)
        .order("criado_em", desc=True)
        .execute()
    )
    return jsonify(res.data or [])


@briefings_bp.route("/<briefing_id>/proposta", methods=["PUT"])
@require_tenant
@require_admin
def enviar_proposta(briefing_id):
    """Admin propõe valor e período para o briefing."""
    try:
        body = PropostaBriefingSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db = get_db()
    briefing = (
        db.table("briefings")
        .select("id, status")
        .eq("id", briefing_id)
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )
    if not briefing or not briefing.data:
        return jsonify({"error": "Briefing não encontrado"}), 404
    if briefing.data["status"] not in ("aguardando",):
        return jsonify({"error": "Briefing já respondido"}), 409

    res = (
        db.table("briefings")
        .update({
            "valor_proposto": body.valor_proposto,
            "periodo_sugerido": body.periodo_sugerido,
            "status": "proposta_enviada",
        })
        .eq("id", briefing_id)
        .eq("tenant_id", g.tenant_id)
        .execute()
    )
    return jsonify(res.data[0] if res.data else {})


@briefings_bp.route("/<briefing_id>/resposta", methods=["PUT"])
@require_tenant
@require_client
def responder_proposta(briefing_id):
    """Cliente aceita ou recusa a proposta."""
    body = request.get_json(force=True) or {}
    aceitar = body.get("aceitar")
    if aceitar not in (True, False):
        return jsonify({"error": "'aceitar' deve ser true ou false"}), 400

    db = get_db()
    briefing = (
        db.table("briefings")
        .select("id, cliente_id, status")
        .eq("id", briefing_id)
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )
    if not briefing or not briefing.data:
        return jsonify({"error": "Briefing não encontrado"}), 404
    if briefing.data["cliente_id"] != g.cliente_id:
        return jsonify({"error": "Não autorizado"}), 403
    if briefing.data["status"] != "proposta_enviada":
        return jsonify({"error": "Proposta não disponível para resposta"}), 409

    novo_status = "confirmado" if aceitar else "recusado"
    res = (
        db.table("briefings")
        .update({"status": novo_status})
        .eq("id", briefing_id)
        .execute()
    )
    return jsonify(res.data[0] if res.data else {})
