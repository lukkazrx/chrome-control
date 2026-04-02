import { useState, useEffect } from 'react';
import { UserPlus, Users as UsersIcon, Save, Pencil, Trash2, LogOut } from 'lucide-react';
import { GET, POST, PUT, DEL } from '../api';
import { toast } from '../utils/toast.js';
import { openConfirm } from '../utils/confirm.js';

export default function Usuarios({ usuarioLogado, fazerLogout }) {
  // --- ESTADO LOCAL DA LISTA DE USUÁRIOS ---
  const [usuariosLista, setUsuariosLista] = useState([]);

  // --- ESTADOS DO FORMULÁRIO DE CADASTRO ---
  const [novoNome, setNovoNome] = useState('');
  const [novoLogin, setNovoLogin] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoPerfil, setNovoPerfil] = useState('');

  // --- ESTADOS DO MODAL DE EDIÇÃO ---
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editLogin, setEditLogin] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [editPerfil, setEditPerfil] = useState('');

  // VARIÁVEL DE SEGURANÇA VISUAL: Verifica se é operador
  const isOperador = usuarioLogado?.perfil === 'operador';

  // Carrega a lista de utilizadores ao abrir a página
  useEffect(() => {
    carregarUsuarios();
  }, []);

  async function carregarUsuarios() {
    try {
      const resposta = await GET('/auth/usuarios');
      
      // BLINDAGEM AQUI: Só atualiza a lista se a resposta do banco for realmente um Array (lista)
      if (Array.isArray(resposta)) {
        setUsuariosLista(resposta);
      } else if (resposta && resposta.erro) {
        // Se o banco devolver um erro (ex: Acesso negado), mostra o erro e zera a lista
        toast(resposta.erro, 'warn');
        setUsuariosLista([]);
      } else {
        setUsuariosLista([]);
      }
      
    } catch (err) {
      toast('Erro ao carregar usuários: ' + err.message, 'error');
      setUsuariosLista([]);
    }
  }

  // --- REQUISIÇÕES API ---
  async function criarUsuario() {
    if (isOperador) {
      toast('Operadores não têm permissão para criar usuários.', 'error');
      return;
    }

    if (!novoNome || !novoLogin || !novaSenha || !novoPerfil) {
      toast('Preencha todos os campos', 'warn');
      return;
    }
    if (novaSenha.length < 6) {
      toast('A senha deve ter ao menos 6 caracteres', 'warn');
      return;
    }

    try {
      await POST('/auth/usuarios', {
        nome: novoNome,
        login: novoLogin,
        senha: novaSenha,
        perfil: novoPerfil
      });
      
      setNovoNome('');
      setNovoLogin('');
      setNovaSenha('');
      setNovoPerfil('');
      
      carregarUsuarios(); 
      toast('Usuário cadastrado com sucesso!');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function excluirUsuario(id, nome) {
    if (isOperador) {
      toast('Operadores não têm permissão para excluir usuários.', 'error');
      return;
    }

    openConfirm(
      'Excluir Usuário', 
      `Tem certeza que deseja excluir o usuário "${nome}"? Esta ação não pode ser desfeita.`, 
      async () => {
        try {
          await DEL(`/auth/usuarios/${id}`);
          carregarUsuarios();
          toast('Usuário excluído com sucesso!');
        } catch (err) {
          toast(err.message, 'error'); 
        }
      }
    );
  }

  function abrirEditarUsuario(u) {
    if (isOperador && u.id !== usuarioLogado.id) {
      toast('Você só tem permissão para editar o seu próprio usuário.', 'error');
      return;
    }

    setEditId(u.id);
    setEditNome(u.nome);
    setEditLogin(u.login);
    setEditSenha(''); 
    setEditPerfil(u.perfil);
    setEditModalOpen(true);
  }

  async function salvarEdicaoUsuario() {
    if (!editNome || !editLogin || !editPerfil) {
      toast('Preencha os campos obrigatórios.', 'warn');
      return;
    }
    if (editSenha && editSenha.length < 6) {
      toast('A senha deve ter ao menos 6 caracteres', 'warn');
      return;
    }

    try {
      await PUT(`/auth/usuarios/${editId}`, {
        nome: editNome,
        login: editLogin,
        senha: editSenha || undefined, 
        perfil: isOperador ? 'operador' : editPerfil 
      });
      setEditModalOpen(false);
      carregarUsuarios();
      toast('Usuário atualizado com sucesso!');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <section className="page active" id="page-usuarios">
      <div className="page-header">
        <div>
          <h1>Usuários</h1>
          <p>Gerencie quem pode acessar o sistema</p>
        </div>
        <button className="btn btn-danger" onClick={fazerLogout}>
          <span className="icon"><LogOut size={16} /></span> Sair do sistema
        </button>
      </div>

      {/* --- FORMULÁRIO DE CADASTRO (Oculto para Operadores) --- */}
      {!isOperador && (
        <div className="form-card">
          <h2><span className="icon icon-lg"><UserPlus size={20} /></span> Cadastrar Usuário</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Nome completo *</label>
              <input 
                type="text" placeholder="Ex: João Silva" 
                value={novoNome} onChange={e => setNovoNome(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label>Login *</label>
              <input 
                type="text" placeholder="Ex: joao" 
                value={novoLogin} onChange={e => setNovoLogin(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label>Senha *</label>
              <input 
                type="password" placeholder="Mínimo 6 caracteres" 
                value={novaSenha} onChange={e => setNovaSenha(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label>Perfil *</label>
              <select value={novoPerfil} onChange={e => setNovoPerfil(e.target.value)}>
                <option value="">Selecione...</option>
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div className="form-actions-right">
            <button className="btn btn-primary" onClick={criarUsuario}>
              <span className="icon"><Save size={16} /></span> Salvar Usuário
            </button>
          </div>
        </div>
      )}

      {/* --- TABELA DE USUÁRIOS --- */}
      <div className="table-card">
        <div className="table-header">
          <h2><span className="icon icon-lg"><UsersIcon size={20} /></span> Usuários Cadastrados</h2>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Perfil</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {/* O map agora é protegido, mas já garantimos lá em cima que usuáriosLista é sempre um Array */}
              {usuariosLista.map(u => {
                const isMe = u.id === usuarioLogado?.id;
                
                return (
                  <tr key={u.id}>
                    <td className="font-medium">
                      {u.nome} {isMe && <span className="text-highlight-sm">(você)</span>}
                    </td>
                    <td><span className="text-mono-sm">{u.login}</span></td>
                    <td>
                      {u.perfil === 'admin' 
                        ? <span className="chip-admin">⭐ Admin</span>
                        : <span className="chip-operador">Operador</span>
                      }
                    </td>
                    <td className="text-muted-sm">{u.criado_em || '—'}</td>
                    <td>
                      <div className="actions">
                        {/* Se for admin, mostra sempre. Se for operador, só mostra na linha dele mesmo. */}
                        {(!isOperador || isMe) && (
                          <button className="btn btn-ghost btn-sm" onClick={() => abrirEditarUsuario(u)}>
                            <span className="icon"><Pencil size={16} /></span> Editar
                          </button>
                        )}

                        {/* Operador nunca vê o botão excluir. O Admin vê em todos, menos no próprio dele. */}
                        {!isOperador && !isMe && (
                          <button className="btn btn-danger btn-sm" onClick={() => excluirUsuario(u.id, u.nome)}>
                            <span className="icon"><Trash2 size={16} /></span> Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL DE EDIÇÃO --- */}
      {editModalOpen && (
        <div className="modal-overlay open">
          <div className="modal modal-md">
            <h2>Editar Usuário</h2>
            <p className="text-muted-sm mb-4">Deixe a senha em branco para não alterar.</p>
            
            <div className="form-grid mb-4">
              <div className="form-group">
                <label>Nome completo *</label>
                <input type="text" value={editNome} onChange={e => setEditNome(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Login *</label>
                <input type="text" value={editLogin} onChange={e => setEditLogin(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Nova senha (opcional)</label>
                <input type="password" placeholder="Deixe em branco para manter" value={editSenha} onChange={e => setEditSenha(e.target.value)} />
              </div>
              
              {!isOperador && (
                <div className="form-group">
                  <label>Perfil *</label>
                  <select value={editPerfil} onChange={e => setEditPerfil(e.target.value)}>
                    <option value="operador">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              )}
              {isOperador && (
                <div className="form-group">
                  <label>Perfil *</label>
                  <input type="text" value="Operador" disabled />
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarEdicaoUsuario}>
                <span className="icon"><Save size={16} /></span> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}