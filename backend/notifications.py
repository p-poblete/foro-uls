"""Notificaciones en MongoDB (documento flexible, alta escritura).

Se insertan como efecto secundario de otras acciones (like, comentario, reporte,
acción de moderación…) y son best-effort: si Mongo no está disponible, la acción
principal no falla. El shape calza con el tipo `Notification` del frontend.

`trigger_user_id=None` = notificación anónima/de sistema (reportes y moderación):
el frontend no muestra quién la originó.
"""
from datetime import datetime, timezone

from database import get_mongo

MESSAGES = {
    "LIKE":           "Le dio like a tu publicación",
    "DISLIKE":        "Le dio dislike a tu publicación",
    "COMMENT":        "Comentó en tu publicación",
    "REPLY":          "Respondió a tu comentario",
    "COMMUNITY_POST": "Nueva publicación en tu comunidad",
    "ANNOUNCEMENT":   "Nuevo anuncio en tu comunidad",
}


def _doc(user_id, ntype, trigger_user_id, post_id=None, comment_id=None, message=None):
    return {
        "user_id":         int(user_id),
        "type":            ntype,
        "trigger_user_id": int(trigger_user_id) if trigger_user_id is not None else None,
        "publication_id":  int(post_id) if post_id is not None else None,
        "comment_id":      str(comment_id) if comment_id is not None else None,
        "message":         message or MESSAGES.get(ntype, ""),
        "is_read":         False,
        "created_at":      datetime.now(timezone.utc),
    }


def notify(user_id, ntype, trigger_user_id=None, post_id=None, comment_id=None, message=None):
    """Notifica a un usuario. No notifica acciones propias; nunca lanza.
    Con trigger_user_id=None es anónima/de sistema (moderación, reportes)."""
    if user_id is None:
        return
    if trigger_user_id is not None and int(user_id) == int(trigger_user_id):
        return
    try:
        mongo = get_mongo()
        if mongo is not None:
            mongo.notifications.insert_one(
                _doc(user_id, ntype, trigger_user_id, post_id, comment_id, message))
    except Exception:
        pass


def notify_many(user_ids, ntype, trigger_user_id, post_id=None, message=None):
    """Notifica a varios usuarios (ej. miembros de una comunidad). Nunca lanza."""
    docs = [
        _doc(uid, ntype, trigger_user_id, post_id, message=message)
        for uid in user_ids
        if trigger_user_id is None or int(uid) != int(trigger_user_id)
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
    trigger = n.get("trigger_user_id")
    return {
        "_id":             str(n["_id"]),
        "user_id":         str(n["user_id"]),
        "type":            n["type"],
        "trigger_user_id": str(trigger) if trigger is not None else None,
        "publication_id":  str(n["publication_id"]) if n.get("publication_id") is not None else None,
        "comment_id":      n.get("comment_id"),
        "message":         n.get("message", ""),
        "is_read":         bool(n.get("is_read", False)),
        "created_at":      n["created_at"].isoformat() if isinstance(n.get("created_at"), datetime) else n.get("created_at"),
    }
