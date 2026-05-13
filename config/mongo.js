const mongoose = require('mongoose');

console.log("--- TENTANDO LIGAÇÃO AO ATLAS ---");

// Link direto sem variáveis para evitar erros
mongoose.connect("mongodb+srv://administrador:administrador@cluster0.tx6vn46.mongodb.net/portfolio_receitas?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => {
        console.log('✅ SUCESSO: Conectado ao MongoDB Atlas!');
    })
    .catch((err) => {
        console.log('❌ ERRO: Verifique se sua senha e IP estão certos no site do Atlas.');
        console.error(err);
    });

module.exports = mongoose;