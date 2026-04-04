// src/components/AgendaPublica.jsx
// Página pública para professores — não requer login no ChromeControl
import { useState, useEffect, useMemo, useCallback } from 'react';

const HOST = window.location.hostname;
const API  = `http://${HOST}:3000/api/agenda`;

// ── Utilidades ───────────────────────────────────────────────
function api(path, method = 'GET', body = null) {
  return fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null,
  }).then(async r => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'Erro na requisição');
    return d;
  });
}

function fmtData(date) {
  // YYYY-MM-DD
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function fmtDataBR(date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function gerarSlots(horaInicio, horaFim, duracao) {
  const slots = [];
  const [hI, mI] = horaInicio.split(':').map(Number);
  const [hF, mF] = horaFim.split(':').map(Number);
  let min = hI * 60 + mI;
  const fim = hF * 60 + mF;
  while (min + duracao <= fim) {
    const ini = `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
    const end = `${String(Math.floor((min+duracao)/60)).padStart(2,'0')}:${String((min+duracao)%60).padStart(2,'0')}`;
    slots.push({ inicio: ini, fim: end });
    min += duracao;
  }
  return slots;
}

const NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const NOMES_DIA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const COR_ESCURA = {
  '#4f8ef7': '#1a3a7a',
  '#38d9a9': '#0f4a3a',
  '#f59e0b': '#5c3a00',
  '#ef4444': '#5c1010',
  '#8b5cf6': '#3a1a6a',
  '#ec4899': '#6a0a3a',
  '#06b6d4': '#033a4a',
  '#10b981': '#0a3a2a',
};

export default function AgendaPublica() {
  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  const [config, setConfig]         = useState({ hora_inicio:'07:00', hora_fim:'18:00', duracao_slot:50, dominio:'' });
  const [recursos, setRecursos]     = useState([]);
  const [recurso, setRecurso]       = useState('');
  const [agendamentos, setAgendamentos] = useState([]);
  const [calMes, setCalMes]         = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [diaSel, setDiaSel]         = useState(hoje);
  const [slotForm, setSlotForm]     = useState(null); // { inicio, fim }
  const [form, setForm]             = useState({ professor_nome:'', professor_email:'', turma:'', obs:'' });
  const [sessao, setSessao]         = useState(null);  // { nome, email }
  const [meusSessao, setMeusSessao] = useState([]); // ids agendados nesta sessão
  const [detalhe, setDetalhe]       = useState(null);
  const [cancelForm, setCancelForm] = useState(null); // { id, email:'' }
  const [loading, setLoading]       = useState(false);
  const [toast, setToast]           = useState(null);

  const showToast = useCallback((msg, tipo='success') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Carregar config + recursos na inicialização
  useEffect(() => {
    api('/config').then(setConfig).catch(() => {});
    api('/recursos').then(list => {
      setRecursos(list);
      if (list.length > 0) setRecurso(list[0].id);
    }).catch(() => {});
    const saved = localStorage.getItem('agenda_sessao');
    const ids   = JSON.parse(localStorage.getItem('agenda_meus') || '[]');
    if (saved) setSessao(JSON.parse(saved));
    setMeusSessao(ids);
  }, []);

  // Carregar agendamentos quando muda recurso ou mês
  useEffect(() => {
    if (!recurso) return;
    api(`/disponibilidade?recurso_id=${recurso}&ano=${calMes.ano}&mes=${calMes.mes+1}`)
      .then(setAgendamentos).catch(() => {});
  }, [recurso, calMes]);

  // Dias do mês com grade
  const diasMes = useMemo(() => {
    const primeiro = new Date(calMes.ano, calMes.mes, 1);
    const ultimo   = new Date(calMes.ano, calMes.mes + 1, 0);
    const dias = [];
    for (let i = 0; i < primeiro.getDay(); i++) dias.push(null);
    for (let d = 1; d <= ultimo.getDate(); d++) dias.push(new Date(calMes.ano, calMes.mes, d));
    return dias;
  }, [calMes]);

  // Dias que têm agendamento para o recurso selecionado
  const diasComAg = useMemo(() => new Set(agendamentos.map(a => a.data)), [agendamentos]);

  // Slots do dia selecionado
  const slots = useMemo(() => {
    const dataStr = fmtData(diaSel);
    const base = gerarSlots(config.hora_inicio, config.hora_fim, config.duracao_slot);
    return base.map(s => {
      const ag = agendamentos.find(a => a.data === dataStr && a.hora_inicio === s.inicio);
      return { ...s, agendamento: ag || null };
    });
  }, [diaSel, agendamentos, config]);

  const recursoObj = recursos.find(r => r.id === recurso);

  function salvarSessao(nome, email) {
    const s = { nome, email };
    setSessao(s);
    localStorage.setItem('agenda_sessao', JSON.stringify(s));
  }

  async function handleReservar(slot) {
    const nome  = form.professor_nome.trim()  || sessao?.nome  || '';
    const email = form.professor_email.trim() || sessao?.email || '';
    if (!nome || !email) return showToast('Informe seu nome e e-mail.', 'error');
    const emailRgx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRgx.test(email)) return showToast('E-mail inválido.', 'error');

    setLoading(true);
    try {
      const novo = await api('/reservar', 'POST', {
        recurso_id: recurso,
        professor_nome:  nome,
        professor_email: email,
        turma: form.turma.trim(),
        obs:   form.obs.trim(),
        data:  fmtData(diaSel),
        hora_inicio: slot.inicio,
        hora_fim:    slot.fim,
      });
      salvarSessao(nome, email);
      const novosIds = [...meusSessao, novo.id];
      setMeusSessao(novosIds);
      localStorage.setItem('agenda_meus', JSON.stringify(novosIds));
      // Reload agendamentos do mês
      const lista = await api(`/disponibilidade?recurso_id=${recurso}&ano=${calMes.ano}&mes=${calMes.mes+1}`);
      setAgendamentos(lista);
      setSlotForm(null);
      setForm({ professor_nome:'', professor_email:'', turma:'', obs:'' });
      showToast('✅ Agendamento realizado com sucesso!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally { setLoading(false); }
  }

  async function handleCancelar(id, email) {
    setLoading(true);
    try {
      await api(`/reservar/${id}`, 'DELETE', { email });
      const novosIds = meusSessao.filter(i => i !== id);
      setMeusSessao(novosIds);
      localStorage.setItem('agenda_meus', JSON.stringify(novosIds));
      const lista = await api(`/disponibilidade?recurso_id=${recurso}&ano=${calMes.ano}&mes=${calMes.mes+1}`);
      setAgendamentos(lista);
      setCancelForm(null);
      setDetalhe(null);
      showToast('Agendamento cancelado.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally { setLoading(false); }
  }

  function navegarMes(delta) {
    setCalMes(prev => {
      let m = prev.mes + delta;
      let a = prev.ano;
      if (m < 0)  { m = 11; a--; }
      if (m > 11) { m = 0;  a++; }
      return { ano: a, mes: m };
    });
  }

  const isMeuAgendamento = (ag) => ag && meusSessao.includes(ag.id);

  return (
    <div className="ap-root">
      {/* Toast */}
      {toast && (
        <div className={`ap-toast ap-toast-${toast.tipo}`}>{toast.msg}</div>
      )}

      {/* Header */}
      <header className="ap-header">
        <div className="ap-logo">
          <span className="ap-logo-1">Chrome</span><span className="ap-logo-2">Control</span>
        </div>
        <div className="ap-header-title">
          <h1>Agendamento de Recursos</h1>
          <p>Reserve o laboratório ou carrinho de Chromebooks</p>
        </div>
      </header>

      <div className="ap-body">
        {/* Seletor de recurso */}
        <div className="ap-card ap-resource-card">
          <label className="ap-label">📦 Recurso</label>
          <select
            className="ap-select"
            value={recurso}
            onChange={e => { setRecurso(e.target.value); setSlotForm(null); setDetalhe(null); }}
          >
            {recursos.map(r => (
              <option key={r.id} value={r.id}>{r.nome}</option>
            ))}
          </select>
          {recursoObj?.descricao && (
            <p className="ap-resource-desc">{recursoObj.descricao}</p>
          )}
        </div>

        <div className="ap-grid">
          {/* Coluna esquerda: Calendário */}
          <div className="ap-card ap-cal-card">
            <div className="ap-cal-nav">
              <button className="ap-icon-btn" onClick={() => navegarMes(-1)}>‹</button>
              <span className="ap-cal-title">{NOMES_MES[calMes.mes]} {calMes.ano}</span>
              <button className="ap-icon-btn" onClick={() => navegarMes(1)}>›</button>
            </div>

            <div className="ap-cal-grid">
              {NOMES_DIA.map(d => (
                <div key={d} className="ap-cal-wd">{d}</div>
              ))}
              {diasMes.map((dia, i) => {
                if (!dia) return <div key={`e-${i}`} />;
                const dataStr = fmtData(dia);
                const isHoje    = fmtData(dia) === fmtData(hoje);
                const isSel     = fmtData(dia) === fmtData(diaSel);
                const temAg     = diasComAg.has(dataStr);
                const passado   = dia < hoje;
                return (
                  <button
                    key={dataStr}
                    onClick={() => { setDiaSel(dia); setSlotForm(null); setDetalhe(null); }}
                    className={[
                      'ap-cal-day',
                      isSel   ? 'sel'     : '',
                      isHoje  ? 'hoje'    : '',
                      passado ? 'passado' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {dia.getDate()}
                    {temAg && !isSel && <span className="ap-cal-dot" />}
                  </button>
                );
              })}
            </div>

            {/* Legenda de sessão */}
            {sessao && (
              <div className="ap-sessao">
                <span className="ap-sessao-icon">👤</span>
                <div>
                  <div className="ap-sessao-nome">{sessao.nome}</div>
                  <div className="ap-sessao-email">{sessao.email}</div>
                </div>
                <button className="ap-sessao-sair" onClick={() => {
                  setSessao(null); setMeusSessao([]);
                  localStorage.removeItem('agenda_sessao');
                  localStorage.removeItem('agenda_meus');
                }}>Sair</button>
              </div>
            )}
          </div>

          {/* Coluna direita: Slots do dia */}
          <div className="ap-card ap-slots-card">
            <h2 className="ap-slots-titulo">
              {fmtDataBR(diaSel).charAt(0).toUpperCase() + fmtDataBR(diaSel).slice(1)}
            </h2>
            {diaSel < hoje ? (
              <div className="ap-empty">
                <span style={{ fontSize: '2rem' }}>🔒</span>
                <p>Não é possível agendar em datas passadas.</p>
              </div>
            ) : (
              <div className="ap-slots-lista">
                {slots.map((slot) => {
                  const ag       = slot.agendamento;
                  const isMeu    = isMeuAgendamento(ag);
                  const cor      = recursoObj?.cor || '#4f8ef7';
                  const corEsc   = COR_ESCURA[cor] || '#1a3a7a';
                  const aberto   = slotForm?.inicio === slot.inicio;

                  if (ag) {
                    return (
                      <div key={slot.inicio} className="ap-slot ap-slot-ocupado"
                        style={{ borderLeftColor: cor, background: `${cor}18` }}
                      >
                        <div className="ap-slot-hora">{slot.inicio}</div>
                        <div className="ap-slot-info">
                          <div className="ap-slot-nome" style={{ color: cor }}>{ag.professor_nome}</div>
                          {ag.turma && <div className="ap-slot-turma">Turma: {ag.turma}</div>}
                          <div className="ap-slot-email">{ag.professor_email}</div>
                        </div>
                        {isMeu && (
                          <button
                            className="ap-btn-cancelar"
                            onClick={() => {
                              setDetalhe(null);
                              setCancelForm({ id: ag.id, email: sessao?.email || '' });
                            }}
                          >Cancelar</button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={slot.inicio} className="ap-slot-wrapper">
                      <button
                        className={`ap-slot ap-slot-livre ${aberto ? 'aberto' : ''}`}
                        onClick={() => {
                          setSlotForm(aberto ? null : slot);
                          setDetalhe(null);
                          if (!aberto && sessao) {
                            setForm(prev => ({ ...prev, professor_nome: sessao.nome, professor_email: sessao.email }));
                          }
                        }}
                      >
                        <div className="ap-slot-hora">{slot.inicio}</div>
                        <div className="ap-slot-livre-label">Disponível</div>
                        <div className="ap-slot-plus">{aberto ? '×' : '+'}</div>
                      </button>

                      {aberto && (
                        <div className="ap-form" style={{ borderLeftColor: cor }}>
                          <p className="ap-form-titulo">
                            Reservar <strong>{recursoObj?.nome}</strong> — {slot.inicio} às {slot.fim}
                          </p>
                          <div className="ap-form-row">
                            <input
                              className="ap-input"
                              placeholder="Seu nome *"
                              value={form.professor_nome}
                              onChange={e => setForm(p => ({ ...p, professor_nome: e.target.value }))}
                            />
                            <input
                              className="ap-input"
                              placeholder={config.dominio
                                ? `E-mail (${config.dominio.split(',').map(d => `@${d.trim()}`).join(' ou ')}) *`
                                : 'Seu e-mail *'}
                              type="email"
                              value={form.professor_email}
                              onChange={e => setForm(p => ({ ...p, professor_email: e.target.value }))}
                            />
                          </div>
                          <div className="ap-form-row">
                            <input
                              className="ap-input"
                              placeholder="Turma (ex: 3ºA)"
                              value={form.turma}
                              onChange={e => setForm(p => ({ ...p, turma: e.target.value }))}
                            />
                            <input
                              className="ap-input"
                              placeholder="Observações"
                              value={form.obs}
                              onChange={e => setForm(p => ({ ...p, obs: e.target.value }))}
                            />
                          </div>
                          <div className="ap-form-actions">
                            <button
                              className="ap-btn-confirmar"
                              style={{ background: cor }}
                              onClick={() => handleReservar(slot)}
                              disabled={loading}
                            >
                              {loading ? 'Aguarde...' : '✓ Confirmar Reserva'}
                            </button>
                            <button className="ap-btn-ghost" onClick={() => setSlotForm(null)}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: confirmação de cancelamento */}
      {cancelForm && (
        <div className="ap-overlay" onClick={() => setCancelForm(null)}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <h3>Cancelar agendamento</h3>
            <p>Confirme seu e-mail para cancelar:</p>
            <input
              className="ap-input"
              type="email"
              placeholder="Seu e-mail"
              value={cancelForm.email}
              onChange={e => setCancelForm(p => ({ ...p, email: e.target.value }))}
            />
            <div className="ap-modal-actions">
              <button
                className="ap-btn-confirmar"
                style={{ background: '#ef4444' }}
                onClick={() => handleCancelar(cancelForm.id, cancelForm.email)}
                disabled={loading}
              >
                {loading ? 'Cancelando...' : 'Cancelar Agendamento'}
              </button>
              <button className="ap-btn-ghost" onClick={() => setCancelForm(null)}>Voltar</button>
            </div>
          </div>
        </div>
      )}

      <footer className="ap-footer">
        <span>ChromeControl — Sistema de Agendamento</span>
        <a href="/" className="ap-footer-link">Acesso Administrativo</a>
      </footer>
    </div>
  );
}
