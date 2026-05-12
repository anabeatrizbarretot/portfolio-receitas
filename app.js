const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

const db = require('./config/db');
require('./config/mongo');

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Garantir que a pasta de uploads existe
const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Configuração do Multer para fotos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.use(session({
    secret: 'segredo',
    resave: false,
    saveUninitialized: false
}));

// --- AUTENTICAÇÃO ---
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const result = await db.query('SELECT * FROM alunos WHERE email = $1 AND senha = $2', [email, senha]);
        if(result.rows.length > 0){
            req.session.usuario = result.rows[0];
            res.redirect('/home');
        } else { res.send('Email ou senha inválidos'); }
    } catch(err) { res.send('Erro no login'); }
});
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// --- ÁREA DE RECEITAS (ALUNO) ---
app.get('/receitas', async (req, res) => {
    if(!req.session.usuario) return res.redirect('/login');
    try {
        const receitas = await db.query(`
            SELECT r.*, STRING_AGG(c.nome, ', ') AS categorias 
            FROM receitas r 
            LEFT JOIN receitas_categorias rc ON r.id = rc.receita_id 
            LEFT JOIN categorias c ON c.id = rc.categoria_id 
            GROUP BY r.id ORDER BY r.id DESC`);
        const categorias = await db.query('SELECT * FROM categorias ORDER BY nome');
        res.render('receitas', { receitas: receitas.rows, categorias: categorias.rows });
    } catch(err) { res.send('Erro ao carregar receitas'); }
});

app.post('/receitas', upload.single('imagem'), async (req, res) => {
    const { nome, descricao, link_externo, categorias, nova_categoria_nome } = req.body;
    const imagem_url = req.file ? req.file.filename : null;
    try {
        const result = await db.query(
            'INSERT INTO receitas(nome, descricao, link_externo, imagem_url) VALUES($1, $2, $3, $4) RETURNING id',
            [nome, descricao, link_externo, imagem_url]);
        const rId = result.rows[0].id;
        if(categorias){
            const cats = Array.isArray(categorias) ? categorias : [categorias];
            for(let c of cats) await db.query('INSERT INTO receitas_categorias VALUES($1, $2)', [rId, c]);
        }
        if(nova_categoria_nome && nova_categoria_nome.trim() !== ""){
            const nc = await db.query('INSERT INTO categorias(nome) VALUES($1) RETURNING id', [nova_categoria_nome]);
            await db.query('INSERT INTO receitas_categorias VALUES($1, $2)', [rId, nc.rows[0].id]);
        }
        res.redirect('/receitas');
    } catch(err) { res.send('Erro ao cadastrar'); }
});

// --- ROTA DE EDIÇÃO (CORREÇÃO DO ERRO GET) ---
app.get('/receitas/editar/:id', async (req, res) => {
    if(!req.session.usuario) return res.redirect('/login');
    try {
        const recipe = await db.query('SELECT * FROM receitas WHERE id = $1', [req.params.id]);
        const cats = await db.query('SELECT * FROM categorias ORDER BY nome');
        const linked = await db.query('SELECT categoria_id FROM receitas_categorias WHERE receita_id = $1', [req.params.id]);
        
        const r = recipe.rows[0];
        r.categorias_ids = linked.rows.map(row => row.categoria_id);
        res.render('editar', { receita: r, categorias: cats.rows });
    } catch(err) { res.send('Erro ao abrir edição'); }
});

app.post('/receitas/editar/:id', upload.single('imagem'), async (req, res) => {
    const { nome, descricao, link_externo, categorias } = req.body;
    const id = req.params.id;
    try {
        let sql = 'UPDATE receitas SET nome=$1, descricao=$2, link_externo=$3';
        let params = [nome, descricao, link_externo];
        if (req.file) {
            sql += ', imagem_url=$4 WHERE id=$5';
            params.push(req.file.filename, id);
        } else {
            sql += ' WHERE id=$4';
            params.push(id);
        }
        await db.query(sql, params);
        await db.query('DELETE FROM receitas_categorias WHERE receita_id = $1', [id]);
        if(categorias){
            const cats = Array.isArray(categorias) ? categorias : [categorias];
            for(let c of cats) await db.query('INSERT INTO receitas_categorias VALUES($1, $2)', [id, c]);
        }
        res.redirect('/receitas');
    } catch(err) { res.send('Erro ao atualizar'); }
});

app.get('/receitas/excluir/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM receitas_categorias WHERE receita_id = $1', [req.params.id]);
        await db.query('DELETE FROM receitas WHERE id = $1', [req.params.id]);
        res.redirect('/receitas');
    } catch(err) { res.send('Erro ao excluir'); }
});

app.get('/home', (req, res) => {
    if(req.session.usuario) {
        res.render('index', { usuario: req.session.usuario });
    } else {
        res.redirect('/login');
    }
});

// --- PÁGINA PÚBLICA ---
app.get('/publico', async (req, res) => {
    const catId = req.query.categoria;
    try {
        let sql = `SELECT r.*, STRING_AGG(c.nome, ', ') AS categorias FROM receitas r 
                   LEFT JOIN receitas_categorias rc ON r.id = rc.receita_id 
                   LEFT JOIN categorias c ON c.id = rc.categoria_id `;
        let params = [];
        if(catId) {
            sql += ` WHERE r.id IN (SELECT receita_id FROM receitas_categorias WHERE categoria_id = $1) `;
            params.push(catId);
        }
        sql += ` GROUP BY r.id ORDER BY r.id DESC`;
        const receitas = await db.query(sql, params);
        const categorias = await db.query('SELECT * FROM categorias ORDER BY nome');
        res.render('publico', { receitas: receitas.rows, categorias: categorias.rows });
    } catch(err) { res.send('Erro ao carregar público'); }
});

// --- HABILIDADES E RELATÓRIO ---
app.get('/habilidades', async (req, res) => {
    if(!req.session.usuario) return res.redirect('/login');
    try {
        const hab = await db.query('SELECT * FROM habilidades ORDER BY nome');
        const minhas = await db.query(`SELECT ah.id, h.nome, ah.nivel FROM alunos_habilidades ah 
                                     INNER JOIN habilidades h ON h.id = ah.habilidade_id WHERE aluno_id = $1`, [req.session.usuario.id]);
        res.render('habilidades', { habilidades: hab.rows, minhasHabilidades: minhas.rows });
    } catch(err) { res.send('Erro ao carregar habilidades'); }
});

app.post('/habilidades', async (req, res) => {
    const { habilidade_id, nivel } = req.body;
    try {
        await db.query('INSERT INTO alunos_habilidades(aluno_id, habilidade_id, nivel) VALUES($1, $2, $3)', [req.session.usuario.id, habilidade_id, nivel]);
        res.redirect('/habilidades');
    } catch(err) { res.send('Erro ao salvar habilidade'); }
});

app.get('/relatorio', async (req, res) => {
    try {
        const totalAlunos = await db.query('SELECT COUNT(*) FROM alunos');
        const relatorio = await db.query(`SELECT h.nome, COUNT(ah.id) AS quantidade FROM habilidades h 
                                        LEFT JOIN alunos_habilidades ah ON h.id = ah.habilidade_id GROUP BY h.nome ORDER BY h.nome`);
        const total = parseInt(totalAlunos.rows[0].count);
        const habs = relatorio.rows.map(i => ({ nome: i.nome, quantidade: i.quantidade, porcentagem: total > 0 ? ((i.quantidade / total) * 100).toFixed(0) : 0 }));
        res.render('relatorio', { habilidades: habs });
    } catch(err) { res.send('Erro no relatório'); }
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));