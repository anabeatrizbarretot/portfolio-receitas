const express = require('express');
const session = require('express-session');

const app = express();

const db = require('./config/db');

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'segredo',
    resave: false,
    saveUninitialized: false
}));

app.get('/', (req, res) => {
    res.send('Servidor funcionando');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {

    const { email, senha } = req.body;

    try {

        const result = await db.query(
            'SELECT * FROM alunos WHERE email = $1 AND senha = $2',
            [email, senha]
        );

        if(result.rows.length > 0){

            req.session.usuario = result.rows[0];

            res.send('Login realizado');

        } else {

            res.send('Email ou senha inválidos');

        }

    } catch(err){

        console.log(err);
        res.send('Erro no login');

    }

});

app.get('/perfil', (req, res) => {

    if(req.session.usuario){

        res.send(`Bem-vinda ${req.session.usuario.nome}`);

    } else {

        res.send('Usuário não logado');

    }

});

app.get('/receitas', (req, res) => {

    if(req.session.usuario){

        res.render('receitas');

    } else {

        res.send('Faça login');

    }

});

app.listen(3000, () => {
    console.log('Servidor rodando');
});