import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { InventorySetup } from './pages/InventorySetup';
import { CollectData } from './pages/CollectData';
import { InventoryDetail } from './pages/InventoryDetail';
import { FieldWorkDetail } from './pages/FieldWorkDetail';
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
  const { fieldWorks, createFieldWork } = useInventory();
  const { signOut, status } = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [newFwName, setNewFwName] = useState('');
  const [newFwLocal, setNewFwLocal] = useState('');
  // Utilizando formato YYYY-MM-DD para o input type="date"
  const [newFwDate, setNewFwDate] = useState(new Date().toISOString().split('T')[0]);

  const handleCreateFw = () => {
    if (!newFwName) return alert('Dê um nome ao trabalho.');
    
    // Converter YYYY-MM-DD para DD/MM/YYYY antes de salvar
    const formattedDate = newFwDate 
      ? new Date(newFwDate + 'T12:00:00').toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');

    createFieldWork({
      id: Date.now().toString(),
      nome: newFwName,
      local: newFwLocal || 'Não especificado',
      dataInicio: formattedDate,
      status: 'Aberto'
    });
    setShowModal(false);
    setNewFwName('');
    setNewFwLocal('');
    setNewFwDate(new Date().toISOString().split('T')[0]); 
  };
  
  return (
    <div className="container" style={{ marginTop: '20px' }}>
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '0px' }} />
          <div>
            <h1 style={{ color: 'var(--primary-color)', fontSize: '20px', whiteSpace: 'nowrap', margin: 0 }}>Trabalhos de Campo</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Gerenciamento</p>
          </div>
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

      <button className="btn btn-primary" style={{ margin: '0 0 24px', position: 'sticky', top: '16px', zIndex: 100 }} onClick={() => setShowModal(true)}>
        + Novo Trabalho de Campo
      </button>
      
      {fieldWorks.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>Nenhum projeto encontrado</h3>
          <p style={{ color: '#666', marginTop: '8px' }}>Crie seu primeiro trabalho de campo!</p>
        </div>
      ) : (
        <div className="inventory-list">
          {fieldWorks.map(fw => (
            <div 
              key={fw.id} 
              className="inventory-card" 
              onClick={() => navigate(`/fieldwork/${fw.id}`)}
            >
              <div className="inventory-card-title">{fw.nome}</div>
              <div className="inventory-card-info">Local: {fw.local}</div>
              <div className="inventory-card-info">Data: {fw.dataInicio}</div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
           <div className="glass-card" style={{ width: '100%', maxWidth: '400px', borderRadius: '0px' }}>
              <h3>Novo Trabalho</h3>
              <input className="input-field" placeholder="Nome (Ex: Inventário 2026)" value={newFwName} onChange={e => setNewFwName(e.target.value)} style={{ marginTop: '16px' }} />
              <input className="input-field" placeholder="Local / Fazenda" value={newFwLocal} onChange={e => setNewFwLocal(e.target.value)} />
              <input type="date" className="input-field" value={newFwDate} onChange={e => setNewFwDate(e.target.value)} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleCreateFw}>Criar</button>
              </div>
           </div>
        </div>
      )}
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
        <Route path="/fieldwork/:id" element={<ProtectedRoute><FieldWorkDetail /></ProtectedRoute>} />
        <Route path="/setup/:fieldWorkId/:talhaoId" element={<ProtectedRoute><InventorySetup /></ProtectedRoute>} />
        <Route path="/collect" element={<ProtectedRoute><CollectData /></ProtectedRoute>} />
        <Route path="/detail/:id" element={<ProtectedRoute><InventoryDetail /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminAccounts /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
