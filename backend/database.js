// ============================================================
//  ChromeControl — Banco de dados (sqlite3 direto)
// ============================================================

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const bcrypt  = require('bcryptjs');

const db = new sqlite3.Database(path.join(__dirname, 'banco.db'));

// Helper: transforma callback em promise
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper: executa múltiplos comandos em transação
function transaction(queries) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      Promise.all(queries.map(({ sql, params }) => run(sql, params || [])))
        .then((results) => {
          db.run('COMMIT');
          resolve(results);
        })
        .catch((err) => {
          db.run('ROLLBACK');
          reject(err);
        });
    });
  });
}

// ── Criação das tabelas ──────────────────────────────────────
async function iniciarBanco() {
  db.serialize(() => {
    db.run(`PRAGMA foreign_keys = ON`);

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id         TEXT PRIMARY KEY,
      nome       TEXT NOT NULL,
      login      TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil     TEXT NOT NULL DEFAULT 'operador',
      criado_em  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chromebooks (
      id         TEXT PRIMARY KEY,
      patrimonio TEXT NOT NULL UNIQUE,
      numero     TEXT,
      cor        TEXT NOT NULL,
      obs        TEXT DEFAULT '',
      status     TEXT NOT NULL DEFAULT 'disponivel',
      criado_em  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS professores (
      id            TEXT PRIMARY KEY,
      nome          TEXT NOT NULL,
      turma         TEXT NOT NULL,
      email         TEXT DEFAULT '',
      tipo          TEXT NOT NULL,
      materia       TEXT DEFAULT '',
      codigo_barras TEXT DEFAULT '',
      criado_em     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS emprestimos (
      id                TEXT PRIMARY KEY,
      professor_id      TEXT NOT NULL,
      professor_nome    TEXT NOT NULL,
      professor_turma   TEXT NOT NULL,
      professor_tipo    TEXT NOT NULL,
      professor_materia TEXT DEFAULT '',
      acessorios        TEXT,
      obs               TEXT DEFAULT '',
      data_retirada     TEXT NOT NULL,
      data_devolucao    TEXT DEFAULT NULL,
      status            TEXT NOT NULL DEFAULT 'ativo',
      criado_em         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      registrado_por    TEXT,
      devolvido_por     TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS emprestimo_chromebooks (
      emprestimo_id TEXT NOT NULL,
      chromebook_id TEXT NOT NULL,
      patrimonio    TEXT NOT NULL,
      numero        TEXT,
      cor           TEXT NOT NULL,
      PRIMARY KEY (emprestimo_id, chromebook_id)
    )`);

    // =========================================================
    // NOVA TABELA: HISTÓRICO DE AUDITORIAS
    // =========================================================
    db.run(`CREATE TABLE IF NOT EXISTS auditorias (
      id                 TEXT PRIMARY KEY,
      data_auditoria     TEXT NOT NULL,
      responsavel        TEXT NOT NULL,
      esperados_json     TEXT NOT NULL, -- Arrays com os dados do momento salvos como JSON
      encontrados_json   TEXT NOT NULL,
      pendentes_json     TEXT NOT NULL,
      qtd_esperada       INTEGER NOT NULL,
      qtd_encontrada     INTEGER NOT NULL,
      qtd_pendente       INTEGER NOT NULL
    )`);

    // =========================================================
    // NOVA TABELA: LOGS DE AÇÕES DE USUÁRIOS
    // =========================================================
    db.run(`CREATE TABLE IF NOT EXISTS logs_sistema (
      id            TEXT PRIMARY KEY,
      operador_id   TEXT NOT NULL,
      operador_nome TEXT NOT NULL,
      acao          TEXT NOT NULL,
      entidade      TEXT,
      detalhes      TEXT,
      data_hora     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);

    // =========================================================
    // NOVA TABELA: CONFIGURAÇÕES DA ESCOLA (WHITE-LABEL)
    // =========================================================
    db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    )`);

    // =========================================================
    // TABELAS: AGENDA DE RECURSOS
    // =========================================================
    db.run(`CREATE TABLE IF NOT EXISTS recursos_agenda (
      id        TEXT PRIMARY KEY,
      nome      TEXT NOT NULL,
      descricao TEXT DEFAULT '',
      cor       TEXT DEFAULT '#4f8ef7',
      ativo     INTEGER NOT NULL DEFAULT 1,
      ordem     INTEGER DEFAULT 0,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
      id               TEXT PRIMARY KEY,
      recurso_id       TEXT NOT NULL,
      professor_nome   TEXT NOT NULL,
      professor_email  TEXT NOT NULL,
      turma            TEXT DEFAULT '',
      data             TEXT NOT NULL,
      hora_inicio      TEXT NOT NULL,
      hora_fim         TEXT NOT NULL,
      obs              TEXT DEFAULT '',
      criado_em        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);
  });

  // --- MIGRATIONS AUTOMÁTICAS PARA BANCOS EXISTENTES ---
  
  try {
    await get(`SELECT numero FROM chromebooks LIMIT 1`);
  } catch (err) {
    console.log('🔄 Atualizando banco: adicionando coluna "numero" em chromebooks...');
    await run(`ALTER TABLE chromebooks ADD COLUMN numero TEXT`);
  }

  try {
    await get(`SELECT numero FROM emprestimo_chromebooks LIMIT 1`);
  } catch (err) {
    console.log('🔄 Atualizando banco: adicionando coluna "numero" em emprestimo_chromebooks...');
    await run(`ALTER TABLE emprestimo_chromebooks ADD COLUMN numero TEXT`);
  }

  try {
    await get(`SELECT registrado_por FROM emprestimos LIMIT 1`);
  } catch (err) {
    console.log('🔄 Atualizando banco: adicionando coluna "registrado_por" em emprestimos...');
    await run(`ALTER TABLE emprestimos ADD COLUMN registrado_por TEXT`);
  }

  try {
    await get(`SELECT devolvido_por FROM emprestimos LIMIT 1`);
  } catch (err) {
    console.log('🔄 Atualizando banco: adicionando coluna "devolvido_por" em emprestimos...');
    await run(`ALTER TABLE emprestimos ADD COLUMN devolvido_por TEXT`);
  }

  try {
    await get(`SELECT acessorios FROM emprestimos LIMIT 1`);
  } catch (err) {
    console.log('🔄 Atualizando banco: adicionando coluna "acessorios" em emprestimos...');
    await run(`ALTER TABLE emprestimos ADD COLUMN acessorios TEXT`);
  }

  try {
    await get(`SELECT codigo_barras FROM professores LIMIT 1`);
  } catch (err) {
    console.log('🔄 Atualizando banco: adicionando coluna "codigo_barras" em professores...');
    await run(`ALTER TABLE professores ADD COLUMN codigo_barras TEXT DEFAULT ''`);
  }

  // --- FIM DAS MIGRATIONS ---

  // --- SEED CONFIGURAÇÕES PADRÃO ---
  const countConfigs = await get(`SELECT COUNT(*) as count FROM configuracoes`);
  if (countConfigs.count === 0) {
    console.log('🌱 Semeando configurações padrão da instituição...');
    await run(`INSERT INTO configuracoes (chave, valor) VALUES 
      ('escola_nome', 'ChromeControl Escola Padrão'),
      ('atraso_padrao_horas', '4'),
      ('brevo_api_key', ''),
      ('email_remetente', 'noreply@chromecontrol.com.br'),
      ('nome_remetente', 'Biblioteca da Escola'),
      ('agenda_dominio', ''),
      ('agenda_hora_inicio', '07:00'),
      ('agenda_hora_fim', '18:00'),
      ('agenda_duracao_slot', '50'),
      ('agenda_sabado', '0')
    `);
  } else {
    // Migration: add agenda keys if they don't exist
    const keys = ['agenda_dominio', 'agenda_hora_inicio', 'agenda_hora_fim', 'agenda_duracao_slot', 'agenda_sabado'];
    const defaults = { agenda_dominio: '', agenda_hora_inicio: '07:00', agenda_hora_fim: '18:00', agenda_duracao_slot: '50', agenda_sabado: '0' };
    for (const k of keys) {
      const exists = await get(`SELECT chave FROM configuracoes WHERE chave = ?`, [k]);
      if (!exists) await run(`INSERT INTO configuracoes (chave, valor) VALUES (?, ?)`, [k, defaults[k]]);
    }
  }

  // --- SEED RECURSOS PADRÃO DA AGENDA ---
  const countRecursos = await get(`SELECT COUNT(*) as count FROM recursos_agenda`);
  if (countRecursos.count === 0) {
    console.log('🌱 Semeando recursos padrão da agenda...');
    await run(`INSERT INTO recursos_agenda (id, nome, descricao, cor, ordem) VALUES
      ('lab-info', 'Laboratório de Informática', 'Laboratório com computadores fixos', '#4f8ef7', 0),
      ('carrinho-cb', 'Carrinho de Chromebooks', 'Carrinho com Chromebooks portáteis', '#38d9a9', 1)
    `);
  }

  // Cria admin padrão se não existir
  const admin = await get(`SELECT id FROM usuarios WHERE login = 'admin'`);
  if (!admin) {
    const hash = await bcrypt.hash('admin123', 10);
    await run(
      `INSERT INTO usuarios (id, nome, login, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)`,
      ['admin-inicial', 'Administrador', 'admin', hash, 'admin']
    );
    console.log('👤 Usuário admin criado — login: admin / senha: admin123');
    console.log('⚠️  Troque a senha após o primeiro acesso!');
  }

  console.log('✅ Banco de dados SQLite iniciado — banco.db');
}

// ── Utilitário para registrar logs ───────────────────────────
async function registrarLog(operador_id, operador_nome, acao, entidade = null, detalhes = null) {
  try {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    await run(
      `INSERT INTO logs_sistema (id, operador_id, operador_nome, acao, entidade, detalhes) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, operador_id, operador_nome, acao, entidade, detalhes]
    );
  } catch (err) {
    console.error('❌ Erro ao registrar log no banco:', err.message);
  }
}

module.exports = { db, run, get, all, transaction, iniciarBanco, registrarLog };