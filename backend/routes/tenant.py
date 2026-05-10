from flask import Blueprint, jsonify, g
from database import get_db

tenant_bp = Blueprint("tenant", __name__)

_DEFAULT_CONFIG = {
    "nome": "Sistema de Agendamento",
    "tagline": "",
    "icone": "📅",
    "cores": {
        "acento": "#6366f1",
        "acentoClaro": "#818cf8",
        "acentoEscuro": "#4338ca",
        "sombraAcento": "rgba(99,102,241,0.25)",
        "bgAcento": "rgba(99,102,241,0.04)",
    },
    "termos": {
        "servico": "serviço",
        "Servico": "Serviço",
        "servicos": "serviços",
        "Servicos": "Serviços",
        "agendar": "Agendar",
        "notas_placeholder": "Observações (opcional)",
        "notas_label": "Observações",
        "historico_titulo": "Meu histórico",
        "home_titulo": "Bem-vindo",
        "home_subtitulo": "O que deseja fazer?",
    },
    "camposExtras": False,
    "duracaoPadrao": 30,
    "horariosFuncionamento": {"inicio": "09:00", "fim": "18:00", "intervalos": 30},
}


@tenant_bp.route("/config", methods=["GET"])
def get_config():
    """Retorna a config pública do tenant (sem auth)."""
    if g.get("tenant_id"):
        cfg = dict(_DEFAULT_CONFIG)
        cfg.update(g.tenant_config or {})
        # Garante que campos de cores e termos tenham merge profundo
        for key in ("cores", "termos", "horariosFuncionamento"):
            if key in g.tenant_config and key in _DEFAULT_CONFIG:
                merged = dict(_DEFAULT_CONFIG[key])
                merged.update(g.tenant_config[key])
                cfg[key] = merged
        cfg["slug"] = g.tenant_slug
        return jsonify(cfg)

    # Tenant não encontrado — retorna config padrão com flag de erro
    return jsonify({**_DEFAULT_CONFIG, "slug": None, "_tenantNotFound": True})
