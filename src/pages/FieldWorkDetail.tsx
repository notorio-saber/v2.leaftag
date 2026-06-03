import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import * as XLSX from 'xlsx';
import { MapVisualization } from '../components/MapVisualization';
import { StatisticalDashboard } from '../components/StatisticalDashboard';

const generateId = () => Date.now().toString();

export const FieldWorkDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fieldWorks, talhoes, inventories, setCurrentInventory, deleteFieldWork, createTalhao, deleteTalhao, isSynced, strata, createFieldWork } = useInventory();
  const [showMap, setShowMap] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [talhaoDashboardId, setTalhaoDashboardId] = useState<string | null>(null);
  const [showTalhaoModal, setShowTalhaoModal] = useState(false);
  const [newTalhaoName, setNewTalhaoName] = useState('');
  const [newTalhaoArea, setNewTalhaoArea] = useState('');
  const [newTalhaoObs, setNewTalhaoObs] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [talhaoFilter, setTalhaoFilter] = useState('');
  const [stratumFilter, setStratumFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [editingTalhao, setEditingTalhao] = useState<any>(null);
  const [editTalhaoName, setEditTalhaoName] = useState('');
  const [editTalhaoArea, setEditTalhaoArea] = useState('');
  const [editTalhaoObs, setEditTalhaoObs] = useState('');

  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [googleSheetsUrlInput, setGoogleSheetsUrlInput] = useState('');
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);

  const fw = fieldWorks.find(f => f.id === id);

  useEffect(() => {
    if (fw) {
      setGoogleSheetsUrlInput(fw.googleSheetsUrl || '');
    }
  }, [fw]);
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

  // Group strata for this fieldwork
  const fwStrata = strata.filter(s => s.fieldWorkId === id);

  const filteredParcels = parcels.filter(p => {
    if (dateFilter) {
      const formattedFilter = new Date(dateFilter + 'T12:00:00').toLocaleDateString('pt-BR');
      if (p.dataInicio !== formattedFilter && p.ultimaColeta !== formattedFilter) return false;
    }
    if (talhaoFilter) {
      if (talhaoFilter === 'sem-talhao') {
        if (p.talhaoId) return false;
      } else if (p.talhaoId !== talhaoFilter) {
        return false;
      }
    }
    if (stratumFilter && p.stratumId !== stratumFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const isFilterActive = dateFilter || talhaoFilter || stratumFilter || statusFilter;

  // List all talhões that match the talhaoFilter or contain filtered parcels
  const filteredTalhoesList = talhaoFilter
    ? fwTalhoes.filter(t => t.id === talhaoFilter)
    : fwTalhoes.filter(t => {
        if (dateFilter || stratumFilter || statusFilter) {
          return filteredParcels.some(p => p.talhaoId === t.id);
        }
        return true;
      });

  // Group parcels by talhaoId
  const parcelsByTalhao = filteredParcels.filter(p => p.talhaoId);
  const legacyParcels = filteredParcels.filter(p => !p.talhaoId);

  // Calculate total area (ha)
  const totalStrataArea = fwStrata.reduce((acc, s) => acc + (s.area || 0), 0);
  const totalTalhaoArea = fwTalhoes.reduce((acc, t) => acc + (t.area || 0), 0);
  const totalArea = totalStrataArea > 0 ? totalStrataArea : totalTalhaoArea;

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
      area: parseFloat(newTalhaoArea) || undefined,
      observacoes: newTalhaoObs.trim()
    });

    setShowTalhaoModal(false);
    setNewTalhaoName('');
    setNewTalhaoArea('');
    setNewTalhaoObs('');
  };

  const handleEditTalhao = (talhao: any) => {
    setEditingTalhao(talhao);
    setEditTalhaoName(talhao.nome);
    setEditTalhaoArea(talhao.area?.toString() || '');
    setEditTalhaoObs(talhao.observacoes || '');
  };

  const handleSaveTalhaoEdit = () => {
    if (!editTalhaoName.trim()) return alert('Por favor, dê um nome ao talhão.');
    if (!editingTalhao) return;

    createTalhao({
      ...editingTalhao,
      nome: editTalhaoName.trim(),
      area: parseFloat(editTalhaoArea) || undefined,
      observacoes: editTalhaoObs.trim()
    });

    setEditingTalhao(null);
    setEditTalhaoName('');
    setEditTalhaoArea('');
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

  const handleSyncGoogleSheets = async () => {
    if (!fw || !fw.googleSheetsUrl) return alert("Por favor, vincule uma planilha do Google nas configurações primeiro.");

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

    const headers = Array.from(new Set(allData.flatMap(Object.keys)));
    const payload = { headers, rows: allData };

    setIsSyncingSheets(true);
    try {
      const response = await fetch(fw.googleSheetsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
      });

      const resText = await response.text();
      let result;
      try {
        result = JSON.parse(resText);
      } catch (e) {
        console.warn("Could not parse response JSON:", resText);
      }

      if (result && result.status === 'success') {
        alert(result.message);
      } else if (result && result.status === 'error') {
        alert("Erro no script do Google: " + result.message);
      } else {
        alert("Sincronização concluída com sucesso!");
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao sincronizar com Google Planilhas. Detalhes: " + err.message);
    } finally {
      setIsSyncingSheets(false);
    }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ color: 'var(--primary-hover)', fontSize: '24px', fontWeight: '800', margin: 0 }}>{fw.nome}</h1>
            
            {/* Cloud Sync Icon */}
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isSynced ? '#81c784' : '#ffb74d',
                transition: 'all 0.3s ease',
                cursor: 'default'
              }}
              title={isSynced ? "Dados 100% sincronizados na nuvem" : "Sincronizando alterações locais..."}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={isSynced ? "" : "spin-icon"}
              >
                <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.47-.47-1.15-.78-2-.78-2 0-3.5 1.5-3.5 3.5v.78c-2.3 0-4 1.7-4 4A3.5 3.5 0 0 0 10 22h7.5" />
                {isSynced && <path d="M9 16l2 2 4-4" />}
              </svg>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Local: {fw.local} | Data: {fw.dataInicio}
            {totalArea > 0 && ` | Área Total: ${totalArea.toFixed(2)} ha`}
          </p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => navigate('/')}>
          Voltar
        </button>
      </div>

      {/* Action bar and summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '28px 0 16px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>Talhões ({fwTalhoes.length}) • Parcelas ({parcels.length})</h2>
          {isFilterActive && (
            <span style={{ fontSize: '12px', color: 'var(--primary-hover)', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>
              Filtro Ativo ({filteredParcels.length} parcelas encontradas)
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Filter Button */}
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ 
              width: 'auto', 
              padding: '10px 18px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              borderColor: isFilterActive ? 'var(--primary-hover)' : 'rgba(255,255,255,0.1)',
              background: isFilterActive ? 'rgba(76, 175, 80, 0.05)' : 'transparent'
            }} 
            onClick={() => setShowFilterPanel(!showFilterPanel)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Filtrar {isFilterActive && "•"}
          </button>
          {parcels.length > 0 && (
            <>
              <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 18px' }} onClick={handleExportAll}>
                 Exportar Projeto Completo
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ 
                  width: 'auto', 
                  padding: '10px 18px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  borderColor: fw.googleSheetsUrl ? 'var(--primary-hover)' : 'rgba(255,255,255,0.1)' 
                }} 
                onClick={() => setShowSheetsModal(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                {fw.googleSheetsUrl ? "Planilha Vinculada" : "Vincular Planilha"}
              </button>
              {fw.googleSheetsUrl && (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ 
                    width: 'auto', 
                    padding: '10px 18px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    background: 'linear-gradient(135deg, #00e676 0%, #00b0ff 100%)',
                    border: 'none'
                  }} 
                  onClick={handleSyncGoogleSheets}
                  disabled={isSyncingSheets}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className={isSyncingSheets ? "spin-icon" : ""}
                  >
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                  </svg>
                  {isSyncingSheets ? "Enviando..." : "Sincronizar Planilha"}
                </button>
              )}
            </>
          )}
          <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => setShowTalhaoModal(true)}>
            + Novo Talhão
          </button>
        </div>
      </div>

      {/* Expanded Filter Panel */}
      {showFilterPanel && (
        <div className="glass-card" style={{
          marginTop: '12px',
          marginBottom: '20px',
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          width: '100%'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            
            {/* Date Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Data de Coleta</label>
              <input 
                type="date" 
                className="input-field" 
                style={{ marginBottom: 0, padding: '8px 12px', height: '38px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }} 
                value={dateFilter} 
                onChange={e => setDateFilter(e.target.value)} 
              />
            </div>

            {/* Talhao Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Talhão</label>
              <select 
                className="input-field" 
                style={{ marginBottom: 0, padding: '8px 12px', height: '38px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} 
                value={talhaoFilter} 
                onChange={e => setTalhaoFilter(e.target.value)}
              >
                <option value="">-- Todos --</option>
                <option value="sem-talhao">Sem Talhão</option>
                {fwTalhoes.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>

            {/* Stratum Filter */}
            {fwStrata.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Estrato</label>
                <select 
                  className="input-field" 
                  style={{ marginBottom: 0, padding: '8px 12px', height: '38px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} 
                  value={stratumFilter} 
                  onChange={e => setStratumFilter(e.target.value)}
                >
                  <option value="">-- Todos --</option>
                  {fwStrata.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Status</label>
              <select 
                className="input-field" 
                style={{ marginBottom: 0, padding: '8px 12px', height: '38px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">-- Todos --</option>
                <option value="Aberto">Aberto</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>

          </div>

          {isFilterActive && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ width: 'auto', padding: '6px 16px', fontSize: '12px' }}
                onClick={() => {
                  setDateFilter('');
                  setTalhaoFilter('');
                  setStratumFilter('');
                  setStatusFilter('');
                }}
              >
                Limpar Filtros
              </button>
            </div>
          )}
        </div>
      )}
      
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
      {filteredTalhoesList.length === 0 && legacyParcels.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          {isFilterActive ? (
            <>
              <h3 style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Nenhum resultado</h3>
              <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>Nenhum talhão ou parcela corresponde aos filtros ativos.</p>
              <button className="btn btn-secondary" style={{ maxWidth: '240px', margin: '0 auto' }} onClick={() => {
                setDateFilter('');
                setTalhaoFilter('');
                setStratumFilter('');
                setStatusFilter('');
              }}>
                Limpar Filtros
              </button>
            </>
          ) : (
            <>
              <h3 style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Nenhum talhão criado</h3>
              <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>Comece adicionando seu primeiro talhão de manejo!</p>
              <button className="btn btn-primary" style={{ maxWidth: '240px', margin: '0 auto' }} onClick={() => setShowTalhaoModal(true)}>
                Criar Primeiro Talhão
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* List all talhões */}
          {filteredTalhoesList.map(talhao => {
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ color: '#ffffff', fontSize: '18px', fontWeight: '800', margin: 0 }}>{talhao.nome}</h3>
                      {talhao.area !== undefined && (
                        <span style={{ 
                          background: 'rgba(0, 230, 118, 0.12)', 
                          border: '1px solid rgba(0, 230, 118, 0.35)', 
                          borderRadius: '8px', 
                          padding: '3px 8px', 
                          fontSize: '11px', 
                          fontWeight: '800',
                          color: '#00e676',
                          display: 'inline-block'
                        }}>
                          {talhao.area.toFixed(2)} ha
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>{talhaoParcels.length} parcelas cadastradas</span>
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
                Defina o nome, área e observações do talhão para organizar as parcelas.
              </p>
              <input 
                className="input-field" 
                placeholder="Ex: Talhão Leste, Quadra B" 
                value={newTalhaoName} 
                onChange={e => setNewTalhaoName(e.target.value)} 
                style={{ marginTop: '20px' }} 
              />
              <input 
                type="number"
                step="0.01"
                className="input-field" 
                placeholder="Área em Hectares (Ex: 10.5)" 
                value={newTalhaoArea} 
                onChange={e => setNewTalhaoArea(e.target.value)} 
                style={{ marginTop: '8px' }} 
              />
              <textarea 
                className="input-field" 
                placeholder="Observações do talhão (Opcional)" 
                value={newTalhaoObs} 
                onChange={e => setNewTalhaoObs(e.target.value)} 
                style={{ marginTop: '8px', minHeight: '80px', fontFamily: 'inherit' }} 
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => { setShowTalhaoModal(false); setNewTalhaoName(''); setNewTalhaoArea(''); setNewTalhaoObs(''); }}>Cancelar</button>
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
                Edite o nome, área ou observações do talhão.
              </p>
              <input 
                className="input-field" 
                placeholder="Ex: Talhão Leste, Quadra B" 
                value={editTalhaoName} 
                onChange={e => setEditTalhaoName(e.target.value)} 
                style={{ marginTop: '20px' }} 
              />
              <input 
                type="number"
                step="0.01"
                className="input-field" 
                placeholder="Área em Hectares (Ex: 10.5)" 
                value={editTalhaoArea} 
                onChange={e => setEditTalhaoArea(e.target.value)} 
                style={{ marginTop: '8px' }} 
              />
              <textarea 
                className="input-field" 
                placeholder="Observações do talhão (Opcional)" 
                value={editTalhaoObs} 
                onChange={e => setEditTalhaoObs(e.target.value)} 
                style={{ marginTop: '8px', minHeight: '80px', fontFamily: 'inherit' }} 
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => { setEditingTalhao(null); setEditTalhaoName(''); setEditTalhaoArea(''); setEditTalhaoObs(''); }}>Cancelar</button>
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

      {/* Google Sheets Integration Modal */}
      {showSheetsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '550px', margin: 0, maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary-hover)', fontWeight: '800' }}>Vincular Google Planilhas</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '6px', marginBottom: '16px', lineHeight: '1.4' }}>
              Vincule este Trabalho de Campo a uma planilha do Google Sheets para enviar seus dados estruturados com um clique.
            </p>
            
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '12.5px', color: '#e0e0e0', marginBottom: '16px' }}>
              <strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>Instruções de Configuração:</strong>
              <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Crie uma nova planilha vazia no Google Planilhas (<a href="https://sheets.new" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>sheets.new</a>).</li>
                <li>No menu superior, acesse <strong>Extensões</strong> &gt; <strong>Apps Script</strong>.</li>
                <li>Apague todo o código existente na janela e cole o script abaixo.</li>
                <li>Clique no ícone de salvar (disquete) e depois clique em <strong>Implantar</strong> &gt; <strong>Nova implantação</strong>.</li>
                <li>Clique na engrenagem de "Tipo", escolha <strong>App da Web</strong>. Em "Quem pode acessar", mude para <strong>Qualquer pessoa</strong>.</li>
                <li>Clique em Implantar, conceda as permissões se solicitado, copie a <strong>URL do App da Web</strong> gerada e cole no campo de texto abaixo.</li>
              </ol>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Código do Google Apps Script:</label>
              <textarea 
                readOnly 
                className="input-field" 
                style={{ height: '140px', fontFamily: 'monospace', fontSize: '11px', background: 'rgba(0,0,0,0.5)', color: '#81c784', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'text' }} 
                value={`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();
    
    if (data.headers && data.headers.length > 0) {
      sheet.appendRow(data.headers);
    }
    
    if (data.rows && data.rows.length > 0) {
      var range = sheet.getRange(2, 1, data.rows.length, data.headers.length);
      var values = data.rows.map(function(row) {
        return data.headers.map(function(header) {
          return row[header] !== undefined ? row[header] : "";
        });
      });
      range.setValues(values);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Dados sincronizados com sucesso! Total: " + (data.rows ? data.rows.length : 0) + " linhas." }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}
              />
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', alignSelf: 'flex-start' }}
                onClick={() => {
                  navigator.clipboard.writeText(`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();
    
    if (data.headers && data.headers.length > 0) {
      sheet.appendRow(data.headers);
    }
    
    if (data.rows && data.rows.length > 0) {
      var range = sheet.getRange(2, 1, data.rows.length, data.headers.length);
      var values = data.rows.map(function(row) {
        return data.headers.map(function(header) {
          return row[header] !== undefined ? row[header] : "";
        });
      });
      range.setValues(values);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Dados sincronizados com sucesso! Total: " + (data.rows ? data.rows.length : 0) + " linhas." }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`);
                  alert("Código copiado para a área de transferência!");
                }}
              >
                Copiar Script
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>URL do App da Web:</label>
              <input 
                type="url" 
                className="input-field" 
                placeholder="https://script.google.com/macros/s/.../exec" 
                value={googleSheetsUrlInput} 
                onChange={e => setGoogleSheetsUrlInput(e.target.value)} 
                style={{ marginBottom: 0 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                style={{ width: 'auto' }}
                onClick={() => {
                  setShowSheetsModal(false);
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                style={{ width: 'auto' }}
                onClick={async () => {
                  if (googleSheetsUrlInput.trim() && !googleSheetsUrlInput.startsWith('https://script.google.com')) {
                    return alert('Por favor, insira uma URL válida do Google Apps Script.');
                  }
                  
                  // Save to Firebase
                  await createFieldWork({
                    ...fw,
                    googleSheetsUrl: googleSheetsUrlInput.trim() || undefined
                  });

                  alert('Configurações de sincronização salvas com sucesso!');
                  setShowSheetsModal(false);
                }}
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
