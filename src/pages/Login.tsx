import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export const Login = () => {
  const { currentUser, loginWithGoogle, loading, status } = useAuth();

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-card" style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
          <h3 style={{ color: 'var(--primary-hover)', marginBottom: '8px' }}>Carregando...</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Iniciando motores LeafTag</span>
        </div>
      </div>
    );
  }

  // Redirecionamentos com base no status do usuário logado
  if (currentUser) {
    if (status === 'pending') {
      return <Navigate to="/pending" />;
    } else if (status === 'admin' || status === 'active') {
      return <Navigate to="/" />;
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent', position: 'relative', overflowX: 'hidden' }}>
      {/* Background blobs explicitly matching the DS */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: -1 }}>
        <div style={{ position: 'absolute', top: '15%', left: '15%', width: '380px', height: '380px', background: 'rgba(46, 125, 50, 0.15)', borderRadius: '50%', filter: 'blur(130px)' }}></div>
        <div style={{ position: 'absolute', bottom: '15%', right: '15%', width: '320px', height: '320px', background: 'rgba(0, 150, 136, 0.08)', borderRadius: '50%', filter: 'blur(110px)' }}></div>
      </div>

      {/* Header */}
      <header style={{ 
        padding: '20px 24px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)', 
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: 'rgba(2, 5, 3, 0.4)',
        width: '100%', 
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '1200px', margin: '0 auto', width: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo.png" alt="LeafTag" style={{ width: '38px', height: '38px', borderRadius: '8px', boxShadow: '0 0 15px var(--primary-glow)' }} />
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1.5px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>LeafTag</span>
          </div>
          <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={loginWithGoogle}>
            Acessar
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Badge Developed By */}
        <div style={{ 
          background: 'rgba(46, 125, 50, 0.08)', 
          color: 'var(--primary-hover)', 
          padding: '6px 16px', 
          borderRadius: '100px', 
          fontSize: '11px', 
          marginBottom: '28px', 
          border: '1px solid rgba(46, 125, 50, 0.3)', 
          textTransform: 'uppercase', 
          letterSpacing: '1.5px', 
          fontWeight: '800',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          EcoAds • Soluções Ambientais
        </div>
        
        <h1 style={{ 
          fontSize: 'clamp(32px, 5vw, 54px)', 
          lineHeight: 1.15, 
          marginBottom: '20px', 
          maxWidth: '820px', 
          color: '#ffffff', 
          fontWeight: '800',
          letterSpacing: '-0.04em',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          O padrão profissional para <span style={{ 
            background: 'linear-gradient(135deg, #a5d6a7 0%, #4caf50 50%, #2e7d32 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>inventários florestais</span>.
        </h1>
        
        <p style={{ 
          fontSize: '17px', 
          color: 'var(--text-muted)', 
          maxWidth: '650px', 
          marginBottom: '36px', 
          lineHeight: 1.6,
          fontFamily: "'Inter', sans-serif"
        }}>
          Coleta rápida, processamento automático e relatórios analíticos florestais estruturados direto no celular. 
          Totalmente integrado com inteligência de dados e suficiência amostral.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '400px' }}>
          <button className="btn btn-primary" style={{ padding: '16px 36px', fontSize: '13px', boxShadow: '0 8px 25px rgba(46, 125, 50, 0.25)' }} onClick={loginWithGoogle}>
            Iniciar com Conta Google
          </button>
        </div>

        {/* Reforço de Posicionamento Técnico */}
        <div style={{ marginTop: '36px', color: '#6e7671', fontSize: '13px', maxWidth: '600px', lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}>
          Desenvolvido especificamente para Engenharia Florestal e Estudos Ambientais.<br/>
          Opera offline com sincronismo em tempo real ao restabelecer conexão.
        </div>

        {/* Features Cards Grid matching DS (Rounded 24px) */}
        <div style={{ 
          marginTop: '70px', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', 
          gap: '24px', 
          width: '100%', 
          textAlign: 'left' 
        }}>
          <div className="glass-card">
            <div style={{ height: '3px', background: 'var(--primary-color)', width: '32px', borderRadius: '4px', marginBottom: '20px' }}></div>
            <h3 style={{ color: 'white', marginBottom: '10px', fontSize: '18px', fontWeight: '700' }}>Coleta Mobile Fluida</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: 1.6 }}>
              Registre DAP, CAP, fustes secundários bifurcados, alturas comerciais e coordenadas GPS. 
              Substitui cadernos e planilhas instáveis de campo com segurança profissional.
            </p>
          </div>

          <div className="glass-card">
            <div style={{ height: '3px', background: 'var(--primary-color)', width: '32px', borderRadius: '4px', marginBottom: '20px' }}></div>
            <h3 style={{ color: 'white', marginBottom: '10px', fontSize: '18px', fontWeight: '700' }}>Processamento Imediato</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: 1.6 }}>
              Cálculo imediato de área basal, distribuição diamétrica, volume estimado por fator de forma, e índices de Shannon e Simpson. 
              Exportação limpa de planilhas formatadas (.xlsx).
            </p>
          </div>

          <div className="glass-card">
            <div style={{ height: '3px', background: 'var(--primary-color)', width: '32px', borderRadius: '4px', marginBottom: '20px' }}></div>
            <h3 style={{ color: 'white', marginBottom: '10px', fontSize: '18px', fontWeight: '700' }}>Curva do Coletor Real-Time</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: 1.6 }}>
              Validação matemática instantânea da suficiência amostral por estabilização de assíntota de espécies. 
              Saiba exatamente quando interromper a amostragem em campo.
            </p>
          </div>
        </div>

        {/* Autoridade EcoAds Block */}
        <div className="glass-card" style={{ 
          marginTop: '70px', 
          textAlign: 'center', 
          padding: '48px 32px', 
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(46, 125, 50, 0.12) !important'
        }}>
          <h2 style={{ color: 'var(--primary-hover)', marginBottom: '18px', fontSize: '24px', fontWeight: '800' }}>Ecossistema de Tecnologia Florestal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, maxWidth: '700px', margin: '0 auto 28px' }}>
            O LeafTag foi projetado e refinado pela EcoAds. Estruturado por engenheiros com experiência de campo para eliminar retrabalho em escritório e digitalizar inventários com precisão acadêmica e industrial.
          </p>
          <div className="card-divider"></div>
          <h3 style={{ color: '#ffffff', fontSize: '18px', marginTop: '24px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
            Chega de digitação manual de cadernos de campo.
          </h3>
          <button className="btn btn-primary" style={{ padding: '14px 32px', width: 'auto', marginTop: '24px' }} onClick={loginWithGoogle}>
            Acessar a Plataforma
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ 
        padding: '30px 24px', 
        textAlign: 'center', 
        borderTop: '1px solid rgba(255, 255, 255, 0.06)', 
        background: 'rgba(2, 5, 3, 0.8)', 
        color: '#6e7671', 
        fontSize: '13px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <span><strong>LeafTag</strong> &copy; {new Date().getFullYear()}</span>
          <span>Tecnologia Florestal Inteligente • <strong>EcoAds</strong></span>
        </div>
      </footer>
    </div>
  );
};
