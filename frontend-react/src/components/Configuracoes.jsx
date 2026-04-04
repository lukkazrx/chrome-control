import { useState, useEffect } from 'react';
import { PUT, GET, POST, DEL } from '../api';
import { toast } from '../utils/toast';
import { Settings, Save, Mail, School, Shield, CalendarDays, Plus, Pencil, Trash2, Check, X, Globe } from 'lucide-react';

export default function Configuracoes({ state, setState, usuarioLogado }) {
  const [formData, setFormData] = useState({
    escola_nome: '',
    atraso_padrao_horas: '',
    brevo_api_key: '',
    email_remetente: '',
    nome_remetente: '',
    agenda_dominio: '',
    agenda_hora_inicio: '07:00',
    agenda_hora_fim: '18:00',
    agenda_duracao_slot: '50',
    agenda_sabado: '0',
  });

  const [isLoading, setIsLoading] = useState(false);

  // ── Recursos da Agenda ──────────────────────────────────────
  const [recursos, setRecursos] = useState([]);
  const [recursoForm, setRecursoForm] = useState(null);
  const [recursoLoading, setRecursoLoading] = useState(false);

  const CORES_RECURSO = ['#4f8ef7', '#38d9a9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981'];

  // ── Domínios da Agenda ──────────────────────────────────────
  const [dominioInput, setDominioInput] = useState('');

  function getDominios() {
    return (formData.agenda_dominio || '').split(',').map(d => d.trim()).filter(Boolean);
  }

  function adicionarDominio() {
    const novo = dominioInput.trim().toLowerCase().replace(/^@/, '');
    if (!novo) return;

    const atuais = getDominios();
    if (atuais.includes(novo)) {
      setDominioInput('');
      return;
    }

    setFormData(prev => ({ ...prev, agenda_dominio: [...atuais, novo].join(',') }));
    setDominioInput('');
  }

  function removerDominio(dom) {
    setFormData(prev => ({
      ...prev,
      agenda_dominio: getDominios().filter(d => d !== dom).join(','),
    }));
  }

  useEffect(() => {
    if (state.configuracoes) {
      setFormData(prev => ({ ...prev, ...state.configuracoes }));
    }
  }, [state.configuracoes]);

  useEffect(() => {
    if (usuarioLogado?.perfil === 'admin') carregarRecursos();
  }, [usuarioLogado]);

  async function carregarRecursos() {
    try {
      setRecursos(await GET('/agenda/admin/recursos'));
    } catch {}
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSalvar = async () => {
    if (usuarioLogado?.perfil !== 'admin') {
      return toast('Apenas administradores podem alterar as configurações do sistema.', 'error');
    }

    const payload = { ...formData };
    if (payload.brevo_api_key === '*** PROTECTED ***') delete payload.brevo_api_key;

    setIsLoading(true);
    try {
      await PUT('/configuracoes', payload);
      setState(prev => ({ ...prev, configuracoes: { ...state.configuracoes, ...payload } }));
      toast('Configurações globais atualizadas com sucesso!');
    } catch (err) {
      toast(err.message || 'Falha ao salvar as configurações.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  async function salvarRecurso() {
    if (!recursoForm?.nome?.trim()) return toast('Nome é obrigatório.', 'error');

    setRecursoLoading(true);
    try {
      if (recursoForm.id) {
        const atualizado = await PUT(`/agenda/admin/recursos/${recursoForm.id}`, recursoForm);
        setRecursos(prev => prev.map(r => (r.id === atualizado.id ? atualizado : r)));
      } else {
        const novo = await POST('/agenda/admin/recursos', recursoForm);
        setRecursos(prev => [...prev, novo]);
      }

      setRecursoForm(null);
      toast('Recurso salvo com sucesso!');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRecursoLoading(false);
    }
  }

  async function excluirRecurso(id) {
    if (!confirm('Excluir este recurso? Só é possível se não houver agendamentos futuros.')) return;

    try {
      await DEL(`/agenda/admin/recursos/${id}`);
      setRecursos(prev => prev.filter(r => r.id !== id));
      toast('Recurso excluído.');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (usuarioLogado?.perfil !== 'admin') {
    return (
      <section className="page active" id="page-configuracoes">
        <div className="page-header">
          <div>
            <h1>Configurações</h1>
            <p>Área administrativa do sistema.</p>
          </div>
        </div>

        <div className="form-card">
          <div className="empty">
            <div className="icon"><Shield size={40} /></div>
            <p>Essa página é exclusiva para administradores do sistema.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page active" id="page-configuracoes">
      <div className="page-header">
        <div>
          <h1>Configurações Administrativas</h1>
          <p>Gerencie identidade institucional, regras de atraso, e-mails e agenda do sistema.</p>
        </div>

        <div className="header-actions">
          <button type="button" className="btn btn-primary" onClick={handleSalvar} disabled={isLoading}>
            <Save size={16} />
            {isLoading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      <div className="form-grid cfg-top-grid">
        <div className="form-card">
          <h2>
            <span className="flex-center-gap-sm">
              <School size={18} />
              Identidade e Regras
            </span>
          </h2>

          <div className="form-group mb-4">
            <label htmlFor="escola_nome">Nome da Instituição (Escola)</label>
            <input
              id="escola_nome"
              name="escola_nome"
              type="text"
              value={formData.escola_nome || ''}
              onChange={handleChange}
              placeholder="Ex: Colégio LaSalle"
            />
            <small className="text-muted-sm">Este nome será utilizado nos alertas visuais, recibos e rodapés do sistema.</small>
          </div>

          <div className="form-group">
            <label htmlFor="atraso_padrao_horas">Janela de Atraso Padrão (em horas)</label>
            <input
              id="atraso_padrao_horas"
              name="atraso_padrao_horas"
              type="number"
              min="1"
              value={formData.atraso_padrao_horas || ''}
              onChange={handleChange}
              placeholder="Ex: 4"
            />
            <small className="text-muted-sm">Equipamentos não devolvidos após esse período serão marcados como atrasados.</small>
          </div>
        </div>

        <div className="form-card">
          <h2>
            <span className="flex-center-gap-sm">
              <Mail size={18} />
              Comunicação por E-mail
            </span>
          </h2>

          <div className="form-group mb-4">
            <label htmlFor="brevo_api_key">API Key de Envio (Brevo)</label>
            <input
              id="brevo_api_key"
              name="brevo_api_key"
              type="password"
              value={formData.brevo_api_key || ''}
              onChange={handleChange}
              placeholder="Insira a chave xkeysib-..."
            />
            <small className="text-muted-sm">A chave fica protegida para perfis sem permissão administrativa.</small>
          </div>

          <div className="form-group mb-4">
            <label htmlFor="email_remetente">Endereço de E-mail Remetente</label>
            <input
              id="email_remetente"
              name="email_remetente"
              type="email"
              value={formData.email_remetente || ''}
              onChange={handleChange}
              placeholder="noreply@escola.com.br"
            />
          </div>

          <div className="form-group">
            <label htmlFor="nome_remetente">Nome Visível no Cabeçalho do E-mail</label>
            <input
              id="nome_remetente"
              name="nome_remetente"
              type="text"
              value={formData.nome_remetente || ''}
              onChange={handleChange}
              placeholder="Ex: Coordenação de TI"
            />
            <small className="text-muted-sm">Esse nome será exibido como assinatura do remetente.</small>
          </div>
        </div>
      </div>

      <div className="form-card cfg-section-mt">
        <h2>
          <span className="flex-center-gap-sm">
            <CalendarDays size={18} />
            Agenda de Recursos
          </span>
        </h2>

        <div className="form-grid cfg-agenda-grid">
          <div className="flex-col-gap-sm">
            <div className="form-group mb-4">
              <label className="cfg-label-icon flex-center-gap-sm" htmlFor="agenda_dominio_input">
                <Globe size={14} />
                Domínios de E-mail Permitidos
              </label>

              <div className="turmas-tags-container cfg-domain-tags">
                {getDominios().map(dom => (
                  <span key={dom} className="turma-tag cfg-domain-tag">
                    @{dom}
                    <button
                      type="button"
                      className="btn-remove-tag cfg-domain-tag-remove"
                      onClick={() => removerDominio(dom)}
                      title="Remover domínio"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}

                {getDominios().length === 0 && (
                  <span className="no-selection cfg-domain-empty">Nenhum domínio — qualquer e-mail será aceito</span>
                )}
              </div>

              <div className="turmas-input-group cfg-domain-input-row">
                <input
                  id="agenda_dominio_input"
                  className="cfg-input"
                  placeholder="Ex: lasalle.org.br"
                  value={dominioInput}
                  onChange={e => setDominioInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      adicionarDominio();
                    }
                  }}
                />
                <button type="button" className="btn btn-ghost" onClick={adicionarDominio}>
                  <Plus size={15} />
                  Adicionar
                </button>
              </div>

              <small className="text-muted-sm cfg-hint">
                Professores só poderão agendar com e-mails desses domínios. Deixe vazio para aceitar qualquer e-mail.
              </small>
            </div>

            <div className="form-grid cfg-horarios-grid">
              <div className="form-group">
                <label htmlFor="agenda_hora_inicio">Início</label>
                <input
                  id="agenda_hora_inicio"
                  name="agenda_hora_inicio"
                  type="time"
                  value={formData.agenda_hora_inicio || '07:00'}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="agenda_hora_fim">Término</label>
                <input
                  id="agenda_hora_fim"
                  name="agenda_hora_fim"
                  type="time"
                  value={formData.agenda_hora_fim || '18:00'}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="agenda_duracao_slot">Duração do slot (min)</label>
                <input
                  id="agenda_duracao_slot"
                  name="agenda_duracao_slot"
                  type="number"
                  min="10"
                  step="5"
                  value={formData.agenda_duracao_slot || '50'}
                  onChange={handleChange}
                  placeholder="50"
                />
              </div>
            </div>

            {/* Toggle: Sábados */}
            <label className="toggle-switch" htmlFor="toggle-sabado">
              <input
                id="toggle-sabado"
                type="checkbox"
                checked={formData.agenda_sabado === '1'}
                onChange={e =>
                  setFormData(prev => ({ ...prev, agenda_sabado: e.target.checked ? '1' : '0' }))
                }
              />
              <span className="toggle-slider" />
              <span className="toggle-label">Habilitar agendamentos aos sábados</span>
            </label>
          </div>

          <div>
            <div className="cfg-recursos-header flex-between-wrap">
              <label className="section-label cfg-recursos-label">Recursos Disponíveis</label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setRecursoForm({ nome: '', descricao: '', cor: '#4f8ef7', ativo: true })}
              >
                <Plus size={14} />
                Adicionar
              </button>
            </div>

            {recursoForm && (
              <div className="cfg-recurso-form">
                <div className="cfg-recurso-form-top">
                  <input
                    className="cfg-input"
                    placeholder="Nome do recurso *"
                    value={recursoForm.nome}
                    onChange={e => setRecursoForm(p => ({ ...p, nome: e.target.value }))}
                    onFocus={e => { e.target.style.borderColor = recursoForm.cor; }}
                    onBlur={e => { e.target.style.borderColor = ''; }}
                  />

                  <div className="cfg-color-picker">
                    {CORES_RECURSO.map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`cfg-color-dot ${recursoForm.cor === c ? 'ativo' : ''}`}
                        style={{
                          background: c,
                          boxShadow: recursoForm.cor === c ? `0 0 0 2px var(--surface2), 0 0 0 4px ${c}` : 'none',
                        }}
                        title={c}
                        onClick={() => setRecursoForm(p => ({ ...p, cor: c }))}
                      />
                    ))}
                  </div>
                </div>

                <input
                  className="cfg-input cfg-input-desc"
                  placeholder="Descrição (opcional)"
                  value={recursoForm.descricao}
                  onChange={e => setRecursoForm(p => ({ ...p, descricao: e.target.value }))}
                />

                <div className="cfg-recurso-form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setRecursoForm(null)}>
                    <X size={14} />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: recursoForm.cor }}
                    onClick={salvarRecurso}
                    disabled={recursoLoading}
                  >
                    <Check size={14} />
                    {recursoLoading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            <div className="cfg-recurso-lista">
              {recursos.map(r => (
                <div
                  key={r.id}
                  className={`cfg-recurso-item ${!r.ativo ? 'inativo' : ''}`}
                  style={{ borderLeftColor: r.cor }}
                >
                  <div className="cfg-recurso-dot" style={{ background: r.cor }} />

                  <div className="cfg-recurso-info">
                    <div className="cfg-recurso-nome">{r.nome}</div>
                    {r.descricao && <div className="cfg-recurso-desc">{r.descricao}</div>}
                    {!r.ativo && <span className="cfg-recurso-inativo">Inativo</span>}
                  </div>

                  <div className="cfg-recurso-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setRecursoForm({ ...r, ativo: Boolean(r.ativo) })}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger-ghost"
                      onClick={() => excluirRecurso(r.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {recursos.length === 0 && (
                <p className="cfg-recurso-empty">Nenhum recurso cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="form-card cfg-section-mt">
        <div className="flex-between-wrap">
          <div className="flex-col-start">
            <span className="section-label">Permissão atual</span>
            <span className="chip-admin">Administrador</span>
            <p className="text-muted-sm mt-3">
              As alterações feitas aqui impactam todo o sistema e os envios automáticos de e-mail.
            </p>
          </div>

          <div className="form-actions-right">
            <button type="button" className="btn btn-primary btn-lg" onClick={handleSalvar} disabled={isLoading}>
              <Settings size={18} />
              {isLoading ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
