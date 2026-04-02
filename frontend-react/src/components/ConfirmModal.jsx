import { useState, useEffect } from 'react';

export default function ConfirmModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState('');
  
  // Guardamos a função que será executada ao confirmar
  const [onConfirmAction, setOnConfirmAction] = useState(null);

  useEffect(() => {
    const handleShow = (e) => {
      setTitle(e.detail.title);
      setMsg(e.detail.msg);
      
      // No React, para guardar uma função no state, temos de passar 
      // uma função que retorna a nossa função, para evitar que ela seja executada imediatamente
      setOnConfirmAction(() => e.detail.onConfirm); 
      
      setIsOpen(true);
    };

    window.addEventListener('show-confirm', handleShow);
    return () => window.removeEventListener('show-confirm', handleShow);
  }, []);

  const handleConfirm = () => {
    if (onConfirmAction) onConfirmAction(); // Executa a ação pendente
    setIsOpen(false); // Fecha o modal
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open">
      <div className="modal">
        <h2>{title}</h2>
        <p>{msg}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={handleCancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={handleConfirm}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}