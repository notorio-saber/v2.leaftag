import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { ForestGISModule } from '../ForestGISModule';
import { StatisticalDashboard } from '../StatisticalDashboard';
import { SortimentoTab } from '../SortimentoTab';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  calculateShannonIndex,
  calculateSimpsonIndex,
  calculatePielouIndex,
  calculateBasalArea,
  calculateVolume,
  cleanResult,
  getDapOfTreeOrStem
} from '../../utils/forestryCalculations';

interface HUDOfficeDashboardProps {
  activeFw: any;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTier: 'field' | 'inventory' | 'forest';
  setActiveTier: (val: 'field' | 'inventory' | 'forest') => void;
  focusedNode: number | null;
  setFocusedNode: (val: number | null) => void;
  expandedStages: Record<number, boolean>;
  setExpandedStages: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  activeLayer: 'process' | 'gis' | 'stats';
  setActiveLayer: (val: 'process' | 'gis' | 'stats') => void;
  showUpgradeModal: { requiredTier: 'inventory' | 'forest'; featureName: string } | null;
  setShowUpgradeModal: (val: { requiredTier: 'inventory' | 'forest'; featureName: string } | null) => void;
  isStageLocked: (stageId: number) => boolean;
  activeParcels: any[];
  activeTalhoes: any[];
  activeStrata: any[];
  kpis: any;
  reportGenerated: boolean;
  setReportGenerated: (val: boolean) => void;
  allCubagedTrees: any[];
  heightModels: any[];
  volumeModels: any[];
  selectedHeightModelId: string;
  setSelectedHeightModelId: (id: string) => void;
  selectedVolumeModelId: string;
  setSelectedVolumeModelId: (id: string) => void;
  processingFatorForma: string;
  setProcessingFatorForma: (val: string) => void;
  activeProcessings: any[];
  stratifiedStats: any;
  googleSheetsUrlInput: string;
  setGoogleSheetsUrlInput: (val: string) => void;
  isSyncingSheets: boolean;
  editingTalhao: any;
  setEditingTalhao: (val: any) => void;
  editTalhaoName: string;
  setEditTalhaoName: (val: string) => void;
  editTalhaoArea: string;
  setEditTalhaoArea: (val: string) => void;
  editTalhaoObs: string;
  setEditTalhaoObs: (val: string) => void;
  showStratumModal: boolean;
  setShowStratumModal: (val: boolean) => void;
  showColetaModal: boolean;
  setShowColetaModal: (val: boolean) => void;
  showRelatorioModal: boolean;
  setShowRelatorioModal: (val: boolean) => void;
  showBatchProcessModal: boolean;
  setShowBatchProcessModal: (val: boolean) => void;
  showSheetsModal: boolean;
  setShowSheetsModal: (val: boolean) => void;
  selectedReportProcessing: any;
  setSelectedReportProcessing: (val: any) => void;
  showNewProcessModal: boolean;
  setShowNewProcessModal: (val: boolean) => void;
  newProcessName: string;
  setNewProcessName: (val: string) => void;
  newProcessConsolidationMode: 'talhao' | 'stratum' | 'auto';
  setNewProcessConsolidationMode: (val: 'talhao' | 'stratum' | 'auto') => void;
  newProcessFatorCasca: string;
  setNewProcessFatorCasca: (val: string) => void;
  expandedTalhoes: Record<string, boolean>;
  setExpandedTalhoes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  expandedParcels: Record<number, boolean>;
  setExpandedParcels: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setTalhaoDashboardId: (val: string | null) => void;
  setShowParcelDashboardId: (val: number | null) => void;
  setAuditParcelId: (val: number | null) => void;
  setStratumDashboardId: (val: string | null) => void;
  collaborators: string[];
  handleSyncGoogleSheets: () => void;
  handleEditClick: (fw: any) => void;
  handleExportAll: () => void;
  handleExportAllProcessed: () => void;
  handleCreateInventoryProcessing: (name: string, mode: 'talhao' | 'stratum' | 'auto') => void;
  
