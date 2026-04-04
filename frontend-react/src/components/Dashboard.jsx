import { useState } from 'react';
import { FileText, Zap, Inbox, Mail, Pencil, Undo2, X, Plus, Save, CheckSquare, Square, BarChart3, PieChart as PieIcon, Filter, Activity, LayoutGrid } from 'lucide-react';
import { gerarRelatorioPDF } from '../utils/pdfGenerator.js';
import { toast } from '../utils/toast.js';
import { PUT } from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

const ACESSORIOS_DISPONIVEIS = ['Carregador', 'Mouse', 'Cabo HDMI', 'Adaptador', 'Fones'];

// --- CORES PARA OS GRÁFICOS ---
const COLORS = ['#4f8ef7', '#38d9a9', '#f7c94f', '#ff5e5e', '#a0a0b0'];

// --- HELPERS ---
function cargoLabel(tipo, materia) {
  if (tipo === 'Matéria') return `Prof. ${materia}`;
  if (tipo === 'Titular') return 'Prof. Titular';
  if (tipo === 'Coordenador') return 'Coordenador';
  if (tipo === 'Orientador') return 'Orientador';
  if (tipo === 'Outro') return materia || 'Outro';
  return tipo || '—';
}

function formatarTurmas(turmaStr) {
  if (!turmaStr || turmaStr === '—') return '—';
  try {
    const arr = JSON.parse(turmaStr);
    return Array.isArray(arr) ? arr.join(', ') : turmaStr;
  } catch {
    return turmaStr;
  }
}

function calcularAtraso(dataStr) {
  if (!dataStr) return 'normal';
  try {
    const partes = dataStr.split(', ');
    if (partes.length !== 2) return 'normal';

    const [dia, mes, ano] = partes[0].split('/');
    const [hora, min, seg] = partes[1].split(':');

    const dataRetirada = new Date(ano, mes - 1, dia, hora, min, seg);
    const diffHoras = (new Date() - dataRetirada) / (1000 * 60 * 60);

    if (diffHoras >= 24) return 'critico';
    if (diffHoras >= 12) return 'alerta';
    return 'normal';
  } catch {
    return 'normal';
  }
}

// Filtro de datas
function isDentroDoPeriodo(dataStr, periodo) {
  if (periodo === 'todos') return true;
  if (!dataStr) return false;

  const hoje = new Date();
  const hojeStr = hoje.toLocaleDateString('pt-BR');

  if (periodo === 'hoje') return dataStr.startsWith(hojeStr);

  const partes = dataStr.split(',')[0].split('/');
  if (partes.length !== 3) return false;

  const dataRetirada = new Date(partes[2], partes[1] - 1, partes[0]);

  hoje.setHours(0, 0, 0, 0);
  dataRetirada.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(hoje - dataRetirada);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (periodo === 'semana') return diffDays <= 7;
  if (periodo === 'mes') return diffDays <= 30;

  return true;
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="custom-tooltip-title">{payload[0].payload.name}</p>
        <p className="custom-tooltip-item">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent2)' }}></span>
          Registros: <strong style={{ color: '#fff' }}>{payload[0].value}</strong>
        </p>
      </div>
    );
  }
  return null;
};

