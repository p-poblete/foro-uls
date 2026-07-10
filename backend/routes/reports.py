"""Reportes de contenido y resolución de moderación, persistidos en MongoDB.

Cualquier usuario autenticado reporta; solo moderadores (rol `moderator` de
Auth0 RBAC) listan y resuelven. Flujo de notificaciones:

- Al reportar: el autor del contenido recibe un aviso ANÓNIMO (nunca se revela
  quién reportó); el panel sí muestra el reportante al moderador.
- Al resolver: el reportante recibe el resultado y el autor recibe el veredicto
  (contenido eliminado o mantenido), ambos con el motivo del moderador.
- `action: "remove"` banea (soft-delete) la publicación o comentario reportado.
"""
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone

from database import get_mongo
from models import Post, User, db
from auth_utils import require_auth, require_moderator
from errors import err
from notifications import notify

reports_bp = Blueprint("reports", __name__)

TARGET_TYPES = ("publication", "comment", "user", "community")
REASONS      = ("SPAM", "HARASSMENT", "MISINFO", "NSFW", "OFFTOPIC", "OTHER")
STATUSES     = ("PENDING", "REVIEWED", "DISMISSED")

REASON_LABELS = {
    "SPAM":       "Spam o autopromoción",
    "HARASSMENT": "Acoso o discurso de odio",
    "MISINFO":    "Desinformación",
    "NSFW":       "Contenido sexual o violento",
    "OFFTOPIC":   "Fuera de tema en la comunidad",
    "OTHER":      "Otro motivo",
}

TARGET_LABELS = {"publication": "publicación", "comment": "comentario",
                 "user": "usuario", "community": "comunidad"}


def _serialize(r):
    r["_id"] = str(r["_id"])
    if isinstance(r.get("created_at"), datetime):
        r["created_at"] = r["created_at"].isoformat()
    if isinstance(r.get("resolved_at"), datetime):
        r["resolved_at"] = r["resolved_at"].isoformat()
    return r


def _parse_oid(value):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


def _content_refs(report):
    """(author_id, post_id, comment_id) del contenido reportado, para notificar."""
    ttype, tid = report["target_type"], report["target_id"]
    if ttype == "publication":
        post = Post.query.filter_by(id=int(tid)).first() if str(tid).isdigit() else None
        return (post.author_id, post.id, None) if post else (None, None, None)
    if ttype == "comment":
        oid = _parse_oid(tid)
        c = get_mongo().comments.find_one({"_id": oid}) if oid else None
        return (c.get("author_id"), c.get("post_id"), str(c["_id"])) if c else (None, None, None)
    return (None, None, None)


# crear un reporte — cualquier usuario autenticado
@reports_bp.route("/reports", methods=["POST"])
@require_auth
def create_report():
    data = request.get_json() or {}
    if data.get("target_type") not in TARGET_TYPES:
        return err("VALIDATION_ERROR", f"target_type debe ser uno de {', '.join(TARGET_TYPES)}", 400)
    if not data.get("target_id"):
        return err("VALIDATION_ERROR", "target_id es obligatorio", 400)
    if data.get("reason") not in REASONS:
        return err("VALIDATION_ERROR", f"reason debe ser uno de {', '.join(REASONS)}", 400)

    report = {
        "target_type":  data["target_type"],
        "target_id":    str(data["target_id"]),
        "target_label": data.get("target_label"),
        "reason":       data["reason"],
        "detail":       (data.get("detail") or "")[:500],
        "status":       "PENDING",
        "reporter_id":  g.current_user.id,
        "created_at":   datetime.now(timezone.utc),
    }
    result = get_mongo().reports.insert_one(report)
    report["_id"] = str(result.inserted_id)

    # Aviso ANÓNIMO al autor del contenido reportado (no se revela el reportante).
    author_id, post_id, comment_id = _content_refs(report)
    if author_id and author_id != g.current_user.id:
        kind = TARGET_LABELS[report["target_type"]]
        notify(author_id, "REPORT_RECEIVED", post_id=post_id, comment_id=comment_id,
               message=f"Alguien ha reportado tu {kind} por el motivo «{REASON_LABELS[report['reason']]}». Un moderador la revisará.")

    return jsonify({"message": "Reporte enviado", "report": _serialize(report)}), 201


