import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export const PendingAccess = () => {
  const { status, signOut } = useAuth();

  if (status === 'active' || status === 'admin') {
    return <Navigate to="/" />;
  }

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center' }}>
      <div className="glass-card" style={{ textAlign: 'center' }}>
        <div style={{ height: '3px', background: 'var(--primary-color)', width: '48px', margin: '0 auto 20px' }}></div>
        <h2 style={{ color: 'var(--primary-color)', marginBottom: '8px' }}>Acesso Pendente</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Sua conta foi criada com sucesso, mas você precisa da aprovação do administrador para acessar os trabalhos de campo.
        </p>

        <a 
          href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20acabei%20de%20criar%20uma%20conta%20no%20LeafTag%20e%20gostaria%20de%20solicitar%20a%20libera%C3%A7%C3%A3o%20de%20acesso."
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ textDecoration: 'none', display: 'block', marginTop: '24px', backgroundColor: '#25D366' }}
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
