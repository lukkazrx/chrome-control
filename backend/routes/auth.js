// ============================================================
//  Rotas — Autenticação e Usuários
// ============================================================

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { run, get, all } = require('../database');
const { autenticar, apenasAdmin } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha)
    return res.status(400).json({ erro: 'Informe login e senha.' });

  try {
    const usuario = await get(`SELECT * FROM usuarios WHERE login = ?`, [login]);
    if (!usuario)
      return res.status(401).json({ erro: 'Login ou senha incorretos.' });

    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok)
      return res.status(401).json({ erro: 'Login ou senha incorretos.' });

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log(`🔐 Login: ${usuario.nome} (${usuario.perfil})`);
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil } });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/auth/me
router.get('/me', autenticar, (req, res) => {
  res.json(req.usuario);
});

// GET /api/auth/usuarios
// Removido apenasAdmin para que os Operadores consigam ver a lista
router.get('/usuarios', autenticar, async (req, res) => {
  try {
    const rows = await all(`SELECT id, nome, login, perfil, criado_em FROM usuarios ORDER BY nome`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/auth/usuarios
// Mantido apenasAdmin: Operadores NÃO podem criar usuários
router.post('/usuarios', autenticar, apenasAdmin, async (req, res) => {
  const { nome, login, senha, perfil } = req.body;
  if (!nome || !login || !senha || !perfil)
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, login, senha, perfil.' });
  if (!['admin', 'operador'].includes(perfil))
    return res.status(400).json({ erro: 'Perfil inválido.' });

  try {
    const hash = await bcrypt.hash(senha, 10);
    const id   = Date.now().toString();
    await run(`INSERT INTO usuarios (id, nome, login, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)`,
      [id, nome, login, hash, perfil]);
    res.status(201).json({ id, nome, login, perfil });
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ erro: 'Este login já está em uso.' });
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/auth/usuarios/:id
// Removido apenasAdmin do middleware, mas a verificação é feita internamente
router.put('/usuarios/:id', autenticar, async (req, res) => {
  const { nome, login, perfil, senha } = req.body;
  const { id } = req.params;
  
  if (!nome || !login || !perfil)
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, login, perfil.' });

  // TRAVA DE SEGURANÇA 1: Se for operador, só pode editar o próprio ID
  if (req.usuario.perfil !== 'admin' && req.usuario.id !== id) {
    return res.status(403).json({ erro: 'Você só tem permissão para editar o seu próprio usuário.' });
  }

  // TRAVA DE SEGURANÇA 2: Impede que um operador se auto-promova a admin hackeando a requisição
  let perfilFinal = perfil;
  if (req.usuario.perfil !== 'admin') {
    perfilFinal = 'operador';
  }

  try {
    if (senha) {
      const hash = await bcrypt.hash(senha, 10);
      await run(`UPDATE usuarios SET nome=?, login=?, perfil=?, senha_hash=? WHERE id=?`,
        [nome, login, perfilFinal, hash, id]);
    } else {
      await run(`UPDATE usuarios SET nome=?, login=?, perfil=? WHERE id=?`,
        [nome, login, perfilFinal, id]);
    }
    const atualizado = await get(`SELECT id, nome, login, perfil FROM usuarios WHERE id=?`, [id]);
    res.json(atualizado);
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ erro: 'Este login já está em uso.' });
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/auth/senha
router.put('/senha', autenticar, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha)
    return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });

  try {
    const usuario = await get(`SELECT * FROM usuarios WHERE id=?`, [req.usuario.id]);
    const ok = await bcrypt.compare(senhaAtual, usuario.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta.' });

    const hash = await bcrypt.hash(novaSenha, 10);
    await run(`UPDATE usuarios SET senha_hash=? WHERE id=?`, [hash, req.usuario.id]);
    res.json({ ok: true, mensagem: 'Senha alterada com sucesso.' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/auth/usuarios/:id
// Mantido apenasAdmin: Operadores NÃO podem excluir usuários
router.delete('/usuarios/:id', autenticar, apenasAdmin, async (req, res) => {
  const { id } = req.params;
  if (id === req.usuario.id)
    return res.status(400).json({ erro: 'Você não pode excluir sua própria conta.' });

  try {
    const result = await run(`DELETE FROM usuarios WHERE id=?`, [id]);
    if (!result.changes) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;