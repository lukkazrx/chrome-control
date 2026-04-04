// src/components/Agendamentos.jsx
// Visão administrativa da agenda — requer login cromado
import { useState, useEffect, useMemo, useCallback } from 'react';
import { GET, DEL } from '../api';
import { toast } from '../utils/toast';
import { openConfirm } from '../utils/confirm';
import { Calendar, ChevronLeft, ChevronRight, Copy, ExternalLink, Trash2, Clock, Users } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────
function fmtData(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function fmtDataBR(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
}

function gerarSlots(ini, fim, dur) {
  const slots = [];
  const [hI,mI] = ini.split(':').map(Number);
  const [hF,mF] = fim.split(':').map(Number);
  let min = hI*60+mI;
  const end = hF*60+mF;
  while (min+dur <= end) {
    const s = `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
    const e = `${String(Math.floor((min+dur)/60)).padStart(2,'0')}:${String((min+dur)%60).padStart(2,'0')}`;
    slots.push({ inicio:s, fim:e });
    min += dur;
  }
  return slots;
}

const SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getSegundaFeira(d) {
  const dia = new Date(d);
  const dow  = dia.getDay() || 7; // domingo=7
  dia.setDate(dia.getDate() - dow + 1); // vai para segunda
  return dia;
}

function addDias(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const COR_BG = (cor) => cor + '22';

export default function Agendamentos({ usuarioLogado, state }) {
  const isAdmin = usuarioLogado?.perfil === 'admin';
  const hoje    = new Date(); hoje.setHours(0,0,0,0);

  const [config, setConfig]         = useState({ hora_inicio:'07:00', hora_fim:'18:00', duracao_slot:50, sabado:false });
  const [recursos, setRecursos]     = useState([]);
  const [recursoSel, setRecursoSel] = useState('todos');
  const [agendamentos, setAgendamentos] = useState([]);
  const [semanaBase, setSemanaBase] = useState(() => getSegundaFeira(hoje));
  const [diaMobile, setDiaMobile]   = useState(hoje);
  const [calMes, setCalMes]         = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [diaSel, setDiaSel]         = useState(hoje);
  const [detalhe, setDetalhe]       = useState(null);
  const [isMobile, setIsMobile]     = useState(window.innerWidth < 768);
  const [view, setView]             = useState('semana'); // 'semana' | 'calendario'

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Carrega config e recursos
  useEffect(() => {
    fetch(`http://${window.location.hostname}:3000/api/agenda/config`)
      .then(r => r.json()).then(setConfig).catch(() => {});
    GET('/agenda/admin/recursos').then(list => {
      setRecursos(list.filter(r => r.ativo));
    }).catch(() => {});
  }, []);

  // Carrega agendamentos da semana visível
  const [dataInicio, dataFim] = useMemo(() => {
    if (isMobile) {
      // no mobile: mostra o mês inteiro
      const ini = new Date(calMes.ano, calMes.mes, 1);
      const fim = new Date(calMes.ano, calMes.mes + 1, 0);
      return [fmtData(ini), fmtData(fim)];
    }
    return [fmtData(semanaBase), fmtData(addDias(semanaBase, 6))];
  }, [semanaBase, calMes, isMobile]);

  const carregarAgendamentos = useCallback(async () => {
    try {
      let url = `/agenda/admin?data_inicio=${dataInicio}&data_fim=${dataFim}`;
      if (recursoSel !== 'todos') url += `&recurso_id=${recursoSel}`;
      setAgendamentos(await GET(url));
    } catch (err) { toast(err.message, 'error'); }
  }, [dataInicio, dataFim, recursoSel]);

  useEffect(() => { carregarAgendamentos(); }, [carregarAgendamentos]);

  // Dias da semana no desktop (Seg–Sex, +Sáb se habilitado)
  const diasSemana = useMemo(() => {
    const dias = [1,2,3,4,5].map(i => addDias(semanaBase, i-1));
    if (config.sabado) dias.push(addDias(semanaBase, 5)); // Sábado
    return dias;
  }, [semanaBase, config.sabado]);

  // Slots de horário
  const slots = useMemo(() =>
    gerarSlots(config.hora_inicio, config.hora_fim, config.duracao_slot)
  , [config]);

  // Dias do mês p/ mobile
  const diasMes = useMemo(() => {
    const primeiro = new Date(calMes.ano, calMes.mes, 1);
    const ultimo   = new Date(calMes.ano, calMes.mes + 1, 0);
    const dias = [];
    for (let i = 0; i < primeiro.getDay(); i++) dias.push(null);
    for (let d = 1; d <= ultimo.getDate(); d++) dias.push(new Date(calMes.ano, calMes.mes, d));
    return dias;
  }, [calMes]);

  const diasComAg = useMemo(() => new Set(
    agendamentos.filter(a => recursoSel === 'todos' || a.recurso_id === recursoSel).map(a => a.data)
  ), [agendamentos, recursoSel]);

  function agParaDia(data, recurso_id = null) {
    return agendamentos.filter(a =>
      a.data === data && (recurso_id ? a.recurso_id === recurso_id : (recursoSel === 'todos' || a.recurso_id === recursoSel))
    );
  }

  function agParaSlot(data, slotInicio, recurso_id = null) {
    return agParaDia(data, recurso_id).find(a => a.hora_inicio === slotInicio) || null;
  }

  async function handleCancelarAdmin(ag) {
    openConfirm(
      'Cancelar agendamento',
      `Cancelar reserva de ${ag.professor_nome} — ${ag.data} às ${ag.hora_inicio}?`,
      async () => {
        try {
          await DEL(`/agenda/admin/${ag.id}`);
          setAgendamentos(prev => prev.filter(a => a.id !== ag.id));
          setDetalhe(null);
          toast('Agendamento cancelado.');
        } catch (err) { toast(err.message, 'error'); }
      }
    );
  }

  function copiarLink() {
    const url = `${window.location.protocol}//${window.location.hostname}:${window.location.port || 3000}/agenda`;
    navigator.clipboard.writeText(url).then(() => toast('🔗 Link copiado!')).catch(() => {});
  }

  // Slots do dia selecionado (mobile)
  const slotsDiaSel = useMemo(() => {
    const dataStr = fmtData(diaSel);
    return slots.map(s => {
      const ags = (recursoSel === 'todos' ? recursos : recursos.filter(r => r.id === recursoSel))
        .map(r => {
          const ag = agendamentos.find(a => a.data === dataStr && a.hora_inicio === s.inicio && a.recurso_id === r.id);
          return ag ? { ...ag, recurso_nome: r.nome, recurso_cor: r.cor } : null;
        }).filter(Boolean);
      return { ...s, agendamentos: ags };
    }).filter(s => s.agendamentos.length > 0 || true); // all slots
  }, [diaSel, slots, agendamentos, recursos, recursoSel]);

  const linkPublico = `${window.location.protocol}//${window.location.hostname}:${window.location.port || 3000}/agenda`;

  // ── Render: Stats ─────────────────────────────────────────
  const totalSemana = agendamentos.length;
  const porRecurso  = recursos.map(r => ({
    ...r,
    count: agendamentos.filter(a => a.recurso_id === r.id).length,
  }));

  return (
    <section className="page active" id="page-agendamentos">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Agenda de Recursos</h1>
          <p>Gerencie os agendamentos do laboratório e carrinhos de Chromebooks.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={copiarLink}>
            <Copy size={16} /> Copiar link público
          </button>
          <a className="btn btn-ghost" href={linkPublico} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Ver como professor
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-icon"><Calendar size={20} /></div>
          <div>
            <div className="stat-value">{totalSemana}</div>
            <div className="stat-label">Agendamentos no período</div>
          </div>
        </div>
        {porRecurso.map(r => (
          <div className="stat-card" key={r.id}>
            <div className="stat-icon" style={{ color: r.cor }}>
              <Clock size={20} />
            </div>
            <div>
              <div className="stat-value" style={{ color: r.cor }}>{r.count}</div>
              <div className="stat-label">{r.nome}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="filter-bar" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          <button
            className={`chip ${recursoSel === 'todos' ? 'chip-active' : ''}`}
            onClick={() => setRecursoSel('todos')}
          >Todos</button>
          {recursos.map(r => (
            <button
              key={r.id}
              className={`chip ${recursoSel === r.id ? 'chip-active' : ''}`}
              style={recursoSel === r.id ? { borderColor: r.cor, background: COR_BG(r.cor), color: r.cor } : {}}
              onClick={() => setRecursoSel(r.id)}
            >{r.nome}</button>
          ))}
        </div>
      </div>

      {/* ── DESKTOP: Grade Semanal ── */}
      {!isMobile && (
        <div className="agenda-semana-wrap">
          <div className="agenda-nav">
            <button className="btn btn-ghost" onClick={() => setSemanaBase(d => addDias(d, -7))}>
              <ChevronLeft size={16} /> Semana anterior
            </button>
            <span className="agenda-nav-titulo">
              {semanaBase.toLocaleDateString('pt-BR',{day:'numeric',month:'short'})} — {addDias(semanaBase,4).toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'})}
            </span>
            <button
              className="btn btn-ghost"
              onClick={() => setSemanaBase(getSegundaFeira(hoje))}
              style={fmtData(semanaBase) === fmtData(getSegundaFeira(hoje)) ? { opacity: 0.4, pointerEvents:'none' } : {}}
            >Hoje</button>
            <button className="btn btn-ghost" onClick={() => setSemanaBase(d => addDias(d, 7))}>
              Próxima <ChevronRight size={16} />
            </button>
          </div>

          {/* Grade: 1 coluna de horas + 5 de dias */}
          <div className="agenda-grade" style={{ '--cols': (recursoSel === 'todos' ? recursos.length : 1) }}>
            {/* Cabeçalho */}
            <div className="agenda-grade-hora-label" />
            {diasSemana.map(dia => {
              const isHoje = fmtData(dia) === fmtData(hoje);
              return (
                <div key={fmtData(dia)} className={`agenda-dia-header ${isHoje ? 'hoje' : ''}`}>
                  <span className="agenda-dia-nome">{SEMANA[dia.getDay()]}</span>
                  <span className={`agenda-dia-num ${isHoje ? 'hoje' : ''}`}>{dia.getDate()}</span>
                </div>
              );
            })}

            {/* Slots */}
            {slots.map(slot => (
              <>
                <div key={`h-${slot.inicio}`} className="agenda-hora-label">{slot.inicio}</div>
                {diasSemana.map(dia => {
                  const dataStr = fmtData(dia);
                  if (recursoSel === 'todos') {
                    // Mostra múltiplos recursos empilhados na célula
                    const agsDia = agendamentos.filter(a => a.data === dataStr && a.hora_inicio === slot.inicio);
                    return (
                      <div key={`${dataStr}-${slot.inicio}`} className="agenda-cell">
                        {agsDia.map(ag => {
                          const rec = recursos.find(r => r.id === ag.recurso_id);
                          return (
                            <button key={ag.id} className="agenda-block" title={ag.professor_nome}
                              style={{ background: COR_BG(rec?.cor || '#4f8ef7'), borderLeftColor: rec?.cor || '#4f8ef7', color: rec?.cor || '#4f8ef7' }}
                              onClick={() => setDetalhe({ ...ag, recurso_nome: ag.recurso_nome, recurso_cor: ag.recurso_cor })}
                            >
                              <span className="agenda-block-nome">{ag.professor_nome}</span>
                              <span className="agenda-block-sub">{rec?.nome}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  } else {
                    const ag = agParaSlot(dataStr, slot.inicio, recursoSel);
                    const rec = recursos.find(r => r.id === recursoSel);
                    return (
                      <div key={`${dataStr}-${slot.inicio}`} className="agenda-cell">
                        {ag && (
                          <button className="agenda-block" title={ag.professor_nome}
                            style={{ background: COR_BG(rec?.cor || '#4f8ef7'), borderLeftColor: rec?.cor || '#4f8ef7', color: rec?.cor || '#4f8ef7' }}
                            onClick={() => setDetalhe({ ...ag, recurso_nome: ag.recurso_nome, recurso_cor: ag.recurso_cor })}
                          >
                            <span className="agenda-block-nome">{ag.professor_nome}</span>
                            {ag.turma && <span className="agenda-block-sub">{ag.turma}</span>}
                          </button>
                        )}
                      </div>
                    );
                  }
                })}
              </>
            ))}
          </div>
        </div>
      )}

      {/* ── MOBILE: Calendário + Slots do dia ── */}
      {isMobile && (
        <div className="agenda-mobile">
          {/* Mini calendário */}
          <div className="ap-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <div className="ap-cal-nav">
              <button className="ap-icon-btn" onClick={() => setCalMes(p => {
                let m=p.mes-1,a=p.ano; if(m<0){m=11;a--;} return {ano:a,mes:m};
              })}>‹</button>
              <span className="ap-cal-title">{NOMES_MES[calMes.mes]} {calMes.ano}</span>
              <button className="ap-icon-btn" onClick={() => setCalMes(p => {
                let m=p.mes+1,a=p.ano; if(m>11){m=0;a++;} return {ano:a,mes:m};
              })}>›</button>
            </div>
            <div className="ap-cal-grid">
              {SEMANA.map(d => <div key={d} className="ap-cal-wd">{d}</div>)}
              {diasMes.map((dia, i) => {
                if (!dia) return <div key={`e${i}`}/>;
                const ds = fmtData(dia);
                const isHoje = ds === fmtData(hoje);
                const isSel  = ds === fmtData(diaSel);
                const temAg  = diasComAg.has(ds);
                return (
                  <button key={ds}
                    className={['ap-cal-day', isSel?'sel':'', isHoje?'hoje':'', dia<hoje?'passado':''].filter(Boolean).join(' ')}
                    onClick={() => setDiaSel(dia)}
                  >
                    {dia.getDate()}
                    {temAg && !isSel && <span className="ap-cal-dot"/>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slots do dia selecionado */}
          <div className="ap-card" style={{ padding: '1rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text)' }}>
              {fmtDataBR(fmtData(diaSel)).charAt(0).toUpperCase() + fmtDataBR(fmtData(diaSel)).slice(1)}
            </h2>
            <div className="ap-slots-lista">
              {slotsDiaSel.map(slot => {
                const ags = slot.agendamentos;
                if (ags.length === 0) return null;
                return (
                  <div key={slot.inicio} className="ap-slot ap-slot-ocupado"
                    style={{ borderLeftColor: ags[0]?.recurso_cor || '#4f8ef7', background: COR_BG(ags[0]?.recurso_cor || '#4f8ef7') }}
                  >
                    <div className="ap-slot-hora">{slot.inicio}</div>
                    <div className="ap-slot-info" style={{ flex: 1 }}>
                      {ags.map(ag => (
                        <div key={ag.id}>
                          <div className="ap-slot-nome" style={{ color: ag.recurso_cor }}>{ag.professor_nome}</div>
                          <div className="ap-slot-turma">{ag.recurso_nome}{ag.turma ? ` — ${ag.turma}` : ''}</div>
                          <div className="ap-slot-email">{ag.professor_email}</div>
                        </div>
                      ))}
                    </div>
                    {isAdmin && ags.map(ag => (
                      <button key={ag.id} className="ap-btn-cancelar" style={{ background:'#ef444422', color:'#ef4444' }}
                        onClick={() => handleCancelarAdmin(ag)}>
                        <Trash2 size={14}/> Cancelar
                      </button>
                    ))}
                  </div>
                );
              })}
              {slotsDiaSel.every(s => s.agendamentos.length === 0) && (
                <div className="empty">
                  <div className="icon"><Calendar size={32}/></div>
                  <p>Nenhum agendamento neste dia.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Painel de detalhe (desktop) */}
      {detalhe && (
        <div className="ap-overlay" onClick={() => setDetalhe(null)}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h3 style={{ color: detalhe.recurso_cor || 'var(--primary)' }}>
                {detalhe.recurso_nome}
              </h3>
              <button className="ap-btn-ghost" onClick={() => setDetalhe(null)}>×</button>
            </div>
            <div className="ap-detalhe-grid">
              <div><span className="ap-detalhe-lbl">Responsável</span><span className="ap-detalhe-val">{detalhe.professor_nome}</span></div>
              <div><span className="ap-detalhe-lbl">E-mail</span><span className="ap-detalhe-val">{detalhe.professor_email}</span></div>
              {detalhe.turma && <div><span className="ap-detalhe-lbl">Turma</span><span className="ap-detalhe-val">{detalhe.turma}</span></div>}
              <div><span className="ap-detalhe-lbl">Data</span><span className="ap-detalhe-val">{new Date(detalhe.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</span></div>
              <div><span className="ap-detalhe-lbl">Horário</span><span className="ap-detalhe-val">{detalhe.hora_inicio} — {detalhe.hora_fim}</span></div>
              {detalhe.obs && <div><span className="ap-detalhe-lbl">Observação</span><span className="ap-detalhe-val">{detalhe.obs}</span></div>}
            </div>
            {isAdmin && (
              <div style={{ marginTop:'1.25rem', borderTop:'1px solid var(--border)', paddingTop:'1rem' }}>
                <button className="btn" style={{ background:'#ef444422', color:'#ef4444', border:'1px solid #ef444440' }}
                  onClick={() => handleCancelarAdmin(detalhe)}>
                  <Trash2 size={16} /> Cancelar agendamento
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
