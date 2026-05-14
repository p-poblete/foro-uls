import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from database import db, init_mongo
from routes.users import users_bp
from routes.communities import communities_bp
from routes.posts import posts_bp
from routes.comments import comments_bp

load_dotenv()


def create_app():
    app = Flask(__name__)

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

    # Crear tablas PostgreSQL si no existen
    with app.app_context():
        db.create_all()

    # Registrar blueprints
    app.register_blueprint(users_bp,       url_prefix="/api")
    app.register_blueprint(communities_bp, url_prefix="/api")
    app.register_blueprint(posts_bp,       url_prefix="/api")
    app.register_blueprint(comments_bp,    url_prefix="/api")

    # Health check
    @app.route("/")
    def health():
        return {"status": "ok", "app": "Readuls API v1"}

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