export default function Dashboard({ state, setState, usuarioLogado, editarEmprestimo, enviarLembrete }) {
  const [lembretesEnviando, setLembretesEnviando] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [empEmEdicao, setEmpEmEdicao] = useState(null);
  const [editProfId, setEditProfId] = useState('');
  const [profSearch, setProfSearch] = useState('');
  const [showProfDropdown, setShowProfDropdown] = useState(false);
  const [editCBs, setEditCBs] = useState([]);
  const [editAcessorios, setEditAcessorios] = useState([]);
  const [cbSearch, setCbSearch] = useState('');
  const [showCBDropdown, setShowCBDropdown] = useState(false);
  const [editObs, setEditObs] = useState('');
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [empParaDevolver, setEmpParaDevolver] = useState(null);
  const [cbsParaDevolver, setCbsParaDevolver] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});

  const [periodoGraficos, setPeriodoGraficos] = useState('mes');

  // Controle de visibilidade dos gráficos
  const [showMenuVisibilidade, setShowMenuVisibilidade] = useState(false);
  const [visibilidadeGraficos, setVisibilidadeGraficos] = useState({
    dias: true,
    profs: true,
    turmas: true,
    acessorios: true
  });

  const toggleCard = (id) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

  const totalCBs = state.chromebooks.length;
  const disponiveis = state.chromebooks.filter(c => c.status === 'disponivel').length;
  const emprestados = state.chromebooks.filter(c => c.status === 'emprestado').length;
  const emManutencao = state.chromebooks.filter(c => c.status === 'manutencao' || c.status === 'extraviado').length;
  const totalProfs = state.professores.length;
  const totalHist = state.historico.length;
  const hoje = new Date().toLocaleDateString('pt-BR');
  const empHoje = state.historico.filter(h => h.dataRetirada?.startsWith(hoje)).length;

  const alertasCriticos = state.emprestimos.filter(emp => calcularAtraso(emp.dataRetirada) === 'critico');
  const dispPerc = totalCBs ? (disponiveis / totalCBs) * 100 : 0;
  const empPerc = totalCBs ? (emprestados / totalCBs) * 100 : 0;
  const manPerc = totalCBs ? (emManutencao / totalCBs) * 100 : 0;

  const horaAtual = new Date().getHours();
  let saudacao = 'Bom dia';
  if (horaAtual >= 12 && horaAtual < 18) saudacao = 'Boa tarde';
  else if (horaAtual >= 18) saudacao = 'Boa noite';
  const nomeExibicao = usuarioLogado?.nome ? usuarioLogado.nome.split(' ')[0] : 'Operador';

  // =========================================================================
  // INTELIGÊNCIA DE DADOS (BI)
  // =========================================================================

  const historicoGraficos = state.historico.filter(h => isDentroDoPeriodo(h.dataRetirada, periodoGraficos));

  // 1. Gráfico de Barras: Top Professores
  const profCount = {};
  historicoGraficos.forEach(h => {
    const nomePartes = h.professorNome.split(' ');
    const nomeCurto = nomePartes[0] + (nomePartes.length > 1 ? ' ' + nomePartes[nomePartes.length - 1] : '');
    profCount[nomeCurto] = (profCount[nomeCurto] || 0) + 1;
  });

  const dataTopProfs = Object.entries(profCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // 2. Gráfico de Pizza: Top Turmas
  const turmaCount = {};
  historicoGraficos.forEach(h => {
    const turmasArray = formatarTurmas(h.professorTurma).split(', ');
    turmasArray.forEach(t => {
      if (t && t !== '—') {
        turmaCount[t] = (turmaCount[t] || 0) + 1;
      }
    });
  });

  const dataTopTurmas = Object.entries(turmaCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // 3. Gráfico de Área: Picos de Demanda
  const contagemDias = [
    { name: 'Dom', value: 0 }, { name: 'Seg', value: 0 }, { name: 'Ter', value: 0 },
    { name: 'Qua', value: 0 }, { name: 'Qui', value: 0 }, { name: 'Sex', value: 0 }, { name: 'Sáb', value: 0 }
  ];

  historicoGraficos.forEach(h => {
    if (!h.dataRetirada) return;
    const partes = h.dataRetirada.split(',')[0].split('/');
    if (partes.length === 3) {
      const dataObj = new Date(partes[2], partes[1] - 1, partes[0]);
      const diaIndex = dataObj.getDay();
      if (!isNaN(diaIndex)) contagemDias[diaIndex].value += 1;
    }
  });

  const dataDiasSemana = [
    contagemDias[1], contagemDias[2], contagemDias[3],
    contagemDias[4], contagemDias[5], contagemDias[6], contagemDias[0]
  ];

  // 4. Gráfico de Rosca: Acessórios Mais Requisitados
  const acessoriosCount = {};
  historicoGraficos.forEach(h => {
    let lista = [];
    if (Array.isArray(h.acessorios)) lista = h.acessorios;
    else if (typeof h.acessorios === 'string') {
      try { lista = JSON.parse(h.acessorios); } catch { lista = []; }
    }

    lista.forEach(acc => {
      if (acc) {
        acessoriosCount[acc] = (acessoriosCount[acc] || 0) + 1;
      }
    });
  });

  const dataAcessorios = Object.entries(acessoriosCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // =========================================================================

  const handleGerarPDF = () => {
    gerarRelatorioPDF(state);
    toast('Relatório gerado com sucesso!');
  };

  function iniciarDevolucao(emp) {
    if (emp.chromebooks.length === 1) {
      executarDevolucao(emp, [emp.chromebooks[0].id]);
    } else {
      setEmpParaDevolver(emp);
      setCbsParaDevolver(emp.chromebooks.map(c => c.id));
      setDevModalOpen(true);
    }
  }

  const toggleCbDevolucao = (id) => {
    setCbsParaDevolver(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  async function executarDevolucao(emp, idsParaDevolver) {
    if (idsParaDevolver.length === 0) {
      toast('Selecione ao menos um equipamento para devolver.', 'warn');
      return;
    }
    try {
      const resp = await PUT(`/emprestimos/${emp.id}/devolver`, {
        devolvidoPor: usuarioLogado?.nome || 'Sistema',
        chromebookIds: idsParaDevolver
      });
      if (setState) {
        setState(prev => {
          const novosCBs = prev.chromebooks.map(c => idsParaDevolver.includes(c.id) ? { ...c, status: 'disponivel' } : c);
          if (resp.tipo === 'total') {
            return { ...prev, emprestimos: prev.emprestimos.filter(e => e.id !== emp.id), historico: prev.historico.map(h => h.id === emp.id ? resp.atualizado : h), chromebooks: novosCBs };
          } else {
            return { ...prev, emprestimos: prev.emprestimos.map(e => e.id === emp.id ? resp.atualizado : e), historico: [resp.parcial, ...prev.historico], chromebooks: novosCBs };
          }
        });
      } else {
        window.location.reload();
      }
      setDevModalOpen(false);
      toast(resp.tipo === 'total' ? 'Devolução registrada com sucesso!' : 'Devolução PARCIAL registrada com sucesso!');
    } catch (err) { toast(err.message, 'error'); }
  }

  const abrirModalEditar = (emp) => {
    setEmpEmEdicao(emp); setEditProfId(emp.professorId || ''); setProfSearch(emp.professorNome || '');
    setEditCBs(emp.chromebooks ? [...emp.chromebooks] : []);
    let acessoriosCarregados = [];
    if (Array.isArray(emp.acessorios)) acessoriosCarregados = [...emp.acessorios];
    else if (typeof emp.acessorios === 'string') { try { acessoriosCarregados = JSON.parse(emp.acessorios); } catch { acessoriosCarregados = []; } }
    setEditAcessorios(acessoriosCarregados);
    setEditObs(emp.obs || ''); setCbSearch(''); setShowProfDropdown(false); setShowCBDropdown(false); setEditModalOpen(true);
  };

  const selectProfEdit = (prof) => { setEditProfId(prof.id); setProfSearch(prof.nome); setShowProfDropdown(false); };
  const addCBEdit = (cb) => { if (!editCBs.find(c => c.id === cb.id)) { setEditCBs([...editCBs, { id: cb.id, patrimonio: cb.patrimonio, numero: cb.numero, cor: cb.cor }]); } setCbSearch(''); setShowCBDropdown(false); };
  const removeCBEdit = (cbId) => { setEditCBs(editCBs.filter(c => c.id !== cbId)); };
  const toggleAcessorio = (item) => { setEditAcessorios(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]); };

  const salvarEdicao = async () => {
    if (!empEmEdicao) return;
    if (!editProfId) { toast('Selecione um responsável válido.', 'error'); return; }
    if (editCBs.length === 0) { toast('O empréstimo deve ter ao menos 1 equipamento.', 'error'); return; }
    const prof = state.professores.find(p => p.id === editProfId);
    if (!prof) { toast('Responsável não encontrado no sistema.', 'error'); return; }
    const dadosAtualizados = { professorId: prof.id, professorNome: prof.nome, professorTurma: prof.turma || '—', professorTipo: prof.tipo, professorMateria: prof.materia || '', chromebooks: editCBs, acessorios: editAcessorios, obs: editObs };
    await editarEmprestimo(empEmEdicao.id, dadosAtualizados);
    setEditModalOpen(false);
  };

  const searchProfStr = String(profSearch || '').toLowerCase();
  const profsFiltradosEdit = profSearch ? state.professores.filter(p => String(p.nome || '').toLowerCase().includes(searchProfStr)) : [];
  const cbSearchStr = String(cbSearch || '').toLowerCase();
  const cbsDisponiveisEdit = state.chromebooks.filter(c => c.status === 'disponivel' && (String(c.id || '').toLowerCase().includes(cbSearchStr) || String(c.patrimonio || '').toLowerCase().includes(cbSearchStr) || String(c.numero || '').toLowerCase().includes(cbSearchStr)));

  return (
    <section className="page active" id="page-dashboard">
      <div className="page-header">
        <div>
          <h1 className="fw-800">{saudacao}, {nomeExibicao}! 👋</h1>
          <p>Visão geral do Centro de Comando e saúde dos empréstimos.</p>
        </div>
        <button className="btn btn-primary" onClick={handleGerarPDF}>
          <span className="icon icon-lg"><FileText size={20} /></span> Gerar Relatório PDF
        </button>
      </div>

      {alertasCriticos.length > 0 && (
        <div className="mb-4 alert-critical">
          <div className="alert-icon-wrapper">
            <Zap size={22} fill="white" />
          </div>
          <div>
            <h3 className="alert-title">Atenção Imediata Necessária!</h3>
            <p className="alert-text">
              Você possui <strong>{alertasCriticos.length} empréstimo{(alertasCriticos.length > 1) ? 's' : ''}</strong> que já ultrapassaram o limite de 24 horas de segurança de posse.
              <br />
              <span className="text-muted-sm link-underline" onClick={() => document.getElementById('dashboard-loans').scrollIntoView({ behavior: 'smooth' })}>
                Verifique agora a aba de Empréstimos Ativos pendentes de <strong>{alertasCriticos.slice(0, 2).map(a => a.professorNome).join(', ')}{alertasCriticos.length > 2 ? ' e outros' : ''}</strong>.
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="form-card mb-4">
        <div className="flex-between-center mb-3">
          <span className="section-label m-0">Composição da Frota ({totalCBs} Total)</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-fill bg-success" style={{ width: `${dispPerc}%` }} title={`Disponível: ${disponiveis}`} />
          <div className="progress-fill bg-warning" style={{ width: `${empPerc}%` }} title={`Emprestado: ${emprestados}`} />
          <div className="progress-fill bg-danger" style={{ width: `${manPerc}%` }} title={`Manutenção: ${emManutencao}`} />
        </div>
        <div className="progress-labels-container">
          <div className="flex-center-gap-sm"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent2)' }}></span> <strong className="text-text">{disponiveis}</strong> <span className="text-muted-sm">Disponíveis</span></div>
          <div className="flex-center-gap-sm"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)' }}></span> <strong className="text-text">{emprestados}</strong> <span className="text-muted-sm">Em Uso Lento</span></div>
          <div className="flex-center-gap-sm"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }}></span> <strong className="text-text">{emManutencao}</strong> <span className="text-muted-sm">TI / Manutenção</span></div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Empréstimos Hoje</span>
          <span className="stat-value green">{empHoje}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Professores Cadastrados</span>
          <span className="stat-value blue">{totalProfs}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Em Manutenção</span>
          <span className="stat-value text-muted-sm" style={{ color: '#a0a0b0' }}>
            {emManutencao}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Histórico Geral</span>
          <span className="stat-value blue">{totalHist}</span>
        </div>
      </div>

      <div className="table-card" style={{ marginTop: '1.5rem', marginBottom: '1rem', border: '2px solid var(--border)' }}>
        <div className="table-header" style={{ background: 'var(--surface2)' }}>
          <h2 style={{ fontSize: '1.1rem' }}><span className="icon icon-lg"><Zap size={22} className="text-accent2" /></span> Empréstimos Ativos <span className="badge" style={{ background: 'var(--accent)', color: '#fff', marginLeft: '0.5rem' }}>{state.emprestimos.length}</span></h2>
        </div>
        <div id="dashboard-loans" className="loan-list-container" style={{ background: 'var(--bg)' }}>

          {state.emprestimos.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><Inbox size={40} /></div>
              <p>Nenhum empréstimo correndo neste momento no colégio.</p>
            </div>
          ) : (
            state.emprestimos.map(emp => {
              const prof = state.professores.find(p => p.id === emp.professorId);
              const temEmail = !!(prof?.email);
              const isExpanded = expandedCards[emp.id];
              const cbList = emp.chromebooks || [];
              const hasMany = cbList.length > 4;
              const cbsToShow = (hasMany && !isExpanded) ? cbList.slice(0, 4) : cbList;
              const statusAtraso = calcularAtraso(emp.dataRetirada);

              let listaAcessorios = [];
              if (Array.isArray(emp.acessorios)) listaAcessorios = emp.acessorios;
              else if (typeof emp.acessorios === 'string') { try { listaAcessorios = JSON.parse(emp.acessorios); } catch { listaAcessorios = []; } }

              return (
                <div key={emp.id} className={`loan-card ${statusAtraso !== 'normal' ? 'atraso-' + statusAtraso : ''}`}>
                  <div className="loan-info">
                    {statusAtraso === 'alerta' && <div className="badge-atraso alerta">⚠️ +12h em posse</div>}
                    {statusAtraso === 'critico' && <div className="badge-atraso critico">🚨 +24h em posse</div>}

                    <h3>{emp.professorNome}</h3>
                    <p>
                      {formatarTurmas(emp.professorTurma)} • {cargoLabel(emp.professorTipo, emp.professorMateria)}
                      {emp.obs ? ` • ${emp.obs}` : ''}
                    </p>
                    <div className="loan-email">
                      {temEmail ? `📧 ${prof.email}` : <span className="text-danger">⚠️ Sem e-mail cadastrado</span>}
                    </div>

                    <div className="loan-equipments flex-col-start">
                      <div className="flex-wrap-gap-sm">
                        {cbsToShow.map(c => (
                          <span key={c.id} className="chip-loan-item">
                            {c.numero ? `Nº ${c.numero}` : c.id}
                          </span>
                        ))}
                      </div>

                      {hasMany && (
                        <button className="btn-toggle-expand" onClick={() => toggleCard(emp.id)}>
                          {isExpanded ? 'Ocultar equipamentos ▲' : `Ver os outros ${cbList.length - 4} equipamentos ▼`}
                        </button>
                      )}
                    </div>

                    {listaAcessorios.length > 0 && (
                      <div className="loan-accessories">
                        <strong>Acessórios:</strong> {listaAcessorios.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="loan-actions">
                    <div className="loan-meta text-right">
                      Retirada<br />{emp.dataRetirada}<br />
                      <span className="text-micro-muted">Por: {emp.registradoPor || 'Sistema'}</span><br />
                      <span className="text-warn">{cbList.length} dispositivo(s)</span>
                    </div>

                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={!temEmail || lembretesEnviando[emp.id]}
                      onClick={async () => {
                        setLembretesEnviando(prev => ({ ...prev, [emp.id]: true }));
                        await enviarLembrete(emp);
                        setLembretesEnviando(prev => ({ ...prev, [emp.id]: false }));
                      }}
                    >
                      {lembretesEnviando[emp.id] ? 'Enviando...' : <><span className="icon"><Mail size={16} /></span> Lembrete</>}
                    </button>

                    <button className="btn btn-ghost btn-sm" onClick={() => abrirModalEditar(emp)}>
                      <span className="icon"><Pencil size={16} /></span> Editar
                    </button>

                    <button className="btn btn-success" onClick={() => iniciarDevolucao(emp)}>
                      <span className="icon"><Undo2 size={16} /></span> Devolver
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* --- SESSÃO GRÁFICOS COM FILTRO --- */}
      {state.historico.length > 0 && (
        <div className="mb-4">
          <div className="section-heading-row">
            <h2 className="section-title">
              <BarChart3 size={20} className="text-accent" /> Análise de Uso
            </h2>

            <div className="flex-center-gap-md">
              {/* FILTRO DE PERÍODO */}
              <div className="flex-center-gap-sm">
                <Filter size={16} className="text-muted" />
                <select
                  className="inline-input filter-select-sm"
                  value={periodoGraficos}
                  onChange={e => setPeriodoGraficos(e.target.value)}
                >
                  <option value="hoje">Hoje</option>
                  <option value="semana">Últimos 7 dias</option>
                  <option value="mes">Últimos 30 dias</option>
                  <option value="todos">Todo o período</option>
                </select>
              </div>

              {/* DROPDOWN DE VISIBILIDADE DOS GRÁFICOS */}
              <div className="dropdown-container pos-relative">
                <button
                  className="btn btn-ghost btn-compact"
                  onClick={() => setShowMenuVisibilidade(!showMenuVisibilidade)}
                >
                  <LayoutGrid size={16} /> <span className="ml-1 fs-sm">Exibir</span>
                </button>

                {showMenuVisibilidade && (
                  <div className="dropdown-menu dropdown-menu-right">
                    <div className="dropdown-menu-header">
                      Mostrar Gráficos
                    </div>

                    <label className="dropdown-item-check">
                      <input
                        type="checkbox"
                        checked={visibilidadeGraficos.dias}
                        onChange={() => setVisibilidadeGraficos(prev => ({ ...prev, dias: !prev.dias }))}
                      />
                      Uso por Dia da Semana
                    </label>

                    <label className="dropdown-item-check">
                      <input
                        type="checkbox"
                        checked={visibilidadeGraficos.profs}
                        onChange={() => setVisibilidadeGraficos(prev => ({ ...prev, profs: !prev.profs }))}
                      />
                      Top Professores
                    </label>

                    <label className="dropdown-item-check">
                      <input
                        type="checkbox"
                        checked={visibilidadeGraficos.turmas}
                        onChange={() => setVisibilidadeGraficos(prev => ({ ...prev, turmas: !prev.turmas }))}
                      />
                      Top Turmas
                    </label>

                    <label className="dropdown-item-check">
                      <input
                        type="checkbox"
                        checked={visibilidadeGraficos.acessorios}
                        onChange={() => setVisibilidadeGraficos(prev => ({ ...prev, acessorios: !prev.acessorios }))}
                      />
                      Acessórios Mais Requisitados
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {historicoGraficos.length === 0 ? (
            <div className="form-card empty p-4">
              <p>Nenhum empréstimo registrado no período selecionado.</p>
            </div>
          ) : (!visibilidadeGraficos.dias && !visibilidadeGraficos.profs && !visibilidadeGraficos.turmas && !visibilidadeGraficos.acessorios) ? (
            <div className="form-card empty p-4" style={{ minHeight: '100px' }}>
              <p>Todos os gráficos estão ocultos. Use o botão "Exibir" para ativá-los.</p>
            </div>
          ) : (
            <div className="charts-grid-container">

              {/* GRÁFICO 1: PICOS DE DEMANDA */}
              {visibilidadeGraficos.dias && (
                <div className="form-card chart-card-padding">
                  <h3 className="chart-title">
                    <Activity size={16} /> Uso por Dia da Semana
                  </h3>
                  <div className="chart-container-height">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <AreaChart data={dataDiasSemana} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorDia" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent2)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="var(--accent2)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--muted)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Area type="monotone" dataKey="value" stroke="var(--accent2)" strokeWidth={3} fillOpacity={1} fill="url(#colorDia)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* GRÁFICO 2: TOP PROFESSORES */}
              {visibilidadeGraficos.profs && (
                <div className="form-card chart-card-padding">
                  <h3 className="chart-title">
                    Top 5 Professores
                  </h3>
                  <div className="chart-container-height">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <BarChart data={dataTopProfs} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* GRÁFICO 3: TOP TURMAS */}
              {visibilidadeGraficos.turmas && (
                <div className="form-card chart-card-padding">
                  <h3 style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                    Top 5 Turmas Atendidas
                  </h3>
                  <div style={{ width: '100%', height: 220, display: 'flex', alignItems: 'center' }}>
                    <ResponsiveContainer width="60%" height="100%" minWidth={1} minHeight={1}>
                      <PieChart>
                        <Pie data={dataTopTurmas} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                          {dataTopTurmas.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ width: '40%', paddingLeft: '10px' }}>
                      {dataTopTurmas.map((entry, index) => (
                        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.8rem' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span style={{ color: 'var(--text)' }}>{entry.name}</span>
                          <span style={{ color: 'var(--muted)', marginLeft: 'auto', fontWeight: 'bold' }}>{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* GRÁFICO 4: ACESSÓRIOS MAIS REQUISITADOS */}
              {visibilidadeGraficos.acessorios && (
                <div className="form-card" style={{ padding: '1.5rem 1.5rem 0.5rem 1.5rem' }}>
                  <h3 style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Zap size={16} /> Acessórios Mais Requisitados
                  </h3>
                  {dataAcessorios.length === 0 ? (
                    <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                      Nenhum acessório registrado no período.
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 220, display: 'flex', alignItems: 'center' }}>
                      <ResponsiveContainer width="60%" height="100%" minWidth={1} minHeight={1}>
                        <PieChart>
                          <Pie data={dataAcessorios} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                            {dataAcessorios.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ width: '40%', paddingLeft: '10px' }}>
                        {dataAcessorios.map((entry, index) => (
                          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.8rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS[(index + 2) % COLORS.length] }}></div>
                            <span style={{ color: 'var(--text)' }}>{entry.name}</span>
                            <span style={{ color: 'var(--muted)', marginLeft: 'auto', fontWeight: 'bold' }}>{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      )}



      {devModalOpen && empParaDevolver && (
        <div className="modal-overlay open">
          <div className="modal modal-md">
            <h2>Confirmar Devolução</h2>
            <p className="text-muted-sm mb-4">Selecione QUAIS equipamentos estão sendo devolvidos agora.</p>
            <div className="mb-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {empParaDevolver.chromebooks.map(c => {
                const isSelected = cbsParaDevolver.includes(c.id);
                return (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', border: `1px solid ${isSelected ? 'var(--accent2)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', background: isSelected ? 'rgba(56, 217, 169, 0.05)' : 'var(--surface2)' }}>
                    <input type="checkbox" className="hidden-input" checked={isSelected} onChange={() => toggleCbDevolucao(c.id)} />
                    <div style={{ color: isSelected ? 'var(--accent2)' : 'var(--muted)' }}>
                      {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                    </div>
                    <div>
                      <div className="text-mono-bold">{c.numero ? `Nº ${c.numero}` : c.id}</div>
                      <div className="text-muted-sm">Pat: {c.patrimonio}</div>
                    </div>
                  </label>
                )
              })}
            </div>
            {(() => {
              let acs = [];
              if (Array.isArray(empParaDevolver.acessorios)) acs = empParaDevolver.acessorios;
              else if (typeof empParaDevolver.acessorios === 'string') { try { acs = JSON.parse(empParaDevolver.acessorios); } catch { acs = []; } }
              if (acs.length > 0) {
                return (
                  <div className="mb-4 p-3" style={{ background: 'rgba(247, 201, 79, 0.1)', border: '1px solid var(--warn)', borderRadius: '8px' }}>
                    <div className="text-warn font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>⚠️ Não se esqueça de conferir:</div>
                    <div className="text-muted-sm">{acs.join(', ')}</div>
                  </div>
                );
              }
            })()}
            <div className="modal-actions mt-4">
              <button className="btn btn-ghost" onClick={() => setDevModalOpen(false)}>Cancelar</button>
              <button className="btn btn-success" onClick={() => executarDevolucao(empParaDevolver, cbsParaDevolver)} disabled={cbsParaDevolver.length === 0}>
                <span className="icon"><Undo2 size={16} /></span>
                {cbsParaDevolver.length === empParaDevolver.chromebooks.length ? 'Devolver Tudo' : `Devolver Parcial (${cbsParaDevolver.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && (
        <div className="modal-overlay open">
          <div className="modal modal-md overflow-visible">
            <h2>Editar Empréstimo</h2>
            <p className="text-muted-sm mb-4">Altere o responsável, os equipamentos ou as observações.</p>
            <div className="form-group mb-4" style={{ position: 'relative' }}>
              <label>Responsável</label>
              <input type="text" placeholder="Buscar responsável..." value={profSearch} onChange={e => { setProfSearch(e.target.value); setEditProfId(''); setShowProfDropdown(true); }} onFocus={() => setShowProfDropdown(true)} />
              {showProfDropdown && profSearch && !editProfId && (
                <div className="autocomplete-dropdown">
                  {profsFiltradosEdit.length > 0 ? profsFiltradosEdit.map(p => (
                    <div key={p.id} className="autocomplete-item" onClick={() => selectProfEdit(p)}>
                      <div className="autocomplete-title">{p.nome}</div>
                      <div className="autocomplete-sub">{cargoLabel(p.tipo, p.materia)}</div>
                    </div>
                  )) : (<div className="autocomplete-item text-muted-sm">Nenhum responsável encontrado</div>)}
                </div>
              )}
            </div>

            <div className="form-group mb-4" style={{ position: 'relative' }}>
              <label>Adicionar Equipamentos</label>
              <input type="text" placeholder="Buscar por Nº, ID ou Patrimônio..." value={cbSearch} onChange={e => { setCbSearch(e.target.value); setShowCBDropdown(true); }} onFocus={() => setShowCBDropdown(true)} />
              {showCBDropdown && cbSearch && (
                <div className="autocomplete-dropdown">
                  {cbsDisponiveisEdit.length > 0 ? cbsDisponiveisEdit.map(c => (
                    <div key={c.id} className="autocomplete-item" onClick={() => addCBEdit(c)}>
                      <span className="autocomplete-title">{c.numero ? `Nº ${c.numero}` : c.id}</span>
                      <span className="autocomplete-sub">Pat: {c.patrimonio}</span>
                    </div>
                  )) : (<div className="autocomplete-item text-muted-sm">Nenhum equipamento disponível</div>)}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="section-label">Equipamentos Selecionados</label>
              <div className="loan-equipments">
                {editCBs.map(c => (
                  <span key={c.id} className="chip-loan-item">
                    {c.numero ? `Nº ${c.numero}` : c.id}
                    <button className="btn-remove-tag" onClick={() => removeCBEdit(c.id)}><X size={14} /></button>
                  </span>
                ))}
                {editCBs.length === 0 && <span className="text-muted-sm">Nenhum equipamento na lista</span>}
              </div>
            </div>

            <div className="mb-4">
              <label className="section-label">Acessórios Extras</label>
              <div className="accessory-group">
                {ACESSORIOS_DISPONIVEIS.map(item => (
                  <div key={item} className={`accessory-chip ${editAcessorios.includes(item) ? 'selected' : ''}`} onClick={() => toggleAcessorio(item)}>
                    {editAcessorios.includes(item) ? <Zap size={14} /> : <Plus size={14} />} {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group mb-4">
              <label>Observação (Opcional)</label>
              <input type="text" placeholder="Ex: Faltou carregador" value={editObs} onChange={e => setEditObs(e.target.value)} />
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarEdicao}>
                <span className="icon"><Save size={16} /></span> Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}