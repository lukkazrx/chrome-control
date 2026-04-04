// ============================================================
//  Rotas — Agenda de Recursos (Carrinho / Laboratório)
// ============================================================

const express = require('express');
const router  = express.Router();
const { run, get, all, registrarLog } = require('../database');
const { autenticar, apenasAdmin }     = require('../middleware/auth');

// ── Helpers ─────────────────────────────────────────────────

async function validarDominio(email) {
  const config = await get(`SELECT valor FROM configuracoes WHERE chave = 'agenda_dominio'`);
  const raw = (config?.valor || '').trim();
  if (!raw) return true; // sem restrição
  // Suporta múltiplos domínios separados por vírgula
  const dominios = raw.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
  const emailLower = email.toLowerCase();
  return dominios.some(d => emailLower.endsWith('@' + d) || emailLower.endsWith('.' + d));
}

async function verificarConflito(recurso_id, data, hora_inicio, hora_fim, excludeId = null) {
  let sql = `SELECT id FROM agendamentos
    WHERE recurso_id = ? AND data = ? AND hora_inicio < ? AND hora_fim > ?`;
  const params = [recurso_id, data, hora_fim, hora_inicio];
  if (excludeId) { sql += ` AND id != ?`; params.push(excludeId); }
  return !!(await get(sql, params));
}