  // HUD node orbital position dependencies
  getStageStatus: (id: number) => string;
  getStagePercent: (id: number) => number;
  getStageName: (id: number) => string;
  getStageKpi: (id: number) => string;
  getStageDescription: (id: number) => string;
  handleStageClick: (id: number) => void;
  getNodeIcon: (id: number) => React.ReactNode;
  getNodePos: (id: number, cols: number) => { x: number, y: number };
  cols: number;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export const HUDOfficeDashboard: React.FC<HUDOfficeDashboardProps> = ({
  activeFw,
  sidebarOpen,
  setSidebarOpen,
  activeTier,
  setActiveTier,
  focusedNode,
  setFocusedNode,
  expandedStages,
  setExpandedStages,
  activeLayer,
  setActiveLayer,
  showUpgradeModal,
  setShowUpgradeModal,
  isStageLocked,
  activeParcels,
  activeTalhoes,
  activeStrata,
  kpis,
  reportGenerated,
  allCubagedTrees,
  heightModels,
  volumeModels,
  selectedHeightModelId,
  setSelectedHeightModelId,
  selectedVolumeModelId,
  setSelectedVolumeModelId,
  processingFatorForma,
  setProcessingFatorForma,
  activeProcessings,
  stratifiedStats,
  isSyncingSheets,
  setEditingTalhao,
  setEditTalhaoName,
  setEditTalhaoArea,
  setEditTalhaoObs,
  setShowStratumModal,
  showColetaModal,
  showRelatorioModal,
  showBatchProcessModal,
  showSheetsModal,
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
  expandedTalhoes,
  setExpandedTalhoes,
  expandedParcels,
  setExpandedParcels,
  setTalhaoDashboardId,
  setShowParcelDashboardId,
  setAuditParcelId,
  setStratumDashboardId,
  collaborators,
  handleSyncGoogleSheets,
  handleEditClick,
  handleExportAll,
  handleExportAllProcessed,
  handleCreateInventoryProcessing,
  getStageStatus,
  getStagePercent,
  getStageName,
  getStageKpi,
  getStageDescription,
  handleStageClick,
  getNodeIcon,
  getNodePos,
  cols,
  mapContainerRef,
  canvasRef
}) => {
  const navigate = useNavigate();
  const { deleteTalhao, deleteStratum } = useInventory();
  const { theme } = useAuth();
  
  const activeFwId = activeFw?.id || '';

  const renderSidePanelContent = (id: number) => {
    if (!activeFw) return null;
    switch (id) {
      case 1: // Projeto
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Nome do Projeto</span>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{activeFw.nome}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Local / Fazenda</span>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{activeFw.local}</div>
            </div>
            
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ width: '100%', margin: 0, borderRadius: '6px' }} 
                onClick={() => setShowSheetsModal(true)}
              >
                {activeFw.googleSheetsUrl ? "Planilha Vinculada" : "Vincular Planilha Google"}
              </button>
              {activeFw.googleSheetsUrl && (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ width: '100%', background: 'linear-gradient(135deg, #00e676 0%, #00b0ff 100%)', border: 'none', margin: 0, borderRadius: '6px' }} 
                  onClick={handleSyncGoogleSheets}
                  disabled={isSyncingSheets}
                >
                  {isSyncingSheets ? "Sincronizando..." : "Sincronizar Planilha"}
                </button>
              )}
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', margin: 0, borderRadius: '6px' }} 
                onClick={() => handleEditClick(activeFw)}
              >
                Editar Metadados
              </button>
            </div>
          </div>
        );
        
      case 2: // Talões
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, fontSize: '12px', margin: 0, borderRadius: '6px' }} 
                onClick={() => {
                  setEditingTalhao({ fieldWorkId: activeFwId });
                  setEditTalhaoName('');
                  setEditTalhaoArea('');
                  setEditTalhaoObs('');
                }}
              >
                + Novo Talhão
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, fontSize: '12px', borderColor: '#00b0ff', color: '#00b0ff', margin: 0, borderRadius: '6px' }} 
                onClick={() => setActiveLayer('gis')}
              >
                Camada GIS Map
              </button>
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {activeTalhoes.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Nenhum talhão cadastrado.</span>
              ) : (
                activeTalhoes.map(t => {
                  const talParcels = activeParcels.filter(p => p.talhaoId === t.id);
                  return (
                    <div key={t.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '13.5px' }}>{t.nome}</span>
                        <span style={{ color: '#00e676', fontWeight: 'bold', fontSize: '12px' }}>{t.area ? `${Number(t.area).toFixed(2)} ha` : 'S/ Área'}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{talParcels.length} parcelas • {t.observacoes || 'Sem observações'}</span>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ height: '24px', padding: '0 8px', fontSize: '10px', margin: 0, borderRadius: '4px' }} 
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
                          style={{ height: '24px', padding: '0 8px', fontSize: '10px', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }} 
                          onClick={() => {
                            if (confirm(`Excluir o talhão "${t.nome}" apagarão todas as parcelas associadas. Prosseguir?`)) {
                              deleteTalhao(t.id);
                            }
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );

      case 3: // Estratos
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', fontSize: '12px', margin: 0, borderRadius: '6px' }} 
              onClick={() => setShowStratumModal(true)}
            >
              + Novo Estrato
            </button>

            <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {activeStrata.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Nenhum estrato cadastrado.</span>
              ) : (
                activeStrata.map(s => {
                  const stratParcels = activeParcels.filter(p => p.stratumId === s.id);
                  return (
                    <div key={s.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '13.5px' }}>{s.nome}</span>
                        <span style={{ color: '#00e676', fontWeight: 'bold', fontSize: '12px' }}>{s.area ? `${Number(s.area).toFixed(2)} ha` : 'S/ Área'}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stratParcels.length} parcelas • {s.descricao || 'Sem descrição'}</span>
                      <div>
                        <button 
                          className="btn btn-danger" 
                          style={{ height: '24px', padding: '0 8px', fontSize: '10px', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }} 
                          onClick={() => {
                            if (confirm(`Deseja excluir o estrato "${s.nome}"?`)) {
                              deleteStratum(s.id);
                            }
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );

      case 4: // Parcelas
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, fontSize: '12px', borderColor: '#00b0ff', color: '#00b0ff', margin: 0, borderRadius: '6px' }} 
                onClick={() => setActiveLayer('gis')}
              >
                Camada GIS Map
              </button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {activeParcels.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Nenhuma parcela cadastrada.</span>
              ) : (
                activeParcels.map(p => (
                  <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '13.5px' }}>{p.nome}</span>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Área: {p.areaParcela} m² • {p.dados.length} árvores
                      </div>
                    </div>
                    <span style={{ 
                      fontSize: '10px', 
                      padding: '2px 8px', 
                      borderRadius: '8px', 
                      background: 'rgba(255,255,255,0.03)', 
                      color: p.status === 'Concluído' ? '#00e676' : p.status === 'Em andamento' ? '#00b0ff' : 'var(--text-muted)',
                      fontWeight: '700' 
                    }}>
                      {p.status || 'Pendente'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 5: // Coleta de Campo
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', fontSize: '12px', margin: 0, borderRadius: '6px' }} 
              onClick={() => setShowColetaModal(true)}
            >
              Auditoria de Coletas
            </button>

            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Resumo de Coleta</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Árvores</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{kpis.totalTrees}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Espécies</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#00e676', marginTop: '2px' }}>{kpis.speciesCount}</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 6: // Cubagem
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fustes Cubados</span>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#00b0ff', marginTop: '2px' }}>{allCubagedTrees.length}</div>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ width: 'auto', fontSize: '11px', margin: 0, borderRadius: '6px' }} 
                onClick={() => {
                  navigate('/office'); // Switches back to classic and focuses
                }}
              >
                Gerenciar Fustes
              </button>
            </div>
          </div>
        );

      case 7: // Modelos
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Modelo Hipsométrico</label>
              <select 
                className="input-field" 
                style={{ marginBottom: 0, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} 
                value={selectedHeightModelId} 
                onChange={async (e) => {
                  setSelectedHeightModelId(e.target.value);
                  if (activeFwId) {
                    await updateDoc(doc(db, 'fieldWorks', activeFwId), {
                      selectedHeightModelId: e.target.value
                    });
                  }
                }}
              >
                <option value="none">Nenhum (Usar H Medida)</option>
                {heightModels.map(m => (
                  <option key={m.id} value={m.id}>{m.nome} ({m.tipoModelo})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Modelo Volumétrico</label>
              <select 
                className="input-field" 
                style={{ marginBottom: 0, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} 
                value={selectedVolumeModelId} 
                onChange={async (e) => {
                  setSelectedVolumeModelId(e.target.value);
                  if (activeFwId) {
                    await updateDoc(doc(db, 'fieldWorks', activeFwId), {
                      selectedVolumeModelId: e.target.value
                    });
                  }
                }}
              >
                <option value="legacy">Fator de Forma Clássico (Legacy)</option>
                {volumeModels.map(m => (
                  <option key={m.id} value={m.id}>{m.nome} ({m.tipoModelo})</option>
                ))}
              </select>
            </div>

            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', marginTop: '12px', margin: 0, borderRadius: '6px' }} 
              onClick={() => navigate('/modelos')}
            >
              Biblioteca de Equações
            </button>
          </div>
        );

      case 8: // Processamento
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, fontSize: '12px', margin: 0, borderRadius: '6px' }} 
                onClick={() => {
                  setEditingTalhao(null);
                  setShowBatchProcessModal(true);
                }}
              >
                Processar em Lote
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, fontSize: '12px', borderColor: '#00e676', color: '#00e676', margin: 0, borderRadius: '6px' }} 
                onClick={() => setActiveLayer('stats')}
              >
                Sala Estatística
              </button>
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {activeProcessings.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Nenhum snapshot oficializado.</span>
              ) : (
                activeProcessings.map(p => (
                  <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{p.nomeProcessamento}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Data: {p.dataProcessamento} • Vol: {Math.round(p.volumeTotalEstimado || 0).toLocaleString()} m³
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 9: // Extrapolação
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', fontSize: '12px', margin: 0, borderRadius: '6px' }} 
              onClick={() => setActiveLayer('stats')}
            >
              Ver Fitossociologia e Estatísticas
            </button>
            {latestOfficialProcessing && (
              <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Snapshot Oficial</span>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Erro de Amostragem %</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>
                    {stratifiedStats.errorRel !== undefined 
                      ? `${stratifiedStats.errorRel.toFixed(2)}%`
                      : 'N/D'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Intervalo de Confiança</span>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {stratifiedStats.meanSt !== undefined && stratifiedStats.errorAbs !== undefined
                      ? `${Math.round(Math.max(0, stratifiedStats.meanSt - stratifiedStats.errorAbs))} a ${Math.round(stratifiedStats.meanSt + stratifiedStats.errorAbs)} m³/ha`
                      : 'N/D'}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 10: // Sortimento
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '400px', overflowY: 'auto' }}>
            <SortimentoTab activeFw={activeFw} inventories={activeParcels} activeTalhoes={activeTalhoes} />
          </div>
        );

      case 11: // Relatório
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', fontSize: '12px', margin: 0, borderRadius: '6px' }} 
                onClick={() => setShowRelatorioModal(true)}
              >
                Baixar Relatórios Executivos
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', fontSize: '12px', margin: 0, borderRadius: '6px' }} 
                onClick={handleExportAll}
              >
                Exportar Excel Completo
              </button>
              {latestOfficialProcessing && (
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', fontSize: '12px', borderColor: '#00e676', color: '#00e676', background: 'rgba(0,230,118,0.08)', margin: 0, borderRadius: '6px' }} 
                  onClick={handleExportAllProcessed}
                >
                  Exportar Processamento (Excel)
                </button>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderNestedTreeForStage = (id: number) => {
    if (!activeFw) return null;
    switch (id) {
      case 1: // Projeto
        return (
          <div className="hud-tree-node">
            <div 
              className="hud-tree-card active"
              onClick={() => {
                setFocusedNode(1);
                setShowProjectDashboard(true);
              }}
              style={{ borderRadius: '6px' }}
            >
              <span>🏢 Ver Detalhes</span>
            </div>
            <div className="hud-tree-nested">
              <div className="hud-tree-card leaf-node" style={{ borderRadius: '6px' }}>
                <span>📍 Local: {activeFw.local || 'Não especificado'}</span>
              </div>
              <div className="hud-tree-card leaf-node" style={{ borderRadius: '6px' }}>
                <span>📅 Data: {activeFw.dataInicio}</span>
              </div>
              <div className="hud-tree-card leaf-node" style={{ borderRadius: '6px' }}>
                <span>👥 Colaboradores: {collaborators.length}</span>
              </div>
            </div>
          </div>
        );

      case 2: // Talões
        if (activeTalhoes.length === 0) {
          return (
            <div className="hud-tree-card leaf-node" style={{ color: 'var(--text-muted)', fontStyle: 'italic', borderRadius: '6px' }}>
              Sem talhões cadastrados
            </div>
          );
        }
        return activeTalhoes.map(t => {
          const isTalhaoExpanded = !!expandedTalhoes[t.id];
          return (
            <div key={t.id} className="hud-tree-node">
              <div 
                className={`hud-tree-card ${isTalhaoExpanded ? 'active' : ''}`}
                onClick={() => {
                  setExpandedTalhoes(prev => ({ ...prev, [t.id]: !prev[t.id] }));
                  setTalhaoDashboardId(t.id);
                  setFocusedNode(2);
                }}
                style={{ borderRadius: '6px' }}
              >
                <span>🌳 {t.nome}</span>
                <span>{t.area ? `${t.area} ha` : 'S/ Área'}</span>
              </div>
              {isTalhaoExpanded && (
                <div className="hud-tree-nested">
                  {activeParcels.filter(p => p.talhaoId === t.id).map(p => {
                    const isParcelExpanded = !!expandedParcels[p.id];
                    return (
                      <div key={p.id} className="hud-tree-node">
                        <div 
                          className={`hud-tree-card ${isParcelExpanded ? 'active' : ''}`}
                          onClick={() => {
                            setExpandedParcels(prev => ({ ...prev, [p.id]: !prev[p.id] }));
                            setShowParcelDashboardId(p.id);
                            setFocusedNode(4);
                          }}
                          style={{ borderRadius: '6px' }}
                        >
                          <span>📍 Parcela {p.nome}</span>
                          <span>{p.status}</span>
                        </div>
                        {isParcelExpanded && (
                          <div className="hud-tree-nested">
                            <div className="hud-tree-card leaf-node" onClick={() => { setAuditParcelId(p.id); setFocusedNode(4); }} style={{ borderRadius: '6px' }}>
                              <span>📊 Dados ({p.dados ? p.dados.length : 0} árvores)</span>
                            </div>
                            <div className="hud-tree-card leaf-node" style={{ borderRadius: '6px' }}>
                              <span>📡 GPS: {p.coordenadas || 'Sem GPS'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {activeParcels.filter(p => p.talhaoId === t.id).length === 0 && (
                    <div className="hud-tree-card leaf-node" style={{ color: 'var(--text-muted)', fontStyle: 'italic', borderRadius: '6px' }}>
                      Sem parcelas neste talhão
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        });

      case 3: // Estratos
        if (activeStrata.length === 0) {
          return (
            <div className="hud-tree-card leaf-node" style={{ color: 'var(--text-muted)', fontStyle: 'italic', borderRadius: '6px' }}>
              Sem estratos cadastrados
            </div>
          );
        }
        return activeStrata.map(s => (
          <div 
            key={s.id} 
            className="hud-tree-card" 
            onClick={() => { 
              setStratumDashboardId(s.id); 
              setFocusedNode(3); 
            }}
            style={{ borderRadius: '6px' }}
          >
            <span>🧬 {s.nome}</span>
            <span>{s.area} ha</span>
          </div>
        ));

      case 4: // Parcelas
        if (activeParcels.length === 0) {
          return (
            <div className="hud-tree-card leaf-node" style={{ color: 'var(--text-muted)', fontStyle: 'italic', borderRadius: '6px' }}>
              Sem parcelas cadastradas
            </div>
          );
        }
        return activeParcels.map(p => {
          const isParcelExpanded = !!expandedParcels[p.id];
          return (
            <div key={p.id} className="hud-tree-node">
              <div 
                className={`hud-tree-card ${isParcelExpanded ? 'active' : ''}`}
                onClick={() => {
                  setExpandedParcels(prev => ({ ...prev, [p.id]: !prev[p.id] }));
                  setShowParcelDashboardId(p.id);
                  setFocusedNode(4);
                }}
                style={{ borderRadius: '6px' }}
              >
                <span>📍 Parcela {p.nome}</span>
                <span>{p.status}</span>
              </div>
              {isParcelExpanded && (
                <div className="hud-tree-nested">
                  <div className="hud-tree-card leaf-node" onClick={() => { setAuditParcelId(p.id); setFocusedNode(4); }} style={{ borderRadius: '6px' }}>
                    <span>📊 Árvores ({p.dados ? p.dados.length : 0})</span>
                  </div>
                  <div className="hud-tree-card leaf-node" style={{ borderRadius: '6px' }}>
                    <span>📡 GPS: {p.coordenadas || 'Sem GPS'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        });

      case 5: // Coleta de Campo
        if (activeParcels.length === 0) {
          return (
            <div className="hud-tree-card leaf-node" style={{ color: 'var(--text-muted)', fontStyle: 'italic', borderRadius: '6px' }}>
              Sem parcelas para coleta
            </div>
          );
        }
        return (
          <>
            <div className="hud-tree-card active" onClick={() => { setShowColetaModal(true); setFocusedNode(5); }} style={{ borderRadius: '6px' }}>
              <span>📥 Central de Coleta</span>
            </div>
            {activeParcels.map(p => (
              <div key={p.id} className="hud-tree-card leaf-node" onClick={() => { setShowColetaModal(true); setFocusedNode(5); }} style={{ borderRadius: '6px' }}>
                <span>{p.status === 'Concluído' ? '✅' : '⏳'} {p.nome}</span>
                <span>{p.dados ? p.dados.length : 0}</span>
              </div>
            ))}
          </>
        );

      case 6: // Cubagem
        if (activeCubageSessions.length === 0) {
          return (
            <div className="hud-tree-card leaf-node" style={{ color: 'var(--text-muted)', fontStyle: 'italic', borderRadius: '6px' }}>
              Sem sessões de cubagem
            </div>
          );
        }
        return activeCubageSessions.map(s => (
          <div key={s.id} className="hud-tree-card" onClick={() => { setFocusedNode(6); }} style={{ borderRadius: '6px' }}>
            <span>🪵 {s.nome || 'Sessão'}</span>
            <span>{s.dados ? s.dados.length : 0} fustes</span>
          </div>
        ));

      case 7: // Modelos
        return (
          <>
            <div className="hud-tree-card" onClick={() => { setFocusedNode(7); }} style={{ borderRadius: '6px' }}>
              <span>Hipsometria:</span>
              <span style={{ fontSize: '9px', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedHeightModelId !== 'none' ? heightModels.find(m => m.id === selectedHeightModelId)?.nome : 'Medida'}
              </span>
            </div>
            <div className="hud-tree-card" onClick={() => { setFocusedNode(7); }} style={{ borderRadius: '6px' }}>
              <span>Volume:</span>
              <span style={{ fontSize: '9px', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedVolumeModelId !== 'legacy' ? volumeModels.find(m => m.id === selectedVolumeModelId)?.nome : `FF: ${processingFatorForma}`}
              </span>
            </div>
          </>
        );

      case 8: // Processamento
        return (
          <>
            <div className="hud-tree-card active" onClick={() => { setShowBatchProcessModal(true); setFocusedNode(8); }} style={{ borderRadius: '6px' }}>
              <span>⚡ Lote</span>
            </div>
            {activeProcessings.map(p => (
              <div 
                key={p.id} 
                className={`hud-tree-card ${p.status === 'Oficial' ? 'active' : ''}`} 
                onClick={() => { 
                  setSelectedReportProcessing(p); 
                  setFocusedNode(8); 
                }}
                style={{ borderRadius: '6px' }}
              >
                <span>⚙️ {p.nomeProcessamento}</span>
                <span>{p.status}</span>
              </div>
            ))}
            <div className="hud-tree-card leaf-node" onClick={() => { setShowNewProcessModal(true); setFocusedNode(8); }} style={{ borderRadius: '6px' }}>
              <span>➕ Novo Snapshot</span>
            </div>
          </>
        );

      case 9: // Extrapolação
        return (
          <>
            <div className="hud-tree-card" onClick={() => { setFocusedNode(9); }} style={{ borderRadius: '6px' }}>
              <span>Área Total:</span>
              <span>{activeTalhoes.reduce((acc, t) => acc + (parseFloat(t.area as any) || 0), 0).toFixed(1)} ha</span>
            </div>
            <div className="hud-tree-card" onClick={() => { setFocusedNode(9); }} style={{ borderRadius: '6px' }}>
              <span>Vol Total:</span>
              <span>
                {latestOfficialProcessing 
                  ? `${cleanResult(latestOfficialProcessing.volumeTotalEstimado).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m³` 
                  : 'Pendente'}
              </span>
            </div>
          </>
        );

      case 10: // Sortimento
        return (
          <>
            <div className="hud-tree-card" onClick={() => { setFocusedNode(10); }} style={{ borderRadius: '6px' }}>
              <span>Regras ({sortimentRules.length})</span>
            </div>
            {activeSortimentResults.map(r => (
              <div key={r.id} className="hud-tree-card" onClick={() => { setFocusedNode(10); }} style={{ borderRadius: '6px' }}>
                <span>📋 Árvore #{r.treeNumber} ({r.especie})</span>
                <span>{r.volumeSortidoTotal ? `${r.volumeSortidoTotal.toFixed(2)} m³` : '0.0 m³'}</span>
              </div>
            ))}
          </>
        );

      case 11: // Relatório Final
        return (
          <>
            <div className="hud-tree-card active" onClick={() => { setShowRelatorioModal(true); setFocusedNode(11); }} style={{ borderRadius: '6px' }}>
              <span>📄 Relatório Executivo</span>
            </div>
            {reportGenerated && (
              <div className="hud-tree-card leaf-node" style={{ borderRadius: '6px' }}>
                <span>✅ Exportado</span>
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  const activeCubageSessions = React.useMemo(() => {
    return activeParcels.filter(p => p.template === 'cubagem');
  }, [activeParcels]);

  return (
    <div className="operation-center" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#020503', animation: 'fadeInUp 0.6s ease', overflow: 'hidden' }}>
      
      {/* HUD Top bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 24px', 
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(5, 13, 8, 0.25)',
        backdropFilter: 'blur(20px)',
        flexWrap: 'wrap', 
        gap: '12px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            className="hud-btn-floating"
            onClick={() => setSidebarOpen(prev => !prev)}
            style={{ 
              background: sidebarOpen ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.02)', 
              color: sidebarOpen ? '#ffffff' : '#00e676', 
              borderColor: sidebarOpen ? '#00e676' : 'rgba(255,255,255,0.1)',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'monospace',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              borderRadius: '6px'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            {sidebarOpen ? "FECHAR PAINEL" : "ABRIR PAINEL"}
          </button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#00e676' }}>🛰</span> {activeFw ? activeFw.nome : "Centro de Operações"}
            </h2>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)' }}>
              {activeFw ? `Fazenda/Local: ${activeFw.local} | Data Inicial: ${activeFw.dataInicio}` : "Missão de Inventário Florestal • LeafTag HUD"}
            </span>
          </div>

          {/* Plan Simulator Switcher */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px', // Clamped to 12px
            padding: '3px',
            gap: '4px',
            marginLeft: '8px'
          }}>
            <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 'bold', padding: '0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Plano:
            </span>
            {[
              { id: 'field', label: 'Campo', color: '#ffab40' },
              { id: 'inventory', label: 'Inventário', color: '#40c4ff' },
              { id: 'forest', label: 'Forest', color: '#00e676' }
            ].map(p => {
              const active = activeTier === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveTier(p.id as any);
                    setFocusedNode(null);
                  }}
                  style={{
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '8px', // Clamped to 8px
                    cursor: 'pointer',
                    background: active ? `${p.color}20` : 'transparent',
                    color: active ? p.color : 'rgba(255, 255, 255, 0.5)',
                    border: active ? `1px solid ${p.color}50` : '1px solid transparent',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="hud-btn-floating"
            onClick={() => { setActiveLayer('process'); setFocusedNode(null); }}
            style={{ 
              background: activeLayer === 'process' ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.02)', 
              color: activeLayer === 'process' ? '#ffffff' : '#00e676', 
              borderColor: activeLayer === 'process' ? '#00e676' : 'rgba(255,255,255,0.1)',
              borderRadius: '6px'
            }}
          >
            Visão de Processo
          </button>
          <button 
            className="hud-btn-floating"
            onClick={() => {
              if (activeTier === 'field' || activeTier === 'inventory') {
                setShowUpgradeModal({ requiredTier: 'forest', featureName: 'Camada GIS (Territorial)' });
              } else {
                setActiveLayer('gis');
                setFocusedNode(null);
              }
            }}
            style={{ 
              background: activeLayer === 'gis' ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.02)', 
              color: activeLayer === 'gis' ? '#ffffff' : (activeTier === 'field' || activeTier === 'inventory' ? 'rgba(255,255,255,0.3)' : '#00e676'), 
              borderColor: activeLayer === 'gis' ? '#00e676' : 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '6px'
            }}
          >
            {(activeTier === 'field' || activeTier === 'inventory') && <span>🔒</span>}
            Camada GIS (Territorial)
          </button>
          <button 
            className="hud-btn-floating"
            onClick={() => {
              if (activeTier === 'field') {
                setShowUpgradeModal({ requiredTier: 'inventory', featureName: 'Sala Estatística' });
              } else {
                setActiveLayer('stats');
                setFocusedNode(null);
              }
            }}
            style={{ 
              background: activeLayer === 'stats' ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.02)', 
              color: activeLayer === 'stats' ? '#ffffff' : (activeTier === 'field' ? 'rgba(255,255,255,0.3)' : '#00e676'), 
              borderColor: activeLayer === 'stats' ? '#00e676' : 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '6px'
            }}
          >
            {activeTier === 'field' && <span>🔒</span>}
            Sala Estatística
          </button>
        </div>
      </div>

      {/* Core HUD Canvas Container */}
      <div 
        className="space-hud-container" 
        ref={mapContainerRef}
        style={{ 
          flex: 1, 
          height: 'auto', 
          border: 'none', 
          borderRadius: '0px', 
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        
        {/* Stars background */}
        <div className="hud-stars" />
        
        {/* Left and Right Scroll Navigation Assists */}
        {activeLayer === 'process' && (
          <>
            <button 
              className="hud-scroll-arrow left-arrow"
              onClick={() => {
                if (canvasRef.current) {
                  canvasRef.current.scrollBy({ left: -360, behavior: 'smooth' });
                }
              }}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                background: 'rgba(5, 10, 8, 0.85)',
                border: '1px solid rgba(0, 230, 118, 0.25)',
                color: '#00e676',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                transition: 'all 0.2s ease'
              }}
              title="Rolar para a esquerda"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button 
              className="hud-scroll-arrow right-arrow"
              onClick={() => {
                if (canvasRef.current) {
                  canvasRef.current.scrollBy({ left: 360, behavior: 'smooth' });
                }
              }}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                background: 'rgba(5, 10, 8, 0.85)',
                border: '1px solid rgba(0, 230, 118, 0.25)',
                color: '#00e676',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                transition: 'all 0.2s ease'
              }}
              title="Rolar para a direita"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </>
        )}

        {/* GIS Layer Overlay */}
        {activeLayer === 'gis' && (
          <ForestGISModule
            inventories={activeParcels}
            talhoes={activeTalhoes}
            fieldWorkId={activeFwId}
            onClose={() => { setActiveLayer('process'); setFocusedNode(null); }}
          />
        )}

        {/* Stats Layer Overlay */}
        {activeLayer === 'stats' && (
          <StatisticalDashboard inventories={activeParcels} onClose={() => { setActiveLayer('process'); setFocusedNode(null); }} />
        )}

        {/* Nodes Layer - Redesign V2 Horizontal Flow Pipeline with Nested Expandable Tree Nodes */}
        {activeLayer === 'process' && (
          <div className="space-hud-canvas" ref={canvasRef}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(id => {
              const status = getStageStatus(id);
              const percent = getStagePercent(id);
              const name = getStageName(id);
              const kpi = getStageKpi(id);
              const isExpanded = expandedStages[id];
              
              return (
                <div key={id} className="hud-pipeline-column">
                  
                  {/* Laser Connection Line between columns */}
                  {id < 11 && (
                    <div className="hud-pipeline-laser">
                      <div className="hud-pipeline-laser-pulse" style={{ animationDelay: `${(id - 1) * 0.4}s` }} />
                    </div>
                  )}
                  
                  {/* Sphere Node (Circular tech-grade bezel) */}
                  <div
                    id={`op-node-${id}`}
                    className={`hud-node-sphere status-${status} ${focusedNode === id ? 'active' : ''} ${isStageLocked(id) ? 'locked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isStageLocked(id)) {
                        setShowUpgradeModal({ requiredTier: 'inventory', featureName: `Etapa "${name}"` });
                      } else {
                        handleStageClick(id);
                      }
                    }}
                    style={isStageLocked(id) ? { opacity: 0.5, cursor: 'not-allowed', filter: 'grayscale(0.8)' } : undefined}
                  >
                    {/* Orbit decorative dash ring */}
                    <div className="hud-sphere-orbit" />

                    {/* Hover Tooltip Card */}
                    <div className="hud-hover-info" style={{ borderRadius: '8px' }}>
                      <div style={{ fontWeight: '800', fontSize: '11px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '6px', color: '#00e676', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.5px' }}>
                        {name.toUpperCase()}
                      </div>
                      <div className="hud-hover-line">
                        <span>Status:</span>
                        <span style={{ color: status === 'complete' || status === 'progress' ? '#00ff66' : '#94a3b8', fontWeight: 'bold' }}>
                          {status === 'complete' ? 'Concluído' : status === 'progress' ? 'Em Progresso' : status === 'warning' ? 'Atenção' : 'Não Iniciado'}
                        </span>
                      </div>
                      <div className="hud-hover-line">
                        <span>Progresso:</span>
                        <span style={{ color: '#ffffff' }}>{percent}%</span>
                      </div>
                      <div className="hud-hover-line">
                        <span>Métrica:</span>
                        <span style={{ color: '#cbd5e1' }}>{kpi}</span>
                      </div>
                      <div style={{ marginTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '6px' }}>
                        <span style={{ fontSize: '9px', color: '#aaa', fontStyle: 'italic', display: 'block', width: '100%', whiteSpace: 'normal', lineHeight: '1.3' }}>
                          {getStageDescription(id)}
                        </span>
                      </div>
                    </div>

                    {/* Icon */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isStageLocked(id) ? (
                        <span style={{ fontSize: '18px' }}>🔒</span>
                      ) : (
                        getNodeIcon(id)
                      )}
                    </div>
                  </div>

                  {/* Info labels placed below the sphere */}
                  <div className="hud-node-info-wrapper">
                    <div className="hud-node-title">
                      {name}
                    </div>
                    <div className="hud-node-kpi">
                      {kpi}
                    </div>
                    
                    {/* Expand Button */}
                    {!isStageLocked(id) && (
                      <button 
                        className="hud-expand-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedStages(prev => ({ ...prev, [id]: !prev[id] }));
                        }}
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                  
                  {/* Sub-tree nodes container when expanded */}
                  {isExpanded && (
                    <div className="hud-tree-container">
                      {renderNestedTreeForStage(id)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Sliding Control Side Panel */}
        <div className={`glass-side-panel ${focusedNode !== null ? 'open' : ''}`} style={{ borderRadius: '12px 0 0 12px' }}>
          {focusedNode !== null && (
            <>
              <div className="glass-side-panel-header">
                <div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '1px' }}>ETAPA {String(focusedNode).padStart(2, '0')}</span>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '2px 0 0 0', color: '#fff' }}>{focusedNode === 1 ? "PROJETO" : getStageName(focusedNode)}</h3>
                </div>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: 'auto', padding: '4px 10px', fontSize: '11px', margin: 0, borderRadius: '4px' }} 
                  onClick={() => setFocusedNode(null)}
                >
                  Fechar [X]
                </button>
              </div>
              
              <div className="glass-side-panel-body">
                {/* Status Alert */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status da Etapa</span>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: '800', 
                    textTransform: 'uppercase', 
                    color: getStageStatus(focusedNode) === 'complete' ? '#00e676' : getStageStatus(focusedNode) === 'progress' ? '#00ff66' : getStageStatus(focusedNode) === 'warning' ? '#00e676' : 'var(--text-muted)' 
                  }}>
                    {getStageStatus(focusedNode) === 'complete' ? 'Concluído' : getStageStatus(focusedNode) === 'progress' ? 'Em Progresso' : getStageStatus(focusedNode) === 'warning' ? 'Atenção' : 'Não Iniciado'}
                  </span>
                </div>

                {/* Stage description */}
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                  {getStageDescription(focusedNode)}
                </p>

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                
                {/* Render Node Specific Subviews */}
                {renderSidePanelContent(focusedNode)}
              </div>
            </>
          )}
        </div>

        {/* Upgrade Simulator Modal */}
        {showUpgradeModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{
              background: '#07100a',
              border: '1px solid rgba(0,230,118,0.25)',
              borderRadius: '12px', // Clamped to 12px
              padding: '28px 24px',
              width: '350px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
              textAlign: 'center',
              fontFamily: 'system-ui, sans-serif'
            }}>
              <div style={{ fontSize: '42px', marginBottom: '16px' }}>🔒</div>
              <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '800', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
                Recurso Premium
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: '1.5', margin: '0 0 24px 0' }}>
                A funcionalidade/etapa <strong>{showUpgradeModal.featureName}</strong> está disponível apenas nos planos superiores do LeafTag.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => {
                    setActiveTier(showUpgradeModal.requiredTier);
                    if (showUpgradeModal.featureName === 'Camada GIS (Territorial)') {
                      setActiveLayer('gis');
                    } else if (showUpgradeModal.featureName === 'Sala Estatística') {
                      setActiveLayer('stats');
                    }
                    setShowUpgradeModal(null);
                  }}
                  style={{
                    background: 'rgba(0,230,118,0.2)',
                    border: '1px solid rgba(0,230,118,0.5)',
                    borderRadius: '8px', // Clamped to 8px
                    color: '#00e676',
                    padding: '11px 16px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ⚡ Simular Plano {showUpgradeModal.requiredTier === 'forest' ? 'LeafTag Forest' : 'LeafTag Inventory'}
                </button>
                <button
                  onClick={() => setShowUpgradeModal(null)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', // Clamped to 8px
                    color: '#888',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
