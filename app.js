const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const app = express();

const db = require('./config/db');
require('./config/mongo');

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Configuração do Multer para salvar as fotos das receitas
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/'); // Certifique-se de criar esta pasta!
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(session({
    secret: 'segredo',
    resave: false,
    saveUninitialized: false
}));

// --- LOGIN ---
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('login'));

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
        res.send('Erro no login');
    }
});

// --- ÁREA LOGADA: RECEITAS ---
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
    } catch(err) {
        res.send('Erro ao carregar dados');
    }
});

app.post('/receitas', upload.single('imagem'), async (req, res) => {
    const { nome, descricao, link_externo, categorias, nova_categoria_nome } = req.body;
    const imagem_url = req.file ? req.file.filename : null;

    try {
        const result = await db.query(
            'INSERT INTO receitas(nome, descricao, link_externo, imagem_url) VALUES($1, $2, $3, $4) RETURNING id',
            [nome, descricao, link_externo, imagem_url]);
        const rId = result.rows[0].id;

        // Salva categorias selecionadas (checkbox)
        if(categorias){
            const cats = Array.isArray(categorias) ? categorias : [categorias];
            for(let c of cats) await db.query('INSERT INTO receitas_categorias VALUES($1, $2)', [rId, c]);
        }
        // Salva nova categoria digitada manualmente
        if(nova_categoria_nome && nova_categoria_nome.trim() !== ""){
            const nc = await db.query('INSERT INTO categorias(nome) VALUES($1) RETURNING id', [nova_categoria_nome]);
            await db.query('INSERT INTO receitas_categorias VALUES($1, $2)', [rId, nc.rows[0].id]);
        }
        res.redirect('/receitas');
    } catch(err) {
        res.send('Erro ao salvar receita');
    }
});

app.get('/receitas/excluir/:id', async (req, res) => {
    await db.query('DELETE FROM receitas_categorias WHERE receita_id = $1', [req.params.id]);
    await db.query('DELETE FROM receitas WHERE id = $1', [req.params.id]);
    res.redirect('/receitas');
});

app.get('/receitas/editar/:id', async (req, res) => {
    const recipe = await db.query('SELECT * FROM receitas WHERE id = $1', [req.params.id]);
    const cats = await db.query('SELECT * FROM categorias ORDER BY nome');
    const linked = await db.query('SELECT categoria_id FROM receitas_categorias WHERE receita_id = $1', [req.params.id]);
    
    const r = recipe.rows[0];
    r.categorias_ids = linked.rows.map(row => row.categoria_id);
    res.render('editar', { receita: r, categorias: cats.rows });
});

app.post('/receitas/editar/:id', async (req, res) => {
    const { nome, descricao, link_externo, categorias } = req.body;
    await db.query('UPDATE receitas SET nome=$1, descricao=$2, link_externo=$3 WHERE id=$4', [nome, descricao, link_externo, req.params.id]);
    await db.query('DELETE FROM receitas_categorias WHERE receita_id = $1', [req.params.id]);
    if(categorias){
        const cats = Array.isArray(categorias) ? categorias : [categorias];
        for(let c of cats) await db.query('INSERT INTO receitas_categorias VALUES($1, $2)', [req.params.id, c]);
    }
    res.redirect('/receitas');
});

// --- PÁGINA PÚBLICA ---
app.get('/publico', async (req, res) => {
    const catId = req.query.categoria;
    let sql = `SELECT r.*, STRING_AGG(c.nome, ', ') AS categorias FROM receitas r 
               LEFT JOIN receitas_categorias rc ON r.id = rc.receita_id 
               LEFT JOIN categorias c ON c.id = rc.categoria_id `;
    if(catId) sql += ` WHERE r.id IN (SELECT receita_id FROM receitas_categorias WHERE categoria_id = ${catId}) `;
    sql += ` GROUP BY r.id ORDER BY r.id DESC`;
    
    const receitas = await db.query(sql);
    const categorias = await db.query('SELECT * FROM categorias ORDER BY nome');
    res.render('publico', { receitas: receitas.rows, categorias: categorias.rows });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.listen(3000, () => console.log('Servidor em http://localhost:3000'));