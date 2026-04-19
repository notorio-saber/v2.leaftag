import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export const PendingAccess = () => {
  const { status, signOut } = useAuth();

  if (status === 'active' || status === 'admin') {
    return <Navigate to="/" />;
  }

  const handleWhatsapp = () => {
    window.open("https://wa.me/5547920022746?text=Ol%C3%A1%2C%20criei%20minha%20conta%20no%20LeafTag%20e%20preciso%20de%20%2Aaprova%C3%A7%C3%A3o%2A%20de%20acesso%21", "_blank");
  };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center' }}>
      <div className="glass-card" style={{ textAlign: 'center', border: '1px solid var(--accent-color)' }}>
        <h2 style={{ color: 'var(--accent-color)', marginBottom: '16px' }}>Área de Ativação</h2>
        <p style={{ color: 'var(--text-main)', marginBottom: '8px' }}>Seu registro está pendente no nosso sistema.</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' }}>
          O acesso total foi protegido pelo administrador. Fale com ele para ativar sua conta de campo!
        </p>
        
        <button className="btn btn-primary" style={{ background: '#25D366', color: '#fff', marginBottom: '16px' }} onClick={handleWhatsapp}>
          📲 Pedir Liberação via WhatsApp
        </button>
        
        <button className="btn btn-secondary" onClick={signOut}>
          Sair da Conta
        </button>
      </div>
    </div>
  );
};
