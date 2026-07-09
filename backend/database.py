import os

from flask_sqlalchemy import SQLAlchemy
from pymongo import MongoClient

# PostgreSQL instancia global 
db = SQLAlchemy()

# MongoDB instancia global de PyMongo
_mongo_db = None


def init_mongo(app):
    """Inicializa la conexión a MongoDB y crea índices básicos."""
    global _mongo_db
    # Default 10s: Atlas (SRV + TLS al replica set) puede tardar >2s en frío.
    # Baja MONGO_TIMEOUT_MS en local si prefieres que el arranque sin Mongo falle rápido.
    timeout_ms = int(os.getenv("MONGO_TIMEOUT_MS", "10000"))
    client = MongoClient(app.config["MONGO_URL"], serverSelectionTimeoutMS=timeout_ms)
    _mongo_db = client[app.config["MONGO_DB"]]

    # Índices para comentarios, notificaciones y reportes.
    # ponytail: tolerante a Mongo ausente para que el demo de OAuth arranque sin BD.
    try:
        _mongo_db.comments.create_index([("post_id", 1), ("parent_id", 1)])
        _mongo_db.comments.create_index([("post_id", 1), ("created_at", -1)])
        _mongo_db.notifications.create_index([("user_id", 1), ("created_at", -1)])
        _mongo_db.reports.create_index([("status", 1), ("created_at", -1)])
    except Exception as e:
        app.logger.warning("MongoDB no disponible, se omiten índices: %s", e)


def get_mongo():
    """Retorna la base de datos MongoDB."""
    return _mongo_db
