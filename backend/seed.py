"""Datos de demo para desarrollo. Idempotente: se puede correr varias veces.

    python backend/seed.py

Crea un usuario, dos comunidades, publicaciones y comentarios (Mongo).
"""
from datetime import datetime, timezone

from app import create_app
from database import db, get_mongo
from models import User, Community, Post, Career

CAREERS = [
    ("arq", "Arquitectura y Urbanismo"),
    ("ind", "Ingeniería Industrial"),
    ("psi", "Psicología"),
    ("der", "Derecho"),
    ("adm", "Administración y Negocios Internacionales"),
    ("sft", "Ingeniería de Software"),
    ("com", "Ciencias de la Comunicación"),
    ("cml", "Ingeniería Comercial"),
]


def _get_or_create(model, defaults=None, **filters):
    obj = model.query.filter_by(**filters).first()
    if obj:
        return obj, False
    obj = model(**filters, **(defaults or {}))
    db.session.add(obj)
    db.session.flush()
    return obj, True


def seed():
    app = create_app()
    with app.app_context():
        careers = {}
        for code, name in CAREERS:
            c, _ = _get_or_create(Career, code=code, defaults=dict(name=name))
            careers[code] = c

        user, _ = _get_or_create(
            User, username="ppoblete",
            defaults=dict(
                email="ppobletea@ulasalle.edu.pe",
                display_name="Pablo Poblete",
                avatar_url="https://i.pravatar.cc/120?img=12",
                gender="MALE",
                career_id=careers["sft"].id,
                auth_provider="local",
            ),
        )

        # Usuarios adicionales para poblar autores
        maria, _ = _get_or_create(
            User, username="maria2002",
            defaults=dict(email="maria2002@ulasalle.edu.pe", display_name="María Quispe",
                          avatar_url="https://i.pravatar.cc/120?img=47", gender="FEMALE",
                          career_id=careers["sft"].id, auth_provider="local"),
        )
        ana, _ = _get_or_create(
            User, username="ana.psico",
            defaults=dict(email="ana@ulasalle.edu.pe", display_name="Ana Torres",
                          avatar_url="https://i.pravatar.cc/120?img=49", gender="FEMALE",
                          career_id=careers["psi"].id, auth_provider="local"),
        )

        com_soft, _ = _get_or_create(
            Community, name="Ingenieria_Software_ULS",
            defaults=dict(slug="ingenieria-software-uls",
                          description="Comunidad de Ingeniería de Software.",
                          owner_id=user.id, visibility="public"),
        )
        com_anuncios, _ = _get_or_create(
            Community, name="Anuncios_ULS",
            defaults=dict(slug="anuncios-uls",
                          description="Anuncios oficiales de la universidad.",
                          owner_id=user.id, visibility="restricted"),
        )
        com_psico, _ = _get_or_create(
            Community, name="Psicologia_ULS",
            defaults=dict(slug="psicologia-uls",
                          description="Estudiantes de Psicología compartiendo lecturas y casos.",
                          owner_id=ana.id, visibility="public"),
        )

        posts = [
            dict(community_id=com_soft.id, author_id=user.id, label="HELP",
                 title="¿Cómo se preparan para el parcial de Bases de Datos?",
                 content="Comparto mis apuntes de normalización, ¿qué recursos usan ustedes?",
                 post_type="text"),
            dict(community_id=com_soft.id, author_id=maria.id, label="DISCUSSION",
                 title="Proyecto final: stack recomendado",
                 content="Estoy dudando entre Flask+React o algo full-stack JS. Opiniones.",
                 post_type="text"),
            dict(community_id=com_anuncios.id, author_id=user.id, label="ANNOUNCEMENT",
                 title="Matrícula 2026-II abierta",
                 content="Recuerden que la matrícula cierra el 20 de julio.",
                 external_link="https://ulasalle.edu.pe/matricula", post_type="text"),
            dict(community_id=com_psico.id, author_id=ana.id, label="CASE",
                 title="Caso clínico: ansiedad académica en primer ciclo",
                 content="Comparto un caso anónimo trabajado en práctica supervisada. Busco feedback.",
                 post_type="text"),
        ]
        created_posts = []
        for p in posts:
            title = p.pop("title")
            obj, _ = _get_or_create(Post, title=title, defaults=p)
            created_posts.append(obj)

        db.session.commit()

        # Comentarios en Mongo (solo si la colección está vacía para ese post)
        mongo = get_mongo()
        if mongo is not None:
            try:
                first_post = created_posts[0]
                if mongo.comments.count_documents({"post_id": first_post.id}) == 0:
                    now = datetime.now(timezone.utc)
                    mongo.comments.insert_one({
                        "post_id": first_post.id, "author_id": user.id,
                        "parent_id": None, "depth": 0,
                        "content": "Yo uso los videos del profe + ejercicios de la guía.",
                        "vote_score": 2, "status": "active",
                        "created_at": now, "updated_at": now, "deleted_at": None,
                    })
            except Exception as e:
                print("Mongo no disponible, se omiten comentarios:", e)

        print(f"OK · user={user.id} communities=[{com_soft.id},{com_anuncios.id}] "
              f"posts={[p.id for p in created_posts]}")


if __name__ == "__main__":
    seed()
