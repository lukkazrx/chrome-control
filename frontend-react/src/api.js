import { toast } from './utils/toast.js';

// MÁGICA: Pega o IP ou 'localhost' automaticamente da barra do navegador!
const HOST = window.location.hostname;
const API_URL = `http://${HOST}:3000/api`;

export function getToken() { return localStorage.getItem('token'); }
export function setToken(t) { localStorage.setItem('token', t); }
export function clearToken() { localStorage.removeItem('token'); }

async function request(path, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    // Se o token expirou ou é inválido
    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent('logout-event'));
      toast('Sessão expirada. Faça login novamente.', 'warn');
      return null;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  } catch (err) {
    // Se o servidor estiver desligado ou a rede falhar
    if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
      toast('Erro de conexão: O servidor está offline ou inacessível.', 'error');
    }
    throw err;
  }
}

export const GET = (path) => request(path, 'GET');
export const POST = (path, body) => request(path, body ? 'POST' : 'GET', body);
export const PUT = (path, body) => request(path, 'PUT', body);
export const DEL = (path) => request(path, 'DELETE');