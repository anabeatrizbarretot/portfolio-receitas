const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// --- CONFIGURAÇÕES DE BANCO DE DADOS ---
const db = require('./config/db');       // PostgreSQL
require('./config/mongo');               // MongoDB Atlas
const Comentario = require('./models/Comentario'); 

// --- MIDDLEWARES E VIEW ENGINE ---
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Configuração de Upload
const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// Configuração de Sessão
app.use(session({
    secret: 'chave_projeto_1',
    resave: false,
    saveUninitialized: false
}));

// --- [CRÍTICO] MIDDLEWARE GLOBAL PARA EJS ---
// Garante que a variável 'usuario' exista em todos os arquivos .ejs
app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    next();
});

// --- MIDDLEWARES DE SEGURANÇA (AUTORIZAÇÃO) ---
function verificarAutenticacao(req, res, next) {
    if (req.session.usuario) return next();
    res.redirect('/login');
}

function verificarAdmin(req, res, next) {
    if (req.session.usuario && req.session.usuario.e_admin) return next();
    res.status(403).send("Acesso Negado: Área exclusiva para administradores.");
}

// --- ROTAS DE AUTENTICAÇÃO (REQUISITO 1.1) ---
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const result = await db.query('SELECT * FROM alunos WHERE email = $1 AND senha = $2', [email, senha]);
        if (result.rows.length > 0) {
            req.session.usuario = result.rows[0];
            res.redirect('/home');
        } else { 
            res.send('Erro no login. <a href="/login">Voltar</a>'); 
        }
    } catch (err) { 
        res.status(500).send('Erro no servidor.'); 
    }
});

app.get('/home', verificarAutenticacao, (req, res) => res.render('index'));
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// --- ÁREA DO ADMINISTRADOR (REQUISITO 1.6) ---
app.get('/admin', verificarAdmin, (req, res) => res.render('admin/dashboard'));

// 1. Gerenciar Alunos (CRUD Completo)
app.get('/admin/alunos', verificarAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM alunos ORDER BY nome');
        res.render('admin/alunos', { alunos: result.rows });
    } catch (err) { res.send("Erro ao listar alunos."); }
});

app.post('/admin/alunos', verificarAdmin, async (req, res) => {
    const { nome, email, senha, e_admin } = req.body;
    const adminFlag = e_admin === 'on'; 
    try {
        await db.query('INSERT INTO alunos(nome, email, senha, e_admin) VALUES($1, $2, $3, $4)', [nome, email, senha, adminFlag]);
        res.redirect('/admin/alunos');
    } catch (err) { res.send("Erro ao cadastrar: " + err.message); }
});

// Rota de Edição de Aluno (Resolve erro de "Cannot GET /admin/alunos/editar/...")
app.get('/admin/alunos/editar/:id', verificarAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM alunos WHERE id = $1', [req.params.id]);
        res.render('admin/editar_aluno', { aluno: result.rows[0] });
    } catch (err) { res.send("Erro ao carregar edição de aluno."); }
});

app.post('/admin/alunos/editar/:id', verificarAdmin, async (req, res) => {
    const { nome, email, senha, e_admin } = req.body;
    const adminFlag = e_admin === 'on';
    try {
        await db.query('UPDATE alunos SET nome=$1, email=$2, senha=$3, e_admin=$4 WHERE id=$5', 
            [nome, email, senha, adminFlag, req.params.id]);

        // SE O USUÁRIO EDITADO FOR O QUE ESTÁ LOGADO, ATUALIZA A SESSÃO
        if (req.session.usuario.id == req.params.id) {
            req.session.usuario.nome = nome;
            req.session.usuario.e_admin = adminFlag;
        }

        res.redirect('/admin/alunos');
    } catch (err) { res.send("Erro ao salvar aluno."); }
});

app.get('/admin/alunos/excluir/:id', verificarAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM alunos WHERE id = $1', [req.params.id]);
        res.redirect('/admin/alunos');
    } catch (err) { res.send("Erro ao excluir."); }
});

// 2. Gerenciar Categorias (CRUD Completo)
app.get('/admin/categorias', verificarAdmin, async (req, res) => {
    const result = await db.query('SELECT * FROM categorias ORDER BY nome');
    res.render('admin/categorias', { categorias: result.rows });
});

app.post('/admin/categorias', verificarAdmin, async (req, res) => {
    await db.query('INSERT INTO categorias(nome) VALUES($1)', [req.body.nome]);
    res.redirect('/admin/categorias');
});

app.get('/admin/categorias/editar/:id', verificarAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM categorias WHERE id = $1', [req.params.id]);
        res.render('admin/editar_categoria', { categoria: result.rows[0] });
    } catch (err) { res.send("Erro ao carregar categoria."); }
});

