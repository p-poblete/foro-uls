"""Notificaciones en MongoDB (documento flexible, alta escritura).

Se insertan como efecto secundario de otras acciones (like, comentario, nueva
publicación) y son best-effort: si Mongo no está disponible, la acción principal
no falla. El shape calza con el tipo `Notification` del frontend.
"""
from datetime import datetime, timezone

from database import get_mongo

MESSAGES = {
    "LIKE":           "Le dio like a tu publicación",
    "DISLIKE":        "Le dio dislike a tu publicación",
    "COMMENT":        "Comentó en tu publicación",
    "COMMUNITY_POST": "Nueva publicación en tu comunidad",
}


def _doc(user_id, ntype, trigger_user_id, post_id=None, comment_id=None):
    return {
        "user_id":         int(user_id),
        "type":            ntype,
        "trigger_user_id": int(trigger_user_id),
        "publication_id":  int(post_id) if post_id is not None else None,
        "comment_id":      str(comment_id) if comment_id is not None else None,
        "message":         MESSAGES.get(ntype, ""),
        "is_read":         False,
        "created_at":      datetime.now(timezone.utc),
    }


def notify(user_id, ntype, trigger_user_id, post_id=None, comment_id=None):
    """Notifica a un usuario. No notifica acciones propias; nunca lanza."""
    if int(user_id) == int(trigger_user_id):
        return
    try:
        mongo = get_mongo()
        if mongo is not None:
            mongo.notifications.insert_one(_doc(user_id, ntype, trigger_user_id, post_id, comment_id))
    except Exception:
        pass


def notify_many(user_ids, ntype, trigger_user_id, post_id=None):
    """Notifica a varios usuarios (ej. miembros de una comunidad). Nunca lanza."""
    docs = [
        _doc(uid, ntype, trigger_user_id, post_id)
        for uid in user_ids if int(uid) != int(trigger_user_id)
    ]
    if not docs:
        return
    try:
        mongo = get_mongo()
        if mongo is not None:
            mongo.notifications.insert_many(docs)
    except Exception:
        pass


def serialize(n):
    """Documento Mongo → shape del tipo Notification del frontend (ids como string)."""
    return {
        "_id":             str(n["_id"]),
        "user_id":         str(n["user_id"]),
        "type":            n["type"],
        "trigger_user_id": str(n["trigger_user_id"]),
        "publication_id":  str(n["publication_id"]) if n.get("publication_id") is not None else None,
        "comment_id":      n.get("comment_id"),
        "message":         n.get("message", ""),
        "is_read":         bool(n.get("is_read", False)),
        "created_at":      n["created_at"].isoformat() if isinstance(n.get("created_at"), datetime) else n.get("created_at"),
    }
