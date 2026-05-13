import uuid
import io
import re
import traceback
from collections import defaultdict
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g
from pydantic import BaseModel, field_validator
from PIL import Image
import bleach
from database import get_db
from config import Config
from middleware.auth import require_client, require_admin
from middleware.tenant import require_tenant

briefings_bp = Blueprint("briefings", __name__)

# ── Constantes de validação ───────────────────────────────────────────────────

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_IMAGE_PX    = 1200
ALLOWED_TYPES   = {"image/jpeg", "image/png", "image/webp"}

# ── Rate limit de upload (in-memory, por IP) ─────────────────────────────────

_upload_times: dict[str, list] = defaultdict(list)

def _upload_rate_exceeded(ip: str, max_per_hour: int = 10) -> bool:
    now    = datetime.now()
    cutoff = now - timedelta(hours=1)
    recent = [t for t in _upload_times[ip] if t > cutoff]
    if len(recent) >= max_per_hour:
        _upload_times[ip] = recent
        return True
    recent.append(now)
    _upload_times[ip] = recent
    return False

# ── Helpers ───────────────────────────────────────────────────────────────────

def _client_ip() -> str:
    return request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()

def _audit(acao: str, detalhes: dict = None):
    try:
        get_db().table("audit_log").insert({
            "tenant_id": getattr(g, "tenant_id", None),
            "acao": acao,
            "detalhes": detalhes or {},
            "ip": _client_ip(),
        }).execute()
    except Exception:
        pass

def _sanitize(text: str, max_len: int = 1000) -> str:
    if not text:
        return ""
    return bleach.clean(str(text), tags=[], strip=True)[:max_len]

def _valid_uuid(id_str: str) -> bool:
    try:
        uuid.UUID(str(id_str))
        return True
    except (ValueError, AttributeError):
        return False

