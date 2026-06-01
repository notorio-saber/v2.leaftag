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
        <h2 style={{ color: 'var(--primary-hover)', marginBottom: '12px', fontSize: '22px', fontWeight: '800' }}>Ativar Conta</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '24px' }}>
          Para começar a coletar e gerenciar seus inventários florestais, por favor ative sua conta. Clique no botão abaixo para falar conosco diretamente pelo WhatsApp.
        </p>

        <a 
          href="https://wa.me/5547920022746?text=Olá!%20Acabei%20de%20criar%20uma%20conta%20no%20LeafTag%20e%20gostaria%20de%20solicitar%20a%20ativação."
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
            boxShadow: '0 4px 15px rgba(37, 211, 102, 0.1)',
            fontWeight: 'bold'
          }}
        >
          Ativar pelo WhatsApp
        </a>

        <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={signOut}>
          Sair da Conta
        </button>
      </div>
    </div>
  );
};
