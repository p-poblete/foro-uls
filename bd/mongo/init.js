// =============================================================
// Readuls — MongoDB init
// Ejecutar: mongosh "mongodb://readuls_app:changeme@localhost:27017/readuls" init.js
// =============================================================

load('01_collections.js');
load('02_indexes.js');

print('\nReaduls MongoDB setup complete.');
print('Database: readuls');
print('Collections: comments, comment_votes');