def _detect_image_type(data: bytes) -> str | None:
    """Detecta tipo real pela assinatura de bytes (magic bytes)."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89\x50\x4e\x47\x0d\x0a\x1a\x0a":
        return "image/png"
    if data[:4] == b"\x52\x49\x46\x46" and data[8:12] == b"\x57\x45\x42\x50":
        return "image/webp"
    return None

def _resize_image(data: bytes, max_px: int = MAX_IMAGE_PX) -> tuple[bytes, str]:
    """Redimensiona para max_px no lado maior. Retorna (bytes, ext)."""
    img = Image.open(io.BytesIO(data))
    fmt = (img.format or "JPEG").upper()
    if fmt not in ("JPEG", "PNG", "WEBP"):
        fmt = "JPEG"

    # Normaliza modos com transparência para RGB (necessário para JPEG)
    if img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        converted = img.convert("RGBA") if img.mode == "P" else img
        bg.paste(converted, mask=converted.split()[-1] if converted.mode == "RGBA" else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > max_px:
        ratio = max_px / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    out = io.BytesIO()
    img.save(out, format=fmt, quality=85, optimize=True)
    ext_map = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
    return out.getvalue(), ext_map[fmt]


def _signed_url_from_public(public_url: str) -> str:
    """Troca URL pública por URL assinada (válida 1h). Retorna original em caso de erro."""
    if not public_url:
        return public_url
    marker = f"/object/public/{Config.BRIEFINGS_BUCKET}/"
    idx = public_url.find(marker)
    if idx == -1:
        return public_url
    path = public_url[idx + len(marker):]
    try:
        result = get_db().storage.from_(Config.BRIEFINGS_BUCKET).create_signed_url(path, 3600)
        return result.get("signedURL") or public_url
    except Exception as e:
        print(f"[signed_url] erro: {e}", flush=True)
        return public_url


def _upload_to_storage(tenant_id: str, cliente_id: str, data: bytes, ext: str) -> str:
    db  = get_db()
    fmt = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")
    path = f"{tenant_id}/{cliente_id}/{uuid.uuid4()}.{ext}"
    db.storage.from_(Config.BRIEFINGS_BUCKET).upload(
        path=path,
        file=data,
        file_options={"content-type": fmt, "upsert": "false"},
    )
    return db.storage.from_(Config.BRIEFINGS_BUCKET).get_public_url(path)

# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateBriefingSchema(BaseModel):
    descricao: str = ""
    estilo: str = ""
    local_corpo: str = ""
    tamanho_aprox: str = ""
    periodo_sugerido: str = ""
    data_proposta: str = ""
    hora_proposta: str = ""
    foto_url: str = ""


class PropostaBriefingSchema(BaseModel):
    data_proposta: str
    hora_proposta: str = ""
    notas_admin: str = ""

    @field_validator("data_proposta")
    @classmethod
    def data_ok(cls, v):
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("Data inválida (use YYYY-MM-DD)")
        return v

    @field_validator("hora_proposta")
    @classmethod
    def hora_ok(cls, v):
        if not v:
            return ""
        if not re.match(r"^\d{2}:\d{2}", v):
            raise ValueError("Hora inválida (use HH:MM)")
        return v[:5]

# ── Rotas ─────────────────────────────────────────────────────────────────────

@briefings_bp.route("/upload-foto", methods=["POST"])
@require_tenant
@require_client
def upload_foto():
    ip = _client_ip()
    if _upload_rate_exceeded(ip):
        return jsonify({"error": "Muitos uploads. Tente novamente em 1 hora."}), 429

    if not request.content_type or "multipart/form-data" not in request.content_type:
        return jsonify({"error": "Envie a foto como multipart/form-data"}), 400

    foto = request.files.get("foto")
    if not foto or not foto.filename:
        return jsonify({"error": "Nenhuma foto enviada"}), 400

    data = foto.read()

    if len(data) > MAX_UPLOAD_BYTES:
        return jsonify({"error": "Foto muito grande. Máximo 5 MB."}), 400

    real_type = _detect_image_type(data)
    if real_type not in ALLOWED_TYPES:
        return jsonify({"error": "Formato inválido. Envie JPEG, PNG ou WebP."}), 400

    try:
        resized, ext = _resize_image(data)
    except Exception as e:
        print(f"[upload-foto] ERRO no resize: {e}\n{traceback.format_exc()}", flush=True)
        return jsonify({"error": "Não foi possível processar a imagem. Tente outra."}), 400

    try:
        foto_url = _upload_to_storage(g.tenant_id, g.cliente_id, resized, ext)
        print(f"[upload-foto] OK — tenant={g.tenant_id} cliente={g.cliente_id} ext={ext} bytes={len(resized)} url={foto_url}", flush=True)
    except Exception as e:
        print(f"[upload-foto] ERRO no storage: {e}\n{traceback.format_exc()}", flush=True)
        return jsonify({"error": "Erro ao salvar foto. Tente novamente."}), 500

    _audit("foto_upload", {"cliente_id": g.cliente_id, "ext": ext, "bytes": len(resized)})
    return jsonify({"foto_url": foto_url}), 201


@briefings_bp.route("", methods=["POST"])
@require_tenant
@require_client
def create_briefing():
    foto_url = None

    if request.content_type and "multipart/form-data" in request.content_type:
        data    = request.form
        foto_f  = request.files.get("foto")
        raw     = dict(data)
        raw["foto_url"] = ""
        try:
            body = CreateBriefingSchema.model_validate(raw)
        except Exception as e:
            return jsonify({"error": str(e)}), 400
        if foto_f and foto_f.filename:
            file_data = foto_f.read()
            if len(file_data) <= MAX_UPLOAD_BYTES and _detect_image_type(file_data) in ALLOWED_TYPES:
                try:
                    resized, ext = _resize_image(file_data)
                    foto_url = _upload_to_storage(g.tenant_id, g.cliente_id, resized, ext)
                except Exception:
                    pass
    else:
        raw = request.get_json(force=True) or {}
        try:
            body = CreateBriefingSchema.model_validate(raw)
        except Exception as e:
            return jsonify({"error": str(e)}), 400
        foto_url = body.foto_url or None

    # Valida data_proposta e hora_proposta do cliente (opcionais)
    data_proposta_cliente = None
    if body.data_proposta and re.match(r"^\d{4}-\d{2}-\d{2}$", body.data_proposta):
        data_proposta_cliente = body.data_proposta

    hora_proposta_cliente = None
    if body.hora_proposta and re.match(r"^\d{2}:\d{2}$", body.hora_proposta):
        hora_proposta_cliente = body.hora_proposta[:5]

    briefing_id = str(uuid.uuid4())
    db  = get_db()
    res = db.table("briefings").insert({
        "id":               briefing_id,
        "tenant_id":        g.tenant_id,
        "cliente_id":       g.cliente_id,
        "descricao":        _sanitize(body.descricao, 2000),
        "foto_url":         foto_url,
        "estilo":           _sanitize(body.estilo, 100),
        "local_corpo":      _sanitize(body.local_corpo, 100),
        "tamanho_aprox":    _sanitize(body.tamanho_aprox, 100),
        "periodo_sugerido": _sanitize(body.periodo_sugerido, 300),
        "data_proposta":    data_proposta_cliente,
        "hora_proposta":    hora_proposta_cliente,
        "status":           "aguardando",
    }).execute()

    _audit("briefing_criado", {"briefing_id": briefing_id, "cliente_id": g.cliente_id})
    return jsonify(res.data[0] if res.data else {}), 201


@briefings_bp.route("", methods=["GET"])
@require_tenant
@require_admin
def list_briefings():
    db         = get_db()
    status     = request.args.get("status")
    cliente_id = request.args.get("cliente_id")

    query = (
        db.table("briefings")
        .select("*, clientes(id, nome, telefone)")
        .eq("tenant_id", g.tenant_id)
        .order("criado_em", desc=True)
    )
    if status:
        query = query.eq("status", status)
    if cliente_id:
        if not _valid_uuid(cliente_id):
            return jsonify({"error": "ID inválido"}), 400
        query = query.eq("cliente_id", cliente_id)

    res = query.execute()
    briefings = res.data or []
    for b in briefings:
        if b.get("foto_url"):
            b["foto_url"] = _signed_url_from_public(b["foto_url"])
    return jsonify(briefings)


@briefings_bp.route("/agenda", methods=["GET"])
@require_tenant
@require_admin
def agenda_briefings():
    data = request.args.get("date")
    if not data:
        return jsonify({"error": "Parâmetro 'date' obrigatório"}), 400
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", data):
        return jsonify({"error": "Data inválida (use YYYY-MM-DD)"}), 400
    try:
        db = get_db()
        res = (
            db.table("briefings")
            .select("*, clientes(id, nome, telefone)")
            .eq("tenant_id", g.tenant_id)
            .eq("data_proposta", data)
            .eq("status", "confirmado")
            .order("hora_proposta")
            .execute()
        )
        agenda = res.data or []
        for b in agenda:
            if b.get("foto_url"):
                b["foto_url"] = _signed_url_from_public(b["foto_url"])
        return jsonify(agenda)
    except Exception as e:
        print(f"[agenda_briefings] ERRO date={data} tenant={g.tenant_id}: {e}\n{traceback.format_exc()}", flush=True)
        return jsonify({"error": "Erro ao carregar agenda"}), 500


@briefings_bp.route("/historico", methods=["GET"])
@require_tenant
@require_admin
def historico_briefings():
    db = get_db()
    sel = "id, estilo, local_corpo, data_proposta, data_pagamento, hora_proposta, valor_combinado, pago, status, criado_em, clientes(id, nome, telefone)"

    concluidos = (
        db.table("briefings")
        .select(sel)
        .eq("tenant_id", g.tenant_id)
        .eq("status", "concluido")
        .order("criado_em", desc=True)
        .execute()
    ).data or []

    pagos = (
        db.table("briefings")
        .select(sel)
        .eq("tenant_id", g.tenant_id)
        .eq("pago", True)
        .neq("status", "concluido")
        .order("data_pagamento", desc=True)
        .execute()
    ).data or []

    todos = concluidos + pagos
    todos.sort(key=lambda x: x.get("criado_em") or "", reverse=True)
    return jsonify(todos)


@briefings_bp.route("/agenda/mes", methods=["GET"])
@require_tenant
@require_admin
def agenda_mes():
    try:
        mes = int(request.args.get("mes", 0))
        ano = int(request.args.get("ano", 0))
        if not (1 <= mes <= 12) or ano < 2020:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"error": "Parâmetros mes e ano inválidos"}), 400

    start = f"{ano}-{mes:02d}-01"
    end   = f"{ano+1}-01-01" if mes == 12 else f"{ano}-{mes+1:02d}-01"

    try:
        db = get_db()
        res = (
            db.table("briefings")
            .select("data_proposta")
            .eq("tenant_id", g.tenant_id)
            .eq("status", "confirmado")
            .gte("data_proposta", start)
            .lt("data_proposta", end)
            .execute()
        )
        datas = list({b["data_proposta"] for b in (res.data or []) if b.get("data_proposta")})
        return jsonify({"datas": datas})
    except Exception as e:
        print(f"[agenda_mes] ERRO mes={mes} ano={ano} tenant={g.tenant_id}: {e}\n{traceback.format_exc()}", flush=True)
        return jsonify({"datas": []}), 200


@briefings_bp.route("/mine", methods=["GET"])
@require_tenant
@require_client
def my_briefings():
    db = get_db()
    res = (
        db.table("briefings")
        .select("id, descricao, estilo, local_corpo, tamanho_aprox, periodo_sugerido, data_proposta, hora_proposta, notas_admin, status, foto_url, valor_combinado, pago, data_pagamento, criado_em")
        .eq("tenant_id", g.tenant_id)
        .eq("cliente_id", g.cliente_id)
        .order("criado_em", desc=True)
        .execute()
    )
    meus = res.data or []
    for b in meus:
        if b.get("foto_url"):
            b["foto_url"] = _signed_url_from_public(b["foto_url"])
    return jsonify(meus)


@briefings_bp.route("/<briefing_id>/proposta", methods=["PUT"])
@require_tenant
@require_admin
def enviar_proposta(briefing_id):
    if not _valid_uuid(briefing_id):
        return jsonify({"error": "ID inválido"}), 400
    try:
        body = PropostaBriefingSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db      = get_db()
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
    if briefing.data["status"] != "aguardando":
        return jsonify({"error": "Briefing já processado"}), 409

    res = (
        db.table("briefings")
        .update({
            "data_proposta": body.data_proposta,
            "hora_proposta": body.hora_proposta,
            "notas_admin":   _sanitize(body.notas_admin, 500),
            "status":        "confirmado",
        })
        .eq("id", briefing_id)
        .eq("tenant_id", g.tenant_id)
        .execute()
    )
    return jsonify(res.data[0] if res.data else {})


@briefings_bp.route("/<briefing_id>/reagendar", methods=["PUT"])
@require_tenant
@require_admin
def reagendar_briefing(briefing_id):
    if not _valid_uuid(briefing_id):
        return jsonify({"error": "ID inválido"}), 400
    try:
        body = PropostaBriefingSchema.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    db      = get_db()
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
    if briefing.data["status"] not in ("aguardando", "proposta_enviada", "confirmado"):
        return jsonify({"error": "Não é possível reagendar neste status"}), 409

    update_data: dict = {
        "data_proposta": body.data_proposta,
        "hora_proposta": body.hora_proposta,
        "status":        "confirmado",
    }
    if body.notas_admin:
        update_data["notas_admin"] = _sanitize(body.notas_admin, 500)

    res = (
        db.table("briefings")
        .update(update_data)
        .eq("id", briefing_id)
        .eq("tenant_id", g.tenant_id)
        .execute()
    )
    return jsonify(res.data[0] if res.data else {})


@briefings_bp.route("/<briefing_id>", methods=["DELETE"])
@require_tenant
@require_admin
def cancelar_briefing(briefing_id):
    if not _valid_uuid(briefing_id):
        return jsonify({"error": "ID inválido"}), 400
    db = get_db()
    briefing = (
        db.table("briefings")
        .select("id")
        .eq("id", briefing_id)
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )
    if not briefing or not briefing.data:
        return jsonify({"error": "Briefing não encontrado"}), 404
    db.table("briefings").update({"status": "cancelado"}).eq("id", briefing_id).eq("tenant_id", g.tenant_id).execute()
    return jsonify({"ok": True})


@briefings_bp.route("/<briefing_id>/concluir", methods=["PUT"])
@require_tenant
@require_admin
def concluir_briefing(briefing_id):
    if not _valid_uuid(briefing_id):
        return jsonify({"error": "ID inválido"}), 400
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
    if briefing.data["status"] != "confirmado":
        return jsonify({"error": "Apenas sessões confirmadas podem ser concluídas"}), 409

    res = db.table("briefings").update({"status": "concluido"}).eq("id", briefing_id).eq("tenant_id", g.tenant_id).execute()
    return jsonify(res.data[0] if res.data else {})


@briefings_bp.route("/<briefing_id>/valor", methods=["PUT"])
@require_tenant
@require_admin
def registrar_valor(briefing_id):
    if not _valid_uuid(briefing_id):
        return jsonify({"error": "ID inválido"}), 400
    body = request.get_json(force=True) or {}
    try:
        valor = float(body.get("valor", 0))
        if valor <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"error": "Valor inválido"}), 400

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
    if briefing.data["status"] != "confirmado":
        return jsonify({"error": "Só é possível registrar valor em sessões confirmadas"}), 409

    res = (
        db.table("briefings")
        .update({"valor_combinado": valor})
        .eq("id", briefing_id)
        .eq("tenant_id", g.tenant_id)
        .execute()
    )
    return jsonify(res.data[0] if res.data else {})


@briefings_bp.route("/<briefing_id>/pagamento", methods=["PUT"])
@require_tenant
@require_admin
def confirmar_pagamento(briefing_id):
    if not _valid_uuid(briefing_id):
        return jsonify({"error": "ID inválido"}), 400
    db = get_db()
    briefing = (
        db.table("briefings")
        .select("id, status, valor_combinado")
        .eq("id", briefing_id)
        .eq("tenant_id", g.tenant_id)
        .maybe_single()
        .execute()
    )
    if not briefing or not briefing.data:
        return jsonify({"error": "Briefing não encontrado"}), 404
    if briefing.data["status"] != "confirmado":
        return jsonify({"error": "Só é possível confirmar pagamento de sessões confirmadas"}), 409
    if not briefing.data.get("valor_combinado"):
        return jsonify({"error": "Registre o valor antes de confirmar o pagamento"}), 409

    hoje = datetime.now().strftime("%Y-%m-%d")
    res = (
        db.table("briefings")
        .update({"pago": True, "data_pagamento": hoje})
        .eq("id", briefing_id)
        .eq("tenant_id", g.tenant_id)
        .execute()
    )
    _audit("pagamento_confirmado", {"briefing_id": briefing_id, "valor": str(briefing.data["valor_combinado"])})
    return jsonify(res.data[0] if res.data else {})


@briefings_bp.route("/<briefing_id>/resposta", methods=["PUT"])
@require_tenant
@require_client
def responder_proposta(briefing_id):
    if not _valid_uuid(briefing_id):
        return jsonify({"error": "ID inválido"}), 400
    body    = request.get_json(force=True) or {}
    aceitar = body.get("aceitar")
    if aceitar not in (True, False):
        return jsonify({"error": "'aceitar' deve ser true ou false"}), 400

    db      = get_db()
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
    res = db.table("briefings").update({"status": novo_status}).eq("id", briefing_id).execute()
    return jsonify(res.data[0] if res.data else {})
