// =============================================================
// Readuls — MongoDB Indexes
// Ejecutar: mongosh readuls < 02_indexes.js
// Depende de: 01_collections.js
// =============================================================

use('readuls');

// =============================================================
// comments — índices
// =============================================================

// Árbol completo de un post (query principal del sistema)
db.comments.createIndex(
  { post_id: 1, path: 1 },
  { name: 'idx_comments_post_path', background: true }
);

// Comentarios raíz de un post, ordenados por fecha o votos
db.comments.createIndex(
  { post_id: 1, parent_id: 1, created_at: -1 },
  { name: 'idx_comments_post_parent_date', background: true }
);

// Comentarios raíz de un post, ordenados por votos (sort=top)
db.comments.createIndex(
  { post_id: 1, depth: 1, vote_score: -1 },
  { name: 'idx_comments_post_depth_votes', background: true }
);

// Historial de comentarios de un usuario (perfil)
db.comments.createIndex(
  { author_id: 1, created_at: -1 },
  { name: 'idx_comments_author_date', background: true }
);

// Lazy-load de respuestas directas de un comentario
db.comments.createIndex(
  { parent_id: 1 },
  { name: 'idx_comments_parent_id', background: true }
);

// Obtener árbol completo por regex sobre path (búsqueda de subárboles)
db.comments.createIndex(
  { path: 1 },
  { name: 'idx_comments_path', background: true }
);

// Filtrado por estado para moderación
db.comments.createIndex(
  { status: 1, deleted_at: 1 },
  { name: 'idx_comments_status_deleted', background: true }
);

// TTL: hard delete 30 días después del soft delete
db.comments.createIndex(
  { deleted_at: 1 },
  {
    name: 'idx_comments_ttl_deleted',
    expireAfterSeconds: 2592000,          // 30 días
    partialFilterExpression: {
      deleted_at: { $type: 'date' }
    }
  }
);

print('Indexes for "comments" created.');

// =============================================================
// comment_votes — índices
// =============================================================

// Garantiza 1 voto por usuario por comentario (unicidad)
db.comment_votes.createIndex(
  { comment_id: 1, user_id: 1 },
  { name: 'idx_comment_votes_unique', unique: true, background: true }
);

// Check rápido del voto del usuario actual en batch de comentarios
db.comment_votes.createIndex(
  { comment_id: 1 },
  { name: 'idx_comment_votes_comment_id', background: true }
);

// Historial de votos de un usuario
db.comment_votes.createIndex(
  { user_id: 1 },
  { name: 'idx_comment_votes_user_id', background: true }
);

// TTL: limpiar votos soft-deleted después de 30 días
db.comment_votes.createIndex(
  { deleted_at: 1 },
  {
    name: 'idx_comment_votes_ttl',
    expireAfterSeconds: 2592000,
    partialFilterExpression: {
      deleted_at: { $type: 'date' }
    }
  }
);

print('Indexes for "comment_votes" created.');
print('MongoDB setup complete.');
