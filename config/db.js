const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'receitas_db',
    password: '1234',
    port: 5432
});

pool.connect()
    .then(() => {
        console.log('Banco conectado');
    })
    .catch((err) => {
        console.log('Erro ao conectar', err);
    });

module.exports = pool;