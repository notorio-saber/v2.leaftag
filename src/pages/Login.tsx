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
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 24px', border: '1px solid #4fc3f7', color: '#4fc3f7' }} onClick={loginWithGoogle}>
            Acessar Sistema
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ background: 'rgba(76, 175, 80, 0.1)', color: 'var(--primary-color)', padding: '6px 16px', borderRadius: '20px', fontSize: '14px', marginBottom: '24px', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
          🌱 Desenvolvido pela <strong>EcoAds</strong>
        </div>
        
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.1, marginBottom: '24px', maxWidth: '800px', color: '#fff' }}>
          O padrão profissional para <span style={{ color: 'var(--primary-color)' }}>inventários florestais</span>.
        </h1>
        
        <p style={{ fontSize: '18px', color: 'var(--text-muted)', maxWidth: '600px', marginBottom: '24px', lineHeight: 1.6 }}>
          Coleta, organiza e processa seus dados de campo automaticamente — direto no seu celular.
          Gere planilhas prontas, gráficos completos e análises fitossociológicas em segundos. <br/><br/>
          Com validação de suficiência amostral integrada.
        </p>

        <p style={{ fontSize: '16px', color: 'var(--primary-color)', fontWeight: 'bold', marginBottom: '48px' }}>
          👉 Pare de perder tempo com planilhas manuais. Trabalhe como engenheiro.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ padding: '16px 40px', fontSize: '18px', width: 'auto', background: '#2e7d32', color: 'white' }} onClick={loginWithGoogle}>
            Ativar Conta (Google)
          </button>
        </div>

        {/* Reforço Técnico */}
        <div style={{ marginTop: '32px', color: '#888', fontSize: '14px', maxWidth: '600px', lineHeight: 1.6 }}>
          A ferramenta mais avançada do Brasil para inventário florestal. <br/>
          Desenvolvida por especialistas do setor ambiental para uso real em campo. <br/>
          Funciona 100% offline, com sincronização automática e processamento instantâneo dos dados.
        </div>

        {/* Cards de Autoridade Técnica */}
        <div style={{ marginTop: '80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', width: '100%', maxWidth: '1000px', textAlign: 'left' }}>
           <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>🌲</div>
              <h3 style={{ color: 'white', marginBottom: '12px' }}>Coleta de Campo Profissional</h3>
              <p style={{ color: 'gray', fontSize: '14px', lineHeight: 1.5 }}>
                Registre árvores com nome popular, científico, DAP, altura, coordenadas e observações. 
                <br/>Tudo organizado e pronto para análise — mesmo sem internet.
              </p>
           </div>

           <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>📊</div>
              <h3 style={{ color: 'white', marginBottom: '12px' }}>Processamento Automático</h3>
              <div style={{ color: 'gray', fontSize: '14px', lineHeight: 1.6 }}>
                O LeafTag transforma seus dados em:
                <ul style={{ paddingLeft: '20px', marginTop: '8px', marginBottom: '8px' }}>
                  <li>Planilha completa pronta para exportação</li>
                  <li>Distribuição diamétrica e Área basal</li>
                  <li>Índices de Shannon, Simpson e Pielou</li>
                  <li>Gráficos prontos para relatório</li>
                </ul>
                <strong style={{ color: '#fff' }}>Sem Excel. Sem retrabalho.</strong>
              </div>
           </div>

           <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>📈</div>
              <h3 style={{ color: 'white', marginBottom: '12px' }}>Suficiência Amostral em Tempo Real</h3>
              <p style={{ color: 'gray', fontSize: '14px', lineHeight: 1.5 }}>
                Acompanhe a curva do coletor diretamente no campo. 
                Saiba exatamente quando sua amostragem é suficiente — com base técnica irrefutável.
              </p>
           </div>
        </div>

        {/* Bloco de Autoridade e Punch */}
        <div style={{ marginTop: '80px', maxWidth: '800px', textAlign: 'center', background: 'rgba(0,0,0,0.4)', padding: '48px 24px', borderRadius: '16px', border: '1px solid #333' }}>
           <h2 style={{ color: 'var(--primary-color)', marginBottom: '24px' }}>Desenvolvido pela EcoAds</h2>
           <p style={{ color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1.6, marginBottom: '24px' }}>
             A única agência especializada no setor ambiental e florestal do Brasil.
             <br/><br/>
             Criado por engenheiro florestal com experiência real em inventários, o LeafTag não é um sistema genérico — é uma ferramenta construída para quem trabalha em campo.
           </p>
           <h3 style={{ color: '#fff', fontSize: '24px', marginTop: '40px' }}>
             ⚡ Se você ainda usa caderno ou Excel para inventário, você está atrasado!
           </h3>
           <button className="btn btn-primary" style={{ padding: '16px 40px', fontSize: '18px', width: 'auto', marginTop: '32px' }} onClick={loginWithGoogle}>
             Acessar Sistema Clicando Aqui
           </button>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ padding: '32px 24px', textAlign: 'center', borderTop: '1px solid #1a1a1a', background: '#0a0d0b', color: '#666', fontSize: '14px' }}>
        <strong>LeafTag</strong> &copy; {new Date().getFullYear()} - O ecossistema inteligente da <strong>EcoAds</strong>.
      </footer>
    </div>
  );
};
