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
  const [talhaoDashboardId, setTalhaoDashboardId] = useState<string | null>(null);
  const [showTalhaoModal, setShowTalhaoModal] = useState(false);
  const [newTalhaoName, setNewTalhaoName] = useState('');
  const [newTalhaoObs, setNewTalhaoObs] = useState('');

  const [editingTalhao, setEditingTalhao] = useState<any>(null);
  const [editTalhaoName, setEditTalhaoName] = useState('');
  const [editTalhaoObs, setEditTalhaoObs] = useState('');

  const fw = fieldWorks.find(f => f.id === id);
  if (!fw) {
    return (
      <div className="container" style={{ marginTop: '20px', textAlign: 'center' }}>
        <div className="glass-card">
          <h2>Trabalho de Campo não encontrado</h2>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/')}>Voltar</button>
        </div>
      </div>
    );
  }

  // Filter talões and parcelas belonging to this field work
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
      nome: newTalhaoName.trim(),
      observacoes: newTalhaoObs.trim()
    });

    setShowTalhaoModal(false);
    setNewTalhaoName('');
    setNewTalhaoObs('');
  };

  const handleEditTalhao = (talhao: any) => {
    setEditingTalhao(talhao);
    setEditTalhaoName(talhao.nome);
    setEditTalhaoObs(talhao.observacoes || '');
  };

  const handleSaveTalhaoEdit = () => {
    if (!editTalhaoName.trim()) return alert('Por favor, dê um nome ao talhão.');
    if (!editingTalhao) return;

    createTalhao({
      ...editingTalhao,
      nome: editTalhaoName.trim(),
      observacoes: editTalhaoObs.trim()
    });

    setEditingTalhao(null);
    setEditTalhaoName('');
    setEditTalhaoObs('');
  };

  const handleExportAll = () => {
    const allData: any[] = [];
    parcels.forEach(inv => {
      const currentTal = talhoes.find(t => t.id === inv.talhaoId);
      inv.dados.forEach(ind => {
        const baseData: any = {
           'Talhão': currentTal ? currentTal.nome : 'Sem Talhão',
           'Talhão Observações': currentTal?.observacoes || '',
           'Parcela': inv.nome,
           'Parcela Coordenadas': inv.coordenadas || '',
           'Parcela Observações': inv.observacoes || '',
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

  const handleExportTalhao = (talhaoId: string, talhaoNome: string) => {
    const talhaoParcels = parcels.filter(p => p.talhaoId === talhaoId);
    const allData: any[] = [];
    talhaoParcels.forEach(inv => {
      inv.dados.forEach(ind => {
        const baseData: any = {
           'Talhão': talhaoNome,
           'Talhão Observações': talhoes.find(t => t.id === talhaoId)?.observacoes || '',
           'Parcela': inv.nome,
           'Parcela Coordenadas': inv.coordenadas || '',
           'Parcela Observações': inv.observacoes || '',
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

    if (allData.length === 0) return alert("Nenhum dado encontrado nas parcelas deste talhão.");
    
    const worksheet = XLSX.utils.json_to_sheet(allData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados Talhão");
    XLSX.writeFile(workbook, `Talhao_${talhaoNome.replace(/\s+/g, '_')}.xlsx`);
  };

  const renderParcelCard = (inv: any) => (
    <div 
      key={inv.id} 
      className="inventory-card" 
      onClick={() => {
          setCurrentInventory(inv);
          navigate(`/detail/${inv.id}`);
      }}
      style={{ cursor: 'pointer', flex: '1 1 240px' }}
    >
      <div className="inventory-card-title" style={{ fontSize: '17px' }}>{inv.nome}</div>
      <div className="inventory-stats" style={{ marginTop: '10px', paddingTop: '10px' }}>
        <div className="stat-item">
          <span className="stat-value" style={{ fontSize: '18px' }}>{inv.dados.length}</span>
          <span className="stat-label" style={{ fontSize: '8px' }}>Árvores</span>
        </div>
        <div className="stat-item">
          <span className="stat-value" style={{ fontSize: '18px' }}>{inv.colunas.length}</span>
          <span className="stat-label" style={{ fontSize: '8px' }}>Campos</span>
        </div>
        <div className="stat-item">
          <span className="stat-value" style={{ fontSize: '18px' }}>{inv.areaParcela}</span>
          <span className="stat-label" style={{ fontSize: '8px' }}>Área (m²)</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      {/* Header */}
      <div className="app-header">
        <div>
          <h1 style={{ color: 'var(--primary-hover)', fontSize: '24px', fontWeight: '800' }}>{fw.nome}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Local: {fw.local} | Data: {fw.dataInicio}</p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => navigate('/')}>
          Voltar
        </button>
      </div>

      {/* Action bar and summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '28px 0 16px', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.02em' }}>Talhões ({fwTalhoes.length}) • Parcelas ({parcels.length})</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {parcels.length > 0 && (
            <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }} onClick={handleExportAll}>
               Exportar Projeto Completo
            </button>
          )}
          <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => setShowTalhaoModal(true)}>
            + Novo Talhão
          </button>
        </div>
      </div>
      
      {/* GIS and Dashboard shortcuts */}
      {parcels.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
          <button className="btn btn-secondary" style={{ flex: 1, borderColor: '#009688', color: '#80cbc4', background: 'rgba(0, 150, 136, 0.08)' }} onClick={() => setShowMap(true)}>
            Ver Mapa GIS
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)' }} onClick={() => setShowDashboard(true)}>
            Ver Dashboard
          </button>
        </div>
      )}

      {/* Main Talhões hierarchical layout */}
      {fwTalhoes.length === 0 && legacyParcels.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <h3 style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Nenhum talhão criado</h3>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>Comece adicionando seu primeiro talhão de manejo!</p>
          <button className="btn btn-primary" style={{ maxWidth: '240px', margin: '0 auto' }} onClick={() => setShowTalhaoModal(true)}>
            Criar Primeiro Talhão
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* List all talhões */}
          {fwTalhoes.map(talhao => {
            const talhaoParcels = parcelsByTalhao.filter(p => p.talhaoId === talhao.id);
            return (
              <div 
                key={talhao.id} 
                className="glass-card"
                style={{ 
                  borderLeft: '4px solid var(--primary-color) !important',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  marginBottom: 0
                }}
              >
                {/* Talhao Header Block */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ color: '#ffffff', fontSize: '18px', fontWeight: '800' }}>{talhao.nome}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{talhaoParcels.length} parcelas cadastradas</span>
                    {talhao.observacoes && (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '6px 0 0 0', fontStyle: 'italic', wordBreak: 'break-all' }}>
                        Obs: {talhao.observacoes}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '10.5px' }}
                      onClick={() => navigate(`/setup/${fw.id}/${talhao.id}`)}
                    >
                      + Nova Parcela
                    </button>
                    {talhaoParcels.length > 0 && (
                      <>
                        <button 
                          className="btn btn-secondary" 
                          style={{ width: 'auto', padding: '6px 12px', fontSize: '10.5px', borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)' }}
                          onClick={() => setTalhaoDashboardId(talhao.id)}
                        >
                          Dashboard
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ width: 'auto', padding: '6px 12px', fontSize: '10.5px', borderColor: '#00838f', color: '#80deea', background: 'rgba(0, 131, 143, 0.08)' }}
                          onClick={() => handleExportTalhao(talhao.id, talhao.nome)}
                        >
                          Exportar Excel
                        </button>
                      </>
                    )}
                    <button 
                      className="btn btn-secondary" 
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '10.5px', borderColor: 'var(--primary-hover)', color: 'var(--primary-hover)' }}
                      onClick={() => handleEditTalhao(talhao)}
                    >
                      Editar
                    </button>
                    <button 
                      className="btn btn-danger" 
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '10.5px' }}
                      onClick={() => handleDeleteTalhao(talhao.id, talhao.nome)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                <div className="divider-dashed" style={{ margin: '6px 0 12px' }}></div>

                {/* Talhao parcels grid */}
                {talhaoParcels.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', fontStyle: 'italic', margin: '4px 0' }}>
                    Nenhuma parcela cadastrada neste talhão. Clique em "+ Nova Parcela" acima.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                    {talhaoParcels.map(renderParcelCard)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Legacy unassigned parcels block */}
          {legacyParcels.length > 0 && (
            <div 
              className="glass-card"
              style={{ 
                borderLeft: '4px solid #fbc02d !important',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                marginBottom: 0
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ color: '#fbc02d', fontSize: '17px', fontWeight: '800' }}>Parcelas sem Talhão (Legado)</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cadastradas antes da atualização dos talhões</span>
                </div>
              </div>
              <div className="divider-dashed" style={{ margin: '6px 0 12px' }}></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                {legacyParcels.map(renderParcelCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Field Work button */}
      <button className="btn btn-danger" style={{ marginTop: '36px', opacity: 0.8 }} onClick={handleDeleteFieldWork}>
        Excluir Trabalho de Campo Completo
      </button>

      {/* Talhao Creation Modal (Rounded 24px) */}
      {showTalhaoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
           <div className="glass-card" style={{ width: '100%', maxWidth: '400px', marginBottom: 0 }}>
              <h3 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800' }}>Novo Talhão</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
                Defina o nome do talhão para organizar as parcelas de amostragem florestal.
              </p>
              <input 
                className="input-field" 
                placeholder="Ex: Talhão Leste, Quadra B" 
                value={newTalhaoName} 
                onChange={e => setNewTalhaoName(e.target.value)} 
                style={{ marginTop: '20px' }} 
              />
              <textarea 
                className="input-field" 
                placeholder="Observações do talhão (Opcional)" 
                value={newTalhaoObs} 
                onChange={e => setNewTalhaoObs(e.target.value)} 
                style={{ marginTop: '8px', minHeight: '80px', fontFamily: 'inherit' }} 
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => { setShowTalhaoModal(false); setNewTalhaoName(''); setNewTalhaoObs(''); }}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleCreateTalhao}>Criar</button>
              </div>
           </div>
        </div>
      )}

      {/* Talhao Edit Modal (Rounded 24px) */}
      {editingTalhao && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
           <div className="glass-card" style={{ width: '100%', maxWidth: '400px', marginBottom: 0 }}>
              <h3 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800' }}>Editar Talhão</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
                Edite o nome ou observações do talhão.
              </p>
              <input 
                className="input-field" 
                placeholder="Ex: Talhão Leste, Quadra B" 
                value={editTalhaoName} 
                onChange={e => setEditTalhaoName(e.target.value)} 
                style={{ marginTop: '20px' }} 
              />
              <textarea 
                className="input-field" 
                placeholder="Observações do talhão (Opcional)" 
                value={editTalhaoObs} 
                onChange={e => setEditTalhaoObs(e.target.value)} 
                style={{ marginTop: '8px', minHeight: '80px', fontFamily: 'inherit' }} 
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => { setEditingTalhao(null); setEditTalhaoName(''); setEditTalhaoObs(''); }}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveTalhaoEdit}>Salvar</button>
              </div>
           </div>
        </div>
      )}

      {showMap && <MapVisualization inventories={parcels} onClose={() => setShowMap(false)} />}
      {showDashboard && <StatisticalDashboard inventories={parcels} onClose={() => setShowDashboard(false)} />}
      {talhaoDashboardId && (
        <StatisticalDashboard 
          inventories={parcels.filter(p => p.talhaoId === talhaoDashboardId)} 
          onClose={() => setTalhaoDashboardId(null)} 
        />
      )}
    </div>
  );
};
