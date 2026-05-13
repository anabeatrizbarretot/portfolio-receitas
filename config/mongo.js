const mongoose = require('mongoose');

console.log("--- TENTANDO CONEXÃO REFORÇADA AO ATLAS ---");

// Link padrão (Standard) que funciona melhor em redes com bloqueio
const uri = "mongodb://administrador:administrador@cluster0-shard-00-00.tx6vn46.mongodb.net:27017,cluster0-shard-00-01.tx6vn46.mongodb.net:27017,cluster0-shard-00-02.tx6vn46.mongodb.net:27017/portfolio_receitas?ssl=true&replicaSet=atlas-tx6vn4-shard-0&authSource=admin&retryWrites=true&w=majority";

mongoose.connect(uri)
    .then(() => {
        console.log('✅ SUCESSO ABSOLUTO: MongoDB Atlas Conectado!');
    })
    .catch((err) => {
        console.log('❌ ERRO DE REDE: O MongoDB ainda não consegue te ouvir.');
        console.error(err.message); // Mostra apenas a mensagem curta do erro
    });

module.exports = mongoose;