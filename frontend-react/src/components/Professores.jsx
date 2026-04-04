import { useState, useMemo } from 'react';
import { Download, Upload, PlusCircle, Plus, X, Save, List as ListIcon, Users as UsersIcon, Pencil, Trash2 } from 'lucide-react';
import { POST, DEL, PUT } from '../api';
import { toast } from '../utils/toast.js';
import { openConfirm } from '../utils/confirm.js';
import * as XLSX from 'xlsx';

// Helper para converter a string JSON do banco em array
function getTurmas(prof) {
  try { return JSON.parse(prof.turma || '[]'); } 
  catch { return prof.turma ? [prof.turma] : []; }
}

export default function Professores({ state, setState, usuarioLogado }) {
  // --- ESTADOS DO FORMULÁRIO DE CADASTRO ---
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [tipo, setTipo] = useState('');
  const [materia, setMateria] = useState('');
  const [outro, setOutro] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  
  // Turmas (Cadastro)
  const [turmaInput, setTurmaInput] = useState('');
  const [turmasCadastro, setTurmasCadastro] = useState([]);

  // --- ESTADOS DE FILTRO DA TABELA ---
  const [busca, setBusca] = useState('');
  const [filtroTurma, setFiltroTurma] = useState('');
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // --- ESTADOS DO MODAL DE EDIÇÃO ---
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [editMateria, setEditMateria] = useState('');
  const [editOutro, setEditOutro] = useState('');
  const [editTurmaInput, setEditTurmaInput] = useState('');
  const [editCodigoBarras, setEditCodigoBarras] = useState('');
  const [turmasEdicao, setTurmasEdicao] = useState([]);

  const isOperador = usuarioLogado?.perfil === 'operador';

  // --- LÓGICA DAS TAGS DE TURMA ---
  const adicionarTurma = (e) => {
    e?.preventDefault();
    const val = turmaInput.trim();
    if (!val) return;
    if (turmasCadastro.includes(val)) {
      alert('Turma já adicionada.'); return;
    }
    setTurmasCadastro([...turmasCadastro, val]);
    setTurmaInput('');
  };

  const removerTurma = (t) => {
    setTurmasCadastro(turmasCadastro.filter(x => x !== t));
  };

  const adicionarTurmaEdit = (e) => {
    e?.preventDefault();
    const val = editTurmaInput.trim();
    if (!val) return;
    if (turmasEdicao.includes(val)) {
      alert('Turma já adicionada.'); return;
    }
    setTurmasEdicao([...turmasEdicao, val]);
    setEditTurmaInput('');
  };

  const removerTurmaEdit = (t) => {
    setTurmasEdicao(turmasEdicao.filter(x => x !== t));
  };

  // --- LÓGICA DE FILTRAGEM E SELECT DINÂMICO ---
  const todasTurmas = useMemo(() => {
    const turmasSet = new Set();
    state.professores.forEach(p => getTurmas(p).forEach(t => turmasSet.add(t)));
    return [...turmasSet].sort();
  }, [state.professores]);

  const filteredProfessores = state.professores.filter(p => {
    const turmasArray = getTurmas(p);
    const turmasStr = turmasArray.join(' ');
    const f = busca.toLowerCase();
    
    const textoOk = !f || p.nome.toLowerCase().includes(f) || turmasStr.toLowerCase().includes(f) || (p.email && p.email.toLowerCase().includes(f));
    const turmaOk = !filtroTurma || turmasArray.includes(filtroTurma);
    
    return textoOk && turmaOk;
  });

  const totalPaginas = Math.ceil(filteredProfessores.length / itensPorPagina);
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const professoresPaginados = filteredProfessores.slice(indexInicio, indexInicio + itensPorPagina);

  // --- FUNÇÕES DE PLANILHA ---
  const baixarPlanilhaModelo = () => {
    const cabecalho = ["ID", "Nome", "Turma", "E-mail", "Tipo", "Matéria (Se for professor de matéria)", "Código de Barras"];
    const dadosExemplo = [
      ["1001", "João da Silva", "01", "joao@escola.com.br", "Matéria", "Matemática", "123456789"],
      ["1002", "Maria Souza", "02", "maria@escola.com.br", "Titular", "", ""] 
    ];
    const dadosPlanilha = [cabecalho, ...dadosExemplo];
    const worksheet = XLSX.utils.aoa_to_sheet(dadosPlanilha);
    worksheet['!cols'] = [
      { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 45 }, { wch: 20 }  
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Responsaveis_Modelo");
    XLSX.writeFile(workbook, "modelo_cadastro_responsaveis.xlsx");
  };

  const handleImportarXLSX = async (e) => {
    if (isOperador) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const linhas = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (linhas.length <= 1) {
          toast('A planilha parece estar vazia!', 'error');
          return;
        }

        const novosProfessores = [];
        let ignorados = 0; 

        for (let i = 1; i < linhas.length; i++) {
          const linha = linhas[i];
          const nomePlanilha = String(linha[1] || '').trim();
          
          if (!nomePlanilha) continue; 

          const jaExisteNoBanco = state.professores.some(p => p.nome.toLowerCase() === nomePlanilha.toLowerCase());
          const jaAdicionadoNesteLote = novosProfessores.some(p => p.nome.toLowerCase() === nomePlanilha.toLowerCase());

          if (jaExisteNoBanco || jaAdicionadoNesteLote) {
            ignorados++;
            continue; 
          }

          const novoResp = {
            id: Date.now().toString() + i, 
            nome: nomePlanilha,
            turma: JSON.stringify(linha[2] ? [String(linha[2]).trim()] : []),
            email: String(linha[3] || '').trim(),
            tipo: String(linha[4] || 'Outro').trim(),
            materia: String(linha[5] || '').trim(),
            codigo_barras: String(linha[6] || '').trim()
          };

          await POST('/professores', novoResp);
          novosProfessores.push(novoResp);
        }

        if (novosProfessores.length > 0) {
          setState(prev => {
            const listaAtualizada = [...prev.professores, ...novosProfessores];
            return { 
              ...prev, 
              professores: listaAtualizada.sort((a, b) => a.nome.localeCompare(b.nome)) 
            };
          });
          toast(`${novosProfessores.length} importados com sucesso! ${ignorados > 0 ? `(${ignorados} ignorados por duplicidade)` : ''}`);
        } else {
          toast(ignorados > 0 ? 'Todos os nomes da planilha já existem no sistema!' : 'Nenhum responsável válido para importar.', 'error');
        }

      } catch (err) {
        toast('Erro ao importar: ' + err.message, 'error');
      } finally {
        e.target.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- REQUISIÇÕES API ---
  async function addProfessor() {
    if (isOperador) { toast('Operadores não têm permissão para cadastrar.', 'error'); return; }

    if (!nome || !tipo) { toast('Preencha os campos obrigatórios (Nome e Cargo).', 'error'); return; }
    if (tipo === 'Matéria' && !materia) { toast('Informe qual é a matéria do professor.', 'error'); return; }
    if (tipo === 'Outro' && !outro) { toast('Especifique o nome do cargo.', 'error'); return; }

    try {
      const novo = await POST('/professores', {
        id: Date.now().toString(),
        nome,
        turma: JSON.stringify(turmasCadastro),
        email,
        tipo,
        materia: tipo === 'Matéria' ? materia : tipo === 'Outro' ? outro : '',
        codigo_barras: codigoBarras,
      });
      
      const novaLista = [...state.professores, novo].sort((a, b) => a.nome.localeCompare(b.nome));
      setState(prev => ({ ...prev, professores: novaLista }));
      
      setNome(''); setEmail(''); setTipo(''); setMateria(''); setOutro(''); setCodigoBarras('');
      setTurmasCadastro([]); setTurmaInput('');
      
      toast('Responsável cadastrado com sucesso!');
    } catch (err) { toast(err.message, 'error'); }
  }

  function deleteProfessor(id, nomeProf) {
    if (isOperador) { toast('Operadores não têm permissão para excluir.', 'error'); return; }

    openConfirm('Excluir Responsável', `Deseja realmente excluir "${nomeProf}"? Esta ação não pode ser desfeita.`, async () => {
      try {
        await DEL(`/professores/${id}`);
        setState(prev => ({ ...prev, professores: prev.professores.filter(p => p.id !== id) }));
        toast('Responsável excluído com sucesso!');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function abrirEditarProfessor(prof) {
    if (isOperador) { toast('Operadores não têm permissão para editar.', 'error'); return; }

    setEditId(prof.id);
    setEditNome(prof.nome);
    setEditEmail(prof.email || '');
    setEditTipo(prof.tipo || '');
    setEditMateria(prof.tipo === 'Matéria' ? prof.materia : '');
    setEditOutro(prof.tipo === 'Outro' ? prof.materia : '');
    setEditCodigoBarras(prof.codigo_barras || '');
    setTurmasEdicao(getTurmas(prof));
    setEditTurmaInput('');
    setEditModalOpen(true);
  }

  async function salvarEdicaoProfessor() {
    if (isOperador) return;

    if (!editNome || !editTipo) { toast('Preencha os campos obrigatórios (Nome e Cargo).', 'error'); return; }
    if (editTipo === 'Matéria' && !editMateria) { toast('Informe qual é a matéria do professor.', 'error'); return; }
    if (editTipo === 'Outro' && !editOutro) { toast('Especifique o nome do cargo.', 'error'); return; }

    try {
      const atualizado = await PUT(`/professores/${editId}`, {
        nome: editNome,
        turma: JSON.stringify(turmasEdicao),
        email: editEmail,
        tipo: editTipo,
        materia: editTipo === 'Matéria' ? editMateria : editTipo === 'Outro' ? editOutro : '',
        codigo_barras: editCodigoBarras,
      });

      setState(prev => {
        const novaLista = prev.professores.map(p => p.id === editId ? atualizado : p);
        return { ...prev, professores: novaLista.sort((a, b) => a.nome.localeCompare(b.nome)) };
      });
      
      setEditModalOpen(false);
      toast('Responsável atualizado com sucesso!');
    } catch (err) { toast(err.message, 'error'); }
  }

  // --- RENDER DO CARGO LIMPÍSSIMO ---
  const renderCargoChip = (prof) => {
    let classeCor = 'outro';
    if (prof.tipo === 'Matéria') classeCor = 'materia';
    if (prof.tipo === 'Titular') classeCor = 'titular';
    if (prof.tipo === 'Coordenador') classeCor = 'coordenador';
    if (prof.tipo === 'Orientador') classeCor = 'orientador';

    const label = prof.tipo === 'Matéria' ? `Prof. ${prof.materia}` : 
                  prof.tipo === 'Titular' ? 'Prof. Titular' : 
                  prof.tipo === 'Outro' ? (prof.materia || 'Outro') : prof.tipo;

    return <span className={`chip-cargo ${classeCor}`}>{label}</span>;
  };

  return (
    <section className="page active" id="page-professores">
      <div className="page-header">
        <div>
          <h1>Responsáveis</h1>
          <p>Cadastre quem pode realizar empréstimos de Chromebooks</p>
        </div>
        
        {!isOperador && (
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={baixarPlanilhaModelo}>
              <span className="icon"><Download size={16} /></span> Modelo XLSX
            </button>
            <label className="btn btn-ghost cursor-pointer">
              <span className="icon"><Upload size={16} /></span> Importar XLSX
              <input type="file" accept=".xlsx,.xls" className="d-none" onChange={handleImportarXLSX} />
            </label>
          </div>
        )}
      </div>

      {!isOperador && (
        <div className="form-card">
          <h2><span className="icon icon-lg"><PlusCircle size={20} /></span> Cadastrar Responsável</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Nome completo *</label>
              <input type="text" placeholder="Ex: Maria Silva" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Cód. de Barras do Crachá</label>
              <input type="text" placeholder="Bipe o crachá aqui" value={codigoBarras} onChange={e => setCodigoBarras(e.target.value)} />
            </div>
            
            <div className="form-group">
              <label>Turmas / Salas</label>
              <div className="turmas-input-group">
                <input 
                  type="text" 
                  placeholder="Ex: 9ºA" 
                  value={turmaInput} 
                  onChange={e => setTurmaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') adicionarTurma(e); }}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={adicionarTurma}>
                  <span className="icon"><Plus size={16} /></span> Adicionar
                </button>
              </div>
              <div className="turmas-tags-container">
                {turmasCadastro.map(t => (
                  <span key={t} className="turma-tag">
                    {t} <button type="button" onClick={() => removerTurma(t)}><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>E-mail</label>
              <input type="email" placeholder="email@escola.edu.br" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Cargo *</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="">Selecione...</option>
                <option value="Titular">Professor Titular</option>
                <option value="Matéria">Professor de Matéria</option>
                <option value="Coordenador">Coordenador</option>
                <option value="Orientador">Orientador</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            
            {tipo === 'Matéria' && (
              <div className="form-group">
                <label>Matéria *</label>
                <input type="text" placeholder="Ex: Matemática" value={materia} onChange={e => setMateria(e.target.value)} />
              </div>
            )}
            {tipo === 'Outro' && (
              <div className="form-group">
                <label>Especifique *</label>
                <input type="text" placeholder="Ex: Secretário" value={outro} onChange={e => setOutro(e.target.value)} />
              </div>
            )}
          </div>
          <div className="form-actions-right">
            <button className="btn btn-primary" onClick={addProfessor}>
              <span className="icon"><Save size={16} /></span> Salvar Responsável
            </button>
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-header">
          <h2><span className="icon icon-lg"><ListIcon size={20} /></span> Lista de Responsáveis</h2>
          <div className="search-filters">
            <input className="search-box" type="text" placeholder="Buscar..." value={busca} onChange={e => { setBusca(e.target.value); setPaginaAtual(1); }} />
            <select className="search-box filter-select" value={filtroTurma} onChange={e => { setFiltroTurma(e.target.value); setPaginaAtual(1); }}>
              <option value="">Todas as turmas</option>
              {todasTurmas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Crachá</th>
                <th>Turma / Sala</th>
                <th>E-mail</th>
                <th>Cargo</th>
                {!isOperador && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {professoresPaginados.map(prof => {
                const turmas = getTurmas(prof);
                const visiveis = turmas.slice(0, 3);
                const extras = turmas.length - 3;
                
                return (
                  <tr key={prof.id}>
                    <td className="nome-professor">{prof.nome}</td>
                    <td className="text-mono-sm">
                      {prof.codigo_barras ? (
                        <span className="chip chip-outline">
                          {prof.codigo_barras}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {turmas.length ? (
                        <div className="turmas-tabela-container">
                          {visiveis.map(t => <span key={t} className="turma-badge">{t}</span>)}
                          {extras > 0 && <span className="turma-badge-extra" data-tooltip={turmas.slice(3).join(', ')}>+{extras}</span>}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="email-professor">{prof.email || '—'}</td>
                    <td>{renderCargoChip(prof)}</td>
                    
                    {!isOperador && (
                      <td>
                        <div className="actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarProfessor(prof)}>
                            <span className="icon"><Pencil size={16} /></span> Editar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteProfessor(prof.id, prof.nome)}>
                            <span className="icon"><Trash2 size={16} /></span> Excluir
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredProfessores.length > 0 && (
          <div className="table-footer">
            <div className="flex-center-gap-md">
              <span className="text-muted-sm">Mostrar:</span>
              <select 
                className="items-per-page-select"
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
            
            <div className="flex-center-gap-lg">
              <span className="text-muted-sm fw-500">
                {indexInicio + 1} - {Math.min(indexInicio + itensPorPagina, filteredProfessores.length)} de {filteredProfessores.length}
              </span>
              <div className="flex-gap-xs">
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

        {filteredProfessores.length === 0 && (
          <div className="empty">
            <div className="empty-icon"><UsersIcon size={40} /></div>
            <p>Nenhum responsável encontrado</p>
          </div>
        )}
      </div>

      {editModalOpen && !isOperador && (
        <div className="modal-overlay open">
          <div className="modal modal-md">
            <h2>Editar Responsável</h2>
            <p>Atualize os dados abaixo.</p>
            <div className="form-grid mb-4">
              <div className="form-group">
                <label>Nome completo *</label>
                <input type="text" value={editNome} onChange={e => setEditNome(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Cód. de Barras do Crachá</label>
                <input type="text" value={editCodigoBarras} onChange={e => setEditCodigoBarras(e.target.value)} />
              </div>
              
              <div className="form-group">
                <label>Turmas / Salas</label>
                <div className="turmas-input-group">
                  <input 
                    type="text" 
                    value={editTurmaInput} 
                    onChange={e => setEditTurmaInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') adicionarTurmaEdit(e); }}
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={adicionarTurmaEdit}>
                    <span className="icon"><Plus size={16} /></span> Adicionar
                  </button>
                </div>
                <div className="turmas-tags-container">
                  {turmasEdicao.map(t => (
                    <span key={t} className="turma-tag">
                      {t} <button type="button" onClick={() => removerTurmaEdit(t)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>E-mail</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Cargo *</label>
                <select value={editTipo} onChange={e => { setEditTipo(e.target.value); setEditMateria(''); setEditOutro(''); }}>
                  <option value="">Selecione...</option>
                  <option value="Titular">Professor Titular</option>
                  <option value="Matéria">Professor de Matéria</option>
                  <option value="Coordenador">Coordenador</option>
                  <option value="Orientador">Orientador</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {editTipo === 'Matéria' && (
                <div className="form-group">
                  <label>Matéria *</label>
                  <input type="text" value={editMateria} onChange={e => setEditMateria(e.target.value)} />
                </div>
              )}
              {editTipo === 'Outro' && (
                <div className="form-group">
                  <label>Especifique *</label>
                  <input type="text" value={editOutro} onChange={e => setEditOutro(e.target.value)} />
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarEdicaoProfessor}>
                <span className="icon"><Save size={16} /></span> Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}