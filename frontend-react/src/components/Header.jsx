import { useState, useEffect, useRef } from 'react';
import { Menu, User, LayoutDashboard, ArrowLeftRight, Laptop, Users as UsersIcon, Clock, ChevronDown, Database, Activity, LogOut, Settings, CalendarDays } from 'lucide-react';

export default function Header({ usuarioLogado, fazerLogout, goTo, currentPage, state }) {
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Controle do menu suspenso de Gerenciar
  const [gerenciarOpen, setGerenciarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const userMenuMobileRef = useRef(null);
  const userMenuDesktopRef = useRef(null);

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
      const isOutsideMobile = !userMenuMobileRef.current || !userMenuMobileRef.current.contains(event.target);
      const isOutsideDesktop = !userMenuDesktopRef.current || !userMenuDesktopRef.current.contains(event.target);
      if (isOutsideMobile && isOutsideDesktop) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNav = (page) => {
    goTo(page);
    setMenuOpen(false);      // Fecha o drawer no mobile ao clicar
    setGerenciarOpen(false); // Fecha o menu suspenso Gerenciar
    setUserMenuOpen(false);  // Fecha o menu de usuário
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

      {/* Overlay Escuro para o Drawer (Mobile) */}
      {isMobile && menuOpen && (
        <div className="drawer-overlay" onClick={() => setMenuOpen(false)}></div>
      )}

      {/* Desktop: abas de navegação / Mobile: drawer */}
      <nav id="main-nav" className={menuOpen ? 'open' : ''}>
        
        {/* Card do usuário (mobile) */}
        <div className="drawer-logo drawer-header">
          <span className="brand-1">Chrome</span><span className="brand-2">Control</span>
        </div>
        
        <div id="drawer-user-card" className="mb-3 dropdown-container" ref={userMenuMobileRef}>
          <div 
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="user-card-mobile"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
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
            <ChevronDown size={14} style={{ opacity: 0.5, transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>

          {userMenuOpen && (
            <div className="dropdown-menu" style={{ 
              position: 'static', width: '100%', boxShadow: 'none', border: 'none', 
              marginTop: '0.25rem', backgroundColor: 'transparent' 
            }}>
              <div className="dropdown-item" onClick={() => handleNav('usuarios')} style={{ paddingLeft: '3.5rem' }}>
                <UsersIcon size={16} style={{ opacity: 0.7 }} /> Gestão de Usuários
              </div>
              <div className="dropdown-item" onClick={() => handleNav('historico')} style={{ paddingLeft: '3.5rem' }}>
                <Clock size={16} style={{ opacity: 0.7 }} /> Histórico de Ações
              </div>
              {isAdmin && (
                <div className="dropdown-item" onClick={() => handleNav('logs')} style={{ paddingLeft: '3.5rem' }}>
                  <Activity size={16} style={{ opacity: 0.7 }} /> Logs de Ações
                </div>
              )}
              <div className="dropdown-item" onClick={() => handleNav('configuracoes')} style={{ paddingLeft: '3.5rem' }}>
                <Settings size={16} style={{ opacity: 0.7 }} /> Configurações
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.25rem 0' }}></div>
              <div className="dropdown-item" onClick={fazerLogout} style={{ paddingLeft: '3.5rem', color: 'var(--danger)' }}>
                <LogOut size={16} style={{ opacity: 0.8 }} /> Sair do Sistema
              </div>
            </div>
          )}
        </div>

        {/* Botões de Navegação */}
        <button className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => handleNav('dashboard')}>
          <span className="icon"><LayoutDashboard size={16} /></span> Dashboard
        </button>
        
        <button className={`nav-btn ${currentPage === 'emprestimos' ? 'active' : ''}`} onClick={() => handleNav('emprestimos')}>
          <span className="icon"><ArrowLeftRight size={16} /></span> Empréstimos <span className="badge">{state.emprestimos.length}</span>
        </button>

        <button className={`nav-btn ${currentPage === 'agenda' ? 'active' : ''}`} onClick={() => handleNav('agenda')}>
          <span className="icon"><CalendarDays size={16} /></span> Agenda
        </button>

        {/* --- MENU SUSPENSO: GERENCIAR --- */}
        <div className="dropdown-container" ref={dropdownRef} style={{ width: isMobile ? '100%' : 'auto' }}>
          <button 
            className={`nav-btn ${isGerenciarActive ? 'active' : ''}`} 
            style={{ width: '100%', justifyContent: isMobile ? 'space-between' : 'flex-start' }}
            onClick={() => setGerenciarOpen(!gerenciarOpen)}
          >
            <div className="flex-center-gap-sm">
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
                <span className="badge ml-auto">{state.chromebooks.length}</span>
              </div>
              <div className="dropdown-item" onClick={() => handleNav('professores')} style={{ paddingLeft: isMobile ? '2.5rem' : '1rem' }}>
                <UsersIcon size={16} style={{ opacity: 0.7 }} /> Responsáveis
                <span className="badge ml-auto">{state.professores.length}</span>
              </div>
            </div>
          )}
        </div>

      </nav>

      {/* Desktop: nome/perfil do usuário */}
      {/* Desktop: nome/perfil do usuário */}
      <div className="dropdown-container" ref={userMenuDesktopRef}>
        <button 
          id="user-info-desktop" 
          className="user-info-desktop"
          onClick={() => setUserMenuOpen(!userMenuOpen)}
        >
          <div className="avatar-circle">
            <span className="icon"><User size={16} /></span>
          </div>
          <div className="text-left" style={{ marginRight: '0.5rem' }}>
            <div className="user-name">{usuarioLogado?.nome}</div>
            <div className="user-role">{isAdmin ? '⭐ Administrador' : 'Operador'}</div>
          </div>
          <ChevronDown size={14} style={{ opacity: 0.5, transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {userMenuOpen && (
          <div className="dropdown-menu" style={{ 
            position: 'absolute', right: 0, width: '220px', marginTop: '0.5rem' 
          }}>
            <div className="dropdown-item" onClick={() => handleNav('usuarios')}>
              <UsersIcon size={16} style={{ opacity: 0.7 }} /> Gestão de Usuários
            </div>
            <div className="dropdown-item" onClick={() => handleNav('historico')}>
              <Clock size={16} style={{ opacity: 0.7 }} /> Histórico de Ações
            </div>
            {isAdmin && (
              <div className="dropdown-item" onClick={() => handleNav('logs')}>
                <Activity size={16} style={{ opacity: 0.7 }} /> Logs de Ações
              </div>
            )}
            <div className="dropdown-item" onClick={() => handleNav('configuracoes')}>
              <Settings size={16} style={{ opacity: 0.7 }} /> Configurações
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.25rem 0' }}></div>
            <div className="dropdown-item" onClick={fazerLogout} style={{ color: 'var(--danger)' }}>
              <LogOut size={16} style={{ opacity: 0.8 }} /> Sair do Sistema
            </div>
          </div>
        )}
      </div>
    </header>
  );
}