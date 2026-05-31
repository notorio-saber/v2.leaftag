import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export const PendingAccess = () => {
  const { status, signOut } = useAuth();

  if (status === 'active' || status === 'admin') {
    return <Navigate to="/" />;
  }

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '90vh', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-card" style={{ textAlign: 'center', width: '100%', maxWidth: '420px', padding: '36px 28px' }}>
        <div style={{ height: '3px', background: 'var(--primary-color)', width: '48px', margin: '0 auto 24px', borderRadius: '4px' }}></div>
        <h2 style={{ color: 'var(--primary-hover)', marginBottom: '12px', fontSize: '22px', fontWeight: '800' }}>Acesso Pendente</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
          Sua conta foi criada no sistema, mas você precisa de aprovação de um administrador para visualizar e coletar os dados florestais.
        </p>

        <a 
          href="https://wa.me/5511999999999?text=Olá%2C%20acabei%20de%20criar%20uma%20conta%20no%20LeafTag%20e%20gostaria%20de%20solicitar%20a%20liberação%20de%20acesso."
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
          style={{ 
            textDecoration: 'none', 
            display: 'inline-flex', 
            marginTop: '16px', 
            backgroundColor: 'rgba(37, 211, 102, 0.15)', 
            border: '1px solid rgba(37, 211, 102, 0.45)', 
            color: '#25D366',
            boxShadow: '0 4px 15px rgba(37, 211, 102, 0.1)'
          }}
        >
          Solicitar Liberação no WhatsApp
        </a>

        <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={signOut}>
          Sair da Conta
        </button>
      </div>
    </div>
  );
};
