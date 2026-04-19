import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { InventorySetup } from './pages/InventorySetup';
import { CollectData } from './pages/CollectData';
import { InventoryDetail } from './pages/InventoryDetail';
import { Login } from './pages/Login';
import { PendingAccess } from './pages/PendingAccess';
import { AdminAccounts } from './pages/AdminAccounts';
import './App.css';
import { useInventory } from './context/InventoryContext';
import { useAuth } from './context/AuthContext';

// Permite apenas admin e active
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, status, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" />;
  if (status === 'pending') return <Navigate to="/pending" />;
  return <>{children}</>;
};

const Home = () => {
  const { inventories, setCurrentInventory } = useInventory();
  const { signOut, status } = useAuth();
  const navigate = useNavigate();
  
  return (
    <div className="container" style={{ marginTop: '20px' }}>
      <div className="app-header">
        <div>
          <h1 style={{ color: 'var(--primary-color)' }}>Meus Inventários</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Coleta de dados florestais</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {status === 'admin' && (
             <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => navigate('/admin')}>
               Admin
             </button>
          )}
          <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={signOut}>
            Sair
          </button>
        </div>
      </div>
      
      {inventories.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>Nenhum inventário encontrado</h3>
          <p style={{ color: '#666', marginTop: '8px' }}>Inicie sua primeira coleta de dados!</p>
        </div>
      ) : (
        inventories.map(inv => (
          <div 
            key={inv.id} 
            className="inventory-card" 
            onClick={() => {
                setCurrentInventory(inv);
                navigate(`/detail/${inv.id}`);
            }}
          >
            <div className="inventory-card-title">{inv.nome}</div>
            <div className="inventory-card-info">📍 {inv.local}</div>
            <div className="inventory-card-info">📅 {inv.dataInicio}</div>
            <div className="inventory-stats">
              <div className="stat-item">
                <span className="stat-value">{inv.dados.length}</span>
                <span className="stat-label">Indivíduos</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{inv.colunas.length}</span>
                <span className="stat-label">Colunas</span>
              </div>
            </div>
          </div>
        ))
      )}

      <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={() => navigate('/setup')}>
        + Nova Coleta
      </button>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/pending" element={<PendingAccess />} />
        
        {/* Rotas Protegidas */}
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/setup" element={<ProtectedRoute><InventorySetup /></ProtectedRoute>} />
        <Route path="/collect" element={<ProtectedRoute><CollectData /></ProtectedRoute>} />
        <Route path="/detail/:id" element={<ProtectedRoute><InventoryDetail /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminAccounts /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
