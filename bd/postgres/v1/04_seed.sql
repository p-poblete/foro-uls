-- =============================================================
-- Readuls v1 — Seed de datos
-- Depende de: 01_tables.sql
-- =============================================================

-- =============================================================
-- Carreras de la Universidad La Salle (ULS)
-- =============================================================
INSERT INTO careers (name, code) VALUES
  ('Arquitectura y Urbanismo',                    'arq'),
  ('Ingeniería Industrial',                        'ind'),
  ('Psicología',                                   'psi'),
  ('Derecho',                                      'der'),
  ('Administración y Negocios Internacionales',    'adm'),
  ('Ingeniería de Software',                       'sft'),
  ('Ciencias de la Comunicación',                  'com'),
  ('Ingeniería Comercial',                         'cml')
ON CONFLICT (code) DO NOTHING;

-- =============================================================
-- Usuario demo (solo para desarrollo / datos de prueba)
-- El external_auth_id es ficticio; en producción Auth0
-- crea el registro real en el primer login con Google.
-- =============================================================
INSERT INTO users (
  external_auth_id,
  auth_provider,
  username,
  display_name,
  email,
  gender,
  career_id,
  status
) VALUES (
  'google-oauth2|000000000000000000000',
  'auth0',
  'admin_uls',
  'Admin ULS',
  'admin@ulasalle.edu.pe',
  'NON_BINARY',
  (SELECT id FROM careers WHERE code = 'sft'),
  'active'
)
ON CONFLICT (username) DO NOTHING;

-- =============================================================
-- Comunidades de ejemplo (desarrollo)
-- =============================================================
INSERT INTO communities (name, slug, description, owner_id, visibility, status) VALUES
  (
    'Ingeniería de Software',
    'ingenieria-de-software',
    'Comunidad oficial de la carrera de Ingeniería de Software ULS.',
    (SELECT id FROM users WHERE username = 'admin_uls'),
    'public',
    'active'
  ),
  (
    'Anuncios ULS',
    'anuncios-uls',
    'Comunicados y anuncios oficiales de la Universidad La Salle.',
    (SELECT id FROM users WHERE username = 'admin_uls'),
    'restricted',
    'active'
  ),
  (
    'Psicología ULS',
    'psicologia-uls',
    'Espacio para estudiantes de Psicología: lecturas, casos y debate.',
    (SELECT id FROM users WHERE username = 'admin_uls'),
    'public',
    'active'
  )
ON CONFLICT (slug) DO NOTHING;
