// src/App.jsx
import { useState, useEffect } from 'react';
import { GET, PUT , POST, getToken, setToken, clearToken } from './api';
import './style.css'; 
import { toast } from './utils/toast.js';
import { openConfirm } from './utils/confirm.js';

import LoginScreen from './components/LoginScreen.jsx';
import Header from './components/Header.jsx';
import Dashboard from './components/Dashboard.jsx';
import Emprestimos from './components/Emprestimos.jsx';
import Chromebooks from './components/Chromebooks.jsx';
import Professores from './components/Professores.jsx';
import Historico from './components/Historico.jsx';
import Usuarios from './components/Usuarios.jsx';
import Logs from './components/Logs.jsx';
import Configuracoes from './components/Configuracoes.jsx';
import Agendamentos from './components/Agendamentos.jsx';
import AgendaPublica from './components/AgendaPublica.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import ToastContainer from './components/ToastContainer.jsx';

// Wrapper para detectar rota pública sem violar regra dos hooks
function AppRoot() {
  if (window.location.pathname.startsWith('/agenda')) {
    return <AgendaPublica />;
  }
  return <App />;
}

export default AppRoot;

function App() {

  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  
  const [state, setState] = useState({
    chromebooks: [],
    professores: [],
    emprestimos: [],
    historico: [],
    auditorias: [], 
    configuracoes: {},
  });

  const [loginErro, setLoginErro] = useState('');

  useEffect(() => {
    const token = getToken();
    if (token) {
      GET('/auth/me')
        .then(u => {
          if (u) {
            setUsuarioLogado(u);
            carregarTudo();
          } else {
            fazerLogout();
          }
        })
        .catch(() => fazerLogout());
    }

    window.addEventListener('auth-error', fazerLogout);

    const intervalo = setInterval(() => {
      if (getToken()) {
        carregarTudo();
      }
    }, 5000); 

    return () => {
      window.removeEventListener('auth-error', fazerLogout);
      clearInterval(intervalo);
    };
  }, []);

  async function fazerLogin(login, senha) {
    if (!login || !senha) {
      setLoginErro('Informe login e senha.');
      return;
    }
    try {
      const res = await POST('/auth/login', { login, senha });
      setToken(res.token);
      setUsuarioLogado(res.usuario);
      setLoginErro('');
      carregarTudo();
    } catch (err) {
      setLoginErro(err.message || 'Não foi possível conectar ao servidor.');
    }
  }

  function fazerLogout() {
    clearToken();
    setUsuarioLogado(null);
    // Zera tudo, incluindo configs
    setState({ chromebooks: [], professores: [], emprestimos: [], historico: [], auditorias: [], configuracoes: {} });
  }

  async function carregarTudo() {
    try {
      const [cbs, profs, emps, hist, auds, confs] = await Promise.all([
        GET('/chromebooks'),
        GET('/professores'),
        GET('/emprestimos'),
        GET('/emprestimos/historico'),
        GET('/auditorias'),
        GET('/configuracoes'),
      ]);
      setState({ chromebooks: cbs, professores: profs, emprestimos: emps, historico: hist, auditorias: auds, configuracoes: confs });
    } catch (err) {
      console.error(err);
    }
  }

  function goTo(page) {
    setCurrentPage(page);
  }

  if (!usuarioLogado) {
    return <LoginScreen fazerLogin={fazerLogin} erro={loginErro} />;
  }

  async function editarEmprestimoGlobal(id, dadosEditados) {
    try {
      const empOriginal = state.emprestimos.find(e => e.id === id);
      const atualizado = await PUT(`/emprestimos/${id}/editar`, dadosEditados);

      setState(prev => {
        const novosEmprestimos = prev.emprestimos.map(e => e.id === id ? atualizado : e);
        const novoHistorico = prev.historico.map(h => h.id === id ? atualizado : h);

        const idsOriginais = empOriginal.chromebooks.map(c => c.id);
        const idsNovos = atualizado.chromebooks.map(c => c.id);

        const novosCBs = prev.chromebooks.map(c => {
          if (idsNovos.includes(c.id)) return { ...c, status: 'emprestado' };
          if (idsOriginais.includes(c.id) && !idsNovos.includes(c.id)) return { ...c, status: 'disponivel' };
          return c;
        });

        return { ...prev, emprestimos: novosEmprestimos, historico: novoHistorico, chromebooks: novosCBs };
      });
      toast('Empréstimo atualizado com sucesso!');
    } catch (err) { 
      toast(err.message, 'error'); 
    }
  }

  function devolverEmprestimoGlobal(emp) {
    openConfirm('Confirmar Devolução', `Deseja devolver ${emp.chromebooks.length} Chromebook(s) de ${emp.professorNome}?`, async () => {
      try {
        const atualizado = await PUT(`/emprestimos/${emp.id}/devolver`, {
          devolvidoPor: usuarioLogado?.nome
        });
        
        setState(prev => {
          const novosCBs = prev.chromebooks.map(c => 
            emp.chromebooks.some(ec => ec.id === c.id) ? { ...c, status: 'disponivel' } : c
          );
          return {
            ...prev,
            emprestimos: prev.emprestimos.filter(e => e.id !== emp.id),
            historico: prev.historico.map(h => h.id === emp.id ? atualizado : h),
            chromebooks: novosCBs
          };
        });
        toast('Devolução registrada com sucesso!');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function enviarLembreteGlobal(emp) {
    const prof = state.professores.find(p => p.id === emp.professorId);
    if (!prof?.email) {
      toast('Este responsável não possui e-mail cadastrado.', 'warn'); 
      return;
    }
    try {
      await POST('/email/lembrete', {
        professorEmail: prof.email,
        professorNome: emp.professorNome,
        turma: emp.professorTurma,
        tipo: emp.professorTipo,
        materia: emp.professorMateria,
        chromebooks: emp.chromebooks,
        dataRetirada: emp.dataRetirada,
        obs: emp.obs,
      });
      toast(`📧 Lembrete enviado para ${prof.email}!`);
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <>
      <Header 
        usuarioLogado={usuarioLogado} 
        fazerLogout={fazerLogout} 
        goTo={goTo} 
        currentPage={currentPage}
        state={state}
      />
      <main>
        {currentPage === 'dashboard' && <Dashboard state={state} editarEmprestimo={editarEmprestimoGlobal} devolverEmprestimo={devolverEmprestimoGlobal} enviarLembrete={enviarLembreteGlobal} />}
        
        {currentPage === 'emprestimos' && <Emprestimos state={state} setState={setState} usuarioLogado={usuarioLogado} editarEmprestimo={editarEmprestimoGlobal} devolverEmprestimo={devolverEmprestimoGlobal} enviarLembrete={enviarLembreteGlobal} />}
        
        {currentPage === 'chromebooks' && <Chromebooks state={state} setState={setState} usuarioLogado={usuarioLogado} />}
        {currentPage === 'professores' && <Professores state={state} setState={setState} usuarioLogado={usuarioLogado} />}
        
        {/* ATUALIZADO: Histórico e Auditorias caem no mesmo componente, só muda a aba! */}
        {(currentPage === 'historico' || currentPage === 'auditorias') && (
          <Historico state={state} setState={setState} abaAtiva={currentPage} goTo={goTo} />
        )}
        
        {currentPage === 'usuarios' && <Usuarios usuarioLogado={usuarioLogado} fazerLogout={fazerLogout} />}
        {currentPage === 'logs' && <Logs usuarioLogado={usuarioLogado} />}
        {currentPage === 'configuracoes' && <Configuracoes state={state} setState={setState} usuarioLogado={usuarioLogado} />}
        {currentPage === 'agenda' && <Agendamentos state={state} usuarioLogado={usuarioLogado} />}
      </main>
      
      <ToastContainer />
      <ConfirmModal />
    </>
  );
}