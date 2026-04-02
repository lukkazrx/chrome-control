import { useState, useEffect } from 'react';
import { User, Laptop, ArrowLeftRight, Zap, Inbox, Mail, Pencil, Undo2, Save, X, Camera, Plus, CheckSquare, Square } from 'lucide-react';
import { POST, PUT } from '../api';
import { toast } from '../utils/toast.js';
import { openConfirm } from '../utils/confirm.js';
import { Html5Qrcode } from 'html5-qrcode';

// --- HELPERS ---
function getTurmas(prof) {
  try { return JSON.parse(prof.turma || '[]'); } 
  catch { return prof.turma ? [prof.turma] : []; }
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

function cargoLabel(p) {
  if (p.tipo === 'Matéria')     return `Prof. ${p.materia}`;
  if (p.tipo === 'Titular')     return 'Prof. Titular';
  if (p.tipo === 'Coordenador') return 'Coordenador';
  if (p.tipo === 'Orientador')  return 'Orientador';
  if (p.tipo === 'Outro')       return p.materia || 'Outro';
  return p.tipo || '—';
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

const ACESSORIOS_DISPONIVEIS = ['Carregador', 'Mouse', 'Cabo HDMI', 'Adaptador', 'Fones'];

export default function Emprestimos({ state, setState, usuarioLogado }) {
  const [buscaProf, setBuscaProf] = useState('');
  const [buscaCB, setBuscaCB] = useState('');
  
  const [selectedProf, setSelectedProf] = useState(null);
  const [selectedTurma, setSelectedTurma] = useState('');
  const [selectedCBs, setSelectedCBs] = useState([]);
  const [selectedAcessorios, setSelectedAcessorios] = useState([]);
  const [obs, setObs] = useState('');

  const [autoEnviarEmail, setAutoEnviarEmail] = useState(() => {
    return localStorage.getItem('autoEnviarEmail') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('autoEnviarEmail', autoEnviarEmail);
  }, [autoEnviarEmail]);

  const [lembretesEnviando, setLembretesEnviando] = useState({});

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [empEmEdicao, setEmpEmEdicao] = useState(null);
  
  const [editProfId, setEditProfId] = useState('');
  const [profSearch, setProfSearch] = useState('');
  const [showProfDropdown, setShowProfDropdown] = useState(false);
  
  const [cbSearch, setCbSearch] = useState('');
  const [showCBDropdown, setShowCBDropdown] = useState(false);
  const [editCBs, setEditCBs] = useState([]);
  const [editAcessorios, setEditAcessorios] = useState([]); 
  const [editObs, setEditObs] = useState('');

  // ESTADOS DA DEVOLUÇÃO PARCIAL
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [empParaDevolver, setEmpParaDevolver] = useState(null);
  const [cbsParaDevolver, setCbsParaDevolver] = useState([]);

  const [expandedCards, setExpandedCards] = useState({});
  const [scannerModalOpen, setScannerModalOpen] = useState(false);

  const toggleCard = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const profsFiltrados = state.professores.filter(p => 
    p.nome.toLowerCase().includes(buscaProf.toLowerCase()) || 
    getTurmas(p).join(' ').toLowerCase().includes(buscaProf.toLowerCase()) ||
    (p.codigo_barras && p.codigo_barras.toLowerCase().includes(buscaProf.toLowerCase()))
  );

  const cbsDisponiveis = state.chromebooks.filter(c => 
    c.status === 'disponivel' && 
    (
      String(c.id || '').toLowerCase().includes(buscaCB.toLowerCase()) || 
      String(c.patrimonio || '').toLowerCase().includes(buscaCB.toLowerCase()) || 
      String(c.numero || '').toLowerCase().includes(buscaCB.toLowerCase())
    )
  );

  const handleSelectProf = (p) => {
    setSelectedProf(p);
    const turmas = getTurmas(p);
    if (turmas.length === 1) setSelectedTurma(turmas[0]);
    else setSelectedTurma('');
  };

  const toggleSelectCB = (cb) => {
    if (selectedCBs.find(s => s.id === cb.id)) {
      setSelectedCBs(selectedCBs.filter(s => s.id !== cb.id));
    } else {
      setSelectedCBs([...selectedCBs, cb]);
    }
  };

  const toggleAcessorio = (item, isEdit = false) => {
    if (isEdit) {
      setEditAcessorios(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    } else {
      setSelectedAcessorios(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    }
  };

  const processarCodigoLido = (codigo) => {
    const scan = codigo.trim().toLowerCase();
    if (!scan) return;

    const cbEncontrado = state.chromebooks.find(c => 
      c.status === 'disponivel' && 
      (
        String(c.id || '').toLowerCase() === scan || 
        String(c.patrimonio || '').toLowerCase() === scan ||
        String(c.numero || '').toLowerCase() === scan
      )
    );

    if (cbEncontrado) {
      setSelectedCBs(prev => {
        if (!prev.some(s => s.id === cbEncontrado.id)) {
          toast(`✅ ${cbEncontrado.numero ? 'Nº ' + cbEncontrado.numero : cbEncontrado.id} selecionado!`);
          return [...prev, cbEncontrado];
        } else {
          toast('Este equipamento já está na lista!', 'warn');
          return prev;
        }
      });
    } else {
      toast('Equipamento não encontrado, indisponível ou código inválido.', 'error');
    }
  };

  const handleBiparEquipamento = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processarCodigoLido(buscaCB);
      setBuscaCB('');
    }
  };

  const processarCrachaLido = (codigo) => {
    const scan = codigo.trim().toLowerCase();
    if (!scan) return;
    
    // Procura primeiro pelo crachá, depois pelo nome/id
    const prof = state.professores.find(p => 
      (p.codigo_barras && p.codigo_barras.toLowerCase() === scan) ||
      (p.id.toLowerCase() === scan) ||
      (p.nome.toLowerCase() === scan)
    );

    if (prof) {
      handleSelectProf(prof);
      setBuscaProf('');
      toast(`✅ Responsável selecionado: ${prof.nome}`);
      
      // Tenta focar no input do chromebook para o fluxo ágil contínuo
      const cbInput = document.getElementById('input-busca-cb');
      if (cbInput) cbInput.focus();
    } else {
      toast('Código de crachá não reconhecido.', 'error');
    }
  };

  const handleBiparResponsavel = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processarCrachaLido(buscaProf);
    }
  };

  useEffect(() => {
    let html5QrCode;

    if (scannerModalOpen) {
      html5QrCode = new Html5Qrcode("reader");
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
          html5QrCode.stop().then(() => {
            html5QrCode.clear();
            setScannerModalOpen(false);
            processarCodigoLido(decodedText);
          }).catch(err => console.error("Erro ao parar a câmera", err));
        },
        (errorMessage) => {}
      ).catch((err) => {
        console.warn("Câmera traseira não encontrada. Tentando câmera frontal...", err);
        html5QrCode.start(
          { facingMode: "user" }, 
          config,
          (decodedText) => {
            html5QrCode.stop().then(() => {
              html5QrCode.clear();
              setScannerModalOpen(false);
              processarCodigoLido(decodedText);
            });
          },
          (err) => {}
        ).catch(e => toast("Nenhuma câmera encontrada ou sem permissão.", "error"));
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      }
    };
  }, [scannerModalOpen]);

  async function registrarEmprestimo() {
    if (!selectedProf) { toast('Selecione um responsável.', 'error'); return; }
    if (selectedCBs.length === 0) { toast('Selecione ao menos um equipamento.', 'error'); return; }

    const turmas = getTurmas(selectedProf);
    const turmaFinal = turmas.length > 0 ? selectedTurma : '';
    
    if (turmas.length > 1 && !selectedTurma) { toast('Selecione a turma do empréstimo.', 'error'); return; }

    try {
      const emp = await POST('/emprestimos', {
        id: Date.now().toString(),
        professorId: selectedProf.id,
        professorNome: selectedProf.nome,
        professorTurma: turmaFinal || selectedProf.turma || '—',
        professorTipo: selectedProf.tipo,
        professorMateria: selectedProf.materia || '',
        chromebooks: selectedCBs.map(c => ({ id: c.id, patrimonio: c.patrimonio, numero: c.numero, cor: c.cor })),
        acessorios: selectedAcessorios,
        dataRetirada: new Date().toLocaleString('pt-BR'),
        registradoPor: usuarioLogado?.nome,
        obs,
      });

      setState(prev => {
        const novosCBs = prev.chromebooks.map(c => selectedCBs.some(sel => sel.id === c.id) ? { ...c, status: 'emprestado' } : c);
        return { ...prev, emprestimos: [emp, ...prev.emprestimos], historico: [{ ...emp }, ...prev.historico], chromebooks: novosCBs };
      });

      setSelectedProf(null); setSelectedTurma(''); setSelectedCBs([]); setObs(''); setSelectedAcessorios([]);
      toast('Empréstimo registrado com sucesso!');

      if (autoEnviarEmail && selectedProf?.email) {
        POST('/email/comprovante', {
          acao: 'retirada',
          professorEmail: selectedProf.email,
          professorNome: selectedProf.nome,
          turma: turmaFinal || selectedProf.turma || '—',
          tipo: selectedProf.tipo,
          materia: selectedProf.materia || '',
          chromebooks: selectedCBs.map(c => ({ id: c.id, patrimonio: c.patrimonio, numero: c.numero, cor: c.cor })),
          dataMovimentacao: new Date().toLocaleString('pt-BR'),
          obs
        }).then(() => toast(`📧 Recibo enviado para ${selectedProf.email}!`))
          .catch(() => toast(`⚠️ Falha ao enviar recibo por e-mail`, 'error'));
      }
    } catch (err) { toast(err.message, 'error'); }
  }

  // =========================================================================
  // NOVO FLUXO DE DEVOLUÇÃO (ABRE O MODAL SE TIVER MAIS DE 1)
  // =========================================================================
  function iniciarDevolucao(emp) {
    if (emp.chromebooks.length === 1) {
      // Devolve direto se for só 1
      executarDevolucao(emp, [emp.chromebooks[0].id]);
    } else {
      // Abre o modal de devolução parcial
      setEmpParaDevolver(emp);
      setCbsParaDevolver(emp.chromebooks.map(c => c.id)); // Seleciona todos por padrão
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
        devolvidoPor: usuarioLogado?.nome,
        chromebookIds: idsParaDevolver
      });

      setState(prev => {
        // Atualiza a lista de computadores livres
        const novosCBs = prev.chromebooks.map(c => idsParaDevolver.includes(c.id) ? { ...c, status: 'disponivel' } : c);

        if (resp.tipo === 'total') {
          return {
            ...prev,
            emprestimos: prev.emprestimos.filter(e => e.id !== emp.id),
            historico: prev.historico.map(h => h.id === emp.id ? resp.atualizado : h),
            chromebooks: novosCBs
          };
        } else {
          // É Parcial!
          return {
            ...prev,
            emprestimos: prev.emprestimos.map(e => e.id === emp.id ? resp.atualizado : e),
            historico: [resp.parcial, ...prev.historico], // Joga a parte devolvida pro histórico
            chromebooks: novosCBs
          };
        }
      });
      
      setDevModalOpen(false);
      toast(resp.tipo === 'total' ? 'Devolução registrada com sucesso!' : 'Devolução PARCIAL registrada com sucesso!');

      if (autoEnviarEmail) {
        const profDev = state.professores.find(p => p.id === emp.professorId);
        if (profDev?.email) {
          const cbsDevolvidos = emp.chromebooks.filter(c => idsParaDevolver.includes(c.id));
          POST('/email/comprovante', {
            acao: 'devolucao',
            professorEmail: profDev.email,
            professorNome: profDev.nome,
            turma: profDev.turma || '—',
            tipo: profDev.tipo,
            materia: profDev.materia || '',
            chromebooks: cbsDevolvidos,
            dataMovimentacao: new Date().toLocaleString('pt-BR'),
            obs: emp.obs
          }).then(() => toast(`📧 Recibo de devolução enviado para ${profDev.email}!`))
            .catch(() => toast(`⚠️ Falha ao avisar por e-mail`, 'error'));
        }
      }
    } catch (err) { toast(err.message, 'error'); }
  }

  async function enviarLembrete(emp) {
    const prof = state.professores.find(p => p.id === emp.professorId);
    if (!prof?.email) { toast('Este responsável não possui e-mail cadastrado.', 'warn'); return; }

    setLembretesEnviando(prev => ({ ...prev, [emp.id]: true }));
    try {
      await POST('/email/lembrete', {
        professorEmail: prof.email, professorNome: emp.professorNome, turma: emp.professorTurma,
        tipo: emp.professorTipo, materia: emp.professorMateria, chromebooks: emp.chromebooks,
        dataRetirada: emp.dataRetirada, obs: emp.obs,
      });
      toast(`📧 Lembrete enviado para ${prof.email}!`);
    } catch (err) { toast(err.message, 'error'); } 
    finally { setLembretesEnviando(prev => ({ ...prev, [emp.id]: false })); }
  }

  function abrirEditarEmprestimo(emp) {
    setEmpEmEdicao(emp);
    setEditProfId(emp.professorId);
    setProfSearch(emp.professorNome);
    setEditCBs([...emp.chromebooks]);
    
    let acessoriosCarregados = [];
    if (Array.isArray(emp.acessorios)) acessoriosCarregados = [...emp.acessorios];
    else if (typeof emp.acessorios === 'string') {
      try { acessoriosCarregados = JSON.parse(emp.acessorios); } 
      catch { acessoriosCarregados = []; }
    }
    setEditAcessorios(acessoriosCarregados);

    setEditObs(emp.obs || '');
    setCbSearch('');
    setShowProfDropdown(false);
    setShowCBDropdown(false);
    setEditModalOpen(true);
  }

  const selectProfEdit = (prof) => {
    setEditProfId(prof.id);
    setProfSearch(prof.nome);
    setShowProfDropdown(false);
  };

  const addCBEdit = (cb) => {
    if (!editCBs.find(c => c.id === cb.id)) {
      setEditCBs([...editCBs, { id: cb.id, patrimonio: cb.patrimonio, numero: cb.numero, cor: cb.cor }]);
    }
    setCbSearch('');
    setShowCBDropdown(false);
  };

  const removeCBEdit = (cbId) => {
    setEditCBs(editCBs.filter(c => c.id !== cbId));
  };

  async function salvarEdicaoEmprestimo() {
    if (!editProfId) { toast('Selecione um responsável válido.', 'error'); return; }
    if (editCBs.length === 0) { toast('O empréstimo deve ter ao menos 1 equipamento.', 'error'); return; }

    const prof = state.professores.find(p => p.id === editProfId);
    if (!prof) { toast('Responsável não encontrado no sistema.', 'error'); return; }

    try {
      const payload = {
        professorId: prof.id,
        professorNome: prof.nome,
        professorTurma: prof.turma || '—',
        professorTipo: prof.tipo,
        professorMateria: prof.materia || '',
        chromebooks: editCBs,
        acessorios: editAcessorios, 
        obs: editObs
      };

      const atualizado = await PUT(`/emprestimos/${empEmEdicao.id}`, payload);

      setState(prev => {
        const oldCBIds = empEmEdicao.chromebooks.map(c => c.id);
        const newCBIds = editCBs.map(c => c.id);

        const novosChromebooks = prev.chromebooks.map(c => {
          if (newCBIds.includes(c.id)) return { ...c, status: 'emprestado' };
          if (oldCBIds.includes(c.id) && !newCBIds.includes(c.id)) return { ...c, status: 'disponivel' };
          return c;
        });

        return {
          ...prev,
          emprestimos: prev.emprestimos.map(e => e.id === empEmEdicao.id ? atualizado : e),
          historico: prev.historico.map(h => h.id === empEmEdicao.id ? atualizado : h),
          chromebooks: novosChromebooks
        };
      });

      setEditModalOpen(false);
      toast('Empréstimo atualizado com sucesso!');
    } catch (err) { toast('Erro ao editar: ' + err.message, 'error'); }
  }

  const profsFiltradosEdit = profSearch 
    ? state.professores.filter(p => p.nome.toLowerCase().includes(profSearch.toLowerCase())) 
    : [];
  const cbsDisponiveisEdit = state.chromebooks.filter(c => 
    c.status === 'disponivel' && 
    (c.id.toLowerCase().includes(cbSearch.toLowerCase()) || 
     (c.patrimonio && c.patrimonio.toLowerCase().includes(cbSearch.toLowerCase())) ||
     (c.numero && c.numero.toLowerCase().includes(cbSearch.toLowerCase())))
  );

  return (
    <section className="page active" id="page-emprestimos">
      <div className="page-header">
        <div>
          <h1>Registrar Empréstimo</h1>
          <p>Selecione o responsável e os equipamentos para emprestar</p>
        </div>
        <button className="btn btn-primary" onClick={() => setScannerModalOpen(true)}>
          <span className="icon icon-lg"><Camera size={20} /></span> Usar Câmera
        </button>
      </div>

      <div className="loan-grid">
        <div className="form-card">
          <h2><span className="icon icon-lg"><User size={20} /></span> Selecionar Responsável</h2>
          <input 
            id="input-busca-prof"
            className="search-box w-full mb-3" 
            type="text" 
            placeholder="Bipe o crachá ou busque por nome..." 
            value={buscaProf} 
            onChange={e => setBuscaProf(e.target.value)} 
            onKeyDown={handleBiparResponsavel}
            autoFocus
          />
          <div className="picker-list" id="prof-picker">
            {profsFiltrados.length === 0 ? (
              <div className="empty p-4"><p>Nenhum responsável encontrado</p></div>
            ) : (
              profsFiltrados.map(p => {
                const turmas = getTurmas(p);
                const isSelected = selectedProf?.id === p.id;
                return (
                  <div key={p.id} className={`picker-item ${isSelected ? 'selected' : ''}`} onClick={() => handleSelectProf(p)}>
                    <div>
                      <div>{p.nome}</div>
                      <div className="sub">{cargoLabel(p)} • {turmas.length ? turmas.join(', ') : '—'}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          
          <div className="mt-3">
            <span className="section-label">Selecionado</span>
            <div className="selection-box">
              {selectedProf ? (
                <>
                  <span className="sel-tag">{selectedProf.nome}</span>
                  <span className="text-muted-sm">{cargoLabel(selectedProf)}</span>
                </>
              ) : <span className="no-selection">Nenhum responsável selecionado</span>}
            </div>
          </div>

          {selectedProf && getTurmas(selectedProf).length > 1 && (
            <div className="mt-3">
              <span className="section-label">Turma do Empréstimo *</span>
              <select 
                className="inline-input w-full"
                value={selectedTurma} 
                onChange={e => setSelectedTurma(e.target.value)}
              >
                <option value="">Selecione a turma...</option>
                {getTurmas(selectedProf).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="form-card">
          <h2><span className="icon icon-lg"><Laptop size={20} /></span> Selecionar Equipamentos</h2>
          
          <input 
            id="input-busca-cb"
            className="search-box w-full mb-3" 
            type="text" 
            placeholder="Aponte o leitor físico ou digite o Nº..." 
            value={buscaCB} 
            onChange={e => setBuscaCB(e.target.value)} 
            onKeyDown={handleBiparEquipamento} 
          />

          <div className="picker-list">
            {cbsDisponiveis.length === 0 ? (
              <div className="empty p-4"><p>Nenhum equipamento disponível</p></div>
            ) : (
              cbsDisponiveis.map(c => {
                const isSelected = selectedCBs.some(s => s.id === c.id);
                return (
                  <div key={c.id} className={`picker-item ${isSelected ? 'selected' : ''}`} onClick={() => toggleSelectCB(c)}>
                    <div>
                      <div>
                        {c.numero && <span className="text-mono-bold">Nº {c.numero}</span>}
                        {c.numero ? ` • ${c.id}` : c.id}
                      </div>
                      <div className="sub">Pat: {c.patrimonio} • {c.cor}</div>
                    </div>
                    {isSelected ? <span className="chip chip-available">Selecionado</span> : <span className="chip chip-available">Disponível</span>}
                  </div>
                )
              })
            )}
          </div>
          
          <div className="mt-3">
            <div className="section-label">
              Selecionados (<span>{selectedCBs.length}</span>)
            </div>
            <div className="selection-box" style={{ minHeight: '50px' }}>
              {selectedCBs.length === 0 ? (
                <span className="no-selection">Nenhum equipamento selecionado</span>
              ) : (
                selectedCBs.map(c => (
                  <span 
                    key={c.id} 
                    className="sel-tag green sel-tag-interactive" 
                    onClick={() => toggleSelectCB(c)}
                    title="Clique para remover"
                  >
                    {c.numero ? `Nº ${c.numero}` : c.id}
                    <X size={14} className="opacity-70" />
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="form-card flex-between-wrap">
        <div className="flex-1">
          <div className="mb-4">
            <span className="section-label">Acessórios Extras</span>
            <div className="accessory-group">
              {ACESSORIOS_DISPONIVEIS.map(item => (
                <div 
                  key={item} 
                  className={`accessory-chip ${selectedAcessorios.includes(item) ? 'selected' : ''}`}
                  onClick={() => toggleAcessorio(item)}
                >
                  {selectedAcessorios.includes(item) ? <Zap size={14} /> : <Plus size={14} />}
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="section-label">Observações (opcional)</span>
            <input 
              type="text" 
              className="inline-input w-full" 
              style={{ maxWidth: '400px', marginTop: 0 }} 
              placeholder="Ex: Aula de robótica" 
              value={obs} 
              onChange={e => setObs(e.target.value)} 
            />
          </div>
        </div>
        <div className="loan-submit-area">
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={autoEnviarEmail} 
              onChange={e => setAutoEnviarEmail(e.target.checked)} 
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Enviar comprovante por e-mail</span>
          </label>
          <button className="btn btn-success btn-lg w-full" onClick={registrarEmprestimo}>
            <span className="icon icon-lg"><ArrowLeftRight size={20} /></span> Registrar Empréstimo
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <h2><span className="icon icon-lg"><Zap size={20} /></span> Empréstimos Ativos</h2>
        </div>
        <div className="loan-list-container">
          {state.emprestimos.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><Inbox size={40} /></div>
              <p>Nenhum empréstimo ativo</p>
            </div>
          ) : (
            state.emprestimos.map(emp => {
              const prof = state.professores.find(p => p.id === emp.professorId);
              const temEmail = !!(prof?.email);
              const isEnviando = lembretesEnviando[emp.id];

              const isExpanded = expandedCards[emp.id];
              const cbList = emp.chromebooks || [];
              const hasMany = cbList.length > 4;
              const cbsToShow = (hasMany && !isExpanded) ? cbList.slice(0, 4) : cbList;

              const statusAtraso = calcularAtraso(emp.dataRetirada);
              
              let listaAcessorios = [];
              if (Array.isArray(emp.acessorios)) listaAcessorios = emp.acessorios;
              else if (typeof emp.acessorios === 'string') {
                try { listaAcessorios = JSON.parse(emp.acessorios); } catch { listaAcessorios = []; }
              }

              return (
                <div key={emp.id} className={`loan-card ${statusAtraso !== 'normal' ? 'atraso-' + statusAtraso : ''}`}>
                  <div className="loan-info">
                    {statusAtraso === 'alerta' && <div className="badge-atraso alerta">⚠️ +12h em posse</div>}
                    {statusAtraso === 'critico' && <div className="badge-atraso critico">🚨 +24h em posse</div>}
                    
                    <h3>{emp.professorNome}</h3>
                    <p>
                      {formatarTurmas(emp.professorTurma)} • {cargoLabel({ tipo: emp.professorTipo, materia: emp.professorMateria })}{emp.obs ? ` • ${emp.obs}` : ''}
                    </p>
                    <div className="loan-email">
                      {temEmail ? `📧 ${prof.email}` : <span className="text-danger">⚠️ Sem e-mail cadastrado</span>}
                    </div>
                    
                    <div className="loan-equipments" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
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
                    <div className="loan-meta" style={{ textAlign: 'right' }}>
                      Retirada<br />{emp.dataRetirada}<br />
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'var(--font)' }}>Por: {emp.registradoPor || 'Sistema'}</span><br />
                      <span className="text-warn">{cbList.length} dispositivo(s)</span>
                    </div>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => enviarLembrete(emp)}
                      disabled={!temEmail || isEnviando}
                    >
                      <span className="icon"><Mail size={16} /></span> {isEnviando ? 'Enviando...' : 'Lembrete'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarEmprestimo(emp)}>
                      <span className="icon"><Pencil size={16} /></span> Editar
                    </button>
                    {/* BOTÃO QUE INICIA A DEVOLUÇÃO (E ABRE O NOVO MODAL SE PRECISO) */}
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

      {/* --- NOVO MODAL DE DEVOLUÇÃO PARCIAL --- */}
      {devModalOpen && empParaDevolver && (
        <div className="modal-overlay open">
          <div className="modal modal-md">
            <h2>Confirmar Devolução</h2>
            <p className="text-muted-sm mb-4">
              Selecione QUAIS equipamentos estão sendo devolvidos agora.
            </p>
            
            <div className="mb-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {empParaDevolver.chromebooks.map(c => {
                const isSelected = cbsParaDevolver.includes(c.id);
                return (
                  <label 
                    key={c.id} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.75rem', 
                      padding: '0.75rem', border: `1px solid ${isSelected ? 'var(--accent2)' : 'var(--border)'}`, 
                      borderRadius: '8px', cursor: 'pointer', background: isSelected ? 'rgba(56, 217, 169, 0.05)' : 'var(--surface2)'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      className="hidden-input"
                      checked={isSelected}
                      onChange={() => toggleCbDevolucao(c.id)}
                    />
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
              // Verifica se tem acessórios usando a conversão segura
              let acs = [];
              if (Array.isArray(empParaDevolver.acessorios)) acs = empParaDevolver.acessorios;
              else if (typeof empParaDevolver.acessorios === 'string') {
                try { acs = JSON.parse(empParaDevolver.acessorios); } catch { acs = []; }
              }
              if (acs.length > 0) {
                return (
                  <div className="mb-4 p-3" style={{ background: 'rgba(247, 201, 79, 0.1)', border: '1px solid var(--warn)', borderRadius: '8px' }}>
                    <div className="text-warn font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>⚠️ Não se esqueça de conferir:</div>
                    <div className="text-muted-sm">{acs.join(', ')}</div>
                  </div>
                );
              }
            })()}

            <div className="modal-actions mt-4" style={{ alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={autoEnviarEmail} 
                  onChange={e => setAutoEnviarEmail(e.target.checked)} 
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Auto-Recibo: {autoEnviarEmail ? 'ON' : 'OFF'}</span>
              </label>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-ghost" onClick={() => setDevModalOpen(false)}>Cancelar</button>
                <button 
                  className="btn btn-success" 
                  onClick={() => executarDevolucao(empParaDevolver, cbsParaDevolver)}
                  disabled={cbsParaDevolver.length === 0}
                >
                  <span className="icon"><Undo2 size={16} /></span> 
                  {cbsParaDevolver.length === empParaDevolver.chromebooks.length ? 'Devolver Tudo' : `Devolver Parcial (${cbsParaDevolver.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE EDIÇÃO AVANÇADO --- */}
      {editModalOpen && (
        <div className="modal-overlay open">
          <div className="modal modal-md overflow-visible">
            <h2>Editar Empréstimo</h2>
            <p className="text-muted-sm mb-4">Altere os dados do empréstimo ativo.</p>
            
            <div className="form-group mb-4" style={{ position: 'relative' }}>
              <label>Responsável</label>
              <input 
                type="text" 
                placeholder="Buscar responsável..." 
                value={profSearch} 
                onChange={e => {
                  setProfSearch(e.target.value);
                  setEditProfId('');
                  setShowProfDropdown(true);
                }}
                onFocus={() => setShowProfDropdown(true)}
              />
              {showProfDropdown && profSearch && !editProfId && (
                <div className="autocomplete-dropdown">
                  {profsFiltradosEdit.length > 0 ? profsFiltradosEdit.map(p => (
                    <div key={p.id} className="autocomplete-item" onClick={() => selectProfEdit(p)}>
                      <div className="autocomplete-title">{p.nome}</div>
                      <div className="autocomplete-sub">{cargoLabel(p)}</div>
                    </div>
                  )) : (
                    <div className="autocomplete-item text-muted-sm">Nenhum responsável encontrado</div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group mb-4" style={{ position: 'relative' }}>
              <label>Adicionar Equipamentos</label>
              <input 
                type="text" 
                placeholder="Buscar por Nº, ID ou Patrimônio..." 
                value={cbSearch} 
                onChange={e => {
                  setCbSearch(e.target.value);
                  setShowCBDropdown(true);
                }}
                onFocus={() => setShowCBDropdown(true)}
              />
              {showCBDropdown && cbSearch && (
                <div className="autocomplete-dropdown">
                  {cbsDisponiveisEdit.length > 0 ? cbsDisponiveisEdit.map(c => (
                    <div key={c.id} className="autocomplete-item" onClick={() => addCBEdit(c)}>
                      <span className="autocomplete-title">
                        {c.numero ? `Nº ${c.numero}` : c.id}
                      </span>
                      <span className="autocomplete-sub">Pat: {c.patrimonio}</span>
                    </div>
                  )) : (
                    <div className="autocomplete-item text-muted-sm">Nenhum equipamento disponível</div>
                  )}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="section-label">Equipamentos Selecionados</label>
              <div className="loan-equipments">
                {editCBs.map(c => (
                  <span key={c.id} className="chip-loan-item">
                    {c.numero ? `Nº ${c.numero}` : c.id}
                    <button className="btn-remove-tag" onClick={() => removeCBEdit(c.id)}>
                      <X size={14} />
                    </button>
                  </span>
                ))}
                {editCBs.length === 0 && <span className="text-muted-sm">Nenhum equipamento na lista</span>}
              </div>
            </div>

            <div className="mb-4">
              <label className="section-label">Acessórios Extras</label>
              <div className="accessory-group">
                {ACESSORIOS_DISPONIVEIS.map(item => (
                  <div 
                    key={item} 
                    className={`accessory-chip ${editAcessorios.includes(item) ? 'selected' : ''}`}
                    onClick={() => toggleAcessorio(item, true)}
                  >
                    {editAcessorios.includes(item) ? <Zap size={14} /> : <Plus size={14} />}
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group mb-4">
              <label>Observação</label>
              <input 
                type="text" 
                placeholder="Ex: Aula de robótica" 
                value={editObs} 
                onChange={e => setEditObs(e.target.value)} 
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarEdicaoEmprestimo}>
                <span className="icon"><Save size={16} /></span> Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DA CÂMERA --- */}
      {scannerModalOpen && (
        <div className="modal-overlay open">
          <div className="modal modal-md">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 1rem 0' }}>
              <h2 style={{ margin: 0 }}>Ler Código de Barras</h2>
              <button className="btn-remove-tag" onClick={() => setScannerModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <p className="text-muted-sm mb-4">Aponte a câmera para o código de barras ou QR Code do equipamento.</p>
            
            <div id="reader"></div>

            <div className="modal-actions mt-3">
              <button className="btn btn-ghost w-full" onClick={() => setScannerModalOpen(false)}>
                Fechar Câmera
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}