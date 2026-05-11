const express = require('express');
const session = require('express-session');
const app = express();

// Configurações de Banco de Dados
const db = require('./config/db'); // PostgreSQL
require('./config/mongo');       // MongoDB

// Configuração do View Engine (EJS)
app.set('view engine', 'ejs');

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
    secret: 'segredo',
    resave: false,
    saveUninitialized: false
}));

// --- ROTAS DE AUTENTICAÇÃO ---

app.get('/', (req, res) => {
    res.redirect('/login');
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
            res.redirect('/receitas');
        } else {
            res.send('Email ou senha inválidos');
        }
    } catch(err){
        console.log(err);
        res.send('Erro no login');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- ROTAS DE RECEITAS ---

app.get('/receitas', async (req, res) => {
    if(req.session.usuario){
        try {
            // Busca receitas com as suas categorias concatenadas
            const receitas = await db.query(`
                SELECT 
                    receitas.id,
                    receitas.nome,
                    receitas.descricao,
                    receitas.link_externo,
                    STRING_AGG(categorias.nome, ', ') AS categorias
                FROM receitas
                LEFT JOIN receitas_categorias
                    ON receitas.id = receitas_categorias.receita_id
                LEFT JOIN categorias
                    ON categorias.id = receitas_categorias.categoria_id
                GROUP BY receitas.id
                ORDER BY receitas.id DESC
            `);

            const categorias = await db.query('SELECT * FROM categorias ORDER BY nome');

            res.render('receitas', {
                receitas: receitas.rows,
                categorias: categorias.rows
            });
        } catch(err){
            console.log(err);
            res.send('Erro ao buscar dados');
        }
    } else {
        res.redirect('/login');
    }
});

app.post('/receitas', async (req, res) => {
    const { nome, descricao, link_externo, categorias, nova_categoria_nome } = req.body;

    try {
        // 1. Inserir a receita
        const result = await db.query(
            'INSERT INTO receitas(nome, descricao, link_externo) VALUES($1, $2, $3) RETURNING id',
            [nome, descricao, link_externo]
        );
        const receitaId = result.rows[0].id;

        // 2. Lidar com categorias existentes (checkboxes)
        if (categorias) {
            const catsArray = Array.isArray(categorias) ? categorias : [categorias];
            for (let catId of catsArray) {
                await db.query(
                    'INSERT INTO receitas_categorias(receita_id, categoria_id) VALUES($1, $2)',
                    [receitaId, catId]
                );
            }
        }

        // 3. Lidar com Nova Categoria manual (se preenchida)
        if (nova_categoria_nome && nova_categoria_nome.trim() !== "") {
            const novaCat = await db.query(
                'INSERT INTO categorias(nome) VALUES($1) RETURNING id',
                [nova_categoria_nome]
            );
            await db.query(
                'INSERT INTO receitas_categorias(receita_id, categoria_id) VALUES($1, $2)',
                [receitaId, novaCat.rows[0].id]
            );
        }

        res.redirect('/receitas');
    } catch(err){
        console.log(err);
        res.send('Erro ao cadastrar receita');
    }
});

app.get('/receitas/excluir/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await db.query('DELETE FROM receitas_categorias WHERE receita_id = $1', [id]);
        await db.query('DELETE FROM receitas WHERE id = $1', [id]);
        res.redirect('/receitas');
    } catch(err){
        console.log(err);
        res.send('Erro ao excluir receita');
    }
});

app.get('/receitas/editar/:id', async (req, res) => {
    const id = req.params.id;
    if (req.session.usuario) {
        try {
            const recipeResult = await db.query('SELECT * FROM receitas WHERE id = $1', [id]);
            const allCategories = await db.query('SELECT * FROM categorias ORDER BY nome');
            const linkedCats = await db.query('SELECT categoria_id FROM receitas_categorias WHERE receita_id = $1', [id]);

            const receita = recipeResult.rows[0];
            receita.categorias_ids = linkedCats.rows.map(row => row.categoria_id);

            res.render('editar', {
                receita: receita,
                categorias: allCategories.rows
            });
        } catch(err){
            console.log(err);
            res.send('Erro ao carregar dados para edição');
        }
    } else {
        res.redirect('/login');
    }
});

