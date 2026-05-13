const mongoose = require('mongoose'); // <--- O segredo está aqui: importe o pacote direto!

const ComentarioSchema = new mongoose.Schema({
    receitaId: { 
        type: Number, 
        required: true 
    },
    nome: { 
        type: String, 
        required: true 
    },
    texto: { 
        type: String, 
        required: true 
    },
    data: { 
        type: Date, 
        default: Date.now 
    }
});

// Se o modelo já existir, ele usa o existente, senão cria um novo
module.exports = mongoose.models.Comentario || mongoose.model('Comentario', ComentarioSchema);