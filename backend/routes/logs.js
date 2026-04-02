const express = require('express');
const router = express.Router();
const { all } = require('../database');
const { apenasAdmin } = require('../middleware/auth');

// GET /api/logs -> Buscar todos os logs de ações (apenas administrador)
router.get('/', apenasAdmin, async (req, res) => {
  try {
    const logs = await all(`SELECT * FROM logs_sistema ORDER BY data_hora DESC LIMIT 200`);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar logs.', detalhes: err.message });
  }
});

module.exports = router;
