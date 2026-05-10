const express = require('express');
const session = require('express-session');

const app = express();

const db = require('./config/db');

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static('public'));

app.use(session({
    secret: 'segredo',
    resave: false,
    saveUninitialized: false
}));

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

app.get('/perfil', (req, res) => {

    if(req.session.usuario){

        res.send(`Bem-vinda ${req.session.usuario.nome}`);

    } else {

        res.send('Usuário não logado');

    }

});

app.get('/receitas', async (req, res) => {

    if(req.session.usuario){

        try {

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

            const categorias = await db.query(
                'SELECT * FROM categorias ORDER BY nome'
            );

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

    const { nome, descricao, link_externo, categorias } = req.body;

    try {

        const result = await db.query(
            'INSERT INTO receitas(nome, descricao, link_externo) VALUES($1, $2, $3) RETURNING id',
            [nome, descricao, link_externo]
        );

        const receitaId = result.rows[0].id;

        if(categorias){

            if(Array.isArray(categorias)){

                for(let categoria of categorias){

                    await db.query(
                        'INSERT INTO receitas_categorias(receita_id, categoria_id) VALUES($1, $2)',
                        [receitaId, categoria]
                    );

                }

            } else {

                await db.query(
                    'INSERT INTO receitas_categorias(receita_id, categoria_id) VALUES($1, $2)',
                    [receitaId, categorias]
                );

            }

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

        await db.query(
            'DELETE FROM receitas_categorias WHERE receita_id = $1',
            [id]
        );

        await db.query(
            'DELETE FROM receitas WHERE id = $1',
            [id]
        );

        res.redirect('/receitas');

    } catch(err){

        console.log(err);
        res.send('Erro ao excluir receita');

    }

});

app.get('/receitas/editar/:id', async (req, res) => {

    const id = req.params.id;

    try {

        const result = await db.query(
            'SELECT * FROM receitas WHERE id = $1',
            [id]
        );

        res.render('editar', {
            receita: result.rows[0]
        });

    } catch(err){

        console.log(err);
        res.send('Erro ao carregar receita');

    }

});

app.post('/receitas/editar/:id', async (req, res) => {

    const id = req.params.id;

    const { nome, descricao, link_externo } = req.body;

    try {

        await db.query(
            'UPDATE receitas SET nome = $1, descricao = $2, link_externo = $3 WHERE id = $4',
            [nome, descricao, link_externo, id]
        );

        res.redirect('/receitas');

    } catch(err){

        console.log(err);
        res.send('Erro ao atualizar receita');

    }

});

app.get('/publico', async (req, res) => {

    try {

        const categoriaId = req.query.categoria;

        let receitas;

        if(categoriaId){

            receitas = await db.query(`
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
                WHERE receitas.id IN (
                    SELECT receita_id
                    FROM receitas_categorias
                    WHERE categoria_id = $1
                )
                GROUP BY receitas.id
                ORDER BY receitas.id DESC
            `, [categoriaId]);

        } else {

            receitas = await db.query(`
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

        }

        const categorias = await db.query(
            'SELECT * FROM categorias ORDER BY nome'
        );

        res.render('publico', {
            receitas: receitas.rows,
            categorias: categorias.rows
        });

    } catch(err){

        console.log(err);
        res.send('Erro ao carregar receitas');

    }

});

app.get('/habilidades', async (req, res) => {

    if(req.session.usuario){

        try {

            const habilidades = await db.query(
                'SELECT * FROM habilidades ORDER BY nome'
            );

            const minhasHabilidades = await db.query(`
                SELECT 
                    alunos_habilidades.id,
                    habilidades.nome,
                    alunos_habilidades.nivel
                FROM alunos_habilidades
                INNER JOIN habilidades
                    ON habilidades.id = alunos_habilidades.habilidade_id
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

        const totalAlunos = await db.query(
            'SELECT COUNT(*) FROM alunos'
        );

        const relatorio = await db.query(`
            SELECT 
                habilidades.nome,
                COUNT(alunos_habilidades.id) AS quantidade
            FROM habilidades
            LEFT JOIN alunos_habilidades
                ON habilidades.id = alunos_habilidades.habilidade_id
            GROUP BY habilidades.nome
            ORDER BY habilidades.nome
        `);

        const total = parseInt(totalAlunos.rows[0].count);

        const habilidades = relatorio.rows.map(item => {

            const porcentagem = total > 0
                ? ((item.quantidade / total) * 100).toFixed(0)
                : 0;

            return {
                nome: item.nome,
                quantidade: item.quantidade,
                porcentagem
            };

        });

        res.render('relatorio', {
            habilidades
        });

    } catch(err){

        console.log(err);
        res.send('Erro ao gerar relatório');

    }

});

app.listen(3000, () => {
    console.log('Servidor rodando');
});