# listar reportes — solo moderadores; incluye quién reportó; ?status=PENDING filtra
@reports_bp.route("/reports", methods=["GET"])
@require_moderator
def list_reports():
    query = {}
    status = request.args.get("status")
    if status:
        if status not in STATUSES:
            return err("VALIDATION_ERROR", f"status debe ser uno de {', '.join(STATUSES)}", 400)
        query["status"] = status
    docs = list(get_mongo().reports.find(query).sort("created_at", -1).limit(200))

    # El moderador SÍ ve quién reportó (el autor del contenido, nunca).
    reporter_ids = {d["reporter_id"] for d in docs if d.get("reporter_id")}
    users = User.query.filter(User.id.in_(reporter_ids)).all() if reporter_ids else []
    by_id = {u.id: u.username for u in users}
    for d in docs:
        d["reporter_username"] = by_id.get(d.get("reporter_id"))

    return jsonify({"reports": [_serialize(r) for r in docs]})


# resolver un reporte — solo moderadores.
# body: { "status": "REVIEWED"|"DISMISSED", "action": "remove"?, "note": str? }
# action=remove banea (soft-delete) el contenido reportado. `note` es el motivo
# del moderador y viaja en las notificaciones a reportante y autor.
@reports_bp.route("/reports/<string:report_id>", methods=["PATCH"])
@require_moderator
def update_report(report_id):
    oid = _parse_oid(report_id)
    if not oid:
        return err("VALIDATION_ERROR", "ID de reporte inválido", 400)

    data = request.get_json() or {}
    if data.get("status") not in ("REVIEWED", "DISMISSED"):
        return err("VALIDATION_ERROR", "status debe ser REVIEWED o DISMISSED", 400)
    action = data.get("action")
    if action not in (None, "remove"):
        return err("VALIDATION_ERROR", "action debe ser remove (u omitirse)", 400)
    note = (data.get("note") or "").strip()[:300]

    mongo = get_mongo()
    report = mongo.reports.find_one({"_id": oid})
    if not report:
        return err("NOT_FOUND", "Reporte no encontrado", 404)
    if report["status"] != "PENDING":
        return err("CONFLICT", "El reporte ya fue resuelto", 409)

    author_id, post_id, comment_id = _content_refs(report)
    kind = TARGET_LABELS[report["target_type"]]
    removed = False

    # Banear el contenido (solo publicaciones y comentarios).
    if action == "remove":
        now = datetime.now(timezone.utc)
        if report["target_type"] == "publication" and post_id:
            post = Post.query.filter_by(id=post_id, deleted_at=None).first()
            if post:
                post.deleted_at = now
                post.status = "removed"
                db.session.commit()
                removed = True
        elif report["target_type"] == "comment" and comment_id:
            res = mongo.comments.update_one(
                {"_id": _parse_oid(comment_id), "deleted_at": None},
                {"$set": {"deleted_at": now, "status": "removed"}})
            removed = res.modified_count > 0

    mongo.reports.update_one(
        {"_id": oid},
        {"$set": {"status": data["status"],
                  "action": "remove" if removed else None,
                  "note": note,
                  "resolved_by": g.current_user.id,
                  "resolved_at": datetime.now(timezone.utc)}},
    )

    # Notificaciones de cierre, con el motivo del moderador adjunto.
    reason_note = f" Motivo: {note}" if note else ""
    reporter_id = report.get("reporter_id")
    if removed:
        if reporter_id:
            notify(reporter_id, "REPORT_RESOLVED", post_id=post_id, comment_id=comment_id,
                   message=f"Tu reporte fue atendido: la {kind} fue eliminada.{reason_note}")
        if author_id:
            notify(author_id, "CONTENT_REMOVED", post_id=post_id, comment_id=comment_id,
                   message=f"Un moderador eliminó tu {kind} tras un reporte.{reason_note}")
    else:
        if reporter_id:
            notify(reporter_id, "REPORT_RESOLVED", post_id=post_id, comment_id=comment_id,
                   message=f"Tu reporte fue revisado: la {kind} se mantiene.{reason_note}")
        if author_id:
            notify(author_id, "REPORT_RESOLVED", post_id=post_id, comment_id=comment_id,
                   message=f"Tu {kind} reportada fue revisada y se mantiene.{reason_note}")

    report["status"] = data["status"]
    report["note"] = note
    return jsonify({"message": "Reporte actualizado", "report": _serialize(report)})
