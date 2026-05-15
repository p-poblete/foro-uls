// =============================================================
// Readuls — MongoDB Collections & Validators
// Ejecutar: mongosh readuls < 01_collections.js
// Depende de: nada
// =============================================================

// Seleccionar (o crear) la base de datos
use('readuls');

// =============================================================
// comments
// Estrategia: Materialized Path + Parent Reference
// path: "/rootId/parentId/selfId/"  — permite obtener el árbol
//       completo con un regex sobre path en 1 query
// =============================================================
db.createCollection('comments', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['post_id', 'community_id', 'author_id', 'path', 'depth', 'content', 'status', 'created_at'],
      additionalProperties: true,
      properties: {
        post_id: {
          bsonType: 'string',
          description: 'UUID del post en PostgreSQL (required)'
        },
        community_id: {
          bsonType: 'string',
          description: 'UUID de la comunidad en PostgreSQL (required)'
        },
        author_id: {
          bsonType: 'string',
          description: 'UUID del usuario autor en PostgreSQL (required)'
        },
        parent_id: {
          bsonType: ['objectId', 'null'],
          description: 'ObjectId del comentario padre; null si es raíz'
        },
        path: {
          bsonType: 'string',
          description: 'Materialized path: /rootId/.../selfId/ (required)'
        },
        depth: {
          bsonType: 'int',
          minimum: 0,
          description: 'Profundidad en el árbol; 0 = comentario raíz (required)'
        },
        content: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 10000,
          description: 'Texto en Markdown (required)'
        },
        vote_score: {
          bsonType: 'int',
          description: 'upvote_count - downvote_count (desnormalizado)'
        },
        upvote_count: {
          bsonType: 'int',
          minimum: 0
        },
        downvote_count: {
          bsonType: 'int',
          minimum: 0
        },
        reply_count: {
          bsonType: 'int',
          minimum: 0,
          description: 'Hijos directos (desnormalizado)'
        },
        is_edited: {
          bsonType: 'bool'
        },
        edited_at: {
          bsonType: ['date', 'null']
        },
        is_pinned: {
          bsonType: 'bool'
        },
        author_snapshot: {
          bsonType: 'object',
          description: 'Datos del autor al momento de comentar (snapshot)',
          properties: {
            username:                  { bsonType: 'string' },
            display_name:              { bsonType: 'string' },
            avatar_url:                { bsonType: ['string', 'null'] },
            is_institutional_verified: { bsonType: 'bool' }
          }
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'removed', 'spam'],
          description: 'Estado del comentario (required)'
        },
        removed_reason: {
          bsonType: ['string', 'null']
        },
        removed_by: {
          bsonType: ['string', 'null'],
          description: 'UUID del moderador que lo removió'
        },
        created_at: {
          bsonType: 'date',
          description: 'Fecha de creación (required)'
        },
        updated_at: {
          bsonType: ['date', 'null']
        },
        deleted_at: {
          bsonType: ['date', 'null'],
          description: 'Soft delete; null = activo'
        },
        metadata: {
          bsonType: 'object',
          description: 'Datos de auditoría (ip_hash, user_agent_hash)',
          properties: {
            ip_hash:         { bsonType: ['string', 'null'] },
            user_agent_hash: { bsonType: ['string', 'null'] }
          }
        }
      }
    }
  },
  validationLevel: 'moderate',
  validationAction: 'warn'
});

print('Collection "comments" created.');

// =============================================================
// comment_votes
// Separada del documento de comentario para evitar arrays
// que crecen sin límite y hacen el documento muy pesado
// =============================================================
db.createCollection('comment_votes', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['comment_id', 'user_id', 'vote_type', 'created_at'],
      additionalProperties: true,
      properties: {
        comment_id: {
          bsonType: 'objectId',
          description: 'ObjectId del comentario votado (required)'
        },
        user_id: {
          bsonType: 'string',
          description: 'UUID del usuario en PostgreSQL (required)'
        },
        vote_type: {
          bsonType: 'int',
          enum: [1, -1],
          description: '1 = upvote, -1 = downvote (required)'
        },
        created_at: {
          bsonType: 'date'
        },
        updated_at: {
          bsonType: ['date', 'null']
        },
        deleted_at: {
          bsonType: ['date', 'null']
        }
      }
    }
  },
  validationLevel: 'moderate',
  validationAction: 'warn'
});

print('Collection "comment_votes" created.');
print('Done. Run 02_indexes.js next.');
