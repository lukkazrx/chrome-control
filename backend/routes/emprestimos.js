// ============================================================
//  Rotas — Empréstimos
// ============================================================

const express           = require('express');
const router            = express.Router();
const { run, get, all, registrarLog } = require('../database');

// Helper: monta empréstimo com chromebooks aninhados
async function montarEmprestimo(emp) {
  const cbs = await all(
    `SELECT chromebook_id AS id, patrimonio, numero, cor FROM emprestimo_chromebooks WHERE emprestimo_id=?`,
    [emp.id]
  );
  
  let listaAcessorios = [];
  try {
    if (emp.acessorios) listaAcessorios = JSON.parse(emp.acessorios);
  } catch (err) {
    listaAcessorios = [];
  }

  return {
    id:               emp.id,
    professorId:      emp.professor_id,
    professorNome:    emp.professor_nome,
    professorTurma:   emp.professor_turma,
    professorTipo:    emp.professor_tipo,
    professorMateria: emp.professor_materia,
    acessorios:       listaAcessorios, 
    obs:              emp.obs,
    dataRetirada:     emp.data_retirada,
    dataDevolucao:    emp.data_devolucao,
    status:           emp.status,
    chromebooks:      cbs,
    registradoPor:    emp.registrado_por,
    devolvidoPor:     emp.devolvido_por  
  };
}

