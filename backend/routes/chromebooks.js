// ============================================================
//  Rotas — Chromebooks
// ============================================================

const express          = require('express');
const router           = express.Router();
const { run, get, all, registrarLog } = require('../database');

// IMPORTAÇÃO DOS CADEADOS DE SEGURANÇA
const { autenticar, apenasAdmin } = require('../middleware/auth');

// GET /api/chromebooks (Liberado para ler)
router.get('/', autenticar, async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM chromebooks ORDER BY criado_em DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/chromebooks (BLOQUEADO: Apenas Admin)
router.post('/', autenticar, apenasAdmin, async (req, res) => {
  const { id, patrimonio, numero, cor, obs } = req.body;
  
  if (!id || !patrimonio || !numero || !cor)
    return res.status(400).json({ erro: 'Campos obrigatórios: id, patrimonio, numero, cor.' });

  try {
    await run(`INSERT INTO chromebooks (id, patrimonio, numero, cor, obs) VALUES (?, ?, ?, ?, ?)`,
      [id, patrimonio, numero, cor, obs || '']);
    
    const novo = await get(`SELECT * FROM chromebooks WHERE id=?`, [id]);
    await registrarLog(req.usuario.id, req.usuario.nome, 'CRIOU CHROMEBOOK', `Patrimônio: ${patrimonio}`, `Detalhes: #${numero} - ${cor}`);
    res.status(201).json(novo);
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ erro: 'ID ou patrimônio já cadastrado.' });
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/chromebooks/:id (BLOQUEADO: Apenas Admin)
router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  // 👇 MUDANÇA AQUI: Recebendo o 'status' do React
  const { patrimonio, numero, cor, obs, status } = req.body;
  const { id } = req.params;
  
  if (!patrimonio || !numero || !cor)
    return res.status(400).json({ erro: 'Campos obrigatórios: patrimonio, numero, cor.' });

  try {
    // 👇 MUDANÇA AQUI: Adicionando o 'status' no comando SQL (se vier vazio, mantém 'disponivel')
    const result = await run(`UPDATE chromebooks SET patrimonio=?, numero=?, cor=?, obs=?, status=? WHERE id=?`,
      [patrimonio, numero, cor, obs || '', status || 'disponivel', id]);
      
    if (!result.changes) return res.status(404).json({ erro: 'Chromebook não encontrado.' });
    const atualizado = await get(`SELECT * FROM chromebooks WHERE id=?`, [id]);
    await registrarLog(req.usuario.id, req.usuario.nome, 'EDITOU CHROMEBOOK', `Patrimônio: ${patrimonio}`, `Status novo: ${status || 'disponivel'}`);
    res.json(atualizado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/chromebooks/:id (BLOQUEADO: Apenas Admin)
router.delete('/:id', autenticar, apenasAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const cb = await get(`SELECT * FROM chromebooks WHERE id=?`, [id]);
    if (!cb) return res.status(404).json({ erro: 'Chromebook não encontrado.' });
    if (cb.status === 'emprestado')
      return res.status(409).json({ erro: 'Não é possível excluir um Chromebook em empréstimo.' });

    await run(`DELETE FROM chromebooks WHERE id=?`, [id]);
    await registrarLog(req.usuario.id, req.usuario.nome, 'EXCLUIU CHROMEBOOK', `Patrimônio: ${cb.patrimonio}`, `Cor: ${cb.cor}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;