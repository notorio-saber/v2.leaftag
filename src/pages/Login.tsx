import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export const Login = () => {
  const { currentUser, loginWithGoogle, loading, status } = useAuth();

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <h2>Carregando sistema...</h2>
      </div>
    );
  }

  // Redirecionamentos com base no status do usuário logado
  if (currentUser) {
    if (status === 'pending') {
      return <Navigate to="/pending" />;
    } else if (status === 'admin' || status === 'active') {
      return <Navigate to="/" />; // Vai pra Home principal
    }
  }

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center' }}>
      <div className="glass-card" style={{ textAlign: 'center' }}>
        <img src="/logo.png" alt="LeafTag Logo" style={{ width: '80px', height: '80px', margin: '0 auto 16px', display: 'block', borderRadius: '12px' }} />
        <h1 style={{ color: 'var(--primary-color)', marginBottom: '8px' }}>LeafTag</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Acesso restrito a engenheiros e coletores autorizados.</p>
        
        <button className="btn btn-primary" onClick={loginWithGoogle}>
          Fazer login com Google
        </button>
      </div>
    </div>
  );
};
