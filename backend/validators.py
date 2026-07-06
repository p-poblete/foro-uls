"""Validación de correo institucional. Único punto de verdad del dominio.

    python validators.py   # self-check
"""
import os


def allowed_domain():
    return os.getenv("ALLOWED_EMAIL_DOMAIN", "ulasalle.edu.pe").lower()


def is_institutional_email(email):
    # Prefijar "@" es lo que impide colar "x@evil-ulasalle.edu.pe" o
    # "x@ulasalle.edu.pe.evil.com": el dominio debe ir justo tras la arroba y al final.
    return bool(email) and email.strip().lower().endswith("@" + allowed_domain())


if __name__ == "__main__":
    os.environ["ALLOWED_EMAIL_DOMAIN"] = "ulasalle.edu.pe"
    assert is_institutional_email("ppobletea@ulasalle.edu.pe")
    assert is_institutional_email("A.B@ULASALLE.EDU.PE")          # case-insensitive
    assert not is_institutional_email("alguien@gmail.com")
    assert not is_institutional_email("x@evil-ulasalle.edu.pe")   # sin "@" antes del dominio
    assert not is_institutional_email("x@ulasalle.edu.pe.evil.com")
    assert not is_institutional_email("x@sub.ulasalle.edu.pe")    # subdominio no permitido
    assert not is_institutional_email("")
    assert not is_institutional_email("sin-arroba")
    print("OK validators")
