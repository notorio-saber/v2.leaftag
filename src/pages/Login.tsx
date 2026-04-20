import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export const Login = () => {
  const { currentUser, loginWithGoogle, loading, status } = useAuth();

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--primary-color)' }}>Iniciando motores...</h2>
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', overflowX: 'hidden' }}>
      {/* Header */}
      <header style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="LeafTag Logo" style={{ width: '40px', height: '40px', borderRadius: '8px' }} />
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--primary-color)' }}>LeafTag</span>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 24px', border: '1px solid #4fc3f7', color: '#4fc3f7' }} onClick={loginWithGoogle}>
          Acessar
        </button>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ background: 'rgba(76, 175, 80, 0.1)', color: 'var(--primary-color)', padding: '6px 16px', borderRadius: '20px', fontSize: '14px', marginBottom: '24px', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
          🌱 Desenvolvido por <strong>Ecoads</strong>
        </div>
        
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.1, marginBottom: '24px', maxWidth: '800px', color: '#fff' }}>
          O Cérebro Fitossociológico Supremo para <span style={{ color: 'var(--primary-color)' }}>Inventários Florestais</span>.
        </h1>
        
        <p style={{ fontSize: '18px', color: 'var(--text-muted)', maxWidth: '600px', marginBottom: '48px', lineHeight: 1.6 }}>
          A ferramenta mais avançada de coleta e processamento de dados de campo. Operação 100% offline, distribuição diamétrica instantânea, exportação de laudos gerados sob Padrão de Engenharia.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ padding: '16px 40px', fontSize: '18px', width: 'auto' }} onClick={loginWithGoogle}>
            Ativar Conta / Login Google
          </button>
        </div>

        <div style={{ marginTop: '80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', width: '100%', maxWidth: '1000px' }}>
           <div className="glass-card" style={{ padding: '32px', textAlign: 'left' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>📡</div>
              <h3 style={{ color: 'white', marginBottom: '12px' }}>100% Offline</h3>
              <p style={{ color: 'gray', fontSize: '14px', lineHeight: 1.5 }}>Trabalhe nos rincões mais remotos sem depender de sinal. Seus dados persistem criptografados no app, e sincronizam relatórios no retorno à civilização.</p>
           </div>
           <div className="glass-card" style={{ padding: '32px', textAlign: 'left' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>📊</div>
              <h3 style={{ color: 'white', marginBottom: '12px' }}>Dashboards Vivos</h3>
              <p style={{ color: 'gray', fontSize: '14px', lineHeight: 1.5 }}>Acompanhe índices de Shannon, Simpson, Pielou, Área Basal, Biometria global e identifique a assimptota na curva do coletor ao vivo.</p>
           </div>
           <div className="glass-card" style={{ padding: '32px', textAlign: 'left', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
              <h3 style={{ color: 'white', marginBottom: '12px' }}>Acesso Militar</h3>
              <p style={{ color: 'gray', fontSize: '14px', lineHeight: 1.5 }}>Suas matrizes comerciais blindadas. Novos avaliadores são recepcionados num funil de pendência e dependem da sua chave Mestra de Engenheiro para a ativação.</p>
           </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ padding: '32px 24px', textAlign: 'center', borderTop: '1px solid #1a1a1a', background: '#0a0d0b', color: '#666', fontSize: '14px' }}>
        <strong>LeafTag</strong> &copy; {new Date().getFullYear()} - Ecossistema inteligente <strong>Ecoads</strong>.
      </footer>
    </div>
  );
};
