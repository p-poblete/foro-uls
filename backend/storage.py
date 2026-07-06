"""Subida de imágenes a almacenamiento S3-compatible (MinIO en local).

Un solo punto de subida reutilizado por posts, comentarios, comunidades y
perfiles. Con AWS_S3_ENDPOINT definido usa un backend S3-compatible (MinIO);
sin él, AWS S3 real.
"""
import os
from datetime import datetime, timezone

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError


def _client():
    endpoint = os.getenv("AWS_S3_ENDPOINT") or None
    kwargs = dict(
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_S3_REGION"),
    )
    if endpoint:
        kwargs["endpoint_url"] = endpoint
        kwargs["config"] = Config(s3={"addressing_style": "path"})
    return boto3.client("s3", **kwargs)


def upload_image(file, prefix="uploads"):
    """Sube un FileStorage al bucket. Devuelve (url, error)."""
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    bucket = os.getenv("AWS_S3_BUCKET")
    region = os.getenv("AWS_S3_REGION")

    if not access_key or not secret_key or not bucket or not region:
        return None, "Falta configurar credenciales/region/bucket de almacenamiento"
    if access_key.startswith("tu_") or secret_key.startswith("tu_") or bucket.startswith("tu_"):
        return None, "Credenciales de almacenamiento inválidas (valores de ejemplo)"

    ctype = getattr(file, "content_type", None)
    if ctype and not ctype.startswith("image/"):
        return None, "El archivo debe ser una imagen"

    safe_name = os.path.basename(file.filename or "image")
    key = f"{prefix}/{int(datetime.now(timezone.utc).timestamp())}_{safe_name}"

    try:
        extra = {"ContentType": ctype} if ctype else {}
        _client().upload_fileobj(file, bucket, key, ExtraArgs=extra)
    except (ClientError, BotoCoreError) as exc:
        code = getattr(exc, "response", {}).get("Error", {}).get("Code", "StorageError")
        return None, f"Error subiendo imagen ({code})"

    # Regla única: público = base + key. AWS_S3_PUBLIC_URL es una base ya ligada al
    # bucket (dominio r2.dev/propio de R2, o host/bucket de MinIO), así que solo se
    # le añade la key. Sin público pero con endpoint, se usa path-style host/bucket/key.
    public = os.getenv("AWS_S3_PUBLIC_URL")
    endpoint = os.getenv("AWS_S3_ENDPOINT")
    if public:
        url = f"{public.rstrip('/')}/{key}"
    elif endpoint:
        url = f"{endpoint.rstrip('/')}/{bucket}/{key}"
    else:
        url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return url, None
