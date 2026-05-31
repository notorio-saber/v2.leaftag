import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import * as XLSX from 'xlsx';
import { MapVisualization } from '../components/MapVisualization';
import { StatisticalDashboard } from '../components/StatisticalDashboard';

const generateId = () => Date.now().toString();

export const FieldWorkDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fieldWorks, talhoes, inventories, setCurrentInventory, deleteFieldWork, createTalhao, deleteTalhao } = useInventory();
  const [showMap, setShowMap] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showTalhaoModal, setShowTalhaoModal] = useState(false);
  const [newTalhaoName, setNewTalhaoName] = useState('');

  const fw = fieldWorks.find(f => f.id === id);
  if (!fw) {
    return (
      <div className="container" style={{ marginTop: '20px', textAlign: 'center' }}>
        <h2>Trabalho de Campo não encontrado</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Voltar</button>
      </div>
    );
  }

  // Filter talhões and parcelas belonging to this field work
  const fwTalhoes = talhoes.filter(t => t.fieldWorkId === id);
  const parcels = inventories.filter(i => i.fieldWorkId === id);

  // Group parcels by talhaoId
  const parcelsByTalhao = parcels.filter(p => p.talhaoId);
  const legacyParcels = parcels.filter(p => !p.talhaoId);

  const handleDeleteFieldWork = () => {
    if (confirm('Tem certeza que deseja apagar este Trabalho de Campo, todos os seus talhões e todas as suas parcelas?')) {
      deleteFieldWork(fw.id);
      navigate('/');
    }
  };

  const handleDeleteTalhao = (talhaoId: string, talhaoNome: string) => {
    if (confirm(`Tem certeza que deseja apagar o talhão "${talhaoNome}" e todas as parcelas dentro dele? Esta ação é irreversível.`)) {
      deleteTalhao(talhaoId);
    }
  };

  const handleCreateTalhao = () => {
    if (!newTalhaoName.trim()) return alert('Por favor, dê um nome ao talhão.');
    
    createTalhao({
      id: generateId(),
      fieldWorkId: fw.id,
      nome: newTalhaoName.trim()
    });

    setShowTalhaoModal(false);
    setNewTalhaoName('');
  };

  const handleExportAll = () => {
    const allData: any[] = [];
    parcels.forEach(inv => {
      const currentTal = talhoes.find(t => t.id === inv.talhaoId);
      inv.dados.forEach(ind => {
        const baseData: any = {
           'Talhão': currentTal ? currentTal.nome : 'Sem Talhão',
           'Parcela': inv.nome,
           'Número': ind.numeroIndividuo,
           'Data / Hora': ind.timestamp,
        };
        inv.colunas.forEach(col => {
           baseData[col.nome] = ind[col.id] || '';
        });
        if (ind.multipleStems && ind.stems) {
           ind.stems.forEach((stem: any, i: number) => {
             baseData[`Fuste_${i+1}_CAP`] = stem.cap;
             baseData[`Fuste_${i+1}_Altura`] = stem.altura;
           });
        }
        allData.push(baseData);
      });
    });

    if (allData.length === 0) return alert("Nenhum dado encontrado nas parcelas deste trabalho.");
    
    const worksheet = XLSX.utils.json_to_sheet(allData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados Consolidados");
    XLSX.writeFile(workbook, `Projeto_${fw.nome.replace(/\s+/g, '_')}_Completo.xlsx`);
  };

  const renderParcelCard = (inv: any) => (
    <div 
      key={inv.id} 
      className="inventory-card" 
      onClick={() => {
          setCurrentInventory(inv);
          navigate(`/detail/${inv.id}`);
      }}
      style={{ cursor: 'pointer', flex: '1 1 280px', minWidth: '260px' }}
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
  );

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      {/* Header */}
      <div className="app-header">
        <div>
          <h1 style={{ color: 'var(--primary-color)' }}>{fw.nome}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Local: {fw.local} | Data: {fw.dataInicio}</p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', borderRadius: '0px' }} onClick={() => navigate('/')}>
          Voltar
        </button>
      </div>

      {/* Action bar and summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 16px', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ fontSize: '18px' }}>Talhões ({fwTalhoes.length}) • Parcelas ({parcels.length})</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {parcels.length > 0 && (
            <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', borderRadius: '0px' }} onClick={handleExportAll}>
               Baixar Todo Projeto
            </button>
          )}
          <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px', borderRadius: '0px' }} onClick={() => setShowTalhaoModal(true)}>
            + Novo Talhão
          </button>
        </div>
      </div>
      
      {/* GIS and Dashboard shortcuts */}
      {parcels.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          <button className="btn btn-secondary" style={{ flex: 1, borderColor: '#4fc3f7', color: '#4fc3f7', borderRadius: '0px' }} onClick={() => setShowMap(true)}>
            Ver Mapa GIS
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, borderColor: '#ffb74d', color: '#ffb74d', borderRadius: '0px' }} onClick={() => setShowDashboard(true)}>
            Ver Dashboard
          </button>
        </div>
      )}

      {/* Main Talhões hierarchical layout */}
      {fwTalhoes.length === 0 && legacyParcels.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>Nenhum talhão criado</h3>
          <p style={{ color: '#666', marginTop: '8px' }}>Comece adicionando seu primeiro talhão de manejo!</p>
          <button className="btn btn-primary" style={{ maxWidth: '240px', margin: '20px auto 0' }} onClick={() => setShowTalhaoModal(true)}>
            + Criar Primeiro Talhão
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* List all talhões */}
          {fwTalhoes.map(talhao => {
            const talhaoParcels = parcelsByTalhao.filter(p => p.talhaoId === talhao.id);
            return (
              <div 
                key={talhao.id} 
                style={{ 
                  background: 'rgba(255,255,255,0.01)', 
                  border: '1px solid var(--border-color)', 
                  borderLeft: '4px solid var(--primary-color)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                {/* Talhao Header Block */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>{talhao.nome}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{talhaoParcels.length} parcelas registradas</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '10px', borderRadius: '0px' }}
                      onClick={() => navigate(`/setup/${fw.id}/${talhao.id}`)}
                    >
                      + Nova Parcela
                    </button>
                    <button 
                      className="btn btn-danger" 
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '10px', borderRadius: '0px' }}
                      onClick={() => handleDeleteTalhao(talhao.id, talhao.nome)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                <div className="divider-dashed" style={{ margin: '8px 0 16px' }}></div>

                {/* Talhao parcels grid */}
                {talhaoParcels.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic', margin: '8px 0' }}>
                    Nenhuma parcela cadastrada neste talhão. Clique em "+ Nova Parcela" acima.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                    {talhaoParcels.map(renderParcelCard)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Legacy unassigned parcels block */}
          {legacyParcels.length > 0 && (
            <div 
              style={{ 
                background: 'rgba(255,255,255,0.01)', 
                border: '1px solid var(--border-color)', 
                borderLeft: '4px solid #fbc02d', // Yellow indicator for legacy
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ color: '#fbc02d', fontSize: '18px', fontWeight: 'bold' }}>Parcelas sem Talhão (Legado)</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mapeadas antes da atualização dos talhões</span>
                </div>
              </div>
              <div className="divider-dashed" style={{ margin: '8px 0 16px' }}></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {legacyParcels.map(renderParcelCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Field Work button */}
      <button className="btn btn-danger" style={{ marginTop: '40px', opacity: 0.8 }} onClick={handleDeleteFieldWork}>
        Excluir Trabalho de Campo Completo
      </button>

      {/* Talhao Creation Modal */}
      {showTalhaoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
           <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
              <h3 style={{ color: 'var(--primary-color)' }}>Novo Talhão</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
                Crie um talhão para organizar suas parcelas de amostragem.
              </p>
              <input 
                className="input-field" 
                placeholder="Nome do Talhão (Ex: Talhão Sul, Quadra B)" 
                value={newTalhaoName} 
                onChange={e => setNewTalhaoName(e.target.value)} 
                style={{ marginTop: '24px' }} 
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => { setShowTalhaoModal(false); setNewTalhaoName(''); }}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleCreateTalhao}>Criar</button>
              </div>
           </div>
        </div>
      )}

      {showMap && <MapVisualization inventories={parcels} onClose={() => setShowMap(false)} />}
      {showDashboard && <StatisticalDashboard inventories={parcels} onClose={() => setShowDashboard(false)} />}
    </div>
  );
};
