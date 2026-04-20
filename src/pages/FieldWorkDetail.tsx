import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { MapVisualization } from '../components/MapVisualization';

export const FieldWorkDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fieldWorks, inventories, setCurrentInventory, deleteFieldWork } = useInventory();
  const [showMap, setShowMap] = useState(false);

  const fw = fieldWorks.find(f => f.id === id);
  if (!fw) {
    return (
      <div className="container" style={{ marginTop: '20px', textAlign: 'center' }}>
        <h2>Trabalho de Campo não encontrado</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Voltar</button>
      </div>
    );
  }

  const parcels = inventories.filter(i => i.fieldWorkId === id);

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja apagar este Trabalho de Campo e todas as suas parcelas?')) {
      deleteFieldWork(fw.id);
      navigate('/');
    }
  };

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      <div className="app-header">
        <div>
          <h1 style={{ color: 'var(--primary-color)' }}>{fw.nome}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>📍 {fw.local} | 📅 {fw.dataInicio}</p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => navigate('/')}>
          Voltar
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 16px' }}>
        <h2 style={{ fontSize: '18px' }}>Parcelas ({parcels.length})</h2>
        <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => navigate(`/setup/${fw.id}`)}>
          + Nova Parcela
        </button>
      </div>
      
      {parcels.length > 0 && (
        <button className="btn btn-secondary" style={{ width: '100%', marginBottom: '24px', borderColor: '#4fc3f7', color: '#4fc3f7' }} onClick={() => setShowMap(true)}>
          🌍 Ver Mapa Interativo GIS
        </button>
      )}

      {parcels.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>Nenhuma parcela</h3>
          <p style={{ color: '#666', marginTop: '8px' }}>Crie sua primeira parcela de amostragem!</p>
        </div>
      ) : (
        parcels.map(inv => (
          <div 
            key={inv.id} 
            className="inventory-card" 
            onClick={() => {
                setCurrentInventory(inv);
                navigate(`/detail/${inv.id}`);
            }}
          >
            <div className="inventory-card-title">{inv.nome}</div>
            <div className="inventory-stats" style={{ marginTop: '12px' }}>
              <div className="stat-item">
                <span className="stat-value">{inv.dados.length}</span>
                <span className="stat-label">Indivíduos</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{inv.colunas.length}</span>
                <span className="stat-label">Colunas</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{inv.areaParcela}</span>
                <span className="stat-label">Área (m²)</span>
              </div>
            </div>
          </div>
        ))
      )}

      <button className="btn btn-danger" style={{ marginTop: '24px', opacity: 0.8 }} onClick={handleDelete}>
        Excluir Trabalho de Campo
      </button>

      {showMap && <MapVisualization inventories={parcels} onClose={() => setShowMap(false)} />}
    </div>
  );
};