app.post('/receitas/editar/:id', async (req, res) => {
    const id = req.params.id;
    const { nome, descricao, link_externo, categorias } = req.body;

    try {
        // Atualiza dados básicos
        await db.query(
            'UPDATE receitas SET nome = $1, descricao = $2, link_externo = $3 WHERE id = $4',
            [nome, descricao, link_externo, id]
        );

        // Atualiza categorias (limpa e reinsere)
        await db.query('DELETE FROM receitas_categorias WHERE receita_id = $1', [id]);
        if (categorias) {
            const catsArray = Array.isArray(categorias) ? categorias : [categorias];
            for (let catId of catsArray) {
                await db.query(
                    'INSERT INTO receitas_categorias(receita_id, categoria_id) VALUES($1, $2)',
                    [id, catId]
                );
            }
        }

        res.redirect('/receitas');
    } catch(err){
        console.log(err);
        res.send('Erro ao atualizar receita');
    }
});

// --- PÁGINA PÚBLICA (VISÃO EXTERNA) ---

app.get('/publico', async (req, res) => {
    try {
        const categoriaId = req.query.categoria;
        let queryStr = `
            SELECT 
                receitas.id,
                receitas.nome,
                receitas.descricao,
                receitas.link_externo,
                STRING_AGG(categorias.nome, ', ') AS categorias
            FROM receitas
            LEFT JOIN receitas_categorias ON receitas.id = receitas_categorias.receita_id
            LEFT JOIN categorias ON categorias.id = receitas_categorias.categoria_id
        `;

        let params = [];
        if(categoriaId){
            queryStr += ` WHERE receitas.id IN (SELECT receita_id FROM receitas_categorias WHERE categoria_id = $1) `;
            params.push(categoriaId);
        }

        queryStr += ` GROUP BY receitas.id ORDER BY receitas.id DESC`;

        const receitas = await db.query(queryStr, params);
        const categorias = await db.query('SELECT * FROM categorias ORDER BY nome');

        res.render('publico', {
            receitas: receitas.rows,
            categorias: categorias.rows
        });
    } catch(err){
        console.log(err);
        res.send('Erro ao carregar receitas públicas');
    }
});

// --- HABILIDADES E RELATÓRIOS ---

app.get('/habilidades', async (req, res) => {
    if(req.session.usuario){
        try {
            const habilidades = await db.query('SELECT * FROM habilidades ORDER BY nome');
            const minhasHabilidades = await db.query(`
                SELECT ah.id, h.nome, ah.nivel
                FROM alunos_habilidades ah
                INNER JOIN habilidades h ON h.id = ah.habilidade_id
                WHERE aluno_id = $1
            `, [req.session.usuario.id]);

            res.render('habilidades', {
                habilidades: habilidades.rows,
                minhasHabilidades: minhasHabilidades.rows
            });
        } catch(err){
            console.log(err);
            res.send('Erro ao carregar habilidades');
        }
    } else {
        res.redirect('/login');
    }
});

app.post('/habilidades', async (req, res) => {
    const { habilidade_id, nivel } = req.body;
    try {
        await db.query(
            'INSERT INTO alunos_habilidades(aluno_id, habilidade_id, nivel) VALUES($1, $2, $3)',
            [req.session.usuario.id, habilidade_id, nivel]
        );
        res.redirect('/habilidades');
    } catch(err){
        console.log(err);
        res.send('Erro ao cadastrar habilidade');
    }
});

app.get('/relatorio', async (req, res) => {
    try {
        const totalAlunos = await db.query('SELECT COUNT(*) FROM alunos');
        const relatorio = await db.query(`
            SELECT h.nome, COUNT(ah.id) AS quantidade
            FROM habilidades h
            LEFT JOIN alunos_habilidades ah ON h.id = ah.habilidade_id
            GROUP BY h.nome
            ORDER BY h.nome
        `);

        const total = parseInt(totalAlunos.rows[0].count);
        const habilidades = relatorio.rows.map(item => ({
            nome: item.nome,
            quantidade: item.quantidade,
            porcentagem: total > 0 ? ((item.quantidade / total) * 100).toFixed(0) : 0
        }));

        res.render('relatorio', { habilidades });
    } catch(err){
        console.log(err);
        res.send('Erro ao gerar relatório');
    }
});

// Início do Servidor
app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});