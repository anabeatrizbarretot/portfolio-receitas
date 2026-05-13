const mongoose = require('mongoose');

// Link Direto (Sem SRV) para pular o erro de DNS do VS Code
const uri = "mongodb://administrador:administrador@cluster0-shard-00-00.tx6vn46.mongodb.net:27017,cluster0-shard-00-01.tx6vn46.mongodb.net:27017,cluster0-shard-00-02.tx6vn46.mongodb.net:27017/portfolio_receitas?ssl=true&replicaSet=atlas-tx6vn4-shard-0&authSource=admin&retryWrites=true&w=majority&family=4";

console.log("--- TENTANDO CONEXÃO DIRETA (SEM SRV) ---");

mongoose.connect(uri)
    .then(() => {
        console.log('✅ FINALMENTE! Conectado ao MongoDB Atlas via Link Direto!');
    })
    .catch((err) => {
        console.log('❌ ERRO CRÍTICO:');
        console.error(err.message);
    });

module.exports = mongoose;