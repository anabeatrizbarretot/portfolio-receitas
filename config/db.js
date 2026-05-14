const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres', // Alterado para coincidir com o SQL Shell
    password: '1234',     // A sua senha do Postgres
    port: 5432,
});

pool.connect()
    .then(() => {
        console.log('✅ Banco PostgreSQL conectado com sucesso!');
    })
    .catch((err) => {
        console.error('❌ Erro ao conectar ao Postgres:', err.message);
    });

module.exports = pool;