// ============================================================
//  Rotas — Professores (Responsáveis)
// ============================================================

const express           = require('express');
const router            = express.Router();
const { run, get, all, registrarLog } = require('../database');

// IMPORTAÇÃO DOS CADEADOS DE SEGURANÇA
const { autenticar, apenasAdmin } = require('../middleware/auth');

// GET /api/professores (Liberado para ler)
router.get('/', autenticar, async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM professores ORDER BY nome ASC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/professores (BLOQUEADO: Apenas Admin)
router.post('/', autenticar, apenasAdmin, async (req, res) => {
  const { id, nome, turma, email, tipo, materia, codigo_barras } = req.body;
  if (!id || !nome || !turma || !tipo)
    return res.status(400).json({ erro: 'Campos obrigatórios: id, nome, turma, tipo.' });
  if (tipo === 'Matéria' && !materia)
    return res.status(400).json({ erro: 'Informe a matéria do professor.' });

  try {
    await run(`INSERT INTO professores (id, nome, turma, email, tipo, materia, codigo_barras) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, nome, turma, email || '', tipo, materia || '', codigo_barras || '']);
    const novo = await get(`SELECT * FROM professores WHERE id=?`, [id]);
    await registrarLog(req.usuario.id, req.usuario.nome, 'CRIOU PROFESSOR', `Nome: ${nome}`, `Turma/Tipo: ${turma} - ${tipo}`);
    res.status(201).json(novo);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/professores/:id (BLOQUEADO: Apenas Admin)
router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  const { nome, turma, email, tipo, materia, codigo_barras } = req.body;
  const { id } = req.params;
  if (!nome || !turma || !tipo)
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, turma, tipo.' });
  if (tipo === 'Matéria' && !materia)
    return res.status(400).json({ erro: 'Informe a matéria do professor.' });

  try {
    const result = await run(
      `UPDATE professores SET nome=?, turma=?, email=?, tipo=?, materia=?, codigo_barras=? WHERE id=?`,
      [nome, turma, email || '', tipo, materia || '', codigo_barras || '', id]
    );
    if (!result.changes) return res.status(404).json({ erro: 'Professor não encontrado.' });
    const atualizado = await get(`SELECT * FROM professores WHERE id=?`, [id]);
    await registrarLog(req.usuario.id, req.usuario.nome, 'EDITOU PROFESSOR', `Nome: ${nome}`, `Turma/Tipo: ${turma} - ${tipo}`);
    res.json(atualizado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/professores/:id (BLOQUEADO: Apenas Admin)
router.delete('/:id', autenticar, apenasAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const prof = await get(`SELECT * FROM professores WHERE id=?`, [id]);
    if (!prof) return res.status(404).json({ erro: 'Professor não encontrado.' });

    const empAtivo = await get(
      `SELECT id FROM emprestimos WHERE professor_id=? AND status='ativo'`, [id]
    );
    if (empAtivo)
      return res.status(409).json({ erro: 'Professor possui empréstimo ativo.' });

    await run(`DELETE FROM professores WHERE id=?`, [id]);
    await registrarLog(req.usuario.id, req.usuario.nome, 'EXCLUIU PROFESSOR', `Nome: ${prof.nome}`, `Turma/Tipo: ${prof.turma} - ${prof.tipo}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;