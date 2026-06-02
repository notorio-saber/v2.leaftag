import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { StatisticalDashboard } from '../components/StatisticalDashboard';
import { 
  calculateShannonIndex, 
  calculateSimpsonIndex, 
  calculatePielouIndex, 
  calculateBasalArea, 
  calculateVolume 
} from '../utils/forestryCalculations';

export const OfficeDashboard = () => {
  const navigate = useNavigate();
  const { fieldWorks, talhoes, inventories, strata, createStratum, deleteStratum, saveInventory } = useInventory();
  const { currentUser, signOut } = useAuth();

  const [activeFwId, setActiveFwId] = useState<string>('');
  const [searchProjectQuery, setSearchProjectQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'talhoes' | 'parcelas' | 'estratos'>('talhoes');
  
  // States for sub-dashboards and audits
  const [auditParcelId, setAuditParcelId] = useState<number | null>(null);
  const [talhaoDashboardId, setTalhaoDashboardId] = useState<string | null>(null);
  const [stratumDashboardId, setStratumDashboardId] = useState<string | null>(null);
  const [showParcelDashboardId, setShowParcelDashboardId] = useState<number | null>(null);
  const [selectedTalhaoId, setSelectedTalhaoId] = useState<string | null>(null);
  const [showProjectDashboard, setShowProjectDashboard] = useState(false);

  // States for Strata Creation Modal
  const [showStratumModal, setShowStratumModal] = useState(false);
  const [newStratumName, setNewStratumName] = useState('');
  const [newStratumArea, setNewStratumArea] = useState('');
  const [newStratumDesc, setNewStratumDesc] = useState('');

  // Filter projects by search
  const filteredFieldWorks = useMemo(() => {
    return fieldWorks.filter(fw => 
      fw.nome.toLowerCase().includes(searchProjectQuery.toLowerCase()) ||
      (fw.local && fw.local.toLowerCase().includes(searchProjectQuery.toLowerCase()))
    );
  }, [fieldWorks, searchProjectQuery]);

  // Set first fieldwork as active by default on load, and reset filters on change
  useEffect(() => {
    if (fieldWorks.length > 0 && !activeFwId) {
      setActiveFwId(fieldWorks[0].id);
    }
    setSelectedTalhaoId(null);
  }, [fieldWorks, activeFwId]);

  const activeFw = useMemo(() => {
    return fieldWorks.find(f => f.id === activeFwId);
  }, [fieldWorks, activeFwId]);

  const activeParcels = useMemo(() => {
    return inventories.filter(i => i.fieldWorkId === activeFwId);
  }, [inventories, activeFwId]);

  const activeTalhoes = useMemo(() => {
    return talhoes.filter(t => t.fieldWorkId === activeFwId);
  }, [talhoes, activeFwId]);

  const activeStrata = useMemo(() => {
    return strata.filter(s => s.fieldWorkId === activeFwId);
  }, [strata, activeFwId]);

  // Helper to calculate KPIs for any list of parcels
  const getKpisForParcels = (parcelsList: typeof activeParcels) => {
    let totalTrees = 0;
    let totalArea = 0;
    let totalG = 0;
    let totalV = 0;
    const factorForma = 0.7;

    const spCount: Record<string, number> = {};

    const processCapDap = (capVal?: any, dapVal?: any) => {
       let d = 0;
       if (dapVal) d = parseFloat(dapVal.toString());
       else if (capVal) d = parseFloat(capVal.toString()) / Math.PI;
       return isNaN(d) ? 0 : d;
    };

    parcelsList.forEach(p => {
      totalTrees += p.dados.length;
      totalArea += p.areaParcela;

      p.dados.forEach(ind => {
        const spName = (ind.nomePopular || ind.nomeCientifico || 'Não Identificada').trim();
        spCount[spName] = (spCount[spName] || 0) + 1;

        let maxHtObj = ind.ht ? parseFloat(ind.ht.toString()) : 0;
        let stemsProps: { cap: number, ht: number }[] = [];
        
        if (ind.multipleStems && ind.stems) {
          ind.stems.forEach((s: any) => {
            stemsProps.push({
              cap: parseFloat((s.cap||'0').toString()),
              ht: parseFloat((s.altura||'0').toString())
            });
          });
        } else {
          const mainDap = processCapDap(ind.cap, ind.dap);
          const ht = parseFloat((ind.ht||'0').toString());
          if (mainDap > 0) {
            stemsProps.push({ cap: ind.cap ? parseFloat(ind.cap.toString()) : mainDap*Math.PI, ht: ht });
          }
        }
        
        stemsProps.forEach(stem => {
          const g = calculateBasalArea(stem.cap);
          const v = calculateVolume(g, stem.ht || maxHtObj, factorForma);
          totalG += g;
          totalV += v;
        });
      });
    });

    const speciesCount = Object.keys(spCount).length;
    const shannon = calculateShannonIndex(spCount);
    const simpson = calculateSimpsonIndex(spCount);
    const pielou = calculatePielouIndex(shannon, speciesCount);

    return {
      totalTrees,
      totalArea,
      totalG,
      totalV,
      speciesCount,
      shannon,
      simpson,
      pielou
    };
  };

  // Calculations for general KPIs
  const kpis = useMemo(() => getKpisForParcels(activeParcels), [activeParcels]);

  const talhaoParcels = useMemo(() => {
    if (!selectedTalhaoId) return [];
    return activeParcels.filter(p => p.talhaoId === selectedTalhaoId);
  }, [activeParcels, selectedTalhaoId]);

  const talhaoKpis = useMemo(() => {
    return getKpisForParcels(talhaoParcels);
  }, [talhaoParcels]);

  // Stratified inventory calculations
  const stratifiedStats = useMemo(() => {
    let totalForestArea = 0;
    activeStrata.forEach(s => totalForestArea += s.area);

    const strataDetails = activeStrata.map(s => {
      const stratumParcels = activeParcels.filter(p => p.stratumId === s.id);
      const nh = stratumParcels.length;

      // Calculate volume per hectare for each parcel in this stratum
      const volumesHa = stratumParcels.map(p => {
        let vParcel = 0;
        const factorForma = 0.7;

        const processCapDap = (capVal?: any, dapVal?: any) => {
           let d = 0;
           if (dapVal) d = parseFloat(dapVal.toString());
           else if (capVal) d = parseFloat(capVal.toString()) / Math.PI;
           return isNaN(d) ? 0 : d;
        };

        p.dados.forEach(ind => {
          let maxHtObj = ind.ht ? parseFloat(ind.ht.toString()) : 0;
          let stemsProps: { cap: number, ht: number }[] = [];
          
          if (ind.multipleStems && ind.stems) {
            ind.stems.forEach((st: any) => {
              stemsProps.push({
                cap: parseFloat((st.cap||'0').toString()),
                ht: parseFloat((st.altura||'0').toString())
              });
            });
          } else {
            const mainDap = processCapDap(ind.cap, ind.dap);
            const ht = parseFloat((ind.ht||'0').toString());
            if (mainDap > 0) {
              stemsProps.push({ cap: ind.cap ? parseFloat(ind.cap.toString()) : mainDap*Math.PI, ht: ht });
            }
          }
          
          stemsProps.forEach(stem => {
            const g = calculateBasalArea(stem.cap);
            const v = calculateVolume(g, stem.ht || maxHtObj, factorForma);
            vParcel += v;
          });
        });

        // Convert to per-hectare value
        const areaHa = p.areaParcela / 10000;
        return areaHa > 0 ? vParcel / areaHa : 0;
      });

      // Stratum mean (m³/ha)
      const meanV = nh > 0 ? volumesHa.reduce((acc, val) => acc + val, 0) / nh : 0;

      // Stratum variance (s²)
      let varianceV = 0;
      if (nh > 1) {
        const sumSq = volumesHa.reduce((acc, val) => acc + Math.pow(val - meanV, 2), 0);
        varianceV = sumSq / (nh - 1);
      }

      const Wh = totalForestArea > 0 ? s.area / totalForestArea : 0;

      return {
        stratum: s,
        nh,
        Wh,
        meanV,
        varianceV,
        volumesHa
      };
    });

    // Ponderated calculations
    let meanSt = 0;
    let varMeanSt = 0;
    let totalN = 0;

    strataDetails.forEach(d => {
      meanSt += d.Wh * d.meanV;
      totalN += d.nh;
      if (d.nh > 0) {
        // s2(mean_st) = sum(Wh^2 * sh^2 / nh)
        varMeanSt += Math.pow(d.Wh, 2) * (d.varianceV / d.nh);
      }
    });

    const errorStd = Math.sqrt(varMeanSt);
    const tVal = 2.0; // Padrão prático adotado para nível de confiança ~95%
    const errorAbs = tVal * errorStd;
    const errorRel = meanSt > 0 ? (errorAbs / meanSt) * 100 : 0;

    const totalVolumeForest = meanSt * totalForestArea;
    const lowerVolumeForest = Math.max(0, (meanSt - errorAbs) * totalForestArea);
    const upperVolumeForest = (meanSt + errorAbs) * totalForestArea;

    return {
      totalForestArea,
      strataDetails,
      meanSt,
      errorStd,
      errorAbs,
      errorRel,
      totalVolumeForest,
      lowerVolumeForest,
      upperVolumeForest,
      totalN
    };
  }, [activeStrata, activeParcels]);

  // Projects level Excel Consolidated Export
  const handleExportAll = () => {
    if (!activeFw) return;
    const allData: any[] = [];
    activeParcels.forEach(inv => {
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
    XLSX.writeFile(workbook, `Projeto_${activeFw.nome.replace(/\s+/g, '_')}_Completo.xlsx`);
  };

  // Talhão level Excel Export
  const handleExportTalhao = (talhaoId: string, talhaoNome: string) => {
    const talhaoParcels = activeParcels.filter(p => p.talhaoId === talhaoId);
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

  // Parcela level processed Excel Export
  const handleExportParcelProcessed = (inv: any) => {
    const data = inv.dados.map((ind: any) => {
      let baseData: any = {
        'Talhão': activeTalhoes.find(t => t.id === inv.talhaoId)?.nome || 'Sem Talhão',
        'Parcela': inv.nome,
        'Parcela Coordenadas': inv.coordenadas || '',
        'Número': ind.numeroIndividuo,
        'Data / Hora': ind.timestamp,
        ...ind,
      };

      delete baseData.stems;
      delete baseData.multipleStems;
      delete baseData.id;

      const g = calculateBasalArea(parseFloat(ind.cap || 0));
      baseData['Area_Basal (m2)'] = g.toFixed(4);
      baseData['Volume (m3)'] = calculateVolume(g, parseFloat(ind.ht || 0), 0.7).toFixed(4);
      baseData['DAP_Equivalente (cm)'] = ind.cap ? (parseFloat(ind.cap) / Math.PI).toFixed(2) : '0';
      return baseData;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Processados");
    XLSX.writeFile(workbook, `Parcela_${inv.nome.replace(/\s+/g, '_')}_processados.xlsx`);
  };

  const auditParcel = useMemo(() => {
    if (auditParcelId === null) return null;
    return inventories.find(i => i.id === auditParcelId);
  }, [inventories, auditParcelId]);

  const auditParcelKpis = useMemo(() => {
    if (!auditParcel) return null;
    return getKpisForParcels([auditParcel]);
  }, [auditParcel]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#020503', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", overflowX: 'hidden' }}>
      
      {/* Sidebar (List of projects) */}
      <div style={{ width: '320px', background: 'rgba(5, 13, 8, 0.4)', backdropFilter: 'blur(30px)', borderRight: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* Brand Header */}
        <div style={{ padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px' }} />
            <div>
              <h1 style={{ color: 'var(--primary-color)', fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '0.5px' }}>LeafTag</h1>
              <span style={{ fontSize: '11px', color: '#00e676', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>Painel Escritório</span>
            </div>
          </div>
          <div>
            <button 
              onClick={() => {
                localStorage.setItem('preferredMode', 'field');
                navigate('/');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.45)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '4px 0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                fontWeight: '600'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#00e676';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)';
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
              Ir para Modo Campo
            </button>
          </div>
        </div>

        {/* Project search */}
        <div style={{ padding: '8px 24px' }}>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Pesquisar projetos..."
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', fontSize: '13px', paddingLeft: '34px', marginBottom: 0 }}
              value={searchProjectQuery}
              onChange={e => setSearchProjectQuery(e.target.value)}
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </div>

        {/* Project list items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
            Trabalhos de Campo ({filteredFieldWorks.length})
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredFieldWorks.map(fw => {
              const count = inventories.filter(i => i.fieldWorkId === fw.id).length;
              const isActive = fw.id === activeFwId;
              return (
                <div 
                  key={fw.id} 
                  onClick={() => setActiveFwId(fw.id)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                    border: isActive ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {isActive && (
                    <div style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '20px', background: 'var(--primary-color)', borderRadius: '0 4px 4px 0' }} />
                  )}
                  <h4 style={{ fontSize: '13.5px', margin: 0, fontWeight: '700', color: isActive ? 'var(--primary-hover)' : '#fff' }}>{fw.nome}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Local: {fw.local} | {count} parcelas
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Profile Footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', display: 'block' }}>{currentUser?.displayName || 'Escritório'}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{currentUser?.email}</span>
            </div>
            <button 
              onClick={signOut}
              style={{ background: 'transparent', border: 'none', color: '#ff4d6d', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Sair
            </button>
          </div>
        </div>

      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        {activeFw ? (
          <div style={{ padding: '32px', boxSizing: 'border-box', width: '100%' }}>
            
            {/* Project Title and Header buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '28px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '1px' }}>Projeto Selecionado</span>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', margin: '4px 0 0 0' }}>{activeFw.nome}</h2>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Fazenda/Local: {activeFw.local} | Data Inicial: {activeFw.dataInicio}</span>
              </div>
              
              {activeParcels.length > 0 && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '10px 20px', borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)' }} 
                    onClick={() => setShowProjectDashboard(true)}
                  >
                    Dashboard Geral
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: 'auto', padding: '10px 20px' }} 
                    onClick={handleExportAll}
                  >
                    Exportar Excel Completo
                  </button>
                </div>
              )}
            </div>

            {/* KPI Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              
              <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Indivíduos Totais</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#4fc3f7' }}>{kpis.totalTrees}</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Árvores e Fustes Coletados</span>
              </div>

              <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Riqueza (Espécies)</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#aed581' }}>{kpis.speciesCount}</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Espécies Mapeadas em Campo</span>
              </div>

              <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Biomassa Agregada</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#ba68c8' }}>{kpis.totalV.toFixed(2)} m³</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Volume Comercial Estimado</span>
              </div>

              <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Diversidade Shannon</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#ffb74d' }}>{kpis.shannon.toFixed(3)}</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Índice de Diversidade Ecológica</span>
              </div>

            </div>

            {/* Abas layout for Talhões / Parcelas / Estratos */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
              <button 
                onClick={() => setActiveTab('talhoes')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'talhoes' ? '2px solid var(--primary-color)' : '2px solid transparent',
                  color: activeTab === 'talhoes' ? 'var(--primary-hover)' : 'var(--text-muted)',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14.5px'
                }}
              >
                Talhões ({activeTalhoes.length})
              </button>
              <button 
                onClick={() => setActiveTab('parcelas')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'parcelas' ? '2px solid var(--primary-color)' : '2px solid transparent',
                  color: activeTab === 'parcelas' ? 'var(--primary-hover)' : 'var(--text-muted)',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14.5px'
                }}
              >
                Parcelas ({activeParcels.length})
              </button>
              <button 
                onClick={() => setActiveTab('estratos')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'estratos' ? '2px solid var(--primary-color)' : '2px solid transparent',
                  color: activeTab === 'estratos' ? 'var(--primary-hover)' : 'var(--text-muted)',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14.5px'
                }}
              >
                Estratos ({activeStrata.length})
              </button>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'talhoes' ? (
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                {activeTalhoes.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum talhão cadastrado neste projeto.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome do Talhão</th>
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Observações</th>
                          <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Nº Parcelas</th>
                          <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Nº Árvores</th>
                          <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '280px' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTalhoes.map(t => {
                          const talParcels = activeParcels.filter(p => p.talhaoId === t.id);
                          let treesCount = 0;
                          talParcels.forEach(p => treesCount += p.dados.length);

                          return (
                            <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '18px 24px', fontWeight: 'bold' }}>{t.nome}</td>
                              <td style={{ padding: '18px 24px', color: 'var(--text-muted)', fontSize: '13px' }}>{t.observacoes || 'Sem observações'}</td>
                              <td style={{ padding: '18px 24px', textAlign: 'center', fontWeight: 'bold' }}>{talParcels.length}</td>
                              <td style={{ padding: '18px 24px', textAlign: 'center', color: '#4fc3f7', fontWeight: 'bold' }}>{treesCount}</td>
                              <td style={{ padding: '18px 24px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', borderColor: '#00e676', color: '#00e676', background: 'rgba(0, 230, 118, 0.08)' }} 
                                    onClick={() => {
                                      setSelectedTalhaoId(t.id);
                                      setActiveTab('parcelas');
                                    }}
                                  >
                                    Ver Parcelas
                                  </button>
                                  {talParcels.length > 0 && (
                                    <>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)' }} 
                                        onClick={() => setTalhaoDashboardId(t.id)}
                                      >
                                        Dashboard
                                      </button>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', borderColor: '#00838f', color: '#80deea', background: 'rgba(0, 131, 143, 0.08)' }} 
                                        onClick={() => handleExportTalhao(t.id, t.nome)}
                                      >
                                        Planilha Excel
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeTab === 'parcelas' ? (
              <div className="glass-card" style={{ padding: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
                {selectedTalhaoId && (
                  <div style={{ marginBottom: '20px' }}>
                    {/* Filter Banner */}
                    <div style={{
                      background: 'rgba(0, 230, 118, 0.06)',
                      border: '1px solid rgba(0, 230, 118, 0.15)',
                      borderRadius: '12px',
                      padding: '12px 20px',
                      marginBottom: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '13px', color: '#a5d6a7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        Filtrado pelo Talhão: <strong style={{ color: '#fff', fontSize: '14px' }}>{activeTalhoes.find(t => t.id === selectedTalhaoId)?.nome || 'Sem Nome'}</strong>
                      </span>
                      <button 
                        onClick={() => setSelectedTalhaoId(null)}
                        style={{
                          background: 'rgba(255, 77, 109, 0.1)',
                          border: '1px solid rgba(255, 77, 109, 0.25)',
                          borderRadius: '8px',
                          color: '#ff4d6d',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          padding: '6px 12px',
                          transition: 'all 0.2s',
                          borderStyle: 'solid'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 77, 109, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 77, 109, 0.1)';
                        }}
                      >
                        Remover Filtro
                      </button>
                    </div>

                    {/* Talhão KPI Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ padding: '12px 16px', background: 'rgba(79, 195, 247, 0.03)', border: '1px solid rgba(79, 195, 247, 0.08)', borderRadius: '12px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(79, 195, 247, 0.7)', textTransform: 'uppercase', fontWeight: 'bold' }}>Árvores do Talhão</span>
                        <span style={{ fontSize: '18px', color: '#4fc3f7', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                          {talhaoKpis.totalTrees}
                        </span>
                      </div>
                      <div style={{ padding: '12px 16px', background: 'rgba(174, 213, 129, 0.03)', border: '1px solid rgba(174, 213, 129, 0.08)', borderRadius: '12px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(174, 213, 129, 0.7)', textTransform: 'uppercase', fontWeight: 'bold' }}>Riqueza do Talhão</span>
                        <span style={{ fontSize: '18px', color: '#aed581', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                          {talhaoKpis.speciesCount}
                        </span>
                      </div>
                      <div style={{ padding: '12px 16px', background: 'rgba(186, 104, 200, 0.03)', border: '1px solid rgba(186, 104, 200, 0.08)', borderRadius: '12px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(186, 104, 200, 0.7)', textTransform: 'uppercase', fontWeight: 'bold' }}>Volume do Talhão</span>
                        <span style={{ fontSize: '18px', color: '#ba68c8', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                          {talhaoKpis.totalV.toFixed(2)} m³
                        </span>
                      </div>
                      <div style={{ padding: '12px 16px', background: 'rgba(255, 183, 77, 0.03)', border: '1px solid rgba(255, 183, 77, 0.08)', borderRadius: '12px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(255, 183, 77, 0.7)', textTransform: 'uppercase', fontWeight: 'bold' }}>Shannon do Talhão</span>
                        <span style={{ fontSize: '18px', color: '#ffb74d', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                          {talhaoKpis.shannon.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeParcels.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhuma parcela cadastrada neste projeto.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome da Parcela</th>
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Talhão</th>
                          {activeStrata.length > 0 && (
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estrato</th>
                          )}
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coordenadas GPS</th>
                          <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '110px' }}>Área (m²)</th>
                          <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '110px' }}>Árvores</th>
                          <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '320px' }}>Ações de Auditoria</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedTalhaoId ? activeParcels.filter(p => p.talhaoId === selectedTalhaoId) : activeParcels).map(p => {
                          const talName = activeTalhoes.find(t => t.id === p.talhaoId)?.nome || 'Sem Talhão';
                          return (
                            <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '18px 24px', fontWeight: 'bold' }}>{p.nome}</td>
                              <td style={{ padding: '18px 24px', color: '#ff9800', fontSize: '13.5px', fontWeight: 'bold' }}>{talName}</td>
                              {activeStrata.length > 0 && (
                                <td style={{ padding: '18px 24px' }}>
                                  <select 
                                    value={p.stratumId || ''} 
                                    onChange={async (e) => {
                                      const newStratumId = e.target.value;
                                      const updatedInv = { ...p, stratumId: newStratumId || undefined };
                                      if (!newStratumId) delete updatedInv.stratumId;
                                      await saveInventory(updatedInv);
                                    }}
                                    style={{
                                      background: 'rgba(0,0,0,0.3)',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      color: '#fff',
                                      fontSize: '12.5px',
                                      padding: '6px 10px',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      outline: 'none',
                                      fontFamily: 'inherit',
                                    }}
                                  >
                                    <option value="">-- Sem Estrato --</option>
                                    {activeStrata.map(s => (
                                      <option key={s.id} value={s.id}>{s.nome}</option>
                                    ))}
                                  </select>
                                </td>
                              )}
                              <td style={{ padding: '18px 24px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{p.coordenadas || 'Não coletada'}</td>
                              <td style={{ padding: '18px 24px', textAlign: 'center' }}>{p.areaParcela}</td>
                              <td style={{ padding: '18px 24px', textAlign: 'center', color: '#aed581', fontWeight: 'bold' }}>{p.dados.length}</td>
                              <td style={{ padding: '18px 24px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ width: 'auto', padding: '6px 12px', fontSize: '11px' }} 
                                    onClick={() => setAuditParcelId(p.id)}
                                  >
                                    Auditar Dados
                                  </button>
                                  {p.dados.length > 0 && (
                                    <>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)' }} 
                                        onClick={() => setShowParcelDashboardId(p.id)}
                                      >
                                        Dashboard
                                      </button>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }} 
                                        onClick={() => handleExportParcelProcessed(p)}
                                      >
                                        Exportar Excel
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* ESTRATOS TAB VIEW */
              <div className="glass-card" style={{ padding: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Estratos Florestais</h3>
                  <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '12px' }} onClick={() => setShowStratumModal(true)}>
                    + Novo Estrato
                  </button>
                </div>

                {activeStrata.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                    <h4 style={{ margin: '0 0 8px 0', color: '#fff' }}>Nenhum estrato cadastrado neste projeto</h4>
                    <p style={{ fontSize: '13px', color: '#666', maxWidth: '500px', margin: '0 auto', lineHeight: 1.5 }}>
                      A estratificação é opcional. Se você trabalha com inventários mais simples, não precisa preencher esta aba. Use-a apenas se quiser agrupar parcelas semelhantes (por clone, idade ou sítio) para rodar o cálculo de suficiência e reduzir o erro de amostragem.
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto', marginBottom: '32px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome do Estrato</th>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descrição</th>
                            <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Área (ha)</th>
                            <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Peso (Wh)</th>
                            <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Nº Parcelas</th>
                            <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '220px' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stratifiedStats.strataDetails.map(d => (
                            <tr key={d.stratum.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '14px 20px', fontWeight: 'bold' }}>{d.stratum.nome}</td>
                              <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '12.5px' }}>{d.stratum.descricao || 'Sem descrição'}</td>
                              <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 'bold' }}>{d.stratum.area} ha</td>
                              <td style={{ padding: '14px 20px', textAlign: 'center', color: '#ffb74d', fontWeight: 'bold' }}>{(d.Wh * 100).toFixed(1)}%</td>
                              <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 'bold', color: '#4fc3f7' }}>{d.nh}</td>
                              <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  {d.nh > 0 && (
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)' }} 
                                      onClick={() => setStratumDashboardId(d.stratum.id)}
                                    >
                                      Dashboard
                                    </button>
                                  )}
                                  <button 
                                    className="btn btn-danger" 
                                    style={{ width: 'auto', padding: '4px 10px', fontSize: '10px', height: 'auto' }} 
                                    onClick={() => {
                                      if (confirm(`Deseja deletar o estrato ${d.stratum.nome}? Todas as parcelas associadas a ele ficarão sem estrato.`)) {
                                        deleteStratum(d.stratum.id);
                                      }
                                    }}
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Calculations summary card */}
                    <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,230,118,0.02)', borderRadius: '16px', marginBottom: 0 }}>
                      <h4 style={{ color: 'var(--primary-hover)', fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>
                        Relatório Estatístico: Amostragem Casual Estratificada
                      </h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume Médio Estratificado</span>
                          <span style={{ fontSize: '18px', color: '#fff', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                            {stratifiedStats.meanSt.toFixed(2)} m³/ha
                          </span>
                        </div>
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Erro de Amostragem Relativo</span>
                          <span style={{ fontSize: '18px', color: stratifiedStats.errorRel <= 10 ? '#aed581' : '#ffb74d', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                            {stratifiedStats.errorRel.toFixed(2)}%
                            <span style={{ fontSize: '10px', display: 'block', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
                              {stratifiedStats.errorRel <= 10 ? '✅ Dentro do limite (10%)' : '⚠️ Fora do limite (10%)'}
                            </span>
                          </span>
                        </div>
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume Total Floresta</span>
                          <span style={{ fontSize: '18px', color: '#ba68c8', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                            {stratifiedStats.totalVolumeForest.toFixed(2)} m³
                          </span>
                        </div>
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Intervalo de Confiança (95%)</span>
                          <span style={{ fontSize: '13px', color: '#fff', display: 'block', marginTop: '4px', fontFamily: 'monospace' }}>
                            [{stratifiedStats.lowerVolumeForest.toFixed(1)} - {stratifiedStats.upperVolumeForest.toFixed(1)}] m³
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        ℹ️ **Nota Silvicultural**: Os cálculos utilizam a metodologia oficial de Amostragem Casual Estratificada (Student t = {2.0} com 95% de confiança). Para resultados estatisticamente válidos, certifique-se de cadastrar pelo menos 2 parcelas em cada estrato.
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <h3>Nenhum Projeto Encontrado</h3>
            <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>Por favor, retorne ao Modo Campo para criar o seu primeiro trabalho.</p>
          </div>
        )}
      </div>

      {/* Embedded Read-only Audit Modal */}
      {auditParcel && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', 
          zIndex: 10000, padding: '20px', overflowY: 'auto', backdropFilter: 'blur(8px)'
        }}>
           <div className="glass-card" style={{ width: '100%', maxWidth: '840px', marginTop: '40px', marginBottom: '40px', padding: '24px 32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold' }}>Visualização e Auditoria</span>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: '2px 0 0 0' }}>Inspeção da Parcela: {auditParcel.nome}</h3>
                </div>
                <button onClick={() => setAuditParcelId(null)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
              </div>

              {/* Parcela Info Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Talhão</span>
                  <span style={{ fontSize: '14.5px', color: '#ff9800', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>
                    {activeTalhoes.find(t => t.id === auditParcel.talhaoId)?.nome || 'Sem Talhão'}
                  </span>
                </div>
                {activeStrata.length > 0 && (
                  <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Estrato Florestal</span>
                    <span style={{ fontSize: '14px', color: '#00e676', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>
                      {activeStrata.find(s => s.id === auditParcel.stratumId)?.nome || 'Sem Estrato'}
                    </span>
                  </div>
                )}
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Área Amostral</span>
                  <span style={{ fontSize: '14.5px', color: '#fff', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>
                    {auditParcel.areaParcela} m²
                  </span>
                </div>
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Coordenadas GPS</span>
                  <span style={{ fontSize: '13px', color: '#fff', fontFamily: 'monospace', display: 'block', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {auditParcel.coordenadas || 'Não Coletadas'}
                  </span>
                </div>
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Observações</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {auditParcel.observacoes || 'Sem Observações'}
                  </span>
                </div>
              </div>

              {/* Parcela KPI Summary Grid */}
              {auditParcelKpis && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ padding: '12px 16px', background: 'rgba(79, 195, 247, 0.04)', border: '1px solid rgba(79, 195, 247, 0.15)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(79, 195, 247, 0.8)', textTransform: 'uppercase', fontWeight: 'bold' }}>Árvores na Parcela</span>
                    <span style={{ fontSize: '18px', color: '#4fc3f7', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                      {auditParcelKpis.totalTrees}
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px', background: 'rgba(174, 213, 129, 0.04)', border: '1px solid rgba(174, 213, 129, 0.15)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(174, 213, 129, 0.8)', textTransform: 'uppercase', fontWeight: 'bold' }}>Riqueza (Espécies)</span>
                    <span style={{ fontSize: '18px', color: '#aed581', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                      {auditParcelKpis.speciesCount}
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px', background: 'rgba(186, 104, 200, 0.04)', border: '1px solid rgba(186, 104, 200, 0.15)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(186, 104, 200, 0.8)', textTransform: 'uppercase', fontWeight: 'bold' }}>Volume Parcela</span>
                    <span style={{ fontSize: '18px', color: '#ba68c8', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                      {auditParcelKpis.totalV.toFixed(3)} m³
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px', background: 'rgba(255, 183, 77, 0.04)', border: '1px solid rgba(255, 183, 77, 0.15)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255, 183, 77, 0.8)', textTransform: 'uppercase', fontWeight: 'bold' }}>Shannon (H')</span>
                    <span style={{ fontSize: '18px', color: '#ffb74d', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                      {auditParcelKpis.shannon.toFixed(3)}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions Row */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '8px 16px', fontSize: '12px', borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)' }}
                  onClick={() => setShowParcelDashboardId(auditParcel.id)}
                >
                  📊 Ver Dashboard da Parcela
                </button>
                {auditParcel.dados.length > 0 && (
                  <button
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '8px 16px', fontSize: '12px', borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}
                    onClick={() => handleExportParcelProcessed(auditParcel)}
                  >
                    📥 Exportar Excel da Parcela
                  </button>
                )}
              </div>

              <div style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.2)', padding: '12px 18px', borderRadius: '12px', fontSize: '13px', color: '#a5d6a7', marginBottom: '20px' }}>
                👉 <strong>Modo Somente Leitura (Audit Panel)</strong>: Este espaço destina-se apenas à verificação e auditoria de consistência das árvores cadastradas em campo. Modificações ou exclusões acidentais estão bloqueadas no ambiente de escritório.
              </div>

              {/* Data Table */}
              {auditParcel.dados.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px 0' }}>Nenhuma árvore cadastrada nesta parcela ainda.</p>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 1 }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nº</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hora Cadastro</th>
                        {auditParcel.colunas.map(col => (
                          <th key={col.id} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{col.nome}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditParcel.dados.map((ind: any) => (
                        <tr key={ind.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{ind.numeroIndividuo}</td>
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(ind.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                          {auditParcel.colunas.map(col => (
                            <td key={col.id} style={{ padding: '12px 16px', fontSize: '13px' }}>
                              {col.id === 'coordenadas' ? ind[col.id]?.substring(0, 15) + '...' : ind[col.id]}
                              {ind.multipleStems && ['cap', 'hc', 'ht'].includes(col.id) ? ` [Bifurcado: ${ind.stems?.length}]` : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setAuditParcelId(null)}>Fechar Auditoria</button>
              </div>
           </div>
        </div>
      )}

      {/* Strata Creation Modal */}
      {showStratumModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', margin: 0 }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary-hover)', fontWeight: '800' }}>Novo Estrato Florestal</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', marginBottom: '16px' }}>Crie uma nova subdivisão florestal homogênea.</p>
            
            <input className="input-field" placeholder="Nome (Ex: Eucalipto 5 anos - Argiloso)" value={newStratumName} onChange={e => setNewStratumName(e.target.value)} style={{ marginTop: '8px' }} />
            <input type="number" step="0.01" className="input-field" placeholder="Área Total do Estrato (Hectares)" value={newStratumArea} onChange={e => setNewStratumArea(e.target.value)} />
            <textarea className="input-field" placeholder="Descrição/Observações opcional" value={newStratumDesc} onChange={e => setNewStratumDesc(e.target.value)} style={{ minHeight: '80px', fontFamily: 'inherit' }} />
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => {
                setShowStratumModal(false);
                setNewStratumName('');
                setNewStratumArea('');
                setNewStratumDesc('');
              }}>Cancelar</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!newStratumName) return alert('Dê um nome ao estrato.');
                const areaNum = parseFloat(newStratumArea);
                if (isNaN(areaNum) || areaNum <= 0) return alert('Digite uma área válida maior que zero.');

                await createStratum({
                  id: Date.now().toString(),
                  fieldWorkId: activeFwId,
                  nome: newStratumName,
                  area: areaNum,
                  descricao: newStratumDesc || undefined
                });

                setShowStratumModal(false);
                setNewStratumName('');
                setNewStratumArea('');
                setNewStratumDesc('');
              }}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Sub-dashboards */}
      {showProjectDashboard && activeParcels.length > 0 && (
        <StatisticalDashboard 
          inventories={activeParcels} 
          onClose={() => setShowProjectDashboard(false)} 
        />
      )}

      {talhaoDashboardId && (
        <StatisticalDashboard 
          inventories={activeParcels.filter(p => p.talhaoId === talhaoDashboardId)} 
          onClose={() => setTalhaoDashboardId(null)} 
        />
      )}

      {stratumDashboardId && (
        <StatisticalDashboard 
          inventories={activeParcels.filter(p => p.stratumId === stratumDashboardId)} 
          onClose={() => setStratumDashboardId(null)} 
        />
      )}

      {showParcelDashboardId && (
        <StatisticalDashboard 
          inventories={activeParcels.filter(p => p.id === showParcelDashboardId)} 
          onClose={() => setShowParcelDashboardId(null)} 
        />
      )}

    </div>
  );
};
