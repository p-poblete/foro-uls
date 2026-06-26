import os
from flask import Flask, session, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from database import db, init_mongo
from routes.users import users_bp
from routes.communities import communities_bp
from routes.posts import posts_bp
from routes.comments import comments_bp
from routes.auth import auth_bp, init_oauth

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)


def create_app():
    app = Flask(__name__, static_folder='../', static_url_path='/')

    # Configuración
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "POSTGRES_URL", "postgresql://readuls:readuls123@localhost:5435/readuls"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["MONGO_URL"] = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    app.config["MONGO_DB"]  = os.getenv("MONGO_DB",  "readuls")
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

    # Extensiones
    CORS(app, supports_credentials=True)
    db.init_app(app)
    init_mongo(app)
    init_oauth(app)

    # Crear tablas PostgreSQL si no existen
    with app.app_context():
        db.create_all()

    # Registrar blueprints
    app.register_blueprint(users_bp,       url_prefix="/api")
    app.register_blueprint(communities_bp, url_prefix="/api")
    app.register_blueprint(posts_bp,       url_prefix="/api")
    app.register_blueprint(comments_bp,    url_prefix="/api")
    app.register_blueprint(auth_bp)

    # Health check
    @app.route("/")
    def health():
        return {"status": "ok", "app": "Readuls API v1"}
    
    # Servir login.html
    @app.route("/login.html")
    def login_page():
        parent_dir = os.path.dirname(BASE_DIR)
        return send_from_directory(parent_dir, 'login.html')
    
    # Servir auth-success.html
    @app.route("/auth-success.html")
    def auth_success_page():
        parent_dir = os.path.dirname(BASE_DIR)
        return send_from_directory(parent_dir, 'auth-success.html')

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5001)
