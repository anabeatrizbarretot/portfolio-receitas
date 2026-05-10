const mongoose = require('mongoose');

const ComentarioSchema = new mongoose.Schema({

    receita_id: {
        type: Number,
        required: true
    },

    usuario: {
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

module.exports = mongoose.model(
    'Comentario',
    ComentarioSchema
);