app.post('/admin/categorias/editar/:id', verificarAdmin, async (req, res) => {
    await db.query('UPDATE categorias SET nome=$1 WHERE id=$2', [req.body.nome, req.params.id]);
    res.redirect('/admin/categorias');
});

// 3. Gerenciar Habilidades (CRUD Completo)
app.get('/admin/habilidades', verificarAdmin, async (req, res) => {
    const result = await db.query('SELECT * FROM habilidades ORDER BY nome');
    res.render('admin/habilidades', { habilidades: result.rows });
});

app.post('/admin/habilidades', verificarAdmin, async (req, res) => {
    await db.query('INSERT INTO habilidades(nome) VALUES($1)', [req.body.nome]);
    res.redirect('/admin/habilidades');
});

app.get('/admin/habilidades/editar/:id', verificarAdmin, async (req, res) => {
    const result = await db.query('SELECT * FROM habilidades WHERE id = $1', [req.params.id]);
    res.render('admin/editar_habilidade', { habilidade: result.rows[0] });
});

app.post('/admin/habilidades/editar/:id', verificarAdmin, async (req, res) => {
    await db.query('UPDATE habilidades SET nome=$1 WHERE id=$2', [req.body.nome, req.params.id]);
    res.redirect('/admin/habilidades');
});

// --- ROTA PÚBLICA (REQUISITO 1.7 e 1.8) ---
app.get('/publico', async (req, res) => {
    const catId = req.query.categoria;
    const busca = req.query.q;
    try {
        let sql = `SELECT r.*, STRING_AGG(DISTINCT c.nome, ', ') AS categorias, 
                   STRING_AGG(DISTINCT a.nome, ', ') AS autores
                   FROM receitas r 
                   LEFT JOIN receitas_categorias rc ON r.id = rc.receita_id 
                   LEFT JOIN categorias c ON c.id = rc.categoria_id 
                   LEFT JOIN receitas_alunos ra ON r.id = ra.receita_id
                   LEFT JOIN alunos a ON a.id = ra.aluno_id `;
        let params = [], filtros = [];
        if (catId) { filtros.push(`rc.categoria_id = $${params.length + 1}`); params.push(catId); }
        if (busca) { filtros.push(`(r.nome ILIKE $${params.length + 1} OR r.descricao ILIKE $${params.length + 1})`); params.push(`%${busca}%`); }
        if (filtros.length > 0) sql += " WHERE " + filtros.join(" AND ");
        sql += ` GROUP BY r.id ORDER BY r.id DESC`;

        const receitasResult = await db.query(sql, params);
        const categorias = await db.query('SELECT * FROM categorias ORDER BY nome');

        const ids = receitasResult.rows.map(r => r.id);
        const comentarios = await Comentario.find({ receitaId: { $in: ids } }).sort({ data: -1 });

        const receitasFinais = receitasResult.rows.map(r => ({
            ...r,
            comentarios: comentarios.filter(c => c.receitaId == r.id)
        }));

        res.render('publico', { receitas: receitasFinais, categorias: categorias.rows, categoriaAtiva: catId, termoBusca: busca || '' });
    } catch (err) { res.send('Erro ao carregar portfólio.'); }
});

// Comentários MongoDB Atlas (Requisito 1.8)
app.post('/receitas/:id/comentarios', async (req, res) => {
    await Comentario.create({ receitaId: req.params.id, nome: req.body.nome, texto: req.body.texto });
    res.redirect('/publico');
});

// --- GERENCIAMENTO DE RECEITAS (REQUISITOS 1.2, 1.3, 1.5) ---
app.get('/receitas', verificarAutenticacao, async (req, res) => {
    let sql = `SELECT r.*, STRING_AGG(DISTINCT c.nome, ', ') AS categorias FROM receitas r 
               LEFT JOIN receitas_categorias rc ON r.id = rc.receita_id 
               LEFT JOIN categorias c ON c.id = rc.categoria_id 
               INNER JOIN receitas_alunos ra ON r.id = ra.receita_id `;
    let params = [];
    if (!req.session.usuario.e_admin) {
        sql += ` WHERE ra.aluno_id = $1 `;
        params.push(req.session.usuario.id);
    }
    sql += ` GROUP BY r.id ORDER BY r.id DESC`;
    
    const receitas = await db.query(sql, params);
    const categorias = await db.query('SELECT * FROM categorias ORDER BY nome');
    const todosAlunos = await db.query('SELECT id, nome FROM alunos ORDER BY nome');
    res.render('receitas', { receitas: receitas.rows, categorias: categorias.rows, alunos: todosAlunos.rows });
});

