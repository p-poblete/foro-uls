import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from database import db, init_mongo
from errors import register_error_handlers
from routes.users import users_bp
from routes.communities import communities_bp
from routes.posts import posts_bp
from routes.comments import comments_bp
from routes.careers import careers_bp
from routes.uploads import uploads_bp
from routes.reports import reports_bp
from routes.auth import auth_bp

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)


def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("FLASK_SECRET_KEY") or os.urandom(24).hex()

    # Configuración
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "POSTGRES_URL", "postgresql://readuls:readuls123@localhost:5435/readuls"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["MONGO_URL"] = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    app.config["MONGO_DB"]  = os.getenv("MONGO_DB",  "readuls")

    # Extensiones
    CORS(app)
    db.init_app(app)
    init_mongo(app)

    # Crear tablas PostgreSQL si no existen.
    # ponytail: tolerante a BD ausente para que el demo de OAuth arranque sin Postgres.
    with app.app_context():
        try:
            db.create_all()
            # Índices B-Tree para las consultas calientes del feed (create_all no
            # altera tablas existentes, por eso van como DDL idempotente aparte).
            from sqlalchemy import text
            for ddl in (
                "CREATE INDEX IF NOT EXISTS idx_posts_community_created ON posts (community_id, created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_posts_active ON posts (id DESC) WHERE deleted_at IS NULL AND status = 'active'",
                "CREATE INDEX IF NOT EXISTS idx_members_user ON community_members (user_id)",
            ):
                db.session.execute(text(ddl))
            db.session.commit()
        except Exception as e:
            app.logger.warning("Postgres no disponible, se omite create_all(): %s", e)

    # Registrar blueprints
    app.register_blueprint(users_bp,       url_prefix="/api")
    app.register_blueprint(communities_bp, url_prefix="/api")
    app.register_blueprint(posts_bp,       url_prefix="/api")
    app.register_blueprint(comments_bp,    url_prefix="/api")
    app.register_blueprint(careers_bp,     url_prefix="/api")
    app.register_blueprint(uploads_bp,     url_prefix="/api")
    app.register_blueprint(reports_bp,     url_prefix="/api")
    app.register_blueprint(auth_bp)  # rutas con path completo (/api/... y /oauth/callback)

    # Errores 404/405/500 con el mismo shape JSON que el resto de la API.
    register_error_handlers(app)

    # Health check
    @app.route("/")
    def health():
        return {"status": "ok", "app": "Readuls API v1"}

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
