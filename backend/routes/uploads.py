from flask import Blueprint, request, jsonify
from storage import upload_image
from auth_utils import require_auth
from errors import err

uploads_bp = Blueprint("uploads", __name__)


# Subida genérica de imágenes: devuelve la URL pública. La usan el composer,
# comentarios, edición de comunidad y edición de perfil.
@uploads_bp.route("/uploads", methods=["POST"])
@require_auth
def upload():
    file = request.files.get("file")
    if not file:
        return err("VALIDATION_ERROR", "Falta el archivo (campo 'file')", 400)

    prefix = request.form.get("prefix", "uploads")
    url, error = upload_image(file, prefix=prefix)
    if error:
        return err("STORAGE_ERROR", error, 400)
    return jsonify({"url": url}), 201
