// ============================================================
//  ChromeControl — Servidor principal
// ============================================================

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');

const { iniciarBanco }            = require('./database');
const { autenticar, apenasAdmin } = require('./middleware/auth');
const rotasAuth                   = require('./routes/auth');
const rotasChromebooks            = require('./routes/chromebooks');
const rotasProfessores            = require('./routes/professores');
const rotasEmprestimos            = require('./routes/emprestimos');
const rotasEmail                  = require('./routes/email');
const rotasAuditorias             = require('./routes/auditorias'); // <-- NOVA ROTA AQUI
const rotasLogs                   = require('./routes/logs'); // <-- NOVA ROTA AQUI

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve os arquivos do frontend
app.use(express.static(path.join(__dirname, '..', 'frontend-react', 'dist')));

// ── Rotas públicas (sem autenticação) ────────────────────────
app.use('/api/auth', rotasAuth);

// ── Rotas protegidas (exigem token) ─────────────────────────
app.use('/api/chromebooks', autenticar, rotasChromebooks);
app.use('/api/professores', autenticar, rotasProfessores);
app.use('/api/emprestimos', autenticar, rotasEmprestimos);
app.use('/api/email',       autenticar, rotasEmail);
app.use('/api/auditorias',  autenticar, rotasAuditorias); // <-- NOVA ROTA AQUI
app.use('/api/logs',        autenticar, rotasLogs); 

// ── Health check ─────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({ ok: true, mensagem: 'ChromeControl backend rodando ✅' });
});

// ── Qualquer outra rota serve o frontend ─────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend-react', 'dist', 'index.html'));
});

// ── Inicia banco e depois o servidor ─────────────────────────
iniciarBanco().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║      ChromeControl — Servidor iniciado       ║');
    console.log(`║  Acesse: http://localhost:${PORT}              ║`);
    console.log('║  Na rede: http://<IP-do-computador>:' + PORT + '     ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  });
}).catch(err => {
  console.error('❌ Erro ao iniciar o banco de dados:', err.message);
  process.exit(1);
});