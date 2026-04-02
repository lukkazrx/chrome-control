import { useState, useEffect, useRef } from 'react';
import { Menu, User, LayoutDashboard, ArrowLeftRight, Laptop, Users as UsersIcon, Clock, ChevronDown, Database, Activity } from 'lucide-react';

export default function Header({ usuarioLogado, fazerLogout, goTo, currentPage, state }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Controle do menu suspenso de Gerenciar
  const [gerenciarOpen, setGerenciarOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isAdmin = usuarioLogado?.perfil === 'admin';

  // Fecha o drawer principal se a tela for redimensionada para desktop
  useEffect(() => {
    const handleResize = () => { 
      if (window.innerWidth > 768) {
        setMenuOpen(false); 
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Inteligência para fechar o menu suspenso se clicar fora dele
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setGerenciarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNav = (page) => {
    goTo(page);
    setMenuOpen(false);      // Fecha o drawer no mobile ao clicar
    setGerenciarOpen(false); // Fecha o menu suspenso Gerenciar
  };

  // Verifica qual aba está ativa para acender os botões principais
  const isGerenciarActive = currentPage === 'chromebooks' || currentPage === 'professores';
  const isHistoricoActive = currentPage === 'historico' || currentPage === 'auditorias';

  // Verifica se estamos no celular para mudar o comportamento do menu suspenso
  const isMobile = window.innerWidth <= 768;

  return (
    <header>
      {/* Mobile: hambúrguer */}
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
        <span className="icon icon-lg"><Menu size={20} /></span>
      </button>

      {/* Logo (sempre visível) */}
      <div className="logo"><span className="brand-1">Chrome</span><span className="brand-2">Control</span></div>

      {/* Desktop: abas de navegação / Mobile: drawer */}
      <nav id="main-nav" className={menuOpen ? 'open' : ''}>
        
        {/* Card do usuário (mobile) */}
        <div className="drawer-logo drawer-header">
          <span className="brand-1">Chrome</span><span className="brand-2">Control</span>
        </div>
        
        <div id="drawer-user-card" className="mb-3">
          <div 
            onClick={() => handleNav('usuarios')}
            className="user-card-mobile"
          >
            <div className="user-profile-layout">
              <div className="avatar-circle">
                <span className="icon"><User size={16} /></span>
              </div>
              <div>
                <div className="user-name">{usuarioLogado?.nome}</div>
                <div className="user-role">{isAdmin ? '⭐ Administrador' : 'Operador'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Botões de Navegação */}
        <button className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => handleNav('dashboard')}>
          <span className="icon"><LayoutDashboard size={16} /></span> Dashboard
        </button>
        
        <button className={`nav-btn ${currentPage === 'emprestimos' ? 'active' : ''}`} onClick={() => handleNav('emprestimos')}>
          <span className="icon"><ArrowLeftRight size={16} /></span> Empréstimos <span className="badge">{state.emprestimos.length}</span>
        </button>

        {/* --- MENU SUSPENSO: GERENCIAR --- */}
        <div className="dropdown-container" ref={dropdownRef} style={{ width: isMobile ? '100%' : 'auto' }}>
          <button 
            className={`nav-btn ${isGerenciarActive ? 'active' : ''}`} 
            style={{ width: '100%', justifyContent: isMobile ? 'space-between' : 'flex-start' }}
            onClick={() => setGerenciarOpen(!gerenciarOpen)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="icon"><Database size={16} /></span> Gerenciar
            </div>
            <ChevronDown size={14} style={{ marginLeft: isMobile ? '0' : '4px', transform: gerenciarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {gerenciarOpen && (
            <div className="dropdown-menu" style={{ 
              position: isMobile ? 'static' : 'absolute',
              width: isMobile ? '100%' : '200px',
              boxShadow: isMobile ? 'none' : undefined,
              border: isMobile ? 'none' : undefined,
              marginTop: isMobile ? '0' : '0.5rem',
              backgroundColor: isMobile ? 'transparent' : 'var(--surface2)'
            }}>
              <div className="dropdown-item" onClick={() => handleNav('chromebooks')} style={{ paddingLeft: isMobile ? '2.5rem' : '1rem' }}>
                <Laptop size={16} style={{ opacity: 0.7 }} /> Equipamentos
                <span className="badge" style={{ marginLeft: 'auto' }}>{state.chromebooks.length}</span>
              </div>
              <div className="dropdown-item" onClick={() => handleNav('professores')} style={{ paddingLeft: isMobile ? '2.5rem' : '1rem' }}>
                <UsersIcon size={16} style={{ opacity: 0.7 }} /> Responsáveis
                <span className="badge" style={{ marginLeft: 'auto' }}>{state.professores.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* --- BOTÃO SIMPLES: HISTÓRICO --- */}
        <button className={`nav-btn ${isHistoricoActive ? 'active' : ''}`} onClick={() => handleNav('historico')}>
          <span className="icon"><Clock size={16} /></span> Histórico
        </button>

        {isAdmin && (
          <button className={`nav-btn ${currentPage === 'logs' ? 'active' : ''}`} onClick={() => handleNav('logs')}>
            <span className="icon"><Activity size={16} /></span> Logs de Ações
          </button>
        )}
      </nav>

      {/* Desktop: nome/perfil do usuário */}
      <button 
        id="user-info-desktop" 
        className="user-info-desktop"
        onClick={() => handleNav('usuarios')}
      >
        <div className="avatar-circle">
          <span className="icon"><User size={16} /></span>
        </div>
        <div className="text-left">
          <div className="user-name">{usuarioLogado?.nome}</div>
          <div className="user-role">{isAdmin ? '⭐ Administrador' : 'Operador'}</div>
        </div>
      </button>
    </header>
  );
}