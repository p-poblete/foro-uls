"""Formato único de error de la API: {"error": {"code", "message"}} + status.

El frontend (api-client.ts) lee error.code y error.message; este shape aplica
en todas las rutas y en los handlers globales para que ningún error salga como
HTML de Flask o string suelto.
"""
from flask import jsonify


def err(code, message, status):
    """Respuesta de error consistente. Uso: `return err("NOT_FOUND", "…", 404)`."""
    return jsonify({"error": {"code": code, "message": message}}), status


def register_error_handlers(app):
    @app.errorhandler(404)
    def _not_found(e):
        return err("NOT_FOUND", "Recurso no encontrado", 404)

    @app.errorhandler(405)
    def _method_not_allowed(e):
        return err("METHOD_NOT_ALLOWED", "Método no permitido en esta ruta", 405)

    @app.errorhandler(500)
    def _internal(e):
        return err("INTERNAL", "Error interno del servidor", 500)