app.post('/receitas', verificarAutenticacao, upload.single('imagem'), async (req, res) => {
    const { nome, descricao, link_externo, categorias, autores } = req.body;
    const img = req.file ? req.file.filename : null;
    try {
        const result = await db.query('INSERT INTO receitas(nome, descricao, link_externo, imagem_url) VALUES($1, $2, $3, $4) RETURNING id', [nome, descricao, link_externo, img]);
        const rId = result.rows[0].id;
        
        if (categorias) {
            const cats = Array.isArray(categorias) ? categorias : [categorias];
            for (let c of cats) await db.query('INSERT INTO receitas_categorias VALUES($1, $2)', [rId, c]);
        }

        // Requisito 1.3: Vincula o criador e outros autores
        await db.query('INSERT INTO receitas_alunos VALUES($1, $2)', [rId, req.session.usuario.id]);
        if (autores) {
            const outr = Array.isArray(autores) ? autores : [autores];
            for (let aId of outr) {
                if (aId != req.session.usuario.id) await db.query('INSERT INTO receitas_alunos VALUES($1, $2)', [rId, aId]);
            }
        }
        res.redirect('/receitas');
    } catch (err) { res.send('Erro detalhado: ' + err.message); }
});

// Edição de Receita (Requisito 1.5)
app.get('/receitas/editar/:id', verificarAutenticacao, async (req, res) => {
    const r = await db.query('SELECT * FROM receitas WHERE id = $1', [req.params.id]);
    const cats = await db.query('SELECT * FROM categorias ORDER BY nome');
    const linked = await db.query('SELECT categoria_id FROM receitas_categorias WHERE receita_id = $1', [req.params.id]);
    const receita = r.rows[0];
    receita.categorias_ids = linked.rows.map(row => row.categoria_id);
    res.render('editar', { receita, categorias: cats.rows });
});

app.post('/receitas/editar/:id', verificarAutenticacao, upload.single('imagem'), async (req, res) => {
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

app.get('/receitas/excluir/:id', verificarAutenticacao, async (req, res) => {
    const check = await db.query('SELECT * FROM receitas_alunos WHERE receita_id = $1 AND aluno_id = $2', [req.params.id, req.session.usuario.id]);
    if (check.rows.length > 0 || req.session.usuario.e_admin) {
        await db.query('DELETE FROM receitas WHERE id = $1', [req.params.id]);
        res.redirect('/receitas');
    } else { res.status(403).send("Permissão negada."); }
});

// --- HABILIDADES DO ALUNO (REQUISITO 1.4) ---
app.get('/habilidades', verificarAutenticacao, async (req, res) => {
    const hab = await db.query('SELECT * FROM habilidades ORDER BY nome');
    const minhas = await db.query(`SELECT ah.id, h.nome, ah.nivel FROM alunos_habilidades ah 
                                   INNER JOIN habilidades h ON h.id = ah.habilidade_id 
                                   WHERE ah.aluno_id = $1`, [req.session.usuario.id]);
    res.render('habilidades', { habilidades: hab.rows, minhasHabilidades: minhas.rows });
});

app.post('/habilidades', verificarAutenticacao, async (req, res) => {
    const { habilidade_id, nivel } = req.body;
    try {
        const check = await db.query('SELECT * FROM alunos_habilidades WHERE aluno_id = $1 AND habilidade_id = $2', [req.session.usuario.id, habilidade_id]);
        if (check.rows.length > 0) {
            await db.query('UPDATE alunos_habilidades SET nivel = $1 WHERE aluno_id = $2 AND habilidade_id = $3', [nivel, req.session.usuario.id, habilidade_id]);
        } else {
            await db.query('INSERT INTO alunos_habilidades(aluno_id, habilidade_id, nivel) VALUES($1, $2, $3)', [req.session.usuario.id, habilidade_id, nivel]);
        }
        res.redirect('/habilidades');
    } catch (err) { res.send("Erro ao salvar habilidade."); }
});

// --- RELATÓRIO (REQUISITO 1.9) ---
app.get('/relatorio', async (req, res) => {
    try {
        const totalAlunos = await db.query('SELECT COUNT(*) FROM alunos');
        const relatorio = await db.query(`SELECT h.nome, COUNT(ah.id) AS quantidade FROM habilidades h 
                                          LEFT JOIN alunos_habilidades ah ON h.id = ah.habilidade_id 
                                          GROUP BY h.nome ORDER BY h.nome`);
        const total = parseInt(totalAlunos.rows[0].count);
        const habs = relatorio.rows.map(i => ({ 
            nome: i.nome, 
            quantidade: i.quantidade, 
            porcentagem: total > 0 ? ((i.quantidade / total) * 100).toFixed(0) : 0 
        }));
        res.render('relatorio', { habilidades: habs });
    } catch (err) { res.send("Erro no relatório."); }
});

app.listen(3000, () => console.log(`🚀 Servidor rodando em http://localhost:3000`));