// ── Rota pública: configurações da agenda ────────────────────
// GET /api/agenda/config
router.get('/config', async (req, res) => {
  try {
    const rows = await all(`SELECT chave, valor FROM configuracoes WHERE chave LIKE 'agenda_%'`);
    const c = {};
    for (const r of rows) c[r.chave] = r.valor;
    res.json({
      hora_inicio:  c.agenda_hora_inicio  || '07:00',
      hora_fim:     c.agenda_hora_fim     || '18:00',
      duracao_slot: parseInt(c.agenda_duracao_slot || '50'),
      dominio:      c.agenda_dominio      || '',
      sabado:       c.agenda_sabado === '1',
    });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── Rota pública: lista recursos ativos ──────────────────────
// GET /api/agenda/recursos
router.get('/recursos', async (req, res) => {
  try {
    res.json(await all(`SELECT * FROM recursos_agenda WHERE ativo = 1 ORDER BY ordem, criado_em`));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── Rota pública: disponibilidade por mês ────────────────────
// GET /api/agenda/disponibilidade?recurso_id=X&ano=YYYY&mes=MM
router.get('/disponibilidade', async (req, res) => {
  const { recurso_id, ano, mes } = req.query;
  try {
    let sql = `SELECT id, recurso_id, professor_nome, professor_email, turma, data, hora_inicio, hora_fim, obs FROM agendamentos WHERE 1=1`;
    const params = [];
    if (recurso_id) { sql += ` AND recurso_id = ?`; params.push(recurso_id); }
    if (ano && mes) {
      sql += ` AND data LIKE ?`;
      params.push(`${ano}-${mes.toString().padStart(2,'0')}-%`);
    }
    sql += ` ORDER BY data, hora_inicio`;
    const rows = await all(sql, params);
    // Máscara de e-mail para view pública
    const result = rows.map(r => ({
      ...r,
      professor_email: r.professor_email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '***' + c),
      professor_email_real: undefined,
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── Rota pública: criar agendamento ─────────────────────────
// POST /api/agenda/reservar
router.post('/reservar', async (req, res) => {
  const { recurso_id, professor_nome, professor_email, turma, data, hora_inicio, hora_fim, obs } = req.body;

  if (!recurso_id || !professor_nome || !professor_email || !data || !hora_inicio || !hora_fim)
    return res.status(400).json({ erro: 'Campos obrigatórios: recurso_id, professor_nome, professor_email, data, hora_inicio, hora_fim.' });

  const dominioOk = await validarDominio(professor_email);
  if (!dominioOk) {
    const cfg = await get(`SELECT valor FROM configuracoes WHERE chave = 'agenda_dominio'`);
    const dominios = (cfg?.valor || '').split(',').map(d => d.trim()).filter(Boolean);
    const lista = dominios.map(d => `@${d}`).join(', ');
    return res.status(403).json({ erro: `Apenas e-mails dos domínios ${lista} podem realizar agendamentos.` });
  }

  const recurso = await get(`SELECT * FROM recursos_agenda WHERE id = ? AND ativo = 1`, [recurso_id]);
  if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado ou inativo.' });

  const hoje = new Date().toISOString().split('T')[0];
  if (data < hoje) return res.status(400).json({ erro: 'Não é possível agendar em datas passadas.' });

  if (await verificarConflito(recurso_id, data, hora_inicio, hora_fim))
    return res.status(409).json({ erro: 'Este horário já está ocupado. Escolha outro.' });

  try {
    const id = `AG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    await run(
      `INSERT INTO agendamentos (id, recurso_id, professor_nome, professor_email, turma, data, hora_inicio, hora_fim, obs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, recurso_id, professor_nome, professor_email, turma || '', data, hora_inicio, hora_fim, obs || '']
    );
    res.status(201).json(await get(`SELECT * FROM agendamentos WHERE id = ?`, [id]));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── Rota pública: cancelar PRÓPRIO agendamento ───────────────
// DELETE /api/agenda/reservar/:id   body: { email }
router.delete('/reservar/:id', async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) return res.status(400).json({ erro: 'Informe o e-mail para confirmar o cancelamento.' });

  try {
    const ag = await get(`SELECT * FROM agendamentos WHERE id = ?`, [id]);
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado.' });

    if (ag.professor_email.toLowerCase() !== email.toLowerCase())
      return res.status(403).json({ erro: 'E-mail não confere. Você só pode cancelar seus próprios agendamentos.' });

    const hoje = new Date().toISOString().split('T')[0];
    if (ag.data < hoje) return res.status(400).json({ erro: 'Não é possível cancelar agendamentos passados.' });

    await run(`DELETE FROM agendamentos WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── Admin: lista todos agendamentos ─────────────────────────
// GET /api/agenda/admin?recurso_id=X&data_inicio=Y&data_fim=Z
router.get('/admin', autenticar, async (req, res) => {
  const { recurso_id, data_inicio, data_fim } = req.query;
  try {
    let sql = `SELECT a.*, r.nome AS recurso_nome, r.cor AS recurso_cor
               FROM agendamentos a
               LEFT JOIN recursos_agenda r ON a.recurso_id = r.id
               WHERE 1=1`;
    const params = [];
    if (recurso_id)   { sql += ` AND a.recurso_id = ?`; params.push(recurso_id); }
    if (data_inicio)  { sql += ` AND a.data >= ?`;      params.push(data_inicio); }
    if (data_fim)     { sql += ` AND a.data <= ?`;      params.push(data_fim); }
    sql += ` ORDER BY a.data, a.hora_inicio`;
    res.json(await all(sql, params));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── Admin: cancelar qualquer agendamento ─────────────────────
// DELETE /api/agenda/admin/:id
router.delete('/admin/:id', autenticar, apenasAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const ag = await get(`SELECT * FROM agendamentos WHERE id = ?`, [id]);
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    await run(`DELETE FROM agendamentos WHERE id = ?`, [id]);
    await registrarLog(req.usuario.id, req.usuario.nome, 'CANCELOU_AGENDAMENTO', `ID: ${id}`, `${ag.professor_nome} — ${ag.data} ${ag.hora_inicio}`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── Admin: CRUD de recursos ──────────────────────────────────
// GET /api/agenda/admin/recursos
router.get('/admin/recursos', autenticar, apenasAdmin, async (req, res) => {
  try { res.json(await all(`SELECT * FROM recursos_agenda ORDER BY ordem, criado_em`)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

// POST /api/agenda/admin/recursos
router.post('/admin/recursos', autenticar, apenasAdmin, async (req, res) => {
  const { nome, descricao, cor } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const id = `rec-${Date.now()}`;
    const maxOrdem = await get(`SELECT MAX(ordem) as m FROM recursos_agenda`);
    await run(`INSERT INTO recursos_agenda (id, nome, descricao, cor, ordem) VALUES (?, ?, ?, ?, ?)`,
      [id, nome, descricao || '', cor || '#4f8ef7', (maxOrdem?.m || 0) + 1]);
    res.status(201).json(await get(`SELECT * FROM recursos_agenda WHERE id = ?`, [id]));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// PUT /api/agenda/admin/recursos/:id
router.put('/admin/recursos/:id', autenticar, apenasAdmin, async (req, res) => {
  const { nome, descricao, cor, ativo } = req.body;
  const { id } = req.params;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    await run(`UPDATE recursos_agenda SET nome=?, descricao=?, cor=?, ativo=? WHERE id=?`,
      [nome, descricao || '', cor || '#4f8ef7', ativo !== false ? 1 : 0, id]);
    res.json(await get(`SELECT * FROM recursos_agenda WHERE id = ?`, [id]));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// DELETE /api/agenda/admin/recursos/:id
router.delete('/admin/recursos/:id', autenticar, apenasAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const futuros = await all(`SELECT id FROM agendamentos WHERE recurso_id = ? AND data >= ?`, [id, hoje]);
    if (futuros.length > 0)
      return res.status(409).json({ erro: `Existem ${futuros.length} agendamento(s) futuro(s) para este recurso. Cancele-os antes de excluir.` });
    await run(`DELETE FROM recursos_agenda WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
