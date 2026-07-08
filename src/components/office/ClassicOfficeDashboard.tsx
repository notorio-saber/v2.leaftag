import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { SortimentoTab } from '../SortimentoTab';
import {
  calculateShannonIndex,
  calculateSimpsonIndex,
  calculatePielouIndex,
  calculateBasalArea,
  calculateVolume,
  cleanResult
} from '../../utils/forestryCalculations';

interface ClassicOfficeDashboardProps {
  activeFw: any;
  activeTab: 'centro-operacoes' | 'talhoes' | 'parcelas' | 'estratos' | 'cubagem' | 'extrapolacao' | 'processamentos' | 'sortimento';
  setActiveTab: (tab: 'centro-operacoes' | 'talhoes' | 'parcelas' | 'estratos' | 'cubagem' | 'extrapolacao' | 'processamentos' | 'sortimento') => void;
  activeParcels: any[];
  activeTalhoes: any[];
  activeStrata: any[];
  activeSortimentResults: any[];
  latestOfficialProcessing: any;
  extrapolationData: any;
  kpis: any;
  stratifiedStats: any;
  allCubagedTrees: any[];
  cubageSortOrder: 'asc' | 'desc' | null;
  setCubageSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc' | null>>;
  
  // Modals & operations
  setEditingTalhao: (val: any) => void;
  setEditTalhaoName: (val: string) => void;
  setEditTalhaoArea: (val: string) => void;
  setEditTalhaoObs: (val: string) => void;
  setAuditParcelId: (id: number | null) => void;
  setTalhaoDashboardId: (id: string | null) => void;
  setStratumDashboardId: (id: string | null) => void;
  setShowParcelDashboardId: (id: number | null) => void;
  selectedTalhaoId: string | null;
  setSelectedTalhaoId: (id: string | null) => void;
  setShowProjectDashboard: (val: boolean) => void;
  setShowStratumModal: (val: boolean) => void;
  setShowBatchProcessModal: (val: boolean) => void;
  setShowSheetsModal: (val: boolean) => void;
  isSyncingSheets: boolean;
  handleExportAll: () => void;
  handleExportAllProcessed: () => void;
  handleSyncGoogleSheets: () => void;
  handleExportTalhao: (id: string, name: string) => void;
  handleExportParcelProcessed: (p: any) => void;
  
  // Height and Volume model selectors
  heightModels: any[];
  volumeModels: any[];
  selectedHeightModelId: string;
  setSelectedHeightModelId: (id: string) => void;
  selectedVolumeModelId: string;
  setSelectedVolumeModelId: (id: string) => void;
  processingFatorForma: string;
  setProcessingFatorForma: (val: string) => void;
  handleProcessParcelDataInOffice: (p: any) => void;
  auditParcel: any;
  auditParcelKpis: any;
  
  // Visualizer properties
  setSelectedVisualizerTree: (t: any) => void;
  setSelectedVisualizerPoint: (p: string) => void;
  setSelectedVisualizerSectionId: (id: string | null) => void;
  
  // Processing properties
  activeProcessings: any[];
  deleteProcessing: (id: string) => void;
  handleDuplicarConfiguracao: (proc: any) => void;
  selectedReportProcessing: any;
  setSelectedReportProcessing: (proc: any) => void;
  showNewProcessModal: boolean;
  setShowNewProcessModal: (val: boolean) => void;
  newProcessName: string;
  setNewProcessName: (val: string) => void;
  newProcessConsolidationMode: 'talhao' | 'stratum' | 'auto';
  setNewProcessConsolidationMode: (val: 'talhao' | 'stratum' | 'auto') => void;
  newProcessFatorCasca: string;
  setNewProcessFatorCasca: (val: string) => void;
  handleCreateInventoryProcessing: (name: string, mode: 'talhao' | 'stratum' | 'auto') => void;
  handleExportAdvancedXLSX: (proc: any) => void;
  reportGenerated: boolean;
  setReportGenerated: (val: boolean) => void;
  
  // Operations center functions
  getStageStatus: (id: number) => string;
  getStagePercent: (id: number) => number;
  getStageName: (id: number) => string;
  getStageKpi: (id: number) => string;
  getStageDescription: (id: number) => string;
  getNextRecommendedStep: () => string;
  getBottlenecks: () => string[];
  handleStageClick: (id: number) => void;
  getNodeIcon: (id: number) => React.ReactNode;
  getNodePos: (id: number, cols: number) => { x: number, y: number };
  cols: number;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
}

