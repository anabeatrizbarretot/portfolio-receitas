const mongoose = require('mongoose');

// ESTE LINK NÃO USA SRV, PORTANTO O ERRO "querySrv" NÃO PODE EXISTIR AQUI
const linkDireto = "mongodb://administrador:administrador@cluster0-shard-00-00.tx6vn46.mongodb.net:27017,cluster0-shard-00-01.tx6vn46.mongodb.net:27017,cluster0-shard-00-02.tx6vn46.mongodb.net:27017/portfolio_receitas?ssl=true&replicaSet=atlas-tx6vn4-shard-0&authSource=admin&retryWrites=true&w=majority";

console.log("--- INICIANDO CONEXÃO MANUAL (LINK LONGO) ---");

mongoose.connect(linkDireto, {
    family: 4 // Força o uso de IPv4 para evitar erros de IP falso
})
.then(() => {
    console.log('✅ CONECTADO AO ATLAS: O VS Code finalmente venceu a rede!');
})
.catch((err) => {
    console.log('❌ ERRO REAL DE CONEXÃO:');
    console.error(err.message);
});

module.exports = mongoose;