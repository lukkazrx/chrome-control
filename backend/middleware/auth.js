// ============================================================
//  Middleware de autenticação JWT
// ============================================================

const jwt = require('jsonwebtoken');

// Verifica se o token é válido
function autenticar(req, res, next) {
  const auth  = req.headers['authorization'];
  const token = auth && auth.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ erro: 'Acesso negado. Faça login.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario   = payload; // { id, nome, login, perfil }
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  }
}

// Verifica se o usuário é admin
function apenasAdmin(req, res, next) {
  if (req.usuario?.perfil !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }
  next();
}

module.exports = { autenticar, apenasAdmin };