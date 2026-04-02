import React, { useState, useEffect } from 'react';
import { Trash2, Search, X, Clock, Download, FileText, ChevronDown, ScanLine, CheckCircle2, AlertCircle } from 'lucide-react';
import { DEL } from '../api';
import { toast } from '../utils/toast.js';
import * as XLSX from 'xlsx';
import { gerarHistoricoPDF, gerarRelatorioAuditoria } from '../utils/pdfGenerator.js';

function cargoLabel(p) {
  if (p.tipo === 'Matéria')     return `Prof. ${p.materia}`;
  if (p.tipo === 'Titular')     return 'Prof. Titular';
  if (p.tipo === 'Coordenador') return 'Coordenador';
  if (p.tipo === 'Orientador')  return 'Orientador';
  if (p.tipo === 'Outro')       return p.materia || 'Outro';
  return p.tipo || '—';
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

export default function Historico({ state, setState, abaAtiva, goTo }) {
  // Controle de Abas
  const [abaAtual, setAbaAtual] = useState(abaAtiva === 'auditorias' ? 'auditorias' : 'emprestimos');

  // Sincroniza a aba se o usuário mudar pelo menu superior
  useEffect(() => {
    if (abaAtiva === 'auditorias' || abaAtiva === 'historico') {
      setAbaAtual(abaAtiva === 'auditorias' ? 'auditorias' : 'emprestimos');
    }
  }, [abaAtiva]);

  // Estados - Aba Empréstimos
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Estados - Aba Auditorias
  const [buscaAuditoria, setBuscaAuditoria] = useState('');

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --------------------------------------------------------
  // LÓGICA: EMPRÉSTIMOS
  // --------------------------------------------------------
  const historicoFiltrado = state.historico.filter(h => {
    const fBusca = busca.toLowerCase();

    const textoOk = !fBusca || 
      h.professorNome.toLowerCase().includes(fBusca) ||
      h.professorTurma.toLowerCase().includes(fBusca) ||
      h.chromebooks.some(c => 
        c.id.toLowerCase().includes(fBusca) || 
        (c.numero && c.numero.toLowerCase().includes(fBusca))
      );

    const statusOk = !statusFiltro || h.status === statusFiltro;

    let dataOk = true;
    if (dataInicio || dataFim) {
      const partes = h.dataRetirada?.split(',')[0]?.split('/');
      if (partes?.length === 3) {
        const dataReg = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`); 
        if (dataInicio) dataOk = dataOk && dataReg >= new Date(dataInicio);
        if (dataFim) dataOk = dataOk && dataReg <= new Date(dataFim + 'T23:59:59');
      }
    }

    return textoOk && statusOk && dataOk;
  });

  const limparFiltros = () => {
    setBusca(''); setStatusFiltro(''); setDataInicio(''); setDataFim('');
  };

  async function clearHistory() {
    const concluidos = state.historico.filter(h => h.status === 'devolvido');
    if (concluidos.length === 0) { toast('Nenhum registo concluído para remover.', 'warn'); return; }
    if (!window.confirm(`Remover ${concluidos.length} registo(s) concluídos do histórico?`)) return;

    try {
      await DEL('/emprestimos/historico');
      setState(prev => ({ ...prev, historico: prev.historico.filter(h => h.status !== 'devolvido') }));
      toast('Histórico limpo com sucesso.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  const exportarParaExcel = () => {
    if (historicoFiltrado.length === 0) { toast('Não há dados para exportar.', 'warn'); return; }

    const dadosPlanilha = historicoFiltrado.map(h => {
      const equipamentosStr = h.chromebooks.map(c => c.numero ? `Nº ${c.numero}` : c.id).join(', ');
      let acessoriosStr = '—';
      if (Array.isArray(h.acessorios) && h.acessorios.length > 0) acessoriosStr = h.acessorios.join(', ');
      else if (typeof h.acessorios === 'string' && h.acessorios !== '[]') {
        try { acessoriosStr = JSON.parse(h.acessorios).join(', '); } 
        catch { acessoriosStr = h.acessorios; }
      }

      return {
        "Data/Hora Retirada": h.dataRetirada,
        "Registrado Por (Saída)": h.registradoPor || 'Sistema',
        "Responsável": h.professorNome,
        "Turma/Sala": formatarTurmas(h.professorTurma),
        "Cargo/Matéria": cargoLabel({ tipo: h.professorTipo, materia: h.professorMateria }),
        "Equipamentos": equipamentosStr,
        "Acessórios": acessoriosStr,
        "Data/Hora Devolução": h.dataDevolucao || '—',
        "Registrado Por (Devolução)": h.devolvidoPor || '—',
        "Status": h.status === 'devolvido' ? 'Devolvido' : 'Em andamento',
        "Observações": h.obs || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dadosPlanilha);
    worksheet['!cols'] = [ { wch: 20 }, { wch: 22 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 45 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 40 } ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Histórico");
    XLSX.writeFile(workbook, `historico_emprestimos_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast('Planilha exportada com sucesso!');
  };

  // --------------------------------------------------------
  // LÓGICA: AUDITORIAS
  // --------------------------------------------------------
  const auditoriasFiltradas = (state.auditorias || []).filter(a => 
    !buscaAuditoria || 
    a.responsavel.toLowerCase().includes(buscaAuditoria.toLowerCase()) ||
    a.data_auditoria.includes(buscaAuditoria)
  );

  // Lógica Paginação Empréstimos
  const totalPaginas = Math.ceil(historicoFiltrado.length / itensPorPagina);
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const historicoPaginado = historicoFiltrado.slice(indexInicio, indexInicio + itensPorPagina);

  return (
    <section className="page active" id="page-historico">
      <div className="page-header">
        <div>
          <h1>Histórico do Sistema</h1>
          <p>Consulte registros passados de movimentações e inventários.</p>
        </div>
      </div>

      {/* --- NAVEGAÇÃO DE ABAS --- */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <button 
          style={{ 
            padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
            color: abaAtual === 'emprestimos' ? 'var(--accent)' : 'var(--muted)', 
            borderBottom: abaAtual === 'emprestimos' ? '2px solid var(--accent)' : '2px solid transparent', 
            fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center', transition: 'all 0.2s' 
          }}
          onClick={() => { setAbaAtual('emprestimos'); goTo('historico'); }}
        >
          <Clock size={16} /> Empréstimos Realizados
        </button>
        <button 
          style={{ 
            padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
            color: abaAtual === 'auditorias' ? 'var(--accent)' : 'var(--muted)', 
            borderBottom: abaAtual === 'auditorias' ? '2px solid var(--accent)' : '2px solid transparent', 
            fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center', transition: 'all 0.2s' 
          }}
          onClick={() => { setAbaAtual('auditorias'); goTo('auditorias'); }}
        >
          <ScanLine size={16} /> Auditorias / Inventários
        </button>
      </div>

      {/* ========================================================= */}
      {/* CONTEÚDO: ABA EMPRÉSTIMOS */}
      {/* ========================================================= */}
      {abaAtual === 'emprestimos' && (
        <>
          <div className="form-card px-6 py-4" style={{ marginBottom: '1.5rem' }}>
            <div className="filter-bar">
              <div className="form-group filter-group">
                <label>Data inicial</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="form-group filter-group">
                <label>Data final</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
              <div className="form-group filter-group">
                <label>Status</label>
                <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="ativo">Em andamento</option>
                  <option value="devolvido">Devolvido</option>
                </select>
              </div>
              <div className="filter-actions">
                <button className="btn btn-primary btn-sm">
                  <span className="icon"><Search size={16} /></span> Filtrar
                </button>
                <button className="btn btn-ghost btn-sm" onClick={limparFiltros}>
                  <span className="icon"><X size={16} /></span> Limpar
                </button>
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                <input 
                  className="search-box" 
                  type="text" 
                  placeholder="Buscar por Nº, ID, responsável..." 
                  value={busca} 
                  onChange={e => { setBusca(e.target.value); setPaginaAtual(1); }} 
                />
              </div>

              <div className="header-actions">
                <div className="dropdown-container">
                  <button className="btn btn-ghost" onClick={() => setShowExportMenu(!showExportMenu)}>
                    Exportar <span className="icon"><ChevronDown size={16} /></span>
                  </button>
                  {showExportMenu && (
                    <div className="dropdown-menu">
                      <div className="dropdown-item" onClick={() => { setShowExportMenu(false); if(historicoFiltrado.length === 0){ toast('Sem dados.', 'warn'); return;} gerarHistoricoPDF(historicoFiltrado); toast('PDF gerado!'); }}>
                        <FileText size={16} className="opacity-70" /> Documento PDF
                      </div>
                      <div className="dropdown-item" onClick={() => { setShowExportMenu(false); exportarParaExcel(); }}>
                        <Download size={16} className="opacity-70" /> Planilha XLSX
                      </div>
                    </div>
                  )}
                </div>
                <button className="btn btn-ghost text-danger" onClick={clearHistory}>
                  <span className="icon"><Trash2 size={16} /></span> Limpar
                </button>
              </div>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Data/Hora Retirada</th>
                    <th>Responsável</th>
                    <th>Turma / Cargo</th>
                    <th>Resumo Equip.</th>
                    <th>Data/Hora Devolução</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoPaginado.map(h => {
                    const isExpanded = expandedRows[h.id];
                    const equipamentosResumo = h.chromebooks.slice(0, 2);
                    const quantOcultos = h.chromebooks.length - 2;

                    let listaAcessorios = [];
                    if (Array.isArray(h.acessorios)) listaAcessorios = h.acessorios;
                    else if (typeof h.acessorios === 'string') {
                      try { listaAcessorios = JSON.parse(h.acessorios); } catch { listaAcessorios = []; }
                    }

                    return (
                      <React.Fragment key={h.id}>
                        <tr className={`row-clickable ${isExpanded ? 'row-expanded' : ''}`} onClick={() => toggleRow(h.id)} title="Clique para ver os detalhes">
                          <td className="text-mono-sm">
                            {h.dataRetirada}
                            <div style={{ color: 'var(--muted)', fontSize: '0.7rem', marginTop: '4px', fontFamily: 'var(--font)' }}>Por: {h.registradoPor || 'Sistema'}</div>
                          </td>
                          <td className="font-medium">{h.professorNome}</td>
                          <td className="text-muted-sm">{formatarTurmas(h.professorTurma)} / {cargoLabel({ tipo: h.professorTipo, materia: h.professorMateria })}</td>
                          <td>
                            <div className="loan-equipments">
                              {equipamentosResumo.map(c => (
                                <span key={c.id} className="chip-loan-item">{c.numero ? `Nº ${c.numero}` : c.id}</span>
                              ))}
                              {quantOcultos > 0 && <span className="text-muted-sm" style={{ fontWeight: 600, alignSelf: 'center' }}>+{quantOcultos}</span>}
                            </div>
                          </td>
                          <td className="text-mono-sm">
                            {h.dataDevolucao || '—'}
                            {h.dataDevolucao && <div style={{ color: 'var(--muted)', fontSize: '0.7rem', marginTop: '4px', fontFamily: 'var(--font)' }}>Por: {h.devolvidoPor || 'Sistema'}</div>}
                          </td>
                          <td>
                            <span className={`chip ${h.status === 'devolvido' ? 'chip-available' : 'chip-loaned'}`}>
                              {h.status === 'devolvido' ? 'Devolvido' : 'Em andamento'}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="detail-row">
                            <td colSpan="6">
                              <div className="detail-container">
                                <div className="detail-grid">
                                  <div>
                                    <div className="detail-section-title">Lista Completa de Equipamentos ({h.chromebooks.length})</div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      {h.chromebooks.map(c => (
                                        <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.8rem', fontSize: '0.8rem' }}>
                                          <span className="text-mono-bold" style={{ display: 'block', marginBottom: '2px' }}>{c.numero ? `Nº ${c.numero}` : c.id}</span>
                                          <span className="text-muted-sm">Pat: {c.patrimonio}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="detail-section-title">Acessórios Retirados</div>
                                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.75rem', fontSize: '0.85rem', color: listaAcessorios.length > 0 ? 'var(--text)' : 'var(--muted)' }}>
                                      {listaAcessorios.length > 0 ? listaAcessorios.join(', ') : 'Nenhum acessório retirado.'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="detail-section-title">Observações do Empréstimo</div>
                                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.75rem', fontSize: '0.85rem', color: h.obs ? 'var(--text)' : 'var(--muted)' }}>
                                      {h.obs ? h.obs : 'Nenhuma observação registrada.'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {historicoFiltrado.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="text-muted-sm">Mostrar:</span>
                  <select 
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', padding: '0.3rem', fontSize: '0.85rem', outline: 'none' }}
                    value={itensPorPagina} 
                    onChange={e => { setItensPorPagina(Number(e.target.value)); setPaginaAtual(1); }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-muted-sm">itens por página</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className="text-muted-sm" style={{ fontWeight: '500' }}>
                    {indexInicio + 1} - {Math.min(indexInicio + itensPorPagina, historicoFiltrado.length)} de {historicoFiltrado.length}
                  </span>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button className="btn btn-ghost btn-sm" disabled={paginaAtual === 1} onClick={() => setPaginaAtual(prev => prev - 1)}>
                      Anterior
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={paginaAtual >= totalPaginas} onClick={() => setPaginaAtual(prev => prev + 1)}>
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            )}

            {historicoFiltrado.length === 0 && (
              <div className="empty">
                <div className="empty-icon"><Clock size={40} /></div>
                <p>Nenhum registo no histórico com estes filtros</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* CONTEÚDO: ABA AUDITORIAS */}
      {/* ========================================================= */}
      {abaAtual === 'auditorias' && (
        <div className="table-card">
          <div className="table-header">
            <input 
              className="search-box" 
              type="text" 
              placeholder="Buscar por data ou responsável..." 
              value={buscaAuditoria} 
              onChange={e => setBuscaAuditoria(e.target.value)} 
            />
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Data da Auditoria</th>
                  <th>Responsável</th>
                  <th style={{ textAlign: 'center' }}>Esperados</th>
                  <th style={{ textAlign: 'center' }}>Encontrados</th>
                  <th style={{ textAlign: 'center' }}>Faltando</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {auditoriasFiltradas.map(aud => {
                  const isPerfeito = aud.qtd_pendente === 0;
                  return (
                    <tr key={aud.id}>
                      <td className="text-mono-sm" style={{ fontSize: '0.85rem' }}>{aud.data_auditoria}</td>
                      <td className="font-medium">{aud.responsavel}</td>
                      <td style={{ textAlign: 'center' }} className="text-muted-sm">{aud.qtd_esperada}</td>
                      <td style={{ textAlign: 'center', color: 'var(--accent2)', fontWeight: 600 }}>{aud.qtd_encontrada}</td>
                      <td style={{ textAlign: 'center', color: isPerfeito ? 'var(--muted)' : 'var(--danger)', fontWeight: isPerfeito ? 400 : 700 }}>
                        {aud.qtd_pendente}
                      </td>
                      <td>
                        <span className={`chip ${isPerfeito ? 'chip-available' : 'chip-loaned'}`}>
                          {isPerfeito ? <><CheckCircle2 size={12}/> OK</> : <><AlertCircle size={12}/> Atenção</>}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          onClick={() => {
                            gerarRelatorioAuditoria(aud.esperados_json, aud.encontrados_json, aud.pendentes_json, aud.responsavel);
                            toast('Relatório resgatado do histórico!');
                          }}
                        >
                          <FileText size={16} /> Ver Relatório PDF
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {auditoriasFiltradas.length === 0 && (
            <div className="empty">
              <div className="empty-icon"><ScanLine size={40} /></div>
              <p>Nenhuma auditoria registrada no sistema ainda.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}