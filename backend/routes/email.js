// ============================================================
//  Rotas — E-mail via Brevo API
//  POST /api/email/lembrete  → envia lembrete de devolução
//  GET  /api/email/status    → verifica configuração
// ============================================================

const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { all } = require('../database');

async function getEmailConfigs() {
  const rows = await all(`SELECT chave, valor FROM configuracoes`);
  const c = {};
  for(let r of rows) c[r.chave] = r.valor;
  return {
    brevoKey: c.brevo_api_key || process.env.BREVO_API_KEY,
    emailFrom: c.email_remetente || process.env.EMAIL_FROM,
    emailName: c.nome_remetente || process.env.EMAIL_FROM_NAME || 'ChromeControl Escola Padrão'
  };
}

function cargoLabel(tipo, materia) {
  if (tipo === 'Matéria')     return `Prof. de ${materia}`;
  if (tipo === 'Titular')     return 'Prof. Titular';
  if (tipo === 'Coordenador') return 'Coordenador';
  if (tipo === 'Orientador')  return 'Orientador';
  if (tipo === 'Outro')       return materia || 'Outro';
  return tipo || '—';
}

// ── Template HTML do e-mail (Comprovantes) ──────────────────────────────────
function gerarHtmlComprovante({ acao, professorNome, turma, tipo, materia, chromebooks, dataMovimentacao, obs }) {
  const tipoLabel = cargoLabel(tipo, materia);
  const cbLista   = chromebooks.map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;color:#1a1d27;font-weight:bold">${c.numero ? `Nº ${c.numero}` : c.id}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;color:#64748b;font-size:0.85rem">${c.patrimonio}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:0.85rem;color:#64748b">${c.cor}</td>
    </tr>`).join('');

  const titulo = acao === 'retirada' ? 'Comprovante de Retirada' : 'Comprovante de Devolução';
  const corDestaque = acao === 'retirada' ? '#f59f00' : '#38d9a9'; 
  const mensagem = acao === 'retirada' 
    ? `Você retirou os seguintes equipamentos do laboratório. Por favor, zele por eles e realize a devolução após o uso.` 
    : `O recebimento dos equipamentos listados abaixo foi registrado com sucesso em nosso sistema. Obrigado!`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <div style="background:#1a1d27;padding:28px 32px">
      <span style="font-size:1.1rem;font-weight:700;color:#4f8ef7;font-family:monospace">Chrome</span>
      <span style="font-size:1.1rem;font-weight:700;color:#38d9a9;font-family:monospace">Control</span>
    </div>

    <div style="padding:32px">
      <p style="margin:0 0 6px;font-size:0.8rem;color:${corDestaque};text-transform:uppercase;font-weight:600">${titulo}</p>
      <h1 style="margin:0 0 20px;font-size:1.3rem;color:#1a1d27">Olá, ${professorNome}! 👋</h1>
      <p style="margin:0 0 24px;color:#475569;line-height:1.6">
        ${mensagem}
      </p>

      <p style="margin:0 0 10px;font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase">Dispositivos Vinculados</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;color:#64748b;text-transform:uppercase">Equipamento</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;color:#64748b;text-transform:uppercase">Patrimônio</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;color:#64748b;text-transform:uppercase">Cor</th>
          </tr>
        </thead>
        <tbody>${cbLista}</tbody>
      </table>

      <div style="margin-top:20px;padding:12px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
        <p style="margin:0;font-size:0.875rem;color:#475569">📅 <strong>Data de Registro:</strong> ${dataMovimentacao || new Date().toLocaleString('pt-BR')}</p>
        ${obs ? `<p style="margin:8px 0 0;font-size:0.875rem;color:#475569">📌 <strong>Acessórios/Obs:</strong> ${obs}</p>` : ''}
      </div>
    </div>

    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:0.72rem;color:#94a3b8">
        Recibo eletrônico gerado pelo <strong>ChromeControl</strong>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Template HTML do lembrete ──────────────────────────────────
function gerarHtml({ professorNome, turma, tipo, materia, chromebooks, dataRetirada, obs }) {
  const tipoLabel = cargoLabel(tipo, materia);
  const cbLista   = chromebooks.map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace">${c.id}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace">${c.patrimonio}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${c.cor}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <div style="background:#1a1d27;padding:28px 32px">
      <span style="font-size:1.1rem;font-weight:700;color:#4f8ef7;font-family:monospace">Chrome</span>
      <span style="font-size:1.1rem;font-weight:700;color:#38d9a9;font-family:monospace">Control</span>
    </div>

    <div style="padding:32px">
      <p style="margin:0 0 6px;font-size:0.8rem;color:#64748b;text-transform:uppercase;font-weight:600">Lembrete de Devolução</p>
      <h1 style="margin:0 0 20px;font-size:1.3rem;color:#1a1d27">Olá, ${professorNome}! 👋</h1>
      <p style="margin:0 0 24px;color:#475569;line-height:1.6">
        Você possui <strong>Chromebook(s) emprestado(s)</strong> aguardando devolução. Por favor, retorne os dispositivos assim que possível.
      </p>

      <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:24px;border-left:4px solid #4f8ef7">
        <p style="margin:0 0 4px;font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase">Seus dados</p>
        <p style="margin:0;font-weight:600;color:#1a1d27">${professorNome}</p>
        <p style="margin:4px 0 0;font-size:0.875rem;color:#64748b">Turma: ${turma} &nbsp;•&nbsp; ${tipoLabel}</p>
        ${obs ? `<p style="margin:4px 0 0;font-size:0.875rem;color:#64748b">Obs: ${obs}</p>` : ''}
      </div>

      <p style="margin:0 0 10px;font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase">Dispositivos em seu poder</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;color:#64748b;text-transform:uppercase">ID</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;color:#64748b;text-transform:uppercase">Patrimônio</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;color:#64748b;text-transform:uppercase">Cor</th>
          </tr>
        </thead>
        <tbody>${cbLista}</tbody>
      </table>

      <div style="margin-top:20px;padding:12px 16px;background:#fefce8;border-radius:8px;border:1px solid #fde68a">
        <p style="margin:0;font-size:0.875rem;color:#92400e">📅 <strong>Retirado em:</strong> ${dataRetirada}</p>
      </div>

      <p style="margin:24px 0 0;color:#475569;font-size:0.875rem;line-height:1.6">
        Em caso de dúvidas, procure o responsável pela TI da escola.
      </p>
    </div>

    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:0.72rem;color:#94a3b8">
        E-mail enviado automaticamente pelo sistema <strong>ChromeControl</strong>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// POST /api/email/comprovante
router.post('/comprovante', async (req, res) => {
  const { acao, professorEmail, professorNome, turma, tipo, materia, chromebooks, dataMovimentacao, obs } = req.body;

  if (!professorEmail || !professorNome || !chromebooks?.length) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
  }

  try {
    const conf = await getEmailConfigs();
    if (!conf.brevoKey || conf.brevoKey === 'sua-chave-aqui') {
      return res.status(500).json({ erro: 'Chave de API do Brevo não configurada no painel de configurações.' });
    }

    const isRetirada = acao === 'retirada';
    const icone = isRetirada ? '📤' : '✅';
    const tituloEmail = isRetirada ? `Retirada de Chromebooks (${chromebooks.length})` : `Comprovante de Devolução (${chromebooks.length})`;

    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender:      { name: conf.emailName, email: conf.emailFrom },
      to:          [{ email: professorEmail, name: professorNome }],
      subject:     `${icone} ${tituloEmail} - ${professorNome}`,
      htmlContent: gerarHtmlComprovante({ acao, professorNome, turma, tipo, materia, chromebooks, dataMovimentacao, obs }),
    }, {
      headers: {
        'api-key':      conf.brevoKey,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📧 Comprovante (${acao}) enviado para ${professorEmail} (${professorNome})`);
    res.json({ ok: true, mensagem: `Recibo de ${acao} enviado para ${professorEmail}` });
  } catch (err) {
    const detalhe = err.response?.data?.message || err.message;
    console.error(`❌ Erro ao enviar comprovante de ${acao}:`, detalhe);
    res.status(500).json({ erro: 'Falha ao enviar o recibo.', detalhe });
  }
});

// POST /api/email/lembrete
router.post('/lembrete', async (req, res) => {
  const { professorEmail, professorNome, turma, tipo, materia, chromebooks, dataRetirada, obs } = req.body;

  if (!professorEmail || !professorNome || !chromebooks?.length) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
  }

  try {
    const conf = await getEmailConfigs();
    if (!conf.brevoKey || conf.brevoKey === 'sua-chave-aqui') {
      return res.status(500).json({ erro: 'Chave de API do Brevo não configurada no painel de configurações.' });
    }

    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender:      { name: conf.emailName, email: conf.emailFrom },
      to:          [{ email: professorEmail, name: professorNome }],
      cc:          [{ email: 'lucas.nunes@lasalle.org.br', name: 'Informática Canoas' }],
      replyTo:     { email: 'lucas.nunes@lasalle.org.br', name: 'Informática Canoas' },
      subject:     `🔔 Devolução de Chromebook - ${professorNome}`,
      htmlContent: gerarHtml({ professorNome, turma, tipo, materia, chromebooks, dataRetirada, obs }),
    }, {
      headers: {
        'api-key':      conf.brevoKey,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📧 Lembrete enviado para ${professorEmail} (${professorNome})`);
    res.json({ ok: true, mensagem: `E-mail enviado para ${professorEmail}` });
  } catch (err) {
    const detalhe = err.response?.data?.message || err.message;
    console.error('❌ Erro ao enviar e-mail:', detalhe);
    res.status(500).json({ erro: 'Falha ao enviar o e-mail.', detalhe });
  }
});

// GET /api/email/status
router.get('/status', async (req, res) => {
  try {
    const conf = await getEmailConfigs();
    const configurado = !!(
      conf.brevoKey &&
      conf.brevoKey !== 'sua-chave-aqui' &&
      conf.emailFrom
    );

    if (configurado) {
      res.json({ ok: true, mensagem: 'Brevo configurado ✅', remetente: conf.emailFrom });
    } else {
      res.status(500).json({ ok: false, mensagem: 'Brevo não configurado no Painel. ❌' });
    }
  } catch(err) {
    res.status(500).json({ ok: false, mensagem: 'Erro ao verificar configurações.' });
  }
});

module.exports = router;