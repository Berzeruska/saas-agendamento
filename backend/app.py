from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import Config
from middleware.security import apply_security_headers
from middleware.tenant import resolve_tenant
from routes.auth import auth_bp
from routes.services import services_bp
from routes.appointments import appointments_bp
from routes.products import products_bp
from routes.orders import orders_bp
from routes.admin import admin_bp
from routes.export import export_bp
from routes.tenant import tenant_bp
from routes.superadmin import superadmin_bp
from routes.briefings import briefings_bp


def create_app() -> Flask:
    app = Flask(__name__)

    # CORS — suporta múltiplos tenants/origens
    CORS(
        app,
        origins=Config.cors_origins(),
        supports_credentials=False,
        allow_headers=["Content-Type", "Authorization", "X-Tenant-Slug"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        max_age=600,
    )

    # Rate limiting global + por endpoint
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=[Config.RATE_LIMIT_DEFAULT],
        storage_uri="memory://",
        strategy="fixed-window",
    )

    # Resolve tenant em toda requisição
    app.before_request(resolve_tenant)

    # Headers de segurança em todas as respostas
    app.after_request(apply_security_headers)

    # Blueprints
    app.register_blueprint(tenant_bp,        url_prefix="/api/tenant")
    app.register_blueprint(auth_bp,          url_prefix="/api/auth")
    app.register_blueprint(services_bp,      url_prefix="/api/services")
    app.register_blueprint(appointments_bp,  url_prefix="/api/appointments")
    app.register_blueprint(products_bp,      url_prefix="/api/products")
    app.register_blueprint(orders_bp,        url_prefix="/api/orders")
    app.register_blueprint(admin_bp,         url_prefix="/api/admin")
    app.register_blueprint(export_bp,        url_prefix="/api/admin/export")
    app.register_blueprint(briefings_bp,     url_prefix="/api/briefings")
    app.register_blueprint(superadmin_bp,    url_prefix="/api/superadmin")

    # Rate limits específicos
    limiter.limit(Config.RATE_LIMIT_AUTH)(auth_bp)
    limiter.limit(Config.RATE_LIMIT_EXPORT)(export_bp)

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Endpoint não encontrado"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_):
        return jsonify({"error": "Método não permitido"}), 405

    @app.errorhandler(429)
    def too_many_requests(_):
        return jsonify({"error": "Muitas requisições. Aguarde um momento."}), 429

    @app.errorhandler(500)
    def internal_error(e):
        app.logger.error(f"Erro interno: {e}")
        return jsonify({"error": "Erro interno do servidor"}), 500

    @app.route("/health")
    def health():
        return jsonify({"status": "ok"})

    return app


app = create_app()

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=Config.DEBUG, host="0.0.0.0", port=port)