// GET /api/emprestimos — ativos
router.get('/', async (req, res) => {
  try {
    const rows   = await all(`SELECT * FROM emprestimos WHERE status='ativo' ORDER BY data_retirada DESC`);
    const result = await Promise.all(rows.map(montarEmprestimo));
    res.json(result);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/emprestimos/historico
router.get('/historico', async (req, res) => {
  try {
    const rows   = await all(`SELECT * FROM emprestimos ORDER BY criado_em DESC`);
    const result = await Promise.all(rows.map(montarEmprestimo));
    res.json(result);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/emprestimos — registrar
router.post('/', async (req, res) => {
  const {
    id, professorId, professorNome, professorTurma,
    professorTipo, professorMateria, chromebooks, acessorios, obs, dataRetirada, registradoPor
  } = req.body;

  if (!id || !professorId || !chromebooks?.length)
    return res.status(400).json({ erro: 'Campos obrigatórios: id, professorId, chromebooks.' });

  try {
    for (const cb of chromebooks) {
      const row = await get(`SELECT status FROM chromebooks WHERE id=?`, [cb.id]);
      if (!row) return res.status(404).json({ erro: `Chromebook "${cb.id}" não encontrado.` });
      if (row.status !== 'disponivel')
        return res.status(409).json({ erro: `Chromebook "${cb.id}" não está disponível.` });
    }

    const acessoriosStr = JSON.stringify(acessorios || []);

    await run(
      `INSERT INTO emprestimos (id, professor_id, professor_nome, professor_turma, professor_tipo, professor_materia, acessorios, obs, data_retirada, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, professorId, professorNome, professorTurma, professorTipo, professorMateria || '', acessoriosStr, obs || '', dataRetirada, registradoPor || 'Sistema']
    );

    for (const cb of chromebooks) {
      await run(
        `INSERT INTO emprestimo_chromebooks (emprestimo_id, chromebook_id, patrimonio, numero, cor) VALUES (?, ?, ?, ?, ?)`,
        [id, cb.id, cb.patrimonio, cb.numero, cb.cor]
      );
      await run(`UPDATE chromebooks SET status='emprestado' WHERE id=?`, [cb.id]);
    }

    const emp = await get(`SELECT * FROM emprestimos WHERE id=?`, [id]);
    await registrarLog(req.usuario.id, req.usuario.nome, 'EFETUOU EMPRÉSTIMO', `Prof: ${professorNome}`, `Chromebooks: ${chromebooks.length} unid.`);
    res.status(201).json(await montarEmprestimo(emp));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// PUT /api/emprestimos/:id/editar
router.put('/:id/editar', async (req, res) => {
  const { id } = req.params;
  const { professorId, professorNome, professorTurma, professorTipo, professorMateria, chromebooks, acessorios, obs } = req.body;

  if (!professorId || !chromebooks?.length)
    return res.status(400).json({ erro: 'Campos obrigatórios: professorId, chromebooks.' });

  try {
    const emp = await get(`SELECT * FROM emprestimos WHERE id=?`, [id]);
    if (!emp) return res.status(404).json({ erro: 'Empréstimo não encontrado.' });
    if (emp.status === 'devolvido') return res.status(409).json({ erro: 'Empréstimo já devolvido.' });

    const cbsAntigos = await all(`SELECT chromebook_id FROM emprestimo_chromebooks WHERE emprestimo_id=?`, [id]);
    const idsAntigos  = cbsAntigos.map(c => c.chromebook_id);
    const idsNovos    = chromebooks.map(c => c.id);

    const liberar  = idsAntigos.filter(x => !idsNovos.includes(x));
    const reservar = idsNovos.filter(x => !idsAntigos.includes(x));

    for (const cbId of reservar) {
      const cb = await get(`SELECT status FROM chromebooks WHERE id=?`, [cbId]);
      if (!cb) return res.status(404).json({ erro: `Chromebook "${cbId}" não encontrado.` });
      if (cb.status !== 'disponivel') return res.status(409).json({ erro: `Chromebook "${cbId}" não está disponível.` });
    }

    const acessoriosStr = JSON.stringify(acessorios || []);

    await run(`UPDATE emprestimos SET professor_id=?, professor_nome=?, professor_turma=?, professor_tipo=?, professor_materia=?, acessorios=?, obs=? WHERE id=?`,
      [professorId, professorNome, professorTurma, professorTipo, professorMateria || '', acessoriosStr, obs || '', id]);

    await run(`DELETE FROM emprestimo_chromebooks WHERE emprestimo_id=?`, [id]);
    
    for (const cb of chromebooks) {
      await run(`INSERT INTO emprestimo_chromebooks (emprestimo_id, chromebook_id, patrimonio, numero, cor) VALUES (?,?,?,?,?)`,
        [id, cb.id, cb.patrimonio, cb.numero, cb.cor]);
    }

    for (const cbId of liberar)  await run(`UPDATE chromebooks SET status='disponivel' WHERE id=?`, [cbId]);
    for (const cbId of reservar) await run(`UPDATE chromebooks SET status='emprestado'  WHERE id=?`, [cbId]);

    const atualizado = await get(`SELECT * FROM emprestimos WHERE id=?`, [id]);
    await registrarLog(req.usuario.id, req.usuario.nome, 'EDITOU EMPRÉSTIMO', `ID: ${id}`, `Prof: ${professorNome}`);
    res.json(await montarEmprestimo(atualizado));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// =========================================================================
// NOVO: PUT /api/emprestimos/:id/devolver (AGORA COM DEVOLUÇÃO PARCIAL!)
// =========================================================================
router.put('/:id/devolver', async (req, res) => {
  const { id }        = req.params;
  const { devolvidoPor, chromebookIds } = req.body; // Recebe quais IDs estão sendo devolvidos
  const dataDevolucao = new Date().toLocaleString('pt-BR');

  try {
    const emp = await get(`SELECT * FROM emprestimos WHERE id=?`, [id]);
    if (!emp) return res.status(404).json({ erro: 'Empréstimo não encontrado.' });
    if (emp.status === 'devolvido') return res.status(409).json({ erro: 'Empréstimo já devolvido.' });

    const todosCbs = await all(`SELECT chromebook_id, patrimonio, numero, cor FROM emprestimo_chromebooks WHERE emprestimo_id=?`, [id]);
    
    // Se não enviou chromebookIds, ou enviou todos, é devolução TOTAL
    const isTotal = !chromebookIds || chromebookIds.length === 0 || chromebookIds.length >= todosCbs.length;

    if (isTotal) {
      await run(`UPDATE emprestimos SET status='devolvido', data_devolucao=?, devolvido_por=? WHERE id=?`, 
        [dataDevolucao, devolvidoPor || 'Sistema', id]);

      for (const cb of todosCbs) {
        await run(`UPDATE chromebooks SET status='disponivel' WHERE id=?`, [cb.chromebook_id]);
      }

      const atualizado = await get(`SELECT * FROM emprestimos WHERE id=?`, [id]);
      await registrarLog(req.usuario.id, req.usuario.nome, 'DEVOLVEU EMPRÉSTIMO', `Completa`, `Equipamentos do ID: ${id}`);
      return res.json({ tipo: 'total', atualizado: await montarEmprestimo(atualizado) });
    
    } else {
      // É DEVOLUÇÃO PARCIAL
      const cbsDevolvidos = todosCbs.filter(c => chromebookIds.includes(c.chromebook_id));
      
      // 1. Cria um registro de Histórico só para os que voltaram (clonando os dados)
      const idParcial = id + '-P' + Date.now().toString().slice(-4); 
      await run(
        `INSERT INTO emprestimos (id, professor_id, professor_nome, professor_turma, professor_tipo, professor_materia, acessorios, obs, data_retirada, data_devolucao, status, registrado_por, devolvido_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'devolvido', ?, ?)`,
        [idParcial, emp.professor_id, emp.professor_nome, emp.professor_turma, emp.professor_tipo, emp.professor_materia, '[]', `(Devolução Parcial) ${emp.obs}`, emp.data_retirada, dataDevolucao, emp.registrado_por, devolvidoPor || 'Sistema']
      );

      // 2. Transfere os chromebooks do empréstimo ativo para o histórico novo e libera eles
      for (const cb of cbsDevolvidos) {
        await run(`INSERT INTO emprestimo_chromebooks (emprestimo_id, chromebook_id, patrimonio, numero, cor) VALUES (?, ?, ?, ?, ?)`,
          [idParcial, cb.chromebook_id, cb.patrimonio, cb.numero, cb.cor]);

        await run(`DELETE FROM emprestimo_chromebooks WHERE emprestimo_id=? AND chromebook_id=?`, [id, cb.chromebook_id]);
        await run(`UPDATE chromebooks SET status='disponivel' WHERE id=?`, [cb.chromebook_id]);
      }

      // Retorna os dois empréstimos para o React atualizar a tela
      const atualizado = await get(`SELECT * FROM emprestimos WHERE id=?`, [id]);
      const novoParcial = await get(`SELECT * FROM emprestimos WHERE id=?`, [idParcial]);

      await registrarLog(req.usuario.id, req.usuario.nome, 'DEVOLVEU PARCIALMENTE', `Parcial`, `Equipamentos do ID: ${id}`);
      return res.json({ 
        tipo: 'parcial', 
        atualizado: await montarEmprestimo(atualizado),
        parcial: await montarEmprestimo(novoParcial) 
      });
    }

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /api/emprestimos/historico
router.delete('/historico', async (req, res) => {
  try {
    const result = await run(`DELETE FROM emprestimos WHERE status='devolvido'`);
    await registrarLog(req.usuario.id, req.usuario.nome, 'LIMPOU HISTÓRICO EMPRÉSTIMOS', `Removidos: ${result.changes}`);
    res.json({ ok: true, removidos: result.changes });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;