const express = require('express');
const router = express.Router();
const { run, all } = require('../database');

// GET /api/auditorias -> Busca todo o histórico de inventários
router.get('/', async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM auditorias ORDER BY data_auditoria DESC`);
    
    // Transforma as strings JSON de volta em Arrays reais para o React conseguir ler fácil
    const auditoriasLidas = rows.map(row => ({
      ...row,
      esperados_json: JSON.parse(row.esperados_json || '[]'),
      encontrados_json: JSON.parse(row.encontrados_json || '[]'),
      pendentes_json: JSON.parse(row.pendentes_json || '[]')
    }));

    res.json(auditoriasLidas);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/auditorias -> Salva um novo inventário
router.post('/', async (req, res) => {
  const { responsavel, esperados, encontrados, pendentes } = req.body;
  
  const id = `AUD-${Date.now()}`; // Ex: AUD-1712003847294
  const hoje = new Date();
  // Formata bonitinho "DD/MM/YYYY, HH:MM"
  const data_auditoria = hoje.toLocaleDateString('pt-BR') + ', ' + hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  try {
    await run(
      `INSERT INTO auditorias (
        id, data_auditoria, responsavel, 
        esperados_json, encontrados_json, pendentes_json, 
        qtd_esperada, qtd_encontrada, qtd_pendente
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data_auditoria,
        responsavel || 'Sistema',
        JSON.stringify(esperados || []),
        JSON.stringify(encontrados || []),
        JSON.stringify(pendentes || []),
        esperados ? esperados.length : 0,
        encontrados ? encontrados.length : 0,
        pendentes ? pendentes.length : 0
      ]
    );

    const novaAuditoria = {
      id, data_auditoria, responsavel: responsavel || 'Sistema',
      esperados_json: esperados || [],
      encontrados_json: encontrados || [],
      pendentes_json: pendentes || [],
      qtd_esperada: esperados ? esperados.length : 0,
      qtd_encontrada: encontrados ? encontrados.length : 0,
      qtd_pendente: pendentes ? pendentes.length : 0
    };

    res.status(201).json(novaAuditoria);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;