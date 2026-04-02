import { useState, useEffect } from 'react';
import { GET } from '../api';
import { Activity, RefreshCw } from 'lucide-react';
import { toast } from '../utils/toast';

export default function Logs({ usuarioLogado }) {
  const [logs, setLogs] = useState([]);
  const [carregando, setCarregando] = useState(true);

  if (usuarioLogado?.perfil !== 'admin') {
    return (
      <div className="card text-center" style={{ marginTop: '2rem' }}>
        <h3>Acesso Restrito</h3>
        <p>Apenas administradores podem visualizar o histórico de sistema.</p>
      </div>
    );
  }

  async function fetchLogs() {
    setCarregando(true);
    try {
      const data = await GET('/logs');
      setLogs(data);
    } catch (err) {
      toast('Erro ao buscar logs de ações do sistema', 'error');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <section className="page active" id="page-logs">
      <div className="page-header">
        <div>
          <h1><Activity size={24} style={{ display: 'inline', verticalAlign: 'bottom', marginRight: '8px' }} /> Registro de Atividades</h1>
          <p>Trilha de auditoria - Últimas 200 ações realizadas no sistema.</p>
        </div>
        <button className="btn btn-ghost" onClick={fetchLogs} disabled={carregando}>
          <RefreshCw size={16} className={carregando ? 'icon-spin' : ''} /> 
          {carregando ? ' Atualizando...' : ' Atualizar Agora'}
        </button>
      </div>

      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Operador</th>
                <th>Ação Executada</th>
                <th>Entidade Afetada</th>
                <th>Detalhes Técnicos</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && !carregando ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty" style={{ padding: '2rem 1rem' }}>
                      <div className="empty-icon"><Activity size={40} /></div>
                      <p>Nenhuma ação registrada nas trilhas de auditoria ainda.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  return (
                    <tr key={log.id}>
                      <td className="text-mono-sm">
                        {new Date(log.data_hora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="font-medium">
                        {log.operador_nome}
                      </td>
                      <td>
                        <span className="sel-tag" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-block' }}>
                          {log.acao}
                        </span>
                      </td>
                      <td className="text-muted-sm" style={{ fontWeight: '500' }}>{log.entidade || '-'}</td>
                      <td className="text-muted-sm" style={{ fontSize: '0.8rem' }}>{log.detalhes || '-'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
