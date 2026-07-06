from flask_sqlalchemy import SQLAlchemy
from pymongo import MongoClient

# PostgreSQL instancia global 
db = SQLAlchemy()

# MongoDB instancia global de PyMongo
_mongo_db = None


def init_mongo(app):
    """Inicializa la conexión a MongoDB y crea índices básicos."""
    global _mongo_db
    client = MongoClient(app.config["MONGO_URL"], serverSelectionTimeoutMS=2000)
    _mongo_db = client[app.config["MONGO_DB"]]

    # Índices para la colección de comentarios.
    # ponytail: tolerante a Mongo ausente para que el demo de OAuth arranque sin BD.
    try:
        _mongo_db.comments.create_index([("post_id", 1), ("parent_id", 1)])
        _mongo_db.comments.create_index([("post_id", 1), ("created_at", -1)])
    except Exception as e:
        app.logger.warning("MongoDB no disponible, se omiten índices: %s", e)


def get_mongo():
    """Retorna la base de datos MongoDB."""
    return _mongo_db
