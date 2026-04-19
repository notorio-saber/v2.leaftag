import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { InventorySetup } from './pages/InventorySetup';
import { CollectData } from './pages/CollectData';
import { InventoryDetail } from './pages/InventoryDetail';
import './App.css';
import { useInventory } from './context/InventoryContext';

const Home = () => {
  const { inventories, setCurrentInventory } = useInventory();
  const navigate = useNavigate();
  
  return (
    <div className="container" style={{ marginTop: '20px' }}>
      <div className="app-header">
        <div>
          <h1 style={{ color: 'var(--primary-color)' }}>Meus Inventários</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Coleta de dados florestais</p>
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
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<InventorySetup />} />
        <Route path="/collect" element={<CollectData />} />
        <Route path="/detail/:id" element={<InventoryDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
