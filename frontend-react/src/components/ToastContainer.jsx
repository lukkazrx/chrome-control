import { useState, useEffect } from 'react';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const { msg, type } = e.detail;
      const id = Date.now() + Math.random(); // ID único para o React não se perder

      // Adiciona o novo toast ao estado
      setToasts((prev) => [...prev, { id, msg, type }]);

      // Remove automaticamente após 3 segundos (exatamente como no seu código original)
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    };

    // Fica a escutar o evento global
    window.addEventListener('show-toast', handleToast);
    
    // Limpeza ao desmontar
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  return (
    <div id="toast-container">
      {toasts.map((t) => (
        <div 
          key={t.id} 
          className={`toast ${t.type === 'error' ? 'error' : t.type === 'warn' ? 'warn' : ''}`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}