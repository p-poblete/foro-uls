import os
import json
from flask import Blueprint, request, jsonify, session, redirect, url_for
from authlib.integrations.flask_client import OAuth
from models import User, db

auth_bp = Blueprint("auth", __name__)

oauth = OAuth()

def init_oauth(app):
    # Cargar credenciales desde el JSON
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    json_path = os.path.join(base_dir, "..", "client_secret_48853212171-o0l7hd5euddv10i4ita5p6nhsccj4fam.apps.googleusercontent.com.json")
    
    with open(json_path) as f:
        google_creds = json.load(f)["web"]
    
    oauth.init_app(app)
    oauth.register(
        name='google',
        client_id=google_creds['client_id'],
        client_secret=google_creds['client_secret'],
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile'
        }
    )


@auth_bp.route('/login')
def login():
    redirect_uri = url_for('auth.callback', _external=True)
    print(f"DEBUG: Redirect URI = {redirect_uri}")
    return oauth.google.authorize_redirect(redirect_uri)


@auth_bp.route('/auth/callback')
def callback():
    token = oauth.google.authorize_access_token()
    
    # Obtener el access token y user info
    access_token = token.get('access_token')
    user_info = token.get('userinfo')
    
    # Si no hay userinfo en el token, obtenerlo manualmente
    if not user_info:
        resp = oauth.google.get('https://www.googleapis.com/oauth2/v2/userinfo')
        user_info = resp.json()
    
    # Guardar token en archivo
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tokens_file = os.path.join(base_dir, "..", "tokens_obtenidos.txt")
    with open(tokens_file, "a") as f:
        f.write(f"Access Token: {access_token}\n")
        f.write(f"User: {user_info.get('email')}\n")
        f.write("-" * 50 + "\n")
    
    # Buscar o crear usuario
    google_id = user_info.get('id')
    email = user_info.get('email')
    name = user_info.get('name')
    picture = user_info.get('picture')
    
    user = User.query.filter_by(google_id=google_id).first()
    
    if not user:
        # Verificar si el email ya existe
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            # Actualizar usuario existente con google_id
            existing_user.google_id = google_id
            existing_user.auth_provider = 'google'
            if not existing_user.avatar_url:
                existing_user.avatar_url = picture
            db.session.commit()
            user = existing_user
        else:
            # Crear nuevo usuario
            username = email.split('@')[0]
            # Asegurar username único
            counter = 1
            original_username = username
            while User.query.filter_by(username=username).first():
                username = f"{original_username}{counter}"
                counter += 1
            
            user = User(
                username=username,
                email=email,
                display_name=name,
                avatar_url=picture,
                google_id=google_id,
                auth_provider='google'
            )
            db.session.add(user)
            db.session.commit()
    
    # Guardar en sesión
    session['user_id'] = user.id
    session['access_token'] = access_token
    
    # Redirigir al frontend
    return redirect('/auth-success.html')


@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect('/')


@auth_bp.route('/me')
def me():
    if 'user_id' not in session:
        return jsonify({"error": "No autenticado"}), 401
    
    user = User.query.filter_by(id=session['user_id']).first()
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404
    
    return jsonify({
        "user": user.to_dict(),
        "access_token": session.get('access_token')
    })
