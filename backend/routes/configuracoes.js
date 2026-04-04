const express = require('express');
const router = express.Router();
const { get, all, transaction, registrarLog } = require('../database');
const { autenticar } = require('../middleware/auth');

// Verifica admin (apenas admin pode mexer globalmente no White-label)
function verificarAdmin(req, res, next) {
  if (req.usuario.perfil !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado: Requer perfil de Administrador.' });
  }
  next();
}

// ==========================================
// BUSCAR TODAS CONFIGURAÇÕES (Livre / Auth)
// O sistema precisa ler o nome da escola mesmo não sendo admin
// ==========================================
router.get('/', autenticar, async (req, res) => {
  try {
    const rows = await all(`SELECT chave, valor FROM configuracoes`);
    // Converte array de objetos pra um dicionário direto
    const configMap = {};
    for (let r of rows) {
      configMap[r.chave] = r.valor;
    }

    // Esconde a API Key do Brevo se não for ADMIN pra não vazar no navegador dos operadores
    if (req.usuario.perfil !== 'admin') {
      configMap['brevo_api_key'] = '*** PROTECTED ***';
    }

    res.json(configMap);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configurações.' });
  }
});

// ==========================================
// ATUALIZAR CONFIGURAÇÕES EM MASSA (Apenas ADMIN)
// ==========================================
router.put('/', autenticar, verificarAdmin, async (req, res) => {
  const configs = req.body; // espera um objeto: { escola_nome: "...", brevo_api_key: "..." }

  if (!configs || typeof configs !== 'object') {
    return res.status(400).json({ error: 'Formato de dados inválido.' });
  }

  try {
    const queries = [];
    // Transforma o dicionário em query calls de UPSERT ou Update puro
    for (const chave in configs) {
      queries.push({
        sql: `INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
        params: [chave, configs[chave]]
      });
    }

    await transaction(queries);
    await registrarLog(req.usuario.id, req.usuario.nome, 'ATUALIZOU_CONFIGURACOES', 'SISTEMA', 'As configurações globais do sistema foram alteradas.');

    res.json({ message: 'Configurações atualizadas com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar novas configurações.' });
  }
});

module.exports = router;
