const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// BANCO DE DADOS
const db = require('./config/db');       // Postgres
require('./config/mongo');               // MongoDB Atlas

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.use(session({
    secret: 'chave_projeto_1',
    resave: false,
    saveUninitialized: false
}));

// --- ROTAS ---
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const result = await db.query('SELECT * FROM alunos WHERE email = $1 AND senha = $2', [email, senha]);
        if (result.rows.length > 0) {
            req.session.usuario = result.rows[0];
            res.redirect('/home');
        } else { res.send('Erro no login. <a href="/login">Voltar</a>'); }
    } catch (err) { res.status(500).send('Erro no servidor.'); }
});

app.get('/home', (req, res) => req.session.usuario ? res.render('index', { usuario: req.session.usuario }) : res.redirect('/login'));
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// Portfólio Público
app.get('/publico', async (req, res) => {
    const catId = req.query.categoria;
    const busca = req.query.q;
    try {
        let sql = `SELECT r.*, STRING_AGG(c.nome, ', ') AS categorias FROM receitas r 
                   LEFT JOIN receitas_categorias rc ON r.id = rc.receita_id 
                   LEFT JOIN categorias c ON c.id = rc.categoria_id `;
        let params = [], filtros = [];
        if (catId) { filtros.push(`r.id IN (SELECT receita_id FROM receitas_categorias WHERE categoria_id = $${params.length + 1})`); params.push(catId); }
        if (busca) { filtros.push(`(r.nome ILIKE $${params.length + 1} OR r.descricao ILIKE $${params.length + 1})`); params.push(`%${busca}%`); }
        if (filtros.length > 0) sql += " WHERE " + filtros.join(" AND ");
        sql += ` GROUP BY r.id ORDER BY r.id DESC`;

        const receitas = await db.query(sql, params);
        const categorias = await db.query('SELECT * FROM categorias ORDER BY nome');
        res.render('publico', { receitas: receitas.rows, categorias: categorias.rows, categoriaAtiva: catId, termoBusca: busca || '' });
    } catch (err) { res.send('Erro no público.'); }
});

// CRUD Receitas
app.get('/receitas', async (req, res) => {
    if (!req.session.usuario) return res.redirect('/login');
    const receitas = await db.query(`SELECT r.*, STRING_AGG(c.nome, ', ') AS categorias FROM receitas r 
                                   LEFT JOIN receitas_categorias rc ON r.id = rc.receita_id 
                                   LEFT JOIN categorias c ON c.id = rc.categoria_id 
                                   GROUP BY r.id ORDER BY r.id DESC`);
    const categorias = await db.query('SELECT * FROM categorias ORDER BY nome');
    res.render('receitas', { receitas: receitas.rows, categorias: categorias.rows });
});

app.post('/receitas', upload.single('imagem'), async (req, res) => {
    const { nome, descricao, link_externo, categorias, nova_categoria_nome } = req.body;
    const img = req.file ? req.file.filename : null;
    try {
        const result = await db.query('INSERT INTO receitas(nome, descricao, link_externo, imagem_url) VALUES($1, $2, $3, $4) RETURNING id', [nome, descricao, link_externo, img]);
        const rId = result.rows[0].id;
        if (categorias) {
            const cats = Array.isArray(categorias) ? categorias : [categorias];
            for (let c of cats) await db.query('INSERT INTO receitas_categorias VALUES($1, $2)', [rId, c]);
        }
        res.redirect('/receitas');
    } catch (err) { res.send('Erro ao cadastrar.'); }
});

// Edição/Exclusão
app.get('/receitas/editar/:id', async (req, res) => {
    if (!req.session.usuario) return res.redirect('/login');
    const r = await db.query('SELECT * FROM receitas WHERE id = $1', [req.params.id]);
    const cats = await db.query('SELECT * FROM categorias ORDER BY nome');
    const linked = await db.query('SELECT categoria_id FROM receitas_categorias WHERE receita_id = $1', [req.params.id]);
    const receita = r.rows[0];
    receita.categorias_ids = linked.rows.map(row => row.categoria_id);
    res.render('editar', { receita, categorias: cats.rows });
});

app.post('/receitas/editar/:id', upload.single('imagem'), async (req, res) => {
    const { nome, descricao, link_externo, categorias } = req.body;
    const id = req.params.id;
    try {
        let sql = 'UPDATE receitas SET nome=$1, descricao=$2, link_externo=$3';
        let params = [nome, descricao, link_externo];
        if (req.file) { sql += ', imagem_url=$4 WHERE id=$5'; params.push(req.file.filename, id); }
        else { sql += ' WHERE id=$4'; params.push(id); }
        await db.query(sql, params);
        await db.query('DELETE FROM receitas_categorias WHERE receita_id = $1', [id]);
        if (categorias) {
            const cats = Array.isArray(categorias) ? categorias : [categorias];
            for (let c of cats) await db.query('INSERT INTO receitas_categorias VALUES($1, $2)', [id, c]);
        }
        res.redirect('/receitas');
    } catch (err) { res.send('Erro ao editar.'); }
});

app.get('/receitas/excluir/:id', async (req, res) => {
    await db.query('DELETE FROM receitas_categorias WHERE receita_id = $1', [req.params.id]);
    await db.query('DELETE FROM receitas WHERE id = $1', [req.params.id]);
    res.redirect('/receitas');
});

// Habilidades e Relatório
app.get('/habilidades', async (req, res) => {
    if (!req.session.usuario) return res.redirect('/login');
    const hab = await db.query('SELECT * FROM habilidades ORDER BY nome');
    const minhas = await db.query(`SELECT ah.id, h.nome, ah.nivel FROM alunos_habilidades ah INNER JOIN habilidades h ON h.id = ah.habilidade_id WHERE aluno_id = $1`, [req.session.usuario.id]);
    res.render('habilidades', { habilidades: hab.rows, minhasHabilidades: minhas.rows });
});

app.post('/habilidades', async (req, res) => {
    await db.query('INSERT INTO alunos_habilidades(aluno_id, habilidade_id, nivel) VALUES($1, $2, $3)', [req.session.usuario.id, req.body.habilidade_id, req.body.nivel]);
    res.redirect('/habilidades');
});

app.get('/relatorio', async (req, res) => {
    const totalAlunos = await db.query('SELECT COUNT(*) FROM alunos');
    const relatorio = await db.query(`SELECT h.nome, COUNT(ah.id) AS quantidade FROM habilidades h LEFT JOIN alunos_habilidades ah ON h.id = ah.habilidade_id GROUP BY h.nome ORDER BY h.nome`);
    const total = parseInt(totalAlunos.rows[0].count);
    const habs = relatorio.rows.map(i => ({ nome: i.nome, quantidade: i.quantidade, porcentagem: total > 0 ? ((i.quantidade / total) * 100).toFixed(0) : 0 }));
    res.render('relatorio', { habilidades: habs });
});

app.listen(3000, () => console.log(`🚀 Servidor rodando em http://localhost:3000`));