import { useState, useEffect } from 'react';
import { Download, Upload, PlusCircle, Save, List, Laptop, Pencil, Trash2, QrCode, ScanLine, Camera, X, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { POST, DEL, PUT } from '../api';
import { toast } from '../utils/toast';
import { openConfirm } from '../utils/confirm';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react'; 
import { Html5Qrcode } from 'html5-qrcode';
import { gerarRelatorioAuditoria } from '../utils/pdfGenerator.js';

export default function Chromebooks({ state, setState, usuarioLogado }) {
  // Estados do Formulário de Cadastro
  const [cbId, setCbId] = useState('');
  const [cbPatrimonio, setCbPatrimonio] = useState('');
  const [cbCor, setCbCor] = useState('');
  const [cbObs, setCbObs] = useState('');
  const [cbNumero, setCbNumero] = useState('');

  // Estado da Busca
  const [busca, setBusca] = useState('');
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Estados do Modal de Edição
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editPatrimonio, setEditPatrimonio] = useState('');
  const [editCor, setEditCor] = useState('');
  const [editObs, setEditObs] = useState('');
  const [editNumero, setEditNumero] = useState('');
  const [editStatus, setEditStatus] = useState(''); 

  // =========================================================================
  // ESTADOS DO INVENTÁRIO RELÂMPAGO (AUDITORIA)
  // =========================================================================
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [bipados, setBipados] = useState([]); // IDs dos equipamentos já lidos
  const [inputAuditoria, setInputAuditoria] = useState('');

  const isOperador = usuarioLogado?.perfil === 'operador';

  // Lógica de Filtro da Tabela
  const filteredCBs = state.chromebooks.filter(c =>
    c.patrimonio.toLowerCase().includes(busca.toLowerCase()) ||
    c.id.toLowerCase().includes(busca.toLowerCase()) ||
    c.cor.toLowerCase().includes(busca.toLowerCase()) ||
    (c.numero && c.numero.toLowerCase().includes(busca.toLowerCase()))
  );

  const totalPaginas = Math.ceil(filteredCBs.length / itensPorPagina);
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const cbsPaginados = filteredCBs.slice(indexInicio, indexInicio + itensPorPagina);

  // --- Funções da API ---
  async function addChromebook() {
    if (isOperador) { toast('Operadores não têm permissão para cadastrar equipamentos.', 'error'); return; }

    if (!cbId || !cbPatrimonio || !cbCor || !cbNumero) {
      toast('Preencha os campos obrigatórios.', 'error');
      return;
    }

    try {
      const novo = await POST('/chromebooks', { 
        id: cbId, 
        patrimonio: cbPatrimonio, 
        numero: cbNumero, 
        cor: cbCor, 
        obs: cbObs,
        status: 'disponivel' 
      });
      
      setState(prev => ({ ...prev, chromebooks: [novo, ...prev.chromebooks] }));
      
      setCbId(''); setCbPatrimonio(''); setCbNumero(''); setCbCor(''); setCbObs('');
      toast('Chromebook cadastrado com sucesso!');
    } catch (err) { toast(err.message, 'error'); }
  }

  function deleteChromebook(id) {
    if (isOperador) { toast('Operadores não têm permissão para excluir equipamentos.', 'error'); return; }

    const cb = state.chromebooks.find(c => c.id === id);
    if (cb?.status === 'emprestado') {
      toast('Não é possível excluir um Chromebook em empréstimo.', 'warn');
      return;
    }

    openConfirm('Excluir Chromebook', `Excluir o Chromebook "${id}"? Esta ação não pode ser desfeita.`, async () => {
      try {
        await DEL(`/chromebooks/${id}`);
        setState(prev => ({ ...prev, chromebooks: prev.chromebooks.filter(c => c.id !== id) }));
        toast('Chromebook excluído com sucesso!');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function abrirEditarChromebook(cb) {
    if (isOperador) { toast('Operadores não têm permissão para editar equipamentos.', 'error'); return; }

    setEditId(cb.id); setEditPatrimonio(cb.patrimonio); setEditNumero(cb.numero || '');
    setEditCor(cb.cor); setEditObs(cb.obs || ''); setEditStatus(cb.status || 'disponivel');
    setEditModalOpen(true);
  }

  async function salvarEdicaoChromebook() {
    if (isOperador) return;
    if (!editPatrimonio || !editCor || !editNumero) { toast('Preencha os campos obrigatórios.', 'error'); return; }

    try {
      const cbAntigo = state.chromebooks.find(c => c.id === editId);
      const atualizado = await PUT(`/chromebooks/${editId}`, { 
        ...cbAntigo, patrimonio: editPatrimonio, numero: editNumero, 
        cor: editCor, obs: editObs, status: editStatus 
      });
      
      setState(prev => ({ ...prev, chromebooks: prev.chromebooks.map(c => c.id === editId ? atualizado : c) }));
      setEditModalOpen(false);
      toast('Chromebook atualizado com sucesso!');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function mudarStatusRapido(cb, novoStatus) {
    if (isOperador) return;
    try {
      const atualizado = await PUT(`/chromebooks/${cb.id}`, { ...cb, status: novoStatus });
      setState(prev => ({ ...prev, chromebooks: prev.chromebooks.map(c => c.id === cb.id ? atualizado : c) }));
      const statusLabel = novoStatus === 'disponivel' ? 'Disponível' : novoStatus === 'manutencao' ? 'Em Manutenção' : 'Extraviado';
      toast(`Status alterado para ${statusLabel}`);
    } catch (err) { toast('Erro ao atualizar status: ' + err.message, 'error'); }
  }

  // --- FUNÇÕES DE PLANILHA ---
  const baixarPlanilhaModelo = () => {
    const cabecalho = ["Nº Equipamento", "Patrimônio", "ID (Ex: CB-01)", "Cor", "Observação"];
    const dadosExemplo = [
      ["45", "123456", "CB-001", "Acer Preto", "Carregador com mau contato"],
      ["46", "789012", "CB-002", "Samsung Cinza", ""]
    ];

    const dadosPlanilha = [cabecalho, ...dadosExemplo];
    const worksheet = XLSX.utils.aoa_to_sheet(dadosPlanilha);
    worksheet['!cols'] = [ { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 40 } ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Chromebooks_Modelo");
    XLSX.writeFile(workbook, "modelo_cadastro_chromebooks.xlsx");
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
        
        if (linhas.length <= 1) { toast('A planilha parece estar vazia!', 'error'); return; }

        const novosCBs = [];
        let ignorados = 0; 

        for (let i = 1; i < linhas.length; i++) {
          const linha = linhas[i];
          const numeroPlanilha = String(linha[0] || '').trim(); 
          const patrimonioPlanilha = String(linha[1] || '').trim(); 
          const idPlanilha = String(linha[2] || '').trim(); 
          if (!idPlanilha) continue; 

          const jaExisteNoBanco = state.chromebooks.some(c => c.id.toLowerCase() === idPlanilha.toLowerCase());
          const jaAdicionadoNesteLote = novosCBs.some(c => c.id.toLowerCase() === idPlanilha.toLowerCase());

          if (jaExisteNoBanco || jaAdicionadoNesteLote) { ignorados++; continue; }

          const novoCB = {
            id: idPlanilha, patrimonio: patrimonioPlanilha, numero: numeroPlanilha,
            cor: String(linha[3] || '').trim(), obs: String(linha[4] || '').trim(), status: 'disponivel' 
          };

          await POST('/chromebooks', novoCB);
          novosCBs.push(novoCB);
        }

        if (novosCBs.length > 0) {
          setState(prev => {
            const listaAtualizada = [...prev.chromebooks, ...novosCBs];
            return { ...prev, chromebooks: listaAtualizada.sort((a, b) => a.id.localeCompare(b.id)) };
          });
          toast(`${novosCBs.length} importados com sucesso! ${ignorados > 0 ? `(${ignorados} ignorados)` : ''}`);
        } else {
          toast(ignorados > 0 ? 'IDs da planilha já existem!' : 'Nenhum válido para importar.', 'error');
        }
      } catch (err) { toast('Erro ao importar: ' + err.message, 'error'); } 
      finally { e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  // =========================================================================
  // LÓGICA DO INVENTÁRIO RELÂMPAGO
  // =========================================================================
  
  // Equipamentos que DEVERIAM estar na prateleira (Status: Disponível)
  const esperados = state.chromebooks.filter(c => c.status === 'disponivel');
  
  // Separação: O que achamos vs O que falta
  const encontrados = esperados.filter(c => bipados.includes(c.id));
  const pendentes = esperados.filter(c => !bipados.includes(c.id));
  
  // Cálculo da barra de progresso
  const progressoPorcentagem = esperados.length === 0 ? 100 : Math.round((encontrados.length / esperados.length) * 100);

  const processarCodigoAuditoria = (codigo) => {
    const scan = codigo.trim().toLowerCase();
    if (!scan) return;

    const cbEncontrado = state.chromebooks.find(c => 
      String(c.id).toLowerCase() === scan || 
      String(c.patrimonio).toLowerCase() === scan ||
      String(c.numero).toLowerCase() === scan
    );

    if (!cbEncontrado) {
      toast('Código não reconhecido no sistema.', 'error');
      return;
    }

    if (cbEncontrado.status !== 'disponivel') {
      toast(`Atenção: O equipamento ${cbEncontrado.id} consta como "${cbEncontrado.status}". Ele não deveria estar no armário!`, 'warn');
      return;
    }

    if (bipados.includes(cbEncontrado.id)) {
      // Já bipou esse
      return;
    }

    setBipados(prev => [...prev, cbEncontrado.id]);
  };

  const handleInputAuditoria = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processarCodigoAuditoria(inputAuditoria);
      setInputAuditoria('');
    }
  };

  // Lógica da Câmera do Inventário
  useEffect(() => {
    let html5QrCode;

    if (cameraAtiva) {
      html5QrCode = new Html5Qrcode("reader-audit");
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
          // Pausa rapidamente para evitar ler 10x seguidas e volta
          processarCodigoAuditoria(decodedText);
        },
        () => {} // Ignora erros de frame vazio
      ).catch((err) => {
        console.warn("Câmera traseira não encontrada. Tentando frontal...", err);
        html5QrCode.start(
          { facingMode: "user" }, 
          config,
          (decodedText) => { processarCodigoAuditoria(decodedText); },
          () => {}
        ).catch(e => {
          toast("Nenhuma câmera encontrada ou sem permissão.", "error");
          setCameraAtiva(false);
        });
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      }
    };
  }, [cameraAtiva, bipados]); // Recarrega se a lista bipados mudar para não travar o state

  // Lógica para travar o scroll do fundo no Mobile quando modais estão abertos
  useEffect(() => {
    if (auditModalOpen || editModalOpen) {
      document.body.style.overflow = 'hidden'; // Trava o fundo
    } else {
      document.body.style.overflow = 'unset';  // Libera o fundo
    }
    
    // Limpeza de segurança caso o componente seja desmontado
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [auditModalOpen, editModalOpen]);

  return (
    <section className="page active" id="page-chromebooks">
      <div className="page-header">
        <div>
          <h1>Equipamentos</h1>
          <p>Cadastre e gerencie os dispositivos</p>
        </div>
        
        <div className="header-actions">
          {/* NOVO BOTÃO DE AUDITORIA */}
          <button 
            className="btn btn-primary" 
            onClick={() => { setBipados([]); setAuditModalOpen(true); }}
          >
            <span className="icon"><ScanLine size={16} /></span> Auditoria
          </button>

          {!isOperador && (
            <>
              <button className="btn btn-ghost" onClick={() => window.print()} title="Imprime etiquetas">
                <span className="icon"><QrCode size={16} /></span> Imprimir Etiquetas
              </button>

              <button className="btn btn-ghost" onClick={baixarPlanilhaModelo}>
                <span className="icon"><Download size={16} /></span> Modelo XLSX
              </button>
              <label className="btn btn-ghost btn-upload-label">
                <span className="icon"><Upload size={16} /></span> Importar XLSX
                <input type="file" accept=".xlsx,.xls" className="hidden-input" onChange={handleImportarXLSX} />
              </label>
            </>
          )}
        </div>
      </div>

      {!isOperador && (
        <div className="form-card">
          <h2><span className="icon icon-lg"><PlusCircle size={20} /></span> Cadastrar Equipamento</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Nº Equipamento *</label>
              <input type="text" placeholder="Ex: 45" value={cbNumero} onChange={e => setCbNumero(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Nº Patrimônio *</label>
              <input type="text" placeholder="Ex: PAT-001" value={cbPatrimonio} onChange={e => setCbPatrimonio(e.target.value)} />
            </div>
            <div className="form-group">
              <label>ID / Etiqueta *</label>
              <input type="text" placeholder="Ex: CB-001" value={cbId} onChange={e => setCbId(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Característica *</label>
              <select value={cbCor} onChange={e => setCbCor(e.target.value)}>
                <option value="">Selecione...</option>
                <option value="Acer Preto">Acer Preto</option>
                <option value="Samsung Prata">Samsung Prata</option>
                <option value="Samsung Cinza">Samsung Cinza</option>
              </select>
            </div>
            <div className="form-group">
              <label>Observações</label>
              <input type="text" placeholder="Opcional" value={cbObs} onChange={e => setCbObs(e.target.value)} />
            </div>
          </div>
          
          <div className="form-actions-right">
            <button className="btn btn-primary" onClick={addChromebook}>
              <span className="icon"><Save size={16} /></span> Salvar Equipamento
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="table-card">
        <div className="table-header">
          <h2><span className="icon icon-lg"><List size={20} /></span> Lista de Equipamentos</h2>
          <input className="search-box" type="text" placeholder="Buscar..." value={busca} onChange={e => { setBusca(e.target.value); setPaginaAtual(1); }} />
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Nº Equip.</th>
                <th>Patrimônio</th>
                <th>ID</th>
                <th>Característica</th>
                <th>Status</th>
                <th>Observações</th>
                {!isOperador && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {cbsPaginados.map(cb => (
                <tr key={cb.id}>
                  <td><span className="text-mono-bold">{cb.numero || '—'}</span></td>
                  <td><span className="text-mono">{cb.patrimonio}</span></td>
                  <td><span className="text-mono">{cb.id}</span></td>
                  <td>
                    <span className={`chip ${cb.cor === 'Samsung Prata' ? 'chip-silver' : cb.cor === 'Samsung Cinza' ? 'chip-gray' : 'chip-black'}`}>
                      {cb.cor}
                    </span>
                  </td>
                  
                  <td>
                    {cb.status === 'emprestado' ? (
                      <span className="chip chip-loaned">Emprestado</span>
                    ) : (
                      <select 
                        className={`chip ${cb.status === 'disponivel' ? 'chip-available' : cb.status === 'manutencao' ? 'chip-gray' : 'chip-black'}`}
                        style={{ appearance: 'none', cursor: isOperador ? 'default' : 'pointer', border: 'none', outline: 'none', paddingRight: '0.75rem' }}
                        value={cb.status}
                        onChange={(e) => mudarStatusRapido(cb, e.target.value)}
                        disabled={isOperador}
                        title={!isOperador ? "Clique para alterar o status" : ""}
                      >
                        <option value="disponivel">Disponível</option>
                        <option value="manutencao">Em Manutenção</option>
                        <option value="extraviado">Extraviado</option>
                      </select>
                    )}
                  </td>
                  
                  <td className="text-muted-sm">{cb.obs || '—'}</td>
                  
                  {!isOperador && (
                    <td>
                      <div className="actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarChromebook(cb)}>
                          <span className="icon"><Pencil size={16} /></span> Editar
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteChromebook(cb.id)}>
                          <span className="icon"><Trash2 size={16} /></span> Excluir
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCBs.length > 0 && (
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
                {indexInicio + 1} - {Math.min(indexInicio + itensPorPagina, filteredCBs.length)} de {filteredCBs.length}
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

        {filteredCBs.length === 0 && (
          <div className="empty">
            <div className="empty-icon"><Laptop size={40} /></div>
            <p>Nenhum equipamento encontrado</p>
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {editModalOpen && !isOperador && (
        <div className="modal-overlay open">
          <div className="modal modal-md">
            <h2>Editar Equipamento</h2>
            <p>Atualize os dados do equipamento abaixo.</p>
            <div className="form-grid mb-4">
              
              <div className="form-group">
                <label>Nº Equipamento *</label>
                <input type="text" value={editNumero} onChange={e => setEditNumero(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Nº Patrimônio *</label>
                <input type="text" value={editPatrimonio} onChange={e => setEditPatrimonio(e.target.value)} />
              </div>
              
              <div className="form-group">
                <label>Característica *</label>
                <select value={editCor} onChange={e => setEditCor(e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="Acer Preto">Acer Preto</option>
                  <option value="Samsung Prata">Samsung Prata</option>
                  <option value="Samsung Cinza">Samsung Cinza</option>
                </select>
              </div>

              <div className="form-group">
                <label>Status *</label>
                <select 
                  value={editStatus} 
                  onChange={e => setEditStatus(e.target.value)}
                  disabled={editStatus === 'emprestado'} 
                >
                  {editStatus === 'emprestado' && <option value="emprestado">Emprestado</option>}
                  <option value="disponivel">Disponível</option>
                  <option value="manutencao">Em Manutenção</option>
                  <option value="extraviado">Extraviado</option>
                </select>
              </div>

              <div className="form-group col-span-2">
                <label>Observações</label>
                <input type="text" value={editObs} onChange={e => setEditObs(e.target.value)} />
              </div>

            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarEdicaoChromebook}>
                <span className="icon"><Save size={16} /></span> Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL DE INVENTÁRIO RELÂMPAGO (AUDITORIA)
          ========================================================= */}
      {auditModalOpen && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ScanLine size={24} className="text-accent" /> Inventário Relâmpago
              </h2>
              <button 
                className="btn-remove-tag" 
                onClick={() => { setCameraAtiva(false); setAuditModalOpen(false); }}
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-muted-sm mb-4">
              Bipe todos os equipamentos que estão fisicamente no armário. O sistema cruzará os dados com os {esperados.length} equipamentos que constam como "Disponíveis".
            </p>

            {/* Painel de Estatísticas */}
            <div className="audit-stats">
              <div className="audit-stat-box">
                <div className="audit-stat-value">{esperados.length}</div>
                <div className="audit-stat-label">Deveriam Estar Aqui</div>
              </div>
              <div className="audit-stat-box success">
                <div className="audit-stat-value">{encontrados.length}</div>
                <div className="audit-stat-label">Encontrados</div>
              </div>
              <div className="audit-stat-box warning">
                <div className="audit-stat-value">{pendentes.length}</div>
                <div className="audit-stat-label">Faltando</div>
              </div>
            </div>

            <div className="audit-progress">
              <div className="audit-progress-bar" style={{ width: `${progressoPorcentagem}%` }}></div>
            </div>

            {/* Câmera e Input Manual */}
            <div style={{ background: 'var(--surface2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              
              <div style={{ flex: 1, minWidth: '250px' }}>
                <label className="section-label" style={{ marginBottom: '0.5rem' }}>Bipar Manualmente / Leitor USB</label>
                <input 
                  type="text" 
                  className="inline-input w-full"
                  style={{ marginTop: 0 }}
                  placeholder="Ex: CB-01 ou Patrimônio + Enter"
                  value={inputAuditoria}
                  onChange={(e) => setInputAuditoria(e.target.value)}
                  onKeyDown={handleInputAuditoria}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <span className="text-muted-sm font-medium">Ou use a Câmera</span>
                <button 
                  className={`btn ${cameraAtiva ? 'btn-danger' : 'btn-primary'}`} 
                  onClick={() => setCameraAtiva(!cameraAtiva)}
                >
                  <span className="icon"><Camera size={16} /></span> {cameraAtiva ? 'Desligar Câmera' : 'Ligar Câmera'}
                </button>
              </div>

            </div>

            {/* Div onde a câmera será renderizada */}
            {cameraAtiva && (
              <div style={{ marginBottom: '1.5rem', overflow: 'hidden', borderRadius: '8px', border: '2px solid var(--accent)' }}>
                <div id="reader-audit"></div>
              </div>
            )}

            {/* Listas de Cruzamento de Dados */}
            <div className="audit-lists-container">
              
              {/* Coluna 1: Pendentes */}
              <div>
                <div className="audit-list-header text-warn">
                  <AlertCircle size={18} /> Pendentes ({pendentes.length})
                </div>
                {pendentes.length === 0 ? (
                  <div className="text-muted-sm p-3 text-center" style={{ border: '1px dashed var(--border)', borderRadius: '6px' }}>
                    Todos os equipamentos foram encontrados! 🎉
                  </div>
                ) : (
                  pendentes.map(c => (
                    <div key={c.id} className="audit-item pending">
                      <div>
                        <div className="text-mono-bold">{c.numero ? `Nº ${c.numero}` : c.id}</div>
                        <div className="text-muted-sm" style={{ fontSize: '0.75rem' }}>Pat: {c.patrimonio}</div>
                      </div>
                      <span className="chip chip-gray">Aguardando...</span>
                    </div>
                  ))
                )}
              </div>

              {/* Coluna 2: Encontrados */}
              <div>
                <div className="audit-list-header text-accent2">
                  <CheckCircle2 size={18} /> Encontrados ({encontrados.length})
                </div>
                {encontrados.length === 0 ? (
                  <div className="text-muted-sm p-3 text-center" style={{ border: '1px dashed var(--border)', borderRadius: '6px' }}>
                    Comece a bipar os equipamentos para preencher a lista.
                  </div>
                ) : (
                  encontrados.map(c => (
                    <div key={c.id} className="audit-item found">
                      <div>
                        <div className="text-mono-bold">{c.numero ? `Nº ${c.numero}` : c.id}</div>
                        <div className="text-muted-sm" style={{ fontSize: '0.75rem' }}>Pat: {c.patrimonio}</div>
                      </div>
                      <span className="chip chip-available"><CheckCircle2 size={14}/> OK</span>
                    </div>
                  ))
                )}
              </div>

            </div>

            <div className="modal-actions mt-4" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  gerarRelatorioAuditoria(esperados, encontrados, pendentes, usuarioLogado?.nome);
                  toast('Relatório de auditoria gerado!');
                }}
              >
                <span className="icon"><FileText size={16} /></span> Baixar Relatório PDF
              </button>
              
              <button 
                className="btn btn-ghost" 
                onClick={async () => {
                  try {
                    // Envia os dados para a API salvar no histórico
                    const novaAuditoria = await POST('/auditorias', {
                      responsavel: usuarioLogado?.nome,
                      esperados,
                      encontrados,
                      pendentes
                    });
                    
                    // Adiciona na memória (state global) para aparecer na hora no histórico!
                    setState(prev => ({
                      ...prev,
                      auditorias: [novaAuditoria, ...(prev.auditorias || [])]
                    }));

                    toast('Auditoria salva no histórico!', 'success');
                  } catch (err) {
                    console.error("Erro ao salvar auditoria:", err);
                    toast('Não foi possível salvar no histórico, mas você pode fechar.', 'warn');
                  } finally {
                    setCameraAtiva(false); 
                    setAuditModalOpen(false);
                  }
                }}
              >
                Concluir e Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================
          ÁREA DE IMPRESSÃO DE ETIQUETAS (INVISÍVEL NA TELA NORMAL)
          ========================================================= */}
      <div className="print-area">
        {filteredCBs.map(cb => (
          <div key={cb.id} className="etiqueta">
            <div className="etiqueta-title">Colégio La Salle</div>
            <QRCodeSVG value={cb.id} size={64} level="M" />
            <div className="etiqueta-meta">
              {cb.numero ? `Nº ${cb.numero} - ` : ''}{cb.id}<br/>
              PAT: {cb.patrimonio}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}