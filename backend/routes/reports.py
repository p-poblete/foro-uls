"""Reportes de contenido, persistidos en MongoDB.

Cualquier usuario autenticado reporta; solo moderadores (rol `moderator` de
Auth0 RBAC, inyectado en el token) listan y resuelven. Documento flexible:
el target puede ser publicación, comentario, usuario o comunidad.
"""
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone

from database import get_mongo
from auth_utils import require_auth, require_moderator
from errors import err

reports_bp = Blueprint("reports", __name__)

TARGET_TYPES = ("publication", "comment", "user", "community")
REASONS      = ("SPAM", "HARASSMENT", "MISINFO", "NSFW", "OFFTOPIC", "OTHER")
STATUSES     = ("PENDING", "REVIEWED", "DISMISSED")


def _serialize(r):
    r["_id"] = str(r["_id"])
    if isinstance(r.get("created_at"), datetime):
        r["created_at"] = r["created_at"].isoformat()
    return r


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
    return jsonify({"message": "Reporte enviado", "report": _serialize(report)}), 201


# listar reportes — solo moderadores; ?status=PENDING filtra
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
    return jsonify({"reports": [_serialize(r) for r in docs]})


# resolver un reporte (REVIEWED | DISMISSED) — solo moderadores
@reports_bp.route("/reports/<string:report_id>", methods=["PATCH"])
@require_moderator
def update_report(report_id):
    try:
        oid = ObjectId(report_id)
    except (InvalidId, TypeError):
        return err("VALIDATION_ERROR", "ID de reporte inválido", 400)

    data = request.get_json() or {}
    if data.get("status") not in ("REVIEWED", "DISMISSED"):
        return err("VALIDATION_ERROR", "status debe ser REVIEWED o DISMISSED", 400)

    mongo = get_mongo()
    report = mongo.reports.find_one({"_id": oid})
    if not report:
        return err("NOT_FOUND", "Reporte no encontrado", 404)

    mongo.reports.update_one(
        {"_id": oid},
        {"$set": {"status": data["status"],
                  "resolved_by": g.current_user.id,
                  "resolved_at": datetime.now(timezone.utc)}},
    )
    report["status"] = data["status"]
    return jsonify({"message": "Reporte actualizado", "report": _serialize(report)})