export const ClassicOfficeDashboard: React.FC<ClassicOfficeDashboardProps> = ({
  activeFw,
  activeTab,
  setActiveTab,
  activeParcels,
  activeTalhoes,
  activeStrata,
  activeSortimentResults,
  latestOfficialProcessing,
  extrapolationData,
  kpis,
  stratifiedStats,
  allCubagedTrees,
  cubageSortOrder,
  setCubageSortOrder,
  setEditingTalhao,
  setEditTalhaoName,
  setEditTalhaoArea,
  setEditTalhaoObs,
  setAuditParcelId,
  setTalhaoDashboardId,
  setStratumDashboardId,
  setShowParcelDashboardId,
  selectedTalhaoId,
  setSelectedTalhaoId,
  setShowProjectDashboard,
  setShowStratumModal,
  setShowBatchProcessModal,
  setShowSheetsModal,
  isSyncingSheets,
  handleExportAll,
  handleExportAllProcessed,
  handleSyncGoogleSheets,
  handleExportTalhao,
  handleExportParcelProcessed,
  heightModels,
  volumeModels,
  selectedHeightModelId,
  setSelectedHeightModelId,
  selectedVolumeModelId,
  setSelectedVolumeModelId,
  processingFatorForma,
  setProcessingFatorForma,
  handleProcessParcelDataInOffice,
  auditParcel,
  auditParcelKpis,
  setSelectedVisualizerTree,
  setSelectedVisualizerPoint,
  setSelectedVisualizerSectionId,
  activeProcessings,
  deleteProcessing,
  handleDuplicarConfiguracao,
  selectedReportProcessing,
  setSelectedReportProcessing,
  showNewProcessModal,
  setShowNewProcessModal,
  newProcessName,
  setNewProcessName,
  newProcessConsolidationMode,
  setNewProcessConsolidationMode,
  newProcessFatorCasca,
  setNewProcessFatorCasca,
  handleCreateInventoryProcessing,
  handleExportAdvancedXLSX,
  reportGenerated,
  getStageStatus,
  getStagePercent,
  getStageName,
  getStageKpi,
  getStageDescription,
  getNextRecommendedStep,
  getBottlenecks,
  handleStageClick,
  getNodeIcon,
  getNodePos,
  cols,
  mapContainerRef
}) => {
  const navigate = useNavigate();
  const { deleteTalhao, deleteStratum, saveInventory } = useInventory();
  const { theme } = useAuth();
  const isLight = theme === 'light';

  // Classic only local states
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [talhaoFilter, setTalhaoFilter] = useState('');
  const [stratumFilter, setStratumFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [extraTab, setExtraTab] = useState<'parcelas' | 'talhoes' | 'estratos' | 'trabalho'>('parcelas');
  const [selectedProcessAId, setSelectedProcessAId] = useState<string>('');
  const [selectedProcessBId, setSelectedProcessBId] = useState<string>('');

  // Check if filtering is active
  const isFilterActive = dateFilter !== '' || talhaoFilter !== '' || stratumFilter !== '' || statusFilter !== '';

  const filteredParcelsList = useMemo(() => {
    let result = [...activeParcels];

    if (selectedTalhaoId) {
      result = result.filter(p => p.talhaoId === selectedTalhaoId);
    }
    if (dateFilter) {
      const formattedFilterDate = new Date(dateFilter + 'T12:00:00').toLocaleDateString('pt-BR');
      result = result.filter(p => p.dados && p.dados.some((d: any) => d.timestamp && new Date(d.timestamp).toLocaleDateString('pt-BR') === formattedFilterDate));
    }
    if (talhaoFilter) {
      if (talhaoFilter === 'sem-talhao') {
        result = result.filter(p => !p.talhaoId);
      } else {
        result = result.filter(p => p.talhaoId === talhaoFilter);
      }
    }
    if (stratumFilter) {
      result = result.filter(p => p.stratumId === stratumFilter);
    }
    if (statusFilter) {
      result = result.filter(p => p.status === statusFilter);
    }

    return result;
  }, [activeParcels, selectedTalhaoId, dateFilter, talhaoFilter, stratumFilter, statusFilter]);

  // Compute KPIs for specific filtered talhao
  const talhaoKpis = useMemo(() => {
    if (!selectedTalhaoId) return { totalTrees: 0, speciesCount: 0, totalV: 0, shannon: 0 };
    const talhaoParcels = activeParcels.filter(p => p.talhaoId === selectedTalhaoId);
    
    // KPI Calculation helper
    let totalTrees = 0;
    let totalV = 0;
    const spCount: Record<string, number> = {};
    const factorForma = 0.7;

    const processCapDap = (capVal?: any, dapVal?: any) => {
       let d = 0;
       if (dapVal) d = parseFloat(dapVal.toString());
       else if (capVal) d = parseFloat(capVal.toString()) / Math.PI;
       return isNaN(d) ? 0 : d;
    };

    talhaoParcels.forEach(p => {
      totalTrees += p.dados.length;

      p.dados.forEach((ind: any) => {
        const spName = (ind.nomePopular || ind.nomeCientifico || 'Não Identificada').trim();
        spCount[spName] = (spCount[spName] || 0) + 1;

        let maxHtObj = ind.alturaUtilizada !== undefined ? ind.alturaUtilizada : (ind.ht ? parseFloat(ind.ht.toString()) : 0);
        let stemsProps: { cap: number, ht: number, volumeProcessado?: number }[] = [];
        
        if (ind.multipleStems && ind.stems) {
          ind.stems.forEach((s: any) => {
            stemsProps.push({
              cap: parseFloat((s.cap||'0').toString()),
              ht: s.alturaProcessada !== undefined ? s.alturaProcessada : parseFloat((s.altura||'0').toString()),
              volumeProcessado: s.volumeProcessado
            });
          });
        } else {
          const mainDap = processCapDap(ind.cap, ind.dap);
          const ht = ind.alturaUtilizada !== undefined ? ind.alturaUtilizada : parseFloat((ind.ht||'0').toString());
          if (mainDap > 0) {
            stemsProps.push({ cap: ind.cap ? parseFloat(ind.cap.toString()) : mainDap*Math.PI, ht: ht });
          }
        }
        
        stemsProps.forEach(stem => {
          const g = calculateBasalArea(stem.cap);
          let v = 0;
          if (ind.volumeCalculado !== undefined) {
            if (ind.multipleStems) {
              v = stem.volumeProcessado !== undefined ? stem.volumeProcessado : calculateVolume(g, stem.ht || maxHtObj, factorForma);
            } else {
              v = ind.volumeCalculado;
            }
          } else {
            v = calculateVolume(g, stem.ht || maxHtObj, factorForma);
          }
          totalV += v;
        });
      });
    });

    const speciesCount = Object.keys(spCount).length;
    const shannon = calculateShannonIndex(spCount);

    return {
      totalTrees,
      speciesCount,
      totalV,
      shannon
    };
  }, [selectedTalhaoId, activeParcels]);

  const renderCentroOperacoes = () => {
    try {
      const nextStep = getNextRecommendedStep();
      const bottlenecks = getBottlenecks();
      
      let completedStagesCount = 0;
      for (let i = 1; i <= 11; i++) {
        if (getStageStatus(i) === 'complete') {
          completedStagesCount++;
        }
      }
      const overallProgress = Math.round((completedStagesCount / 11) * 100);

      const totalArea = activeTalhoes.reduce((acc, t) => {
        const aVal = t.area ? (typeof t.area === 'number' ? t.area : parseFloat(t.area as any) || 0) : 0;
        return acc + aVal;
      }, 0);
      
      const completedParcelsCount = activeParcels.filter(p => p.status === 'Concluído').length;
      const totalVolume = latestOfficialProcessing 
        ? (typeof latestOfficialProcessing.volumeTotalEstimado === 'number' 
            ? latestOfficialProcessing.volumeTotalEstimado 
            : parseFloat(latestOfficialProcessing.volumeTotalEstimado as any) || 0) 
        : 0;

      return (
        <div className="operation-center" style={{ animation: 'fadeInUp 0.6s ease' }}>
          {/* PANEL DE INDICADORES EXECUTIVOS */}
          <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-hover)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
                  <span>Centro de Operações LeafTag</span>
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Mapa operacional do inventário florestal
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Progresso do Projeto</span>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#00e676', marginTop: '2px' }}>{overallProgress}%</div>
                </div>
                <div style={{ width: '130px', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ width: `${overallProgress}%`, height: '100%', background: 'linear-gradient(90deg, #2e7d32, #00e676)', borderRadius: '5px' }} />
                </div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
              {/* Próximo Passo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Próximo Passo Recomendado</span>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#00b0ff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  {nextStep}
                </div>
              </div>

              {/* Gargalos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Gargalos Detectados</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '54px', overflowY: 'auto', paddingRight: '4px' }}>
                  {bottlenecks.length === 0 ? (
                    <span style={{ fontSize: '13px', color: '#00e676', fontWeight: 'bold' }}>✓ Nenhum gargalo crítico detectado</span>
                  ) : (
                    bottlenecks.map((b, idx) => (
                      <span key={idx} style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(239, 35, 60, 0.08)', color: '#ff4d6d', border: '1px solid rgba(239, 35, 60, 0.15)', fontWeight: '600' }}>
                        ⚠ {b}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Outros KPIs rápidos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.3px' }}>Área Total</span>
                  <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '2px' }}>{totalArea.toFixed(2)} ha</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.3px' }}>Parcelas Col.</span>
                  <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '2px', color: '#00b0ff' }}>{completedParcelsCount} / {activeParcels.length}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.3px' }}>Volume CC Est.</span>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#00e676', marginTop: '2px' }}>
                    {totalVolume > 0 ? `${Math.round(totalVolume).toLocaleString('pt-BR')} m³` : '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MAPA OPERACIONAL COM SVG CONNECTOR */}
          <div className="operation-map-container" ref={mapContainerRef} style={{ position: 'relative' }}>
            <svg className="operation-svg-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(targetId => {
                const startId = targetId === 2 ? 1 : targetId - 1;
                const startPos = getNodePos(startId, cols);
                const endPos = getNodePos(targetId, cols);
                const targetStatus = getStageStatus(targetId);
                
                let lineClass = 'line-empty';
                if (targetStatus === 'complete') lineClass = 'line-complete';
                else if (targetStatus === 'progress') lineClass = 'line-progress';
                else if (targetStatus === 'warning') lineClass = 'line-warning';
                
                return (
                  <line
                    key={targetId}
                    x1={startPos.x}
                    y1={startPos.y}
                    x2={endPos.x}
                    y2={endPos.y}
                    className={`hud-connection-line ${lineClass}`}
                  />
                );
              })}
            </svg>

            <div className="operation-map-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(id => {
                const status = getStageStatus(id);
                const percent = getStagePercent(id);
                const kpi = getStageKpi(id);
                const desc = getStageDescription(id);
                const name = getStageName(id);
                
                let statusLabel = 'Não Iniciado';
                let statusColor = 'var(--text-muted)';
                if (status === 'complete') { statusLabel = 'Concluído'; statusColor = '#00e676'; }
                else if (status === 'progress') { statusLabel = 'Em Progresso'; statusColor = '#00b0ff'; }
                else if (status === 'warning') { statusLabel = 'Atenção'; statusColor = '#ff9800'; }

                const idx = id - 1;
                const rowIndex = Math.floor(idx / cols);
                const colIndex = rowIndex % 2 === 0 
                  ? idx % cols 
                  : cols - 1 - (idx % cols);

                return (
                  <div
                    id={`op-node-${id}`}
                    key={id}
                    className={`operation-node status-${status}`}
                    onClick={() => handleStageClick(id)}
                    style={{
                      gridRow: rowIndex + 1,
                      gridColumn: colIndex + 1,
                      borderRadius: '12px' // Clamped to 12px for professional layout
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontSize: '9.5px', fontWeight: '800', opacity: 0.5, letterSpacing: '0.5px' }}>ETAPA {String(id).padStart(2, '0')}</span>
                      <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: statusColor, fontWeight: '700', border: `1px solid rgba(255,255,255,0.01)` }}>
                        {statusLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: statusColor }}>
                        {getNodeIcon(id)}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '14.5px', fontWeight: '800', margin: 0 }}>{name}</h3>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>{percent}% concluído</span>
                      </div>
                    </div>

                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 14px 0', minHeight: '34px', lineHeight: '1.4' }}>
                      {desc}
                    </p>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />

                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.3px' }}>KPI Principal</span>
                        <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={kpi}>
                          {kpi}
                        </div>
                      </div>
                      
                      <div style={{ opacity: 0.4, display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    } catch (err: any) {
      console.error("Erro ao renderizar o Centro de Operações:", err);
      return (
        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(239,35,60,0.2)', background: 'rgba(239,35,60,0.05)', color: '#ff4d6d', borderRadius: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Erro no Centro de Operações</h3>
          <p style={{ fontSize: '13px', margin: '8px 0 0 0' }}>
            Ocorreu um erro ao processar os dados do projeto para o mapa operacional:
          </p>
          <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', marginTop: '12px', fontSize: '12px', color: '#fff', overflowX: 'auto' }}>
            {err.stack || err.message || String(err)}
          </pre>
        </div>
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* KPI Cards Row */}
      {activeTab !== 'centro-operacoes' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          
          <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Indivíduos Totais</span>
            <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#4fc3f7' }}>{kpis.totalTrees}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Árvores e Fustes Coletados</span>
          </div>

          <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Riqueza (Espécies)</span>
            <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#aed581' }}>{kpis.speciesCount}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Espécies Mapeadas em Campo</span>
          </div>

          <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Biomassa Agregada</span>
            <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#ba68c8' }}>{kpis.totalV.toFixed(2)} m³</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Volume Comercial Estimado</span>
          </div>

          <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Diversidade Shannon</span>
            <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#ffb74d' }}>{kpis.shannon.toFixed(3)}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Índice de Diversidade Ecológica</span>
          </div>

        </div>
      )}

      {/* TAB CONTENT */}
      {activeTab === 'centro-operacoes' ? (
        renderCentroOperacoes()
      ) : activeTab === 'talhoes' ? (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
          {activeTalhoes.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhum talhão cadastrado neste projeto.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome do Talhão</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Área (ha)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Observações</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '100px' }}>Nº Parcelas</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '100px' }}>Nº Árvores</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '380px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTalhoes.map(t => {
                    const talParcels = activeParcels.filter(p => p.talhaoId === t.id);
                    let treesCount = 0;
                    talParcels.forEach(p => treesCount += p.dados.length);

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{t.nome}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#00e676' }}>
                          {t.area !== undefined ? `${t.area.toFixed(2)} ha` : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>{t.observacoes || 'Sem observações'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold' }}>{talParcels.length}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#4fc3f7', fontWeight: 'bold' }}>{treesCount}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ 
                                width: 'auto', 
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                height: '26px', 
                                borderColor: isLight ? '#16a34a' : '#00e676', 
                                color: isLight ? '#16a34a' : '#00e676', 
                                background: isLight ? 'rgba(22, 163, 74, 0.06)' : 'rgba(0, 230, 118, 0.08)', 
                                margin: 0,
                                borderRadius: '4px'
                              }} 
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
                                  style={{ 
                                    width: 'auto', 
                                    padding: '4px 8px', 
                                    fontSize: '10px', 
                                    height: '26px', 
                                    borderColor: isLight ? '#d97706' : '#ffb74d', 
                                    color: isLight ? '#d97706' : '#ffb74d', 
                                    background: isLight ? 'rgba(217, 119, 6, 0.06)' : 'rgba(255, 183, 77, 0.08)', 
                                    margin: 0,
                                    borderRadius: '4px'
                                  }} 
                                  onClick={() => setTalhaoDashboardId(t.id)}
                                >
                                  Dashboard
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ 
                                    width: 'auto', 
                                    padding: '4px 8px', 
                                    fontSize: '10px', 
                                    height: '26px', 
                                    borderColor: isLight ? '#0891b2' : '#00838f', 
                                    color: isLight ? '#0891b2' : '#80deea', 
                                    background: isLight ? 'rgba(8, 145, 178, 0.06)' : 'rgba(0, 131, 143, 0.08)', 
                                    margin: 0,
                                    borderRadius: '4px'
                                  }} 
                                  onClick={() => handleExportTalhao(t.id, t.nome)}
                                >
                                  Excel
                                </button>
                              </>
                            )}
                            <button 
                              className="btn btn-secondary" 
                              style={{ 
                                width: 'auto', 
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                height: '26px', 
                                borderColor: isLight ? '#0284c7' : '#4fc3f7', 
                                color: isLight ? '#0284c7' : '#4fc3f7', 
                                background: isLight ? 'rgba(2, 132, 199, 0.06)' : 'rgba(79, 195, 247, 0.08)', 
                                margin: 0,
                                borderRadius: '4px'
                              }} 
                              onClick={() => {
                                setEditingTalhao(t);
                                setEditTalhaoName(t.nome);
                                setEditTalhaoArea(t.area?.toString() || '');
                                setEditTalhaoObs(t.observacoes || '');
                              }}
                            >
                              Editar
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ 
                                width: '28px', 
                                height: '26px', 
                                padding: 0, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                margin: 0,
                                borderRadius: '4px'
                              }} 
                              onClick={() => {
                                if (confirm(`Excluir o talhão "${t.nome}" apagará permanentemente todas as parcelas (${talParcels.length}) vinculadas a ele. Deseja prosseguir?`)) {
                                  deleteTalhao(t.id);
                                }
                              }}
                              title="Excluir Talhão"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
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
        <div className="glass-card" style={{ padding: 24, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Parcelas Cadastradas ({filteredParcelsList.length})</h3>
            {/* Filter Button */}
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ 
                width: 'auto', 
                padding: '8px 16px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                borderColor: isFilterActive ? 'var(--primary-hover)' : 'rgba(255,255,255,0.1)',
                background: isFilterActive ? 'rgba(76, 175, 80, 0.05)' : 'transparent',
                fontSize: '12px',
                borderRadius: '8px'
              }} 
              onClick={() => setShowFilterPanel(!showFilterPanel)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Filtrar {isFilterActive && "•"}
            </button>
          </div>

          {/* Expanded Filter Panel */}
          {showFilterPanel && (
            <div className="glass-card" style={{
              marginTop: '12px',
              marginBottom: '20px',
              padding: '20px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px', // Clamped to 12px
              width: '100%'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                
                {/* Date Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Data de Coleta</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    style={{ marginBottom: 0, padding: '8px 12px', height: '38px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff' }} 
                    value={dateFilter} 
                    onChange={e => setDateFilter(e.target.value)} 
                  />
                </div>

                {/* Talhao Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Talhão</label>
                  <select 
                    className="input-field" 
                    style={{ marginBottom: 0, padding: '8px 12px', height: '38px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} 
                    value={talhaoFilter} 
                    onChange={e => setTalhaoFilter(e.target.value)}
                  >
                    <option value="">-- Todos --</option>
                    <option value="sem-talhao">Sem Talhão</option>
                    {activeTalhoes.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Stratum Filter */}
                {activeStrata.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Estrato</label>
                    <select 
                      className="input-field" 
                      style={{ marginBottom: 0, padding: '8px 12px', height: '38px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} 
                      value={stratumFilter} 
                      onChange={e => setStratumFilter(e.target.value)}
                    >
                      <option value="">-- Todos --</option>
                      {activeStrata.map(s => (
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
                    style={{ marginBottom: 0, padding: '8px 12px', height: '38px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} 
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
                    style={{ width: 'auto', padding: '6px 16px', fontSize: '12px', borderRadius: '6px' }}
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

          {selectedTalhaoId && (
            <div style={{ marginBottom: '20px' }}>
              {/* Filter Banner */}
              <div style={{
                background: 'rgba(0, 230, 118, 0.06)',
                border: '1px solid rgba(0, 230, 118, 0.15)',
                borderRadius: '8px',
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
                    borderRadius: '6px',
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
                <div style={{ padding: '12px 16px', background: 'rgba(79, 195, 247, 0.03)', border: '1px solid rgba(79, 195, 247, 0.08)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(79, 195, 247, 0.7)', textTransform: 'uppercase', fontWeight: 'bold' }}>Árvores do Talhão</span>
                  <span style={{ fontSize: '18px', color: '#4fc3f7', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                    {talhaoKpis.totalTrees}
                  </span>
                </div>
                <div style={{ padding: '12px 16px', background: 'rgba(174, 213, 129, 0.03)', border: '1px solid rgba(174, 213, 129, 0.08)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(174, 213, 129, 0.7)', textTransform: 'uppercase', fontWeight: 'bold' }}>Riqueza do Talhão</span>
                  <span style={{ fontSize: '18px', color: '#aed581', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                    {talhaoKpis.speciesCount}
                  </span>
                </div>
                <div style={{ padding: '12px 16px', background: 'rgba(186, 104, 200, 0.03)', border: '1px solid rgba(186, 104, 200, 0.08)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(186, 104, 200, 0.7)', textTransform: 'uppercase', fontWeight: 'bold' }}>Volume do Talhão</span>
                  <span style={{ fontSize: '18px', color: '#ba68c8', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                    {talhaoKpis.totalV.toFixed(2)} m³
                  </span>
                </div>
                <div style={{ padding: '12px 16px', background: 'rgba(255, 183, 77, 0.03)', border: '1px solid rgba(255, 183, 77, 0.08)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255, 183, 77, 0.7)', textTransform: 'uppercase', fontWeight: 'bold' }}>Shannon do Talhão</span>
                  <span style={{ fontSize: '18px', color: '#ffb74d', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                    {talhaoKpis.shannon.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {filteredParcelsList.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma parcela corresponde aos filtros ativos.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome da Parcela</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Talhão</th>
                    {activeStrata.length > 0 && (
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estrato</th>
                    )}
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coordenadas GPS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '110px' }}>Área (m²)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '110px' }}>Árvores</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '320px' }}>Ações de Auditoria</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParcelsList.map(p => {
                    const talName = activeTalhoes.find(t => t.id === p.talhaoId)?.nome || 'Sem Talhão';
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{p.nome}</td>
                        <td style={{ padding: '12px 16px', color: '#ff9800', fontSize: '13.5px', fontWeight: 'bold' }}>{talName}</td>
                        {activeStrata.length > 0 && (
                          <td style={{ padding: '12px 16px' }}>
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
                                borderRadius: '6px',
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
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{p.coordenadas || 'Não coletada'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.areaParcela}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#aed581', fontWeight: 'bold' }}>{p.dados.length}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ width: 'auto', padding: '4px 8px', fontSize: '10px', height: '26px', margin: 0, borderRadius: '4px' }} 
                              onClick={() => setAuditParcelId(p.id)}
                            >
                              Auditar Dados
                            </button>
                            {p.dados.length > 0 && (
                              <>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ width: 'auto', padding: '4px 8px', fontSize: '10px', height: '26px', borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)', margin: 0, borderRadius: '4px' }} 
                                  onClick={() => setShowParcelDashboardId(p.id)}
                                >
                                  Dashboard
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ width: 'auto', padding: '4px 8px', fontSize: '10px', height: '26px', borderColor: 'var(--primary-color)', color: 'var(--primary-color)', margin: 0, borderRadius: '4px' }} 
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
      ) : activeTab === 'estratos' ? (
        <div className="glass-card" style={{ padding: 24, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Estratos Florestais</h3>
            <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '12px', borderRadius: '6px' }} onClick={() => setShowStratumModal(true)}>
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
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome do Estrato</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descrição</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Área (ha)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Peso (Wh)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Nº Parcelas</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '220px' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stratifiedStats.strataDetails.map((d: any) => (
                      <tr key={d.stratum.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{d.stratum.nome}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12.5px' }}>{d.stratum.descricao || 'Sem descrição'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold' }}>{d.stratum.area} ha</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#ffb74d', fontWeight: 'bold' }}>{(d.Wh * 100).toFixed(1)}%</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#4fc3f7' }}>{d.nh}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            {d.nh > 0 && (
                              <button 
                                className="btn btn-secondary" 
                                style={{ 
                                  width: 'auto', 
                                  padding: '4px 8px', 
                                  fontSize: '10px', 
                                  height: '26px', 
                                  borderColor: isLight ? '#16a34a' : '#2e7d32', 
                                  color: isLight ? '#16a34a' : '#a5d6a7', 
                                  background: isLight ? 'rgba(22, 163, 74, 0.06)' : 'rgba(46, 125, 50, 0.08)', 
                                  margin: 0,
                                  borderRadius: '4px'
                                }} 
                                onClick={() => setStratumDashboardId(d.stratum.id)}
                              >
                                Dashboard
                              </button>
                            )}
                            <button 
                              className="btn btn-danger" 
                              style={{ 
                                width: '28px', 
                                height: '26px', 
                                padding: 0, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                margin: 0,
                                borderRadius: '4px'
                              }} 
                              onClick={() => {
                                if (confirm(`Deseja deletar o estrato ${d.stratum.nome}? Todas as parcelas associadas a ele ficarão sem estrato.`)) {
                                  deleteStratum(d.stratum.id);
                                }
                              }}
                              title="Excluir Estrato"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calculations summary card */}
              <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,230,118,0.02)', borderRadius: '12px', marginBottom: 0 }}>
                <h4 style={{ color: 'var(--primary-hover)', fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>
                  Relatório Estatístico: Amostragem Casual Estratificada
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume Médio Estratificado</span>
                    <span style={{ fontSize: '18px', color: '#fff', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                      {stratifiedStats.meanSt.toFixed(2)} m³/ha
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Variância do Volume</span>
                    <span style={{ fontSize: '18px', color: '#fff', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                      {stratifiedStats.varMeanSt.toFixed(4)}
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Erro Padrão da Média</span>
                    <span style={{ fontSize: '18px', color: '#fff', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                      {stratifiedStats.seSt.toFixed(3)} m³/ha
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Erro Relativo (E%)</span>
                    <span style={{ fontSize: '18px', color: stratifiedStats.errorRel <= 10 ? '#00e676' : '#ff4d6d', fontWeight: '800', display: 'block', marginTop: '4px' }}>
                      {stratifiedStats.errorRel.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', fontSize: '13px', lineHeight: '1.5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Graus de Liberdade Efetivo (Welch-Satterthwaite):</span>
                    <strong style={{ color: '#fff' }}>{stratifiedStats.df}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Valor de t de Student (Confiança 95%):</span>
                    <strong style={{ color: '#fff' }}>{stratifiedStats.tValue.toFixed(4)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Erro de Amostragem Absoluto:</span>
                    <strong style={{ color: '#fff' }}>±{stratifiedStats.errorAbs.toFixed(2)} m³/ha</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', marginTop: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Intervalo de Confiança (Volume/ha):</span>
                    <strong style={{ color: '#00e676' }}>
                      {Math.max(0, stratifiedStats.meanSt - stratifiedStats.errorAbs).toFixed(2)} a {(stratifiedStats.meanSt + stratifiedStats.errorAbs).toFixed(2)} m³/ha
                    </strong>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : activeTab === 'cubagem' ? (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
          {allCubagedTrees.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma árvore cubada neste trabalho de campo.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Árvore</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sessão de Cubagem</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Espécie</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Altura (m)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '150px' }}>Método Utilizado</th>
                    <th 
                      style={{ 
                        padding: '12px 16px', 
                        textAlign: 'center', 
                        fontSize: '11px', 
                        color: 'var(--primary-hover)', 
                        textTransform: 'uppercase', 
                        width: '180px',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => {
                        setCubageSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                      }}
                    >
                      Volume Total (m³) {cubageSortOrder === 'desc' ? '▼' : cubageSortOrder === 'asc' ? '▲' : ''}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '140px' }}>Data do Cálculo</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {allCubagedTrees.map((tree, idx) => (
                    <tr key={tree.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>#{tree.numeroIndividuo}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{tree.sessionName}</td>
                      <td style={{ padding: '12px 16px', fontStyle: 'italic' }}>{tree.especie}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{tree.alturaTotal ? `${tree.alturaTotal.toFixed(2)} m` : '-'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', textTransform: 'capitalize' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#fff'
                        }}>
                          {tree.metodoCalculo}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#00e676', fontWeight: 'bold', fontSize: '15px' }}>
                        {tree.volumeTotal ? `${tree.volumeTotal.toFixed(4).replace('.', ',')}` : '0,0000'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        {tree.dataCalculo || '-'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ 
                            width: 'auto', 
                            padding: '6px 12px', 
                            fontSize: '11.5px', 
                            height: '28px', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            borderColor: isLight ? 'rgba(22, 163, 74, 0.4)' : 'rgba(0, 230, 118, 0.3)',
                            background: isLight ? 'rgba(22, 163, 74, 0.05)' : 'rgba(0, 230, 118, 0.04)',
                            color: isLight ? '#16a34a' : '#00e676',
                            borderRadius: '4px'
                          }}
                          onClick={() => {
                            setSelectedVisualizerTree(tree);
                            if (tree.modoColeta === 'relativo') {
                              setSelectedVisualizerPoint('Base');
                            } else {
                              setSelectedVisualizerSectionId(tree.secoes?.[0]?.id || null);
                            }
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          Ver Fuste
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'extrapolacao' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SUB TABS */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
            {(['parcelas', 'talhoes', 'estratos', 'trabalho'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setExtraTab(tab)}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  background: extraTab === tab ? 'rgba(0,230,118,0.1)' : 'transparent',
                  color: extraTab === tab ? '#00e676' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab === 'parcelas' ? 'Unidades Amostrais' : tab === 'talhoes' ? 'Extrapolação por Talhão' : tab === 'estratos' ? 'Extrapolação por Estrato' : 'Resumo Geral do Projeto'}
              </button>
            ))}
          </div>

          {extraTab === 'parcelas' && (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parcela</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área Parcela (m²)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fator Expansão (K)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vol. Total (m³)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--primary-hover)', textTransform: 'uppercase' }}>Vol. / ha (m³)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>G / ha (m²)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Árvores / ha</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extrapolationData.processedParcels.map((p: any) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{p.nome}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.areaParcela.toFixed(1)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>{p.isProcessed ? p.fatorExpansao.toFixed(2) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.isProcessed ? p.volumeTotalParcela.toFixed(4) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#00e676' }}>{p.isProcessed ? p.volumePorHa.toFixed(2) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.isProcessed ? p.areaBasalPorHa.toFixed(3) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.isProcessed ? p.densidadePorHa.toFixed(1) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {p.isProcessed ? (
                            <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(76, 175, 80, 0.15)', color: '#4caf50', fontWeight: 'bold' }}>Processado</span>
                          ) : (
                            <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(244, 67, 54, 0.15)', color: '#f44336', fontWeight: 'bold' }}>Não Processado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {extrapolationData.processedParcels.some((p: any) => !p.isProcessed) && (
                <div style={{ padding: '12px 16px', background: 'rgba(244, 67, 54, 0.08)', borderTop: '1px solid rgba(244, 67, 54, 0.15)', color: '#ef5350', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center', borderRadius: '0 0 8px 8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  <span>Esta parcela ainda não foi processada.</span>
                </div>
              )}
            </div>
          )}

          {extraTab === 'talhoes' && (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Talhão</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área Talhão (ha)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parcelas Processadas</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área Amostrada (m²)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vol. Médio / ha (m³)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>G Médio / ha (m²)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>DAP Médio (cm)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Altura Média (m)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--primary-hover)', textTransform: 'uppercase' }}>Volume Total (m³)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extrapolationData.talhoesResults.map((t: any) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{t.nome}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{t.areaTalhaoHa > 0 ? t.areaTalhaoHa.toFixed(2) : 'Não Informado'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{t.numParcelas}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>{t.areaAmostradaTotal.toFixed(1)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold' }}>{t.numParcelas > 0 ? t.volumeMedioPorHa.toFixed(2) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{t.numParcelas > 0 ? t.areaBasalMedioPorHa.toFixed(3) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{t.numParcelas > 0 ? t.dapMedio.toFixed(2) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{t.numParcelas > 0 ? t.alturaMedio.toFixed(2) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#00e676', fontSize: '14px' }}>
                          {t.numParcelas > 0 && t.areaTalhaoHa > 0 ? t.volumeTotalTalhao.toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {extraTab === 'estratos' && (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estrato</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área Estrato (ha)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parcelas Processadas</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área Amostrada (m²)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vol. Médio / ha (m³)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>G Médio / ha (m²)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Densidade Média / ha</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--primary-hover)', textTransform: 'uppercase' }}>Volume Total (m³)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extrapolationData.strataResults.map((s: any) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{s.nome}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{s.areaEstratoHa > 0 ? s.areaEstratoHa.toFixed(2) : 'Não Informado'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{s.numParcelas}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>{s.areaAmostradaTotal.toFixed(1)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold' }}>{s.numParcelas > 0 ? s.volumeMedioPorHa.toFixed(2) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{s.numParcelas > 0 ? s.areaBasalMedioPorHa.toFixed(3) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{s.numParcelas > 0 ? s.densidadeMedioPorHa.toFixed(1) : '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#00e676', fontSize: '14px' }}>
                          {s.numParcelas > 0 && s.areaEstratoHa > 0 ? s.volumeTotalEstrato.toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {extraTab === 'trabalho' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              
              <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Área Total Inventariada</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#64b5f6' }}>{extrapolationData.trabalho.areaTotalInventariada.toFixed(2)} ha</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Soma dos talhões/estratos cadastrados</span>
              </div>

              <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Área Total Amostrada</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#81c784' }}>{(extrapolationData.trabalho.areaTotalAmostrada / 10000).toFixed(4)} ha</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{extrapolationData.trabalho.areaTotalAmostrada.toFixed(0)} m² no total</span>
              </div>

              <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Parcelas Processadas</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#ffb74d' }}>{extrapolationData.trabalho.numTotalParcelas}</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Parcelas consideradas na amostragem</span>
              </div>

              <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Árvores Medidas</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#ba68c8' }}>{extrapolationData.trabalho.numTotalArvoresMedidas}</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Registradas nas parcelas válidas</span>
              </div>

              <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Volume Médio / ha</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#e57373' }}>{extrapolationData.trabalho.volumeMedioGeralPorHa.toFixed(2)} m³/ha</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Média aritmética por hectare</span>
              </div>

              <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0, 230, 118, 0.08)', borderRadius: '12px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold' }}>Volume Total Estimado</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#00e676' }}>{extrapolationData.trabalho.volumeTotalEstimado.toFixed(2)} m³</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Extrapolação para a área total</span>
              </div>

              <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Área Basal / ha</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#a1887f' }}>{extrapolationData.trabalho.areaBasalMediaPorHa.toFixed(3)} m²/ha</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Média de área transversal acumulada</span>
              </div>

              <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Densidade Média / ha</span>
                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#4db6ac' }}>{extrapolationData.trabalho.densidadeMediaPorHa.toFixed(1)} árv/ha</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Média de árvores por hectare</span>
              </div>

            </div>
          )}
        </div>
      ) : activeTab === 'processamentos' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* TOOLBAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Consolidação & Processamentos</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                Gere snapshots oficiais e consolidados para amostragem florestal técnica.
              </p>
            </div>
            <button 
              className="btn btn-primary" 
              style={{ width: 'auto', padding: '12px 24px', borderRadius: '6px' }}
              onClick={() => {
                setNewProcessName(`Processamento Oficial - ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
                setNewProcessConsolidationMode('auto');
                setShowNewProcessModal(true);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Processar Novo Inventário
            </button>
          </div>

          {/* HISTÓRICO TABLE */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--primary-hover)', margin: 0, letterSpacing: '0.5px' }}>
                Histórico de Versões
              </h3>
            </div>

            {activeProcessings.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" style={{ marginBottom: '12px' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '700' }}>Sem processamentos oficiais</h4>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>
                  Clique no botão acima para processar as parcelas e congelar a primeira versão oficial.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.1)' }}>
                      <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)' }}>Nome do Processamento</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Data</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)' }}>Responsável</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)' }}>Equações H / V</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Modo</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Vol. Total CC / SC (m³)</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Média CC / SC (m³/ha)</th>
                      <th style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProcessings.map(proc => (
                      <tr key={proc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold', fontSize: '14.5px', color: '#fff' }}>{proc.nomeProcessamento}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>{proc.dataProcessamento}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{proc.createdBy}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          H: {proc.heightModelSnapshot ? proc.heightModelSnapshot.nome : 'Medida'} <br />
                          V: {proc.volumeModelSnapshot ? proc.volumeModelSnapshot.nome : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
                            {proc.effectiveConsolidationMode === 'stratum' ? 'Estrato' : 'Talhão'}{proc.consolidationMode === 'auto' ? ' (Auto)' : ''}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px' }}>
                          <div style={{ fontWeight: 'bold', color: '#81c784' }} title="Com Casca">
                            {proc.volumeTotalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CC
                          </div>
                          <div style={{ fontSize: '12px', color: '#00b0ff' }} title="Sem Casca">
                            {(proc.volumeTotalEstimadoSemCasca || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SC
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px' }}>
                          <div style={{ color: 'var(--text-muted)' }} title="Com Casca">
                            {proc.volumeMedioHa.toFixed(2)} CC
                          </div>
                          <div style={{ fontSize: '12px', color: '#00b0ff' }} title="Sem Casca">
                            {(proc.volumeMedioHaSemCasca || 0).toFixed(2)} SC
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ width: 'auto', padding: '6px 10px', height: '28px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}
                              onClick={() => setSelectedReportProcessing(proc)}
                              title="Visualizar Relatório Executivo"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                              Relatório
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ width: 'auto', padding: '6px 10px', height: '28px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}
                              onClick={() => handleDuplicarConfiguracao(proc)}
                              title="Duplicar Configurações no Panel"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                              Config
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ 
                                width: '28px', 
                                height: '28px', 
                                padding: 0, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                margin: 0,
                                borderRadius: '4px'
                              }} 
                              onClick={async () => {
                                if (confirm(`Deseja realmente deletar permanentemente o processamento "${proc.nomeProcessamento}"?`)) {
                                  await deleteProcessing(proc.id);
                                }
                              }}
                              title="Excluir Processamento"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* COMPARADOR DE CENÁRIOS */}
          {activeProcessings.length >= 2 && (
            <div className="glass-card" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary-hover)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Comparação de Cenários (Auditoria Metodológica)
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
                Selecione dois processamentos oficiais do histórico para comparar o impacto estatístico da troca de modelos e consolidação.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label className="input-label">Cenário A (Base)</label>
                  <select 
                    className="input-field" 
                    style={{ marginBottom: 0, borderRadius: '8px' }}
                    value={selectedProcessAId}
                    onChange={e => setSelectedProcessAId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {activeProcessings.map(p => (
                      <option key={p.id} value={p.id}>{p.nomeProcessamento} ({p.dataProcessamento})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Cenário B (Simulação)</label>
                  <select 
                    className="input-field" 
                    style={{ marginBottom: 0, borderRadius: '8px' }}
                    value={selectedProcessBId}
                    onChange={e => setSelectedProcessBId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {activeProcessings.map(p => (
                      <option key={p.id} value={p.id}>{p.nomeProcessamento} ({p.dataProcessamento})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* COMPARISON RESULTS */}
              {(() => {
                const procA = activeProcessings.find(p => p.id === selectedProcessAId);
                const procB = activeProcessings.find(p => p.id === selectedProcessBId);

                if (!procA || !procB) {
                  return (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                      Escolha os cenários A e B acima para ver a comparação de variação técnica.
                    </div>
                  );
                }

                const renderDiffRow = (label: string, valA: number, valB: number, digits = 2, unit = "") => {
                  const diffAbs = valB - valA;
                  const diffPct = valA > 0 ? (diffAbs / valA) * 100 : 0;
                  const isPos = diffAbs > 0;
                  const isZero = Math.abs(diffAbs) < 0.0001;

                  const diffColor = isZero ? 'var(--text-muted)' : (isPos ? '#00e676' : '#ff5252');
                  const diffSign = isZero ? '' : (isPos ? '+' : '');

                  return (
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 'bold' }}>{label}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>{valA.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} {unit}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>{valB.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} {unit}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 'bold', color: diffColor }}>
                        {diffSign}{diffAbs.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} {unit}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 'bold', color: diffColor }}>
                        {isZero ? '0.00%' : `${diffSign}${diffPct.toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                };

                return (
                  <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
                          <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)' }}>Parâmetro Florestal</th>
                          <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Cenário A (Base)</th>
                          <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Cenário B (Simulação)</th>
                          <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Diferença Absoluta</th>
                          <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Variação (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renderDiffRow("Volume Total CC Estimado", procA.trabalho.volumeTotalEstimado, procB.trabalho.volumeTotalEstimado, 2, "m³")}
                        {renderDiffRow("Volume Total SC Estimado", procA.volumeTotalEstimadoSemCasca || procA.trabalho.volumeTotalEstimadoSemCasca || 0, procB.volumeTotalEstimadoSemCasca || procB.trabalho.volumeTotalEstimadoSemCasca || 0, 2, "m³")}
                        {renderDiffRow("Volume Médio CC por Hectare", procA.trabalho.volumeMedioHa, procB.trabalho.volumeMedioHa, 2, "m³/ha")}
                        {renderDiffRow("Volume Médio SC por Hectare", procA.volumeMedioHaSemCasca || procA.trabalho.volumeMedioHaSemCasca || 0, procB.volumeMedioHaSemCasca || procB.trabalho.volumeMedioHaSemCasca || 0, 2, "m³/ha")}
                        {renderDiffRow("Fator de Casca (k)", procA.fatorCasca !== undefined ? procA.fatorCasca : 1.0, procB.fatorCasca !== undefined ? procB.fatorCasca : 1.0, 2, "")}
                        {renderDiffRow("Área Basal Média por Hectare", procA.trabalho.areaBasalMediaHa, procB.trabalho.areaBasalMediaHa, 3, "m²/ha")}
                        {renderDiffRow("Densidade Média por Hectare", procA.trabalho.densidadeMedia, procB.trabalho.densidadeMedia, 1, "árv/ha")}
                        {renderDiffRow("DAP Médio", procA.trabalho.dapMedio, procB.trabalho.dapMedio, 2, "cm")}
                        {renderDiffRow("Altura Média", procA.trabalho.alturaMedia, procB.trabalho.alturaMedia, 2, "m")}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : activeTab === 'sortimento' ? (
        <SortimentoTab 
          activeFw={activeFw} 
          inventories={activeParcels} 
          activeTalhoes={activeTalhoes} 
        />
      ) : null}

      {/* Modal de Novo Processamento */}
      {showNewProcessModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          zIndex: 10000, padding: '20px', backdropFilter: 'blur(8px)'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', marginBottom: 0, borderRadius: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary-hover)', margin: 0 }}>
              Novo Processamento Oficial
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '8px 0 20px 0', lineHeight: '1.4' }}>
              Isso calculará todas as parcelas e árvores usando os modelos ativos no painel e salvará um snapshot consolidado permanente.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label className="input-label">Nome do Processamento</label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ marginBottom: 0, borderRadius: '8px' }}
                  placeholder="Ex: Processamento Consolidação Junho"
                  value={newProcessName}
                  onChange={e => setNewProcessName(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Modo de Consolidação de Área</label>
                <select 
                  className="input-field" 
                  style={{ marginBottom: 0, borderRadius: '8px' }}
                  value={newProcessConsolidationMode}
                  onChange={e => setNewProcessConsolidationMode(e.target.value as any)}
                >
                  <option value="auto">Automático (Prioriza Estrato se houver area)</option>
                  <option value="talhao">Por Talhões</option>
                  <option value="stratum">Por Estratos</option>
                </select>
              </div>

              <div>
                <label className="input-label">Fator de Casca (k)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.5"
                  max="1.0"
                  className="input-field" 
                  style={{ marginBottom: 0, borderRadius: '8px' }}
                  placeholder="Ex: 0.90"
                  value={newProcessFatorCasca}
                  onChange={e => setNewProcessFatorCasca(e.target.value)}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Utilizado para deduzir o diâmetro sem casca: DAPsc = DAPcc * k
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                  Modelos Selecionados
                </span>
                <span style={{ fontSize: '13px', display: 'block', color: '#fff' }}>
                  <strong>Hipsometria:</strong> {selectedHeightModelId !== 'none' ? heightModels.find(m => m.id === selectedHeightModelId)?.nome : 'Medida / Sem Modelo'}
                </span>
                <span style={{ fontSize: '13px', display: 'block', color: '#fff', marginTop: '4px' }}>
                  <strong>Volume:</strong> {selectedVolumeModelId === 'legacy' ? `Fator de Forma (${processingFatorForma})` : volumeModels.find(m => m.id === selectedVolumeModelId)?.nome}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ borderRadius: '6px' }}
                onClick={() => setShowNewProcessModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary"
                style={{ borderRadius: '6px' }}
                onClick={async () => {
                  await handleCreateInventoryProcessing(newProcessName, newProcessConsolidationMode);
                  setShowNewProcessModal(false);
                }}
              >
                Processar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relatório Executivo Printável */}
      {selectedReportProcessing && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', 
          zIndex: 10000, padding: '20px', overflowY: 'auto', backdropFilter: 'blur(8px)'
        }} className="report-modal-backdrop">
          <div className="glass-card printable-report" style={{ width: '100%', maxWidth: '900px', marginTop: '30px', marginBottom: '30px', padding: '32px', borderRadius: '12px' }}>
            
            {/* Header com botões - Ocultado na Impressão via CSS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }} className="no-print">
              <div>
                <span style={{ fontSize: '10px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold' }}>Relatório Oficial Consolidado</span>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: '2px 0 0 0' }}>{selectedReportProcessing.nomeProcessamento}</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ width: 'auto', padding: '8px 16px', fontSize: '11px', height: '36px', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                  onClick={() => window.print()}
                >
                  Imprimir / PDF
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: 'auto', padding: '8px 16px', fontSize: '11px', height: '36px', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                  onClick={() => {
                    handleExportAdvancedXLSX(selectedReportProcessing);
                  }}
                >
                  Planilha Avançada (XLSX)
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: 'auto', padding: '8px 16px', fontSize: '11px', height: '36px', borderRadius: '6px', margin: 0 }} 
                  onClick={() => setSelectedReportProcessing(null)}
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* RELATÓRIO DO INVENTÁRIO (CONTEÚDO IMPRESSO) */}
            <div className="report-content" style={{ color: '#000', background: '#fff', padding: '24px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #2e7d32', paddingBottom: '16px', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#2e7d32' }}>LeafTag Forest Analytics</h1>
                  <span style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Relatório Executivo de Inventário Florestal</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Snapshot: {selectedReportProcessing.nomeProcessamento}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Gerado em: {selectedReportProcessing.dataProcessamento}</div>
                </div>
              </div>

              {/* 1. RESUMO OPERACIONAL */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#2e7d32', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>1. Resumo Operacional da Amostragem</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>Volume Total CC</span>
                    <strong style={{ display: 'block', fontSize: '18px', color: '#2e7d32', marginTop: '4px' }}>{Math.round(selectedReportProcessing.volumeTotalEstimado).toLocaleString('pt-BR')} m³</strong>
                  </div>
                  <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>Volume Total SC (Estimado)</span>
                    <strong style={{ display: 'block', fontSize: '18px', color: '#1565c0', marginTop: '4px' }}>{(selectedReportProcessing.volumeTotalEstimadoSemCasca || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m³</strong>
                  </div>
                  <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>Área do Projeto</span>
                    <strong style={{ display: 'block', fontSize: '18px', marginTop: '4px' }}>{selectedReportProcessing.trabalho.areaTotalInventariada.toFixed(2)} ha</strong>
                  </div>
                  <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>Média de Volume CC</span>
                    <strong style={{ display: 'block', fontSize: '18px', marginTop: '4px' }}>{selectedReportProcessing.volumeMedioHa.toFixed(2)} m³/ha</strong>
                  </div>
                </div>
              </div>

              {/* 2. DADOS METODOLÓGICOS E MODELOS */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#2e7d32', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>2. Modelagem Hipsométrica e Volumétrica Utilizada</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                  <div style={{ background: '#fafafa', padding: '16px', borderRadius: '6px', fontSize: '13px', lineHeight: 1.5 }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Modelo Hipsométrico (H):</strong> {selectedReportProcessing.heightModelSnapshot ? `${selectedReportProcessing.heightModelSnapshot.nome} (${selectedReportProcessing.heightModelSnapshot.tipoModelo})` : 'Não Utilizado / Alturas Medidas'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Modelo Volumétrico (V):</strong> {selectedReportProcessing.volumeModelSnapshot ? `${selectedReportProcessing.volumeModelSnapshot.nome} (${selectedReportProcessing.volumeModelSnapshot.tipoModelo})` : 'Fator de Forma Clássico'}
                    </div>
                    <div>
                      <strong>Fator de Casca (k):</strong> {selectedReportProcessing.fatorCasca || '1.00'}
                    </div>
                  </div>
                  <div style={{ background: '#fafafa', padding: '16px', borderRadius: '6px', fontSize: '13px', lineHeight: 1.5 }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Consolidador Técnico:</strong> {selectedReportProcessing.createdBy}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Modo de Consolidação:</strong> <span style={{ textTransform: 'capitalize' }}>{selectedReportProcessing.effectiveConsolidationMode}</span>
                    </div>
                    <div>
                      <strong>Amostragem:</strong> {selectedReportProcessing.parcelas.length} parcelas amostrais
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. ANÁLISE ESTATÍSTICA */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#2e7d32', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>3. Análise Estatística de Suficiência Amostral</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ border: '1px solid #eee', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>Erro Padrão da Média</span>
                    <strong style={{ display: 'block', fontSize: '16px', marginTop: '4px' }}>{selectedReportProcessing.trabalho.seSt?.toFixed(3) || 'N/D'} m³/ha</strong>
                  </div>
                  <div style={{ border: '1px solid #eee', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>Erro de Amostragem Relativo</span>
                    <strong style={{ display: 'block', fontSize: '16px', color: (selectedReportProcessing.trabalho.errorRel || 0) <= 10 ? '#2e7d32' : '#c62828', marginTop: '4px' }}>
                      {selectedReportProcessing.trabalho.errorRel?.toFixed(2) || 'N/D'}%
                    </strong>
                  </div>
                  <div style={{ border: '1px solid #eee', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>t de Student</span>
                    <strong style={{ display: 'block', fontSize: '16px', marginTop: '4px' }}>{selectedReportProcessing.trabalho.tValue?.toFixed(4) || 'N/D'}</strong>
                  </div>
                  <div style={{ border: '1px solid #eee', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>Graus de Liberdade</span>
                    <strong style={{ display: 'block', fontSize: '16px', marginTop: '4px' }}>{selectedReportProcessing.trabalho.df || 'N/D'}</strong>
                  </div>
                </div>
                <div style={{ background: '#f9f9f9', padding: '12px 16px', borderRadius: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', borderLeft: '4px solid #2e7d32' }}>
                  <span>Intervalo de Confiança do Volume por Hectare:</span>
                  <strong style={{ color: '#2e7d32' }}>
                    {selectedReportProcessing.trabalho.meanSt && selectedReportProcessing.trabalho.errorAbs
                      ? `${(selectedReportProcessing.trabalho.meanSt - selectedReportProcessing.trabalho.errorAbs).toFixed(2)} a ${(selectedReportProcessing.trabalho.meanSt + selectedReportProcessing.trabalho.errorAbs).toFixed(2)} m³/ha`
                      : 'N/D'}
                  </strong>
                </div>
              </div>

              {/* 4. RESULTADOS POR TALHÃO */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#2e7d32', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>4. Resultados Consolidados por Talhão</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Talhão</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Área (ha)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Parc. Usadas</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Árv. Usadas</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vol CC / ha (m³)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vol SC / ha (m³)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vol Total CC (m³)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vol Total SC (m³)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReportProcessing.talhoes.map((t: any) => (
                      <tr key={t.talhaoId} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{t.nome}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{t.areaTalhao.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{t.parcelasUtilizadas}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{t.arvoresUtilizadas}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{t.volumeMedioHa.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{(t.volumeMedioHaSemCasca || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>{Math.round(t.volumeTotalEstimado).toLocaleString('pt-BR')}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#1565c0' }}>{Math.round(t.volumeTotalEstimadoSemCasca || 0).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 5. RESULTADOS POR ESTRATO */}
              {selectedReportProcessing.strata && selectedReportProcessing.strata.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#2e7d32', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>5. Resultados Consolidados por Estrato</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Estrato</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Área (ha)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Parc. Usadas</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Árv. Usadas</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vol CC / ha (m³)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vol SC / ha (m³)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vol Total CC (m³)</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vol Total SC (m³)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReportProcessing.strata.map((s: any) => (
                        <tr key={s.stratumId} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{s.nome}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>{s.areaEstrato.toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>{s.parcelasUtilizadas}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>{s.arvoresUtilizadas}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{s.volumeMedioHa.toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{(s.volumeMedioHaSemCasca || 0).toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>{Math.round(s.volumeTotalEstimado).toLocaleString('pt-BR')}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#1565c0' }}>{Math.round(s.volumeTotalEstimadoSemCasca || 0).toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6. DETALHAMENTO DE UNIDADES AMOSTRAIS */}
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#2e7d32', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
                  {selectedReportProcessing.strata && selectedReportProcessing.strata.length > 0 ? '6. Detalhamento das Unidades Amostrais' : '5. Detalhamento das Unidades Amostrais'}
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Parcela</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Área (m²)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Expansão (K)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Árvores</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Vol CC Parc (m³)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Vol SC Parc (m³)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Vol CC / ha (m³)</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Vol SC / ha (m³)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReportProcessing.parcelas.map((p: any) => (
                      <tr key={p.parcelaId} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{p.nome}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{p.areaParcela}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{p.fatorExpansao.toFixed(2)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{p.numeroArvores}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{p.volumeTotal.toFixed(4)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{(p.volumeTotalSemCasca || 0).toFixed(4)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>{p.volumePorHa.toFixed(2)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>{(p.volumePorHaSemCasca || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
