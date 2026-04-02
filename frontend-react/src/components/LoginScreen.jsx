import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function LoginScreen({ fazerLogin, erro }) {
  const [loginInput, setLoginInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') fazerLogin(loginInput, senhaInput);
  };

  return (
    <div id="login-screen" className="login-screen-overlay">
      <div className="login-card">
        
        <div className="login-header">
          <div className="login-logo">
            <span className="brand-1">Chrome</span><span className="brand-2">Control</span>
          </div>
          <p className="text-muted-sm">Faça login para continuar</p>
        </div>

        <div className="login-form-container">
          <div className="form-group">
            <label>Login</label>
            <input 
              type="text" 
              placeholder="seu login" 
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              onKeyDown={handleKeyDown} 
            />
          </div>
          
          <div className="form-group">
            <label>Senha</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={senhaInput}
              onChange={(e) => setSenhaInput(e.target.value)}
              onKeyDown={handleKeyDown} 
            />
          </div>
          
          {erro && (
            <div id="login-erro" className="error-box">
              {erro}
            </div>
          )}
          
          <button className="btn btn-primary btn-block" onClick={() => fazerLogin(loginInput, senhaInput)}>
            Entrar <span className="icon"><ArrowRight size={16} /></span>
          </button>
        </div>

      </div>
    </div>
  );
}