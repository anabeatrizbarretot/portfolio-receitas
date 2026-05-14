-- 1. Tabela de Alunos (Requisito 1.1 e 1.6)
CREATE TABLE IF NOT EXISTS alunos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(100) NOT NULL,
    e_admin BOOLEAN DEFAULT FALSE -- Define se é administrador
);

-- 2. Tabela de Categorias (Requisito 1.2)
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) UNIQUE NOT NULL
);

-- 3. Tabela de Receitas (Requisito 1.2)
CREATE TABLE IF NOT EXISTS receitas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT NOT NULL,
    link_externo VARCHAR(255),
    imagem_url VARCHAR(255)
);

-- 4. Tabela de Habilidades (Requisito 1.4)
CREATE TABLE IF NOT EXISTS habilidades (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL
);

-- --- RELACIONAMENTOS MUITOS-PARA-MUITOS (N:N) ---

-- Requisito 1.2: Receitas <-> Categorias
CREATE TABLE IF NOT EXISTS receitas_categorias (
    receita_id INTEGER REFERENCES receitas(id) ON DELETE CASCADE,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
    PRIMARY KEY (receita_id, categoria_id)
);

-- Requisito 1.3: Receitas <-> Alunos (Vários responsáveis por uma receita)
CREATE TABLE IF NOT EXISTS receitas_alunos (
    receita_id INTEGER REFERENCES receitas(id) ON DELETE CASCADE,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    PRIMARY KEY (receita_id, aluno_id)
);

-- Requisito 1.4: Alunos <-> Habilidades (Com Nível 0-10)
CREATE TABLE IF NOT EXISTS alunos_habilidades (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    habilidade_id INTEGER REFERENCES habilidades(id) ON DELETE CASCADE,
    nivel INTEGER CHECK (nivel >= 0 AND nivel <= 10),
    UNIQUE(aluno_id, habilidade_id)
);