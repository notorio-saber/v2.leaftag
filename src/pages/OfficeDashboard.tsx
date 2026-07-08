import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { StatisticalDashboard } from '../components/StatisticalDashboard';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  calculateShannonIndex, 
  calculateSimpsonIndex, 
  calculatePielouIndex, 
  calculateBasalArea, 
  calculateVolume 
} from '../utils/forestryCalculations';
import type { 
  InventoryProcessing, 
  ModelSnapshot, 
  ParcelaSnapshot, 
  TalhaoConsolidation, 
  StratumConsolidation, 
  TrabalhoConsolidation 
} from '../types';

import { ProjectSelectionView } from '../components/office/ProjectSelectionView';
import { ClassicOfficeDashboard } from '../components/office/ClassicOfficeDashboard';
import { HUDOfficeDashboard } from '../components/office/HUDOfficeDashboard';
import { SettingsModal } from '../components/office/modals/SettingsModal';
import { TeamModal } from '../components/office/modals/TeamModal';
import { GoogleSheetsModal } from '../components/office/modals/GoogleSheetsModal';
import { BatchProcessModal } from '../components/office/modals/BatchProcessModal';

const PONTOS_RELATIVOS = [
  'Base', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', 'Topo'
];

export const OfficeDashboard = () => {
  const navigate = useNavigate();
  const { 
    fieldWorks, 
    talhoes, 
    inventories, 
    strata, 
    createStratum, 
    deleteStratum, 
    saveInventory, 
    isSynced, 
    createTalhao, 
    deleteTalhao, 
    createFieldWork, 
    heightModels, 
    volumeModels, 
    duplicateFieldWork,
    processings,
    saveProcessing,
    deleteProcessing,
    sortimentRules,
    sortimentResults
  } = useInventory();
  const { currentUser, signOut, status, uidToUse, theme, toggleTheme } = useAuth();
  const isLight = theme === 'light';

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const isOwner = currentUser && currentUser.uid === uidToUse && (status === 'active' || status === 'admin');

  useEffect(() => {
    if (!currentUser || (status !== 'active' && status !== 'admin')) return;
    if (currentUser.uid !== uidToUse) return;

    const loadCollaborators = async () => {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCollaborators(docSnap.data().collaborators || []);
        }
      } catch (e) {
        console.error("Erro ao carregar colaboradores:", e);
      }
    };
    loadCollaborators();
  }, [currentUser, showTeamModal, uidToUse, status]);

  const [activeFwId, setActiveFwId] = useState<string>('');
  const [searchProjectQuery, setSearchProjectQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'centro-operacoes' | 'talhoes' | 'parcelas' | 'estratos' | 'cubagem' | 'extrapolacao' | 'processamentos' | 'sortimento'>('centro-operacoes');
  const [extraTab, setExtraTab] = useState<'parcelas' | 'talhoes' | 'estratos' | 'trabalho'>('parcelas');
  const [cubageSortOrder, setCubageSortOrder] = useState<'asc' | 'desc' | null>('desc');

  // HUD states
  const [activeLayer, setActiveLayer] = useState<'process' | 'gis' | 'stats'>('process');
  const [focusedNode, setFocusedNode] = useState<number | null>(null);
  const [expandedStages, setExpandedStages] = useState<Record<number, boolean>>({ 2: true });

  // Tier Simulator states
  const [activeTier, setActiveTier] = useState<'field' | 'inventory' | 'forest'>('forest');
  const [showUpgradeModal, setShowUpgradeModal] = useState<{ requiredTier: 'inventory' | 'forest'; featureName: string } | null>(null);

  const isStageLocked = (stageId: number): boolean => {
    if (activeTier === 'field') {
      return ![1, 4, 5].includes(stageId);
    }
    return false;
  };

  useEffect(() => {
    if (focusedNode !== null) {
      const isLocked = activeTier === 'field' && ![1, 4, 5].includes(focusedNode);
      if (isLocked) {
        setFocusedNode(null);
      }
    }
    if (activeTier === 'field') {
      setActiveLayer('process');
    } else if (activeTier === 'inventory' && activeLayer === 'gis') {
      setActiveLayer('process');
    }
  }, [activeTier, focusedNode, activeLayer]);
  const [expandedTalhoes, setExpandedTalhoes] = useState<Record<string, boolean>>({});
  const [expandedParcels, setExpandedParcels] = useState<Record<number, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [interfaceMode, setInterfaceMode] = useState<'hud' | 'classic'>(() => {
    return (localStorage.getItem('interface_mode') as 'hud' | 'classic') || 'hud';
  });

  const toggleInterfaceMode = () => {
    const newMode = interfaceMode === 'hud' ? 'classic' : 'hud';
    setInterfaceMode(newMode);
    localStorage.setItem('interface_mode', newMode);
    if (newMode === 'hud') {
      setActiveTab('centro-operacoes');
    }
  };
  
  // Modals for the Operations Center
  const [showColetaModal, setShowColetaModal] = useState(false);
  const [showRelatorioModal, setShowRelatorioModal] = useState(false);
  const [reportGenerated, setReportGenerated] = useState<boolean>(false);

  useEffect(() => {
    if (activeFwId) {
      setReportGenerated(localStorage.getItem(`report_generated_${activeFwId}`) === 'true');
    } else {
      setReportGenerated(false);
    }
  }, [activeFwId]);
  
  // States for sub-dashboards and audits
  const [auditParcelId, setAuditParcelId] = useState<number | null>(null);
  const [talhaoDashboardId, setTalhaoDashboardId] = useState<string | null>(null);
  const [stratumDashboardId, setStratumDashboardId] = useState<string | null>(null);
  const [showParcelDashboardId, setShowParcelDashboardId] = useState<number | null>(null);
  const [selectedTalhaoId, setSelectedTalhaoId] = useState<string | null>(null);
  const [showProjectDashboard, setShowProjectDashboard] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [talhaoFilter, setTalhaoFilter] = useState('');
  const [stratumFilter, setStratumFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // States for Strata Creation Modal
  const [showStratumModal, setShowStratumModal] = useState(false);
  const [newStratumName, setNewStratumName] = useState('');
  const [newStratumArea, setNewStratumArea] = useState('');
  const [newStratumDesc, setNewStratumDesc] = useState('');

  // States for Talhao Editing
  const [editingTalhao, setEditingTalhao] = useState<any>(null);
  const [editTalhaoName, setEditTalhaoName] = useState('');
  const [editTalhaoArea, setEditTalhaoArea] = useState('');
  const [editTalhaoObs, setEditTalhaoObs] = useState('');

  // States for Google Sheets
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [googleSheetsUrlInput, setGoogleSheetsUrlInput] = useState('');
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);

  // Estados para processamento profissional no escritório
  const [selectedHeightModelId, setSelectedHeightModelId] = useState<string>('none');
  const [selectedVolumeModelId, setSelectedVolumeModelId] = useState<string>('legacy');
  const [processingFatorForma, setProcessingFatorForma] = useState<string>('0.7');

  // Estados para o processamento em lote no escritório
  const [showBatchProcessModal, setShowBatchProcessModal] = useState(false);
  const [batchScope, setBatchScope] = useState<'total' | 'talhao' | 'parcela'>('total');
  const [batchTalhaoId, setBatchTalhaoId] = useState<string>('');
  const [batchParcelId, setBatchParcelId] = useState<number | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Estados para novos processamentos oficiais consolidadores
  const [selectedProcessAId, setSelectedProcessAId] = useState<string>('');
  const [selectedProcessBId, setSelectedProcessBId] = useState<string>('');
  const [showNewProcessModal, setShowNewProcessModal] = useState(false);
  const [newProcessName, setNewProcessName] = useState('');
  const [newProcessConsolidationMode, setNewProcessConsolidationMode] = useState<'talhao' | 'stratum' | 'auto'>('auto');
  const [newProcessFatorCasca, setNewProcessFatorCasca] = useState('0.90');
  const [selectedReportProcessing, setSelectedReportProcessing] = useState<InventoryProcessing | null>(null);

  // States for desktop stem and taper visualizer
  const [selectedVisualizerTree, setSelectedVisualizerTree] = useState<any | null>(null);
  const [selectedVisualizerPoint, setSelectedVisualizerPoint] = useState<string>('Base');
  const [selectedVisualizerSectionId, setSelectedVisualizerSectionId] = useState<string | null>(null);

  // Estados para o menu de 3 pontinhos e edição de trabalhos no escritório
  const [activeMenuFwId, setActiveMenuFwId] = useState<string | null>(null);
  const [editingFw, setEditingFw] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocal, setEditLocal] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuFwId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const parseDateToYmd = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  };

  const handleEditClick = (fw: any) => {
    setEditingFw(fw);
    setEditName(fw.nome);
    setEditLocal(fw.local || '');
    setEditDate(parseDateToYmd(fw.dataInicio));
    setActiveMenuFwId(null);
  };

  const handleUpdateFw = async () => {
    if (!editName) return alert('Dê um nome ao trabalho.');
    const formattedDate = editDate 
      ? new Date(editDate + 'T12:00:00').toLocaleDateString('pt-BR')
      : editingFw.dataInicio;

    try {
      await createFieldWork({
        ...editingFw,
        nome: editName,
        local: editLocal || 'Não especificado',
        dataInicio: formattedDate
      });
      setEditingFw(null);
    } catch (err: any) {
      alert("Erro ao atualizar o trabalho: " + err.message);
    }
  };

  const handleExportFieldWork = (fw: any) => {
    const fwParcels = inventories.filter(i => i.fieldWorkId === fw.id && i.template !== 'cubagem');
    const fwTalhoes = talhoes.filter(t => t.fieldWorkId === fw.id);
    
    const allData: any[] = [];
    fwParcels.forEach(inv => {
      const currentTal = fwTalhoes.find(t => t.id === inv.talhaoId);
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

    if (allData.length === 0) {
      alert("Nenhum dado encontrado nas parcelas deste trabalho.");
      return;
    }
    
    const worksheet = XLSX.utils.json_to_sheet(allData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados Consolidados");
    XLSX.writeFile(workbook, `Projeto_${fw.nome.replace(/\s+/g, '_')}_Completo.xlsx`);
  };

  // Helper para obter DAP a partir de cap ou dap
  const getDapOfTreeOrStem = (item: any) => {
    if (item.dap !== undefined && item.dap !== null && item.dap !== '') {
      const dVal = parseFloat(item.dap);
      if (!isNaN(dVal)) return dVal;
    }
    if (item.cap !== undefined && item.cap !== null && item.cap !== '') {
      const cVal = parseFloat(item.cap);
      if (!isNaN(cVal)) return cVal / Math.PI;
    }
    return 0;
  };

  // Helper para limpar resultados de cálculo
  const cleanResult = (val: number) => {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Math.max(0, val);
  };

  // Avalia modelo hipsométrico (retorna H em metros)
  const evaluateHeightModel = (model: any, dap: number): number => {
    if (dap <= 0) return 0;
    const { beta0, beta1, beta2, expressaoCustom } = model.coeficientes;
    
    switch (model.tipoModelo) {
      case 'linear':
        return beta0 + beta1 * dap;
      case 'logaritmico':
      case 'henriksen':
        return beta0 + beta1 * Math.log(dap);
      case 'curtis':
        return Math.exp(beta0 + beta1 / dap);
      case 'trorey':
        return beta0 + beta1 * dap + (beta2 || 0) * Math.pow(dap, 2);
      case 'personalizado':
        if (!expressaoCustom) return 0;
        try {
          const vars = {
            DAP: dap,
            beta0: beta0,
            beta1: beta1 || 0,
            beta2: beta2 || 0,
            beta3: model.coeficientes.beta3 || 0
          };
          const fn = new Function(...Object.keys(vars), `return ${expressaoCustom}`);
          return fn(...Object.values(vars));
        } catch (err) {
          console.error('Erro ao avaliar modelo hipsométrico personalizado:', err);
          return 0;
        }
      default:
        return 0;
    }
  };

  // Avalia modelo volumétrico (retorna V em m³)
  const evaluateVolumeModel = (model: any, dap: number, h: number): number => {
    if (dap <= 0) return 0;
    const { beta0, beta1, beta2, beta3, expressaoCustom } = model.coeficientes;

    switch (model.tipoModelo) {
      case 'fator_forma':
        const g = (Math.PI * Math.pow(dap / 100, 2)) / 4;
        return g * h * beta0;
      case 'schumacher_hall':
        if (h <= 0) return 0;
        return beta0 * Math.pow(dap, beta1 || 0) * Math.pow(h, beta2 || 0);
      case 'spurr':
        return beta0 + (beta1 || 0) * Math.pow(dap, 2) * h;
      case 'stoate':
        return beta0 + (beta1 || 0) * Math.pow(dap, 2) + (beta2 || 0) * Math.pow(dap, 2) * h + (beta3 || 0) * h;
      case 'husch':
        return beta0 * Math.pow(dap, beta1 || 0);
      case 'personalizado':
        if (!expressaoCustom) return 0;
        try {
          const vars = {
            DAP: dap,
            H: h,
            beta0: beta0,
            beta1: beta1 || 0,
            beta2: beta2 || 0,
            beta3: beta3 || 0
          };
          const fn = new Function(...Object.keys(vars), `return ${expressaoCustom}`);
          return fn(...Object.values(vars));
        } catch (err) {
          console.error('Erro ao avaliar modelo volumétrico personalizado:', err);
          return 0;
        }
      default:
        return 0;
    }
  };

  // Função principal para processar a parcela inteira no painel de auditoria do escritório
  const handleProcessParcelDataInOffice = async (targetParcel: any) => {
    if (!targetParcel) return;

    const hm = selectedHeightModelId !== 'none' ? heightModels.find(m => m.id === selectedHeightModelId) : null;
    let vm: any = null;
    let isLegacyVolume = false;
    let legacyFf = 0.7;

    if (selectedVolumeModelId === 'legacy') {
      isLegacyVolume = true;
      legacyFf = parseFloat(processingFatorForma);
      if (isNaN(legacyFf) || legacyFf <= 0) {
        alert('Fator de forma comercial inválido.');
        return;
      }
    } else {
      vm = volumeModels.find(m => m.id === selectedVolumeModelId);
      if (!vm) {
        alert('Modelo volumétrico não encontrado.');
        return;
      }
    }

    const updatedDados = targetParcel.dados.map((ind: any) => {
      const tree = { ...ind };
      
      let isHeightMeasured = false;
      let usedHeight = 0;
      let calculatedVol = 0;

      if (tree.multipleStems && tree.stems && tree.stems.length > 0) {
        let sumVol = 0;
        let maxStemHt = 0;
        let hasAnyEstimate = false;

        const updatedStems = tree.stems.map((stem: any) => {
          const stemCopy = { ...stem };
          const stemDap = getDapOfTreeOrStem(stemCopy);
          let stemHt = parseFloat(stemCopy.altura || '0');
          let stemHtMedidaOuEstimada: 'medida' | 'estimada' = 'medida';

          if (isNaN(stemHt) || stemHt <= 0) {
            const globalHt = parseFloat(tree.ht || '0');
            if (!isNaN(globalHt) && globalHt > 0) {
              stemHt = globalHt;
            }
          }

          if ((isNaN(stemHt) || stemHt <= 0) && hm) {
            stemHt = evaluateHeightModel(hm, stemDap);
            stemHt = cleanResult(stemHt);
            stemHtMedidaOuEstimada = 'estimada';
            hasAnyEstimate = true;
          } else if (isNaN(stemHt) || stemHt <= 0) {
            stemHt = 0;
          }

          stemCopy.alturaProcessada = Number(stemHt.toFixed(2));
          stemCopy.alturaMedidaOuEstimada = stemHtMedidaOuEstimada;

          if (stemHt > maxStemHt) {
            maxStemHt = stemHt;
          }

          let stemVol = 0;
          if (isLegacyVolume) {
            const g = (Math.PI * Math.pow(stemDap / 100, 2)) / 4;
            stemVol = g * stemHt * legacyFf;
          } else if (vm) {
            stemVol = evaluateVolumeModel(vm, stemDap, stemHt);
          }
          stemVol = cleanResult(stemVol);
          stemCopy.volumeProcessado = Number(stemVol.toFixed(4));
          sumVol += stemVol;

          return stemCopy;
        });

        usedHeight = maxStemHt;
        calculatedVol = sumVol;
        isHeightMeasured = !hasAnyEstimate && tree.stems.every((s: any) => parseFloat(s.altura) > 0);
        tree.stems = updatedStems;

      } else {
        const treeDap = getDapOfTreeOrStem(tree);
        let treeHt = parseFloat(tree.ht || '0');
        let htMedidaOuEstimada: 'medida' | 'estimada' = 'medida';

        if ((isNaN(treeHt) || treeHt <= 0) && hm) {
          treeHt = evaluateHeightModel(hm, treeDap);
          treeHt = cleanResult(treeHt);
          htMedidaOuEstimada = 'estimada';
        } else if (isNaN(treeHt) || treeHt <= 0) {
          treeHt = 0;
        } else {
          isHeightMeasured = true;
        }

        usedHeight = treeHt;

        if (isLegacyVolume) {
          const g = (Math.PI * Math.pow(treeDap / 100, 2)) / 4;
          calculatedVol = g * treeHt * legacyFf;
        } else if (vm) {
          calculatedVol = evaluateVolumeModel(vm, treeDap, treeHt);
        }
        calculatedVol = cleanResult(calculatedVol);
        isHeightMeasured = htMedidaOuEstimada === 'medida';
      }

      tree.alturaUtilizada = Number(usedHeight.toFixed(2));
      tree.alturaMedidaOuEstimada = isHeightMeasured ? 'medida' : 'estimada';
      tree.volumeCalculado = Number(calculatedVol.toFixed(4));

      const hmDesc = hm ? `Hipsometria: ${hm.nome} (${hm.tipoModelo})` : 'Hipsometria: Não utilizada';
      const vmDesc = isLegacyVolume ? `Volume: Fator de Forma (${legacyFf})` : `Volume: ${vm.nome} (${vm.tipoModelo})`;
      tree.modeloUtilizado = `${hmDesc} | ${vmDesc}`;

      return tree;
    });

    const updatedInventory = {
      ...targetParcel,
      dados: updatedDados
    };

    try {
      await saveInventory(updatedInventory);
      alert('Processamento profissional concluído na parcela com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar dados processados na parcela.');
    }
  };

  const handleBatchProcess = async () => {
    let parcelsToProcess = [...activeParcels];
    if (batchScope === 'talhao') {
      if (!batchTalhaoId) return alert('Por favor, selecione o talhão.');
      parcelsToProcess = activeParcels.filter(p => p.talhaoId === batchTalhaoId);
    } else if (batchScope === 'parcela') {
      if (!batchParcelId) return alert('Por favor, selecione a parcela.');
      parcelsToProcess = activeParcels.filter(p => p.id === batchParcelId);
    }

    if (parcelsToProcess.length === 0) {
      return alert('Nenhuma parcela encontrada para processar.');
    }

    const hm = selectedHeightModelId !== 'none' ? heightModels.find(m => m.id === selectedHeightModelId) : null;
    let vm: any = null;
    let isLegacyVolume = false;
    let legacyFf = 0.7;

    if (selectedVolumeModelId === 'legacy') {
      isLegacyVolume = true;
      legacyFf = parseFloat(processingFatorForma);
      if (isNaN(legacyFf) || legacyFf <= 0) {
        return alert('Fator de forma comercial inválido.');
      }
    } else {
      vm = volumeModels.find(m => m.id === selectedVolumeModelId);
      if (!vm) {
        return alert('Modelo volumétrico não encontrado.');
      }
    }

    setIsBatchProcessing(true);
    let successCount = 0;

    try {
      for (const targetParcel of parcelsToProcess) {
        const updatedDados = targetParcel.dados.map((ind: any) => {
          const tree = { ...ind };
          let isHeightMeasured = false;
          let usedHeight = 0;
          let calculatedVol = 0;

          if (tree.multipleStems && tree.stems && tree.stems.length > 0) {
            let sumVol = 0;
            let maxStemHt = 0;
            let hasAnyEstimate = false;

            const updatedStems = tree.stems.map((stem: any) => {
              const stemCopy = { ...stem };
              const stemDap = getDapOfTreeOrStem(stemCopy);
              let stemHt = parseFloat(stemCopy.altura || '0');
              let stemHtMedidaOuEstimada: 'medida' | 'estimada' = 'medida';

              if (isNaN(stemHt) || stemHt <= 0) {
                const globalHt = parseFloat(tree.ht || '0');
                if (!isNaN(globalHt) && globalHt > 0) {
                  stemHt = globalHt;
                }
              }

              if ((isNaN(stemHt) || stemHt <= 0) && hm) {
                stemHt = evaluateHeightModel(hm, stemDap);
                stemHt = cleanResult(stemHt);
                stemHtMedidaOuEstimada = 'estimada';
                hasAnyEstimate = true;
              } else if (isNaN(stemHt) || stemHt <= 0) {
                stemHt = 0;
              }

              stemCopy.alturaProcessada = Number(stemHt.toFixed(2));
              stemCopy.alturaMedidaOuEstimada = stemHtMedidaOuEstimada;

              if (stemHt > maxStemHt) {
                maxStemHt = stemHt;
              }

              let stemVol = 0;
              if (isLegacyVolume) {
                const g = (Math.PI * Math.pow(stemDap / 100, 2)) / 4;
                stemVol = g * stemHt * legacyFf;
              } else if (vm) {
                stemVol = evaluateVolumeModel(vm, stemDap, stemHt);
              }
              stemVol = cleanResult(stemVol);
              stemCopy.volumeProcessado = Number(stemVol.toFixed(4));
              sumVol += stemVol;

              return stemCopy;
            });

            usedHeight = maxStemHt;
            calculatedVol = sumVol;
            isHeightMeasured = !hasAnyEstimate && tree.stems.every((s: any) => parseFloat(s.altura) > 0);
            tree.stems = updatedStems;

          } else {
            const treeDap = getDapOfTreeOrStem(tree);
            let treeHt = parseFloat(tree.ht || '0');
            let htMedidaOuEstimada: 'medida' | 'estimada' = 'medida';

            if ((isNaN(treeHt) || treeHt <= 0) && hm) {
              treeHt = evaluateHeightModel(hm, treeDap);
              treeHt = cleanResult(treeHt);
              htMedidaOuEstimada = 'estimada';
            } else if (isNaN(treeHt) || treeHt <= 0) {
              treeHt = 0;
            } else {
              isHeightMeasured = true;
            }

            usedHeight = treeHt;

            if (isLegacyVolume) {
              const g = (Math.PI * Math.pow(treeDap / 100, 2)) / 4;
              calculatedVol = g * treeHt * legacyFf;
            } else if (vm) {
              calculatedVol = evaluateVolumeModel(vm, treeDap, treeHt);
            }
            calculatedVol = cleanResult(calculatedVol);
            isHeightMeasured = htMedidaOuEstimada === 'medida';
          }

          tree.alturaUtilizada = Number(usedHeight.toFixed(2));
          tree.alturaMedidaOuEstimada = isHeightMeasured ? 'medida' : 'estimada';
          tree.volumeCalculado = Number(calculatedVol.toFixed(4));

          const hmDesc = hm ? `Hipsometria: ${hm.nome} (${hm.tipoModelo})` : 'Hipsometria: Não utilizada';
          const vmDesc = isLegacyVolume ? `Volume: Fator de Forma (${legacyFf})` : `Volume: ${vm.nome} (${vm.tipoModelo})`;
          tree.modeloUtilizado = `${hmDesc} | ${vmDesc}`;

          return tree;
        });

        const updatedInventory = {
          ...targetParcel,
          dados: updatedDados
        };

        await saveInventory(updatedInventory);
        successCount++;
      }

      alert(`Processamento concluído com sucesso em ${successCount} parcela(s)!`);
      setShowBatchProcessModal(false);
    } catch (e) {
      console.error(e);
      alert('Erro ao executar o processamento em lote.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

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

  useEffect(() => {
    if (activeFw) {
      setGoogleSheetsUrlInput(activeFw.googleSheetsUrl || '');
    }
  }, [activeFw]);

  const activeParcels = useMemo(() => {
    return inventories.filter(i => i.fieldWorkId === activeFwId && i.template !== 'cubagem');
  }, [inventories, activeFwId]);

  const activeTalhoes = useMemo(() => {
    return talhoes.filter(t => t.fieldWorkId === activeFwId);
  }, [talhoes, activeFwId]);

  const activeStrata = useMemo(() => {
    return strata.filter(s => s.fieldWorkId === activeFwId);
  }, [strata, activeFwId]);

  const activeSortimentResults = useMemo(() => {
    return sortimentResults ? sortimentResults.filter(r => r.fieldWorkId === activeFwId) : [];
  }, [sortimentResults, activeFwId]);

  const latestOfficialProcessing = useMemo(() => {
    if (!processings) return null;
    const fwProcessings = processings.filter(p => p.fieldWorkId === activeFwId);
    const official = fwProcessings.filter(p => p.status === 'Oficial');
    if (official.length > 0) {
      return [...official].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    }
    return null;
  }, [processings, activeFwId]);

  const extrapolationData = useMemo(() => {
    if (!activeFw) return null;

    // 1. Processed Parcels
    const processedParcels = activeParcels.map(inv => {
      const isProcessed = inv.dados && inv.dados.length > 0 && inv.dados.some(t => t.volumeCalculado !== undefined);
      if (!isProcessed) {
        return {
          id: inv.id,
          nome: inv.nome,
          talhaoId: inv.talhaoId,
          stratumId: inv.stratumId,
          isProcessed: false,
          areaParcela: inv.areaParcela || 0,
          fatorExpansao: 0,
          volumeTotalParcela: 0,
          areaBasalTotalParcela: 0,
          numeroArvoresParcela: 0,
          volumePorHa: 0,
          areaBasalPorHa: 0,
          densidadePorHa: 0
        };
      }

      const areaParcela = inv.areaParcela || 0;
      const fatorExpansao = areaParcela > 0 ? (10000 / areaParcela) : 0;
      
      const volumeTotalParcela = inv.dados.reduce((acc, curr) => acc + (curr.volumeCalculado || 0), 0);
      
      let areaBasalTotalParcela = 0;
      inv.dados.forEach(tree => {
        if (tree.multipleStems && tree.stems) {
          tree.stems.forEach(stem => {
            areaBasalTotalParcela += calculateBasalArea(stem.cap || 0);
          });
        } else {
          if (tree.cap !== undefined && tree.cap !== null) {
            areaBasalTotalParcela += calculateBasalArea(parseFloat(tree.cap));
          } else if (tree.dap !== undefined && tree.dap !== null) {
            areaBasalTotalParcela += calculateBasalArea(parseFloat(tree.dap), true);
          }
        }
      });

      const numeroArvoresParcela = inv.dados.length;

      const volumePorHa = volumeTotalParcela * fatorExpansao;
      const areaBasalPorHa = areaBasalTotalParcela * fatorExpansao;
      const densidadePorHa = numeroArvoresParcela * fatorExpansao;

      return {
        id: inv.id,
        nome: inv.nome,
        talhaoId: inv.talhaoId,
        stratumId: inv.stratumId,
        isProcessed: true,
        areaParcela,
        fatorExpansao,
        volumeTotalParcela,
        areaBasalTotalParcela,
        numeroArvoresParcela,
        volumePorHa,
        areaBasalPorHa,
        densidadePorHa,
        dados: inv.dados
      };
    });

    const onlyProcessed = processedParcels.filter(p => p.isProcessed);

    // 2. Agrupamento por Talhão
    const talhoesResults = activeTalhoes.map(t => {
      const tParcels = onlyProcessed.filter(p => p.talhaoId === t.id);
      const numParcelas = tParcels.length;
      const areaAmostradaTotal = tParcels.reduce((acc, curr) => acc + curr.areaParcela, 0);
      const areaTalhaoHa = t.area || 0;

      let volumeMedioPorHa = 0;
      let areaBasalMedioPorHa = 0;
      let densidadeMedioPorHa = 0;
      let dapMedio = 0;
      let alturaMedio = 0;

      if (numParcelas > 0) {
        volumeMedioPorHa = tParcels.reduce((acc, curr) => acc + curr.volumePorHa, 0) / numParcelas;
        areaBasalMedioPorHa = tParcels.reduce((acc, curr) => acc + curr.areaBasalPorHa, 0) / numParcelas;
        densidadeMedioPorHa = tParcels.reduce((acc, curr) => acc + curr.densidadePorHa, 0) / numParcelas;

        let sumDap = 0;
        let sumHt = 0;
        let treeCount = 0;

        tParcels.forEach(p => {
          p.dados?.forEach(tree => {
            let treeDap = 0;
            if (tree.multipleStems && tree.stems) {
              let sumG = 0;
              tree.stems.forEach(stem => {
                sumG += calculateBasalArea(stem.cap || 0);
              });
              treeDap = Math.sqrt(4 * sumG / Math.PI) * 100;
            } else {
              if (tree.dap !== undefined && tree.dap !== null && tree.dap !== '') {
                treeDap = parseFloat(tree.dap);
              } else if (tree.cap !== undefined && tree.cap !== null && tree.cap !== '') {
                treeDap = parseFloat(tree.cap) / Math.PI;
              }
            }
            const ht = tree.alturaUtilizada !== undefined ? tree.alturaUtilizada : parseFloat((tree.ht || '0').toString());
            
            if (treeDap > 0) {
              sumDap += treeDap;
              sumHt += ht;
              treeCount++;
            }
          });
        });

        if (treeCount > 0) {
          dapMedio = sumDap / treeCount;
          alturaMedio = sumHt / treeCount;
        }
      }

      const volumeTotalTalhao = volumeMedioPorHa * areaTalhaoHa;

      return {
        id: t.id,
        nome: t.nome,
        numParcelas,
        areaAmostradaTotal,
        areaTalhaoHa,
        volumeMedioPorHa,
        areaBasalMedioPorHa,
        densidadeMedioPorHa,
        dapMedio,
        alturaMedio,
        volumeTotalTalhao
      };
    });

    // 3. Agrupamento por Estrato
    const strataResults = activeStrata.map(s => {
      const sParcels = onlyProcessed.filter(p => p.stratumId === s.id);
      const numParcelas = sParcels.length;
      const areaAmostradaTotal = sParcels.reduce((acc, curr) => acc + curr.areaParcela, 0);
      const areaEstratoHa = s.area || 0;

      let volumeMedioPorHa = 0;
      let areaBasalMedioPorHa = 0;
      let densidadeMedioPorHa = 0;

      if (numParcelas > 0) {
        volumeMedioPorHa = sParcels.reduce((acc, curr) => acc + curr.volumePorHa, 0) / numParcelas;
        areaBasalMedioPorHa = sParcels.reduce((acc, curr) => acc + curr.areaBasalPorHa, 0) / numParcelas;
        densidadeMedioPorHa = sParcels.reduce((acc, curr) => acc + curr.densidadePorHa, 0) / numParcelas;
      }

      const volumeTotalEstrato = volumeMedioPorHa * areaEstratoHa;

      return {
        id: s.id,
        nome: s.nome,
        numParcelas,
        areaAmostradaTotal,
        areaEstratoHa,
        volumeMedioPorHa,
        areaBasalMedioPorHa,
        densidadeMedioPorHa,
        volumeTotalEstrato
      };
    });

    // 4. Agrupamento do Trabalho Total
    const numTotalParcelas = onlyProcessed.length;
    const areaTotalAmostrada = onlyProcessed.reduce((acc, curr) => acc + curr.areaParcela, 0);
    const numTotalArvoresMedidas = onlyProcessed.reduce((acc, curr) => acc + curr.numeroArvoresParcela, 0);

    const areaTotalInventariada = activeStrata.length > 0
      ? activeStrata.reduce((acc, curr) => acc + (curr.area || 0), 0)
      : activeTalhoes.reduce((acc, curr) => acc + (curr.area || 0), 0);

    let volumeMedioGeralPorHa = 0;
    let areaBasalMediaPorHa = 0;
    let densidadeMediaPorHa = 0;

    if (numTotalParcelas > 0) {
      volumeMedioGeralPorHa = onlyProcessed.reduce((acc, curr) => acc + curr.volumePorHa, 0) / numTotalParcelas;
      areaBasalMediaPorHa = onlyProcessed.reduce((acc, curr) => acc + curr.areaBasalPorHa, 0) / numTotalParcelas;
      densidadeMediaPorHa = onlyProcessed.reduce((acc, curr) => acc + curr.densidadePorHa, 0) / numTotalParcelas;
    }

    let volumeTotalEstimado = 0;
    if (activeStrata.length > 0) {
      volumeTotalEstimado = strataResults.reduce((acc, curr) => acc + curr.volumeTotalEstrato, 0);
    } else if (activeTalhoes.length > 0) {
      volumeTotalEstimado = talhoesResults.reduce((acc, curr) => acc + curr.volumeTotalTalhao, 0);
    } else {
      volumeTotalEstimado = volumeMedioGeralPorHa * areaTotalInventariada;
    }

    return {
      processedParcels,
      talhoesResults,
      strataResults,
      trabalho: {
        areaTotalInventariada,
        areaTotalAmostrada,
        numTotalParcelas,
        numTotalArvoresMedidas,
        volumeMedioGeralPorHa,
        volumeTotalEstimado,
        areaBasalMediaPorHa,
        densidadeMediaPorHa
      }
    };
  }, [activeFw, activeParcels, activeTalhoes, activeStrata, inventories, strata, talhoes]);

  const activeProcessings = useMemo(() => {
    return processings.filter(p => p.fieldWorkId === activeFwId);
  }, [processings, activeFwId]);

  const handleCreateInventoryProcessing = async (nomeProc: string, consMode: 'talhao' | 'stratum' | 'auto') => {
    if (!nomeProc.trim()) {
      alert("Por favor, informe o nome do processamento.");
      return;
    }

    const k = parseFloat(newProcessFatorCasca);
    if (isNaN(k) || k < 0.5 || k > 1.0) {
      alert("Por favor, informe um Fator de Casca válido entre 0.5 e 1.0.");
      return;
    }

    const hm = selectedHeightModelId !== 'none' ? heightModels.find(m => m.id === selectedHeightModelId) : null;
    let vm: any = null;
    let isLegacyVolume = false;
    let legacyFf = 0.7;

    if (selectedVolumeModelId === 'legacy') {
      isLegacyVolume = true;
      legacyFf = parseFloat(processingFatorForma);
      if (isNaN(legacyFf) || legacyFf <= 0) {
        alert('Fator de forma comercial inválido.');
        return;
      }
    } else {
      vm = volumeModels.find(m => m.id === selectedVolumeModelId);
      if (!vm) {
        alert('Modelo volumétrico não encontrado.');
        return;
      }
    }

    // Helpers para obter string de fórmula legível
    const getHtFormula = (m: any) => {
      if (!m) return 'Medida Direta';
      const c = m.coeficientes;
      switch (m.tipoModelo) {
        case 'linear': return `H = ${c.beta0} + ${c.beta1} * DAP`;
        case 'logaritmico': return `H = ${c.beta0} + ${c.beta1} * ln(DAP)`;
        case 'henriksen': return `H = ${c.beta0} + ${c.beta1} * ln(DAP)`;
        case 'curtis': return `H = exp(${c.beta0} + ${c.beta1} / DAP)`;
        case 'trorey': return `H = ${c.beta0} + ${c.beta1} * DAP + ${c.beta2 || 0} * DAP²`;
        case 'personalizado': return c.expressaoCustom || 'Personalizado';
        default: return 'Fórmula padrão';
      }
    };

    const getVolFormula = (m: any, ff?: number) => {
      if (!m) {
        return `V = ((pi * DAP²) / 40000) * H * ${ff || 0.7}`;
      }
      const c = m.coeficientes;
      switch (m.tipoModelo) {
        case 'fator_forma': return `V = ((pi * DAP²) / 40000) * H * ${c.beta0}`;
        case 'schumacher_hall': return `V = ${c.beta0} * DAP^(${c.beta1 || 0}) * H^(${c.beta2 || 0})`;
        case 'spurr': return `V = ${c.beta0} + ${c.beta1 || 0} * DAP² * H`;
        case 'stoate': return `V = ${c.beta0} + ${c.beta1 || 0} * DAP² + ${c.beta2 || 0} * DAP² * H + ${c.beta3 || 0} * H`;
        case 'husch': return `V = ${c.beta0} * DAP^(${c.beta1 || 0})`;
        case 'personalizado': return c.expressaoCustom || 'Personalizado';
        default: return 'Fórmula padrão';
      }
    };

    // Snapshots dos modelos
    const heightModelSnapshot: ModelSnapshot | null = hm ? {
      id: hm.id,
      nome: hm.nome,
      especie: hm.especie,
      regiao: hm.regiao,
      tipoModelo: hm.tipoModelo,
      coeficientes: hm.coeficientes,
      fonteBibliografica: hm.fonteBibliografica || 'Não informada',
      observacoes: hm.observacoes || '',
      unidadeDap: 'cm',
      unidadeAltura: 'm',
      unidadeVolume: 'm³',
      formula: getHtFormula(hm)
    } : null;

    const volumeModelSnapshot: ModelSnapshot | null = !isLegacyVolume && vm ? {
      id: vm.id,
      nome: vm.nome,
      especie: vm.especie,
      regiao: vm.regiao,
      tipoModelo: vm.tipoModelo,
      coeficientes: vm.coeficientes,
      fonteBibliografica: vm.fonteBibliografica || 'Não informada',
      observacoes: vm.observacoes || '',
      unidadeDap: 'cm',
      unidadeAltura: 'm',
      unidadeVolume: 'm³',
      formula: getVolFormula(vm)
    } : {
      id: 'legacy',
      nome: `Fator de Forma (${legacyFf})`,
      especie: 'Geral',
      regiao: 'Geral',
      tipoModelo: 'fator_forma',
      coeficientes: { beta0: legacyFf },
      fonteBibliografica: 'Literatura convencional',
      observacoes: 'Fator de forma fixo comercial.',
      unidadeDap: 'cm',
      unidadeAltura: 'm',
      unidadeVolume: 'm³',
      formula: getVolFormula(null, legacyFf)
    };

    // Arrays de auditoria
    const warnings: string[] = [];
    const parcelasIgnoradas: string[] = [];
    let arvoresIgnoradas = 0;
    let arvoresSemDAP = 0;
    let arvoresSemAltura = 0;
    let arvoresSemVolume = 0;

    const parcelasSnapshots: ParcelaSnapshot[] = [];

    // Processar todas as parcelas ativas
    activeParcels.forEach(parcel => {
      const area = parcel.areaParcela || 0;
      if (area <= 0) {
        parcelasIgnoradas.push(parcel.nome);
        warnings.push(`Parcela "${parcel.nome}": Ignorada porque a área é zero ou negativa.`);
        return;
      }
      if (!parcel.dados || parcel.dados.length === 0) {
        parcelasIgnoradas.push(parcel.nome);
        warnings.push(`Parcela "${parcel.nome}": Ignorada porque não contém indivíduos cadastrados.`);
        return;
      }

      let validTreesCount = 0;
      let parcelVolumeTotal = 0;
      let parcelVolumeTotalSemCasca = 0;
      let parcelBasalAreaTotal = 0;

      parcel.dados.forEach(ind => {
        const treeDap = getDapOfTreeOrStem(ind);
        if (treeDap <= 0) {
          arvoresSemDAP++;
          arvoresIgnoradas++;
          warnings.push(`Parcela "${parcel.nome}": Indivíduo nº ${ind.numeroIndividuo} ignorado por não possuir diâmetro (CAP/DAP) válido.`);
          return;
        }

        validTreesCount++;
        let treeVol = 0;
        let treeVolSemCasca = 0;

        if (ind.multipleStems && ind.stems && ind.stems.length > 0) {
          let stemsVol = 0;
          let stemsVolSemCasca = 0;
          let maxStemHt = 0;
          let maxStemHtSemCasca = 0;

          ind.stems.forEach((stem: any) => {
            const stemDap = getDapOfTreeOrStem(stem);
            if (stemDap <= 0) return; // ignora fuste sem dap
            const stemDapSemCasca = stemDap * k;

            let stemHt = parseFloat(stem.altura || '0');
            if (isNaN(stemHt) || stemHt <= 0) {
              const globalHt = parseFloat(ind.ht || '0');
              if (!isNaN(globalHt) && globalHt > 0) {
                stemHt = globalHt;
              }
            }

            let stemHtSemCasca = stemHt;

            if ((isNaN(stemHt) || stemHt <= 0) && hm) {
              stemHt = evaluateHeightModel(hm, stemDap);
              stemHt = cleanResult(stemHt);
              arvoresSemAltura++;
            } else if (isNaN(stemHt) || stemHt <= 0) {
              stemHt = 0;
              arvoresSemAltura++;
            }

            if ((isNaN(stemHtSemCasca) || stemHtSemCasca <= 0) && hm) {
              stemHtSemCasca = evaluateHeightModel(hm, stemDapSemCasca);
              stemHtSemCasca = cleanResult(stemHtSemCasca);
            } else if (isNaN(stemHtSemCasca) || stemHtSemCasca <= 0) {
              stemHtSemCasca = 0;
            }

            if (stemHt > maxStemHt) {
              maxStemHt = stemHt;
            }
            if (stemHtSemCasca > maxStemHtSemCasca) {
              maxStemHtSemCasca = stemHtSemCasca;
            }

            // Volume do fuste com casca
            let stemVol = 0;
            if (isLegacyVolume) {
              const g = (Math.PI * Math.pow(stemDap / 100, 2)) / 4;
              stemVol = g * stemHt * legacyFf;
            } else if (vm) {
              stemVol = evaluateVolumeModel(vm, stemDap, stemHt);
            }
            stemVol = cleanResult(stemVol);

            // Volume do fuste sem casca
            let stemVolSemCasca = 0;
            if (isLegacyVolume) {
              const gSemCasca = (Math.PI * Math.pow(stemDapSemCasca / 100, 2)) / 4;
              stemVolSemCasca = gSemCasca * stemHtSemCasca * legacyFf;
            } else if (vm) {
              stemVolSemCasca = evaluateVolumeModel(vm, stemDapSemCasca, stemHtSemCasca);
            }
            stemVolSemCasca = cleanResult(stemVolSemCasca);

            if (stemVol <= 0) arvoresSemVolume++;
            stemsVol += stemVol;
            stemsVolSemCasca += stemVolSemCasca;
          });

          treeVol = stemsVol;
          treeVolSemCasca = stemsVolSemCasca;
        } else {
          // Tronco único
          let treeHt = parseFloat(ind.ht || '0');
          let treeHtSemCasca = treeHt;

          if (isNaN(treeHt) || treeHt <= 0) {
            if (hm) {
              treeHt = evaluateHeightModel(hm, treeDap);
              treeHt = cleanResult(treeHt);
              arvoresSemAltura++;
            } else {
              treeHt = 0;
              arvoresSemAltura++;
            }
          }

          if (isNaN(treeHtSemCasca) || treeHtSemCasca <= 0) {
            if (hm) {
              treeHtSemCasca = evaluateHeightModel(hm, treeDap * k);
              treeHtSemCasca = cleanResult(treeHtSemCasca);
            } else {
              treeHtSemCasca = 0;
            }
          }

          if (isLegacyVolume) {
            const g = (Math.PI * Math.pow(treeDap / 100, 2)) / 4;
            treeVol = g * treeHt * legacyFf;
          } else if (vm) {
            treeVol = evaluateVolumeModel(vm, treeDap, treeHt);
          }
          treeVol = cleanResult(treeVol);

          if (isLegacyVolume) {
            const gSemCasca = (Math.PI * Math.pow((treeDap * k) / 100, 2)) / 4;
            treeVolSemCasca = gSemCasca * treeHtSemCasca * legacyFf;
          } else if (vm) {
            treeVolSemCasca = evaluateVolumeModel(vm, treeDap * k, treeHtSemCasca);
          }
          treeVolSemCasca = cleanResult(treeVolSemCasca);

          if (treeVol <= 0) arvoresSemVolume++;
        }

        // Basal Area
        let basalArea = 0;
        if (ind.multipleStems && ind.stems) {
          ind.stems.forEach(stem => {
            basalArea += calculateBasalArea(stem.cap || 0);
          });
        } else {
          basalArea = calculateBasalArea(ind.cap ? parseFloat(ind.cap) : treeDap * Math.PI);
        }

        parcelVolumeTotal += treeVol;
        parcelVolumeTotalSemCasca += treeVolSemCasca;
        parcelBasalAreaTotal += basalArea;
      });

      if (validTreesCount === 0) {
        parcelasIgnoradas.push(parcel.nome);
        warnings.push(`Parcela "${parcel.nome}": Ignorada porque todos os indivíduos nela cadastrados foram desconsiderados por inconsistência.`);
        return;
      }

      const fatorExpansao = 10000 / area;
      parcelasSnapshots.push({
        parcelaId: parcel.id,
        nome: parcel.nome,
        talhaoId: parcel.talhaoId,
        stratumId: parcel.stratumId,
        areaParcela: area,
        fatorExpansao,
        volumeTotal: Number(parcelVolumeTotal.toFixed(4)),
        volumeTotalSemCasca: Number(parcelVolumeTotalSemCasca.toFixed(4)),
        volumePorHa: Number((parcelVolumeTotal * fatorExpansao).toFixed(2)),
        volumePorHaSemCasca: Number((parcelVolumeTotalSemCasca * fatorExpansao).toFixed(2)),
        areaBasalPorHa: Number((parcelBasalAreaTotal * fatorExpansao).toFixed(3)),
        densidadePorHa: Number((validTreesCount * fatorExpansao).toFixed(1)),
        numeroArvores: validTreesCount
      });
    });

    if (parcelasSnapshots.length === 0) {
      alert("Erro no processamento: Nenhuma parcela válida pôde ser calculada. Verifique os dados.");
      return;
    }

    // Consolidação por Talhão
    const talhoesSnapshots: TalhaoConsolidation[] = activeTalhoes.map(t => {
      const tParcels = parcelasSnapshots.filter(p => p.talhaoId === t.id);
      const numParcelas = tParcels.length;
      const areaTalhao = t.area || 0;

      let volumeMedioHa = 0;
      let volumeMedioHaSemCasca = 0;
      let areaBasalMediaHa = 0;
      let densidadeMediaHa = 0;
      let dapMedio = 0;
      let alturaMedia = 0;
      let arvoresUtilizadas = 0;

      if (numParcelas > 0) {
        volumeMedioHa = tParcels.reduce((acc, curr) => acc + curr.volumePorHa, 0) / numParcelas;
        volumeMedioHaSemCasca = tParcels.reduce((acc, curr) => acc + (curr.volumePorHaSemCasca || 0), 0) / numParcelas;
        areaBasalMediaHa = tParcels.reduce((acc, curr) => acc + curr.areaBasalPorHa, 0) / numParcelas;
        densidadeMediaHa = tParcels.reduce((acc, curr) => acc + curr.densidadePorHa, 0) / numParcelas;
        arvoresUtilizadas = tParcels.reduce((acc, curr) => acc + curr.numeroArvores, 0);

        let sumDap = 0;
        let sumHt = 0;
        let count = 0;

        tParcels.forEach(pSnap => {
          const originalParcel = activeParcels.find(ap => ap.id === pSnap.parcelaId);
          originalParcel?.dados?.forEach(tree => {
            const treeDap = getDapOfTreeOrStem(tree);
            if (treeDap > 0) {
              let treeHt = parseFloat(tree.ht || '0');
              if (tree.multipleStems && tree.stems) {
                let maxHt = 0;
                tree.stems.forEach(stem => {
                  const sDap = getDapOfTreeOrStem(stem);
                  if (sDap <= 0) return;
                  let sHt = stem.altura || 0;
                  if ((isNaN(sHt) || sHt <= 0) && hm) sHt = cleanResult(evaluateHeightModel(hm, sDap));
                  if (sHt > maxHt) maxHt = sHt;
                });
                treeHt = maxHt;
              } else {
                if ((isNaN(treeHt) || treeHt <= 0) && hm) treeHt = cleanResult(evaluateHeightModel(hm, treeDap));
              }

              sumDap += treeDap;
              sumHt += treeHt;
              count++;
            }
          });
        });

        if (count > 0) {
          dapMedio = sumDap / count;
          alturaMedia = sumHt / count;
        }
      }

      return {
        talhaoId: t.id,
        nome: t.nome,
        areaTalhao,
        parcelasUtilizadas: numParcelas,
        arvoresUtilizadas,
        volumeMedioHa: Number(volumeMedioHa.toFixed(2)),
        volumeMedioHaSemCasca: Number(volumeMedioHaSemCasca.toFixed(2)),
        volumeTotalEstimado: Number((volumeMedioHa * areaTalhao).toFixed(2)),
        volumeTotalEstimadoSemCasca: Number((volumeMedioHaSemCasca * areaTalhao).toFixed(2)),
        areaBasalMediaHa: Number(areaBasalMediaHa.toFixed(3)),
        densidadeMediaHa: Number(densidadeMediaHa.toFixed(1)),
        dapMedio: Number(dapMedio.toFixed(2)),
        alturaMedia: Number(alturaMedia.toFixed(2))
      };
    });

    // Consolidação por Estrato
    const strataSnapshots: StratumConsolidation[] = activeStrata.map(s => {
      const sParcels = parcelasSnapshots.filter(p => p.stratumId === s.id);
      const numParcelas = sParcels.length;
      const areaEstrato = s.area || 0;

      let volumeMedioHa = 0;
      let volumeMedioHaSemCasca = 0;
      let areaBasalMediaHa = 0;
      let densidadeMediaHa = 0;
      let dapMedio = 0;
      let alturaMedia = 0;
      let arvoresUtilizadas = 0;

      if (numParcelas > 0) {
        volumeMedioHa = sParcels.reduce((acc, curr) => acc + curr.volumePorHa, 0) / numParcelas;
        volumeMedioHaSemCasca = sParcels.reduce((acc, curr) => acc + (curr.volumePorHaSemCasca || 0), 0) / numParcelas;
        areaBasalMediaHa = sParcels.reduce((acc, curr) => acc + curr.areaBasalPorHa, 0) / numParcelas;
        densidadeMediaHa = sParcels.reduce((acc, curr) => acc + curr.densidadePorHa, 0) / numParcelas;
        arvoresUtilizadas = sParcels.reduce((acc, curr) => acc + curr.numeroArvores, 0);

        let sumDap = 0;
        let sumHt = 0;
        let count = 0;

        sParcels.forEach(pSnap => {
          const originalParcel = activeParcels.find(ap => ap.id === pSnap.parcelaId);
          originalParcel?.dados?.forEach(tree => {
            const treeDap = getDapOfTreeOrStem(tree);
            if (treeDap > 0) {
              let treeHt = parseFloat(tree.ht || '0');
              if (tree.multipleStems && tree.stems) {
                let maxHt = 0;
                tree.stems.forEach(stem => {
                  const sDap = getDapOfTreeOrStem(stem);
                  if (sDap <= 0) return;
                  let sHt = stem.altura || 0;
                  if ((isNaN(sHt) || sHt <= 0) && hm) sHt = cleanResult(evaluateHeightModel(hm, sDap));
                  if (sHt > maxHt) maxHt = sHt;
                });
                treeHt = maxHt;
              } else {
                if ((isNaN(treeHt) || treeHt <= 0) && hm) treeHt = cleanResult(evaluateHeightModel(hm, treeDap));
              }

              sumDap += treeDap;
              sumHt += treeHt;
              count++;
            }
          });
        });

        if (count > 0) {
          dapMedio = sumDap / count;
          alturaMedia = sumHt / count;
        }
      }

      return {
        stratumId: s.id,
        nome: s.nome,
        areaEstrato,
        parcelasUtilizadas: numParcelas,
        arvoresUtilizadas,
        volumeMedioHa: Number(volumeMedioHa.toFixed(2)),
        volumeMedioHaSemCasca: Number(volumeMedioHaSemCasca.toFixed(2)),
        volumeTotalEstimado: Number((volumeMedioHa * areaEstrato).toFixed(2)),
        volumeTotalEstimadoSemCasca: Number((volumeMedioHaSemCasca * areaEstrato).toFixed(2)),
        areaBasalMediaHa: Number(areaBasalMediaHa.toFixed(3)),
        densidadeMediaHa: Number(densidadeMediaHa.toFixed(1)),
        dapMedio: Number(dapMedio.toFixed(2)),
        alturaMedia: Number(alturaMedia.toFixed(2))
      };
    });

    // Consolidação Geral do Trabalho
    const totalParcelsCount = parcelasSnapshots.length;
    const totalSampledArea = parcelasSnapshots.reduce((acc, curr) => acc + curr.areaParcela, 0);
    const totalTreesCount = parcelasSnapshots.reduce((acc, curr) => acc + curr.numeroArvores, 0);

    const avgVolHa = totalParcelsCount > 0 ? parcelasSnapshots.reduce((acc, curr) => acc + curr.volumePorHa, 0) / totalParcelsCount : 0;
    const avgVolHaSemCasca = totalParcelsCount > 0 ? parcelasSnapshots.reduce((acc, curr) => acc + (curr.volumePorHaSemCasca || 0), 0) / totalParcelsCount : 0;
    const avgBasalHa = totalParcelsCount > 0 ? parcelasSnapshots.reduce((acc, curr) => acc + curr.areaBasalPorHa, 0) / totalParcelsCount : 0;
    const avgDensityHa = totalParcelsCount > 0 ? parcelasSnapshots.reduce((acc, curr) => acc + curr.densidadePorHa, 0) / totalParcelsCount : 0;

    let overallDap = 0;
    let overallHt = 0;
    let overallTreesCount = 0;

    parcelasSnapshots.forEach(pSnap => {
      const originalParcel = activeParcels.find(ap => ap.id === pSnap.parcelaId);
      originalParcel?.dados?.forEach(tree => {
        const treeDap = getDapOfTreeOrStem(tree);
        if (treeDap > 0) {
          let treeHt = parseFloat(tree.ht || '0');
          if (tree.multipleStems && tree.stems) {
            let maxHt = 0;
            tree.stems.forEach(stem => {
              const sDap = getDapOfTreeOrStem(stem);
              if (sDap <= 0) return;
              let sHt = stem.altura || 0;
              if ((isNaN(sHt) || sHt <= 0) && hm) sHt = cleanResult(evaluateHeightModel(hm, sDap));
              if (sHt > maxHt) maxHt = sHt;
            });
            treeHt = maxHt;
          } else {
            if ((isNaN(treeHt) || treeHt <= 0) && hm) treeHt = cleanResult(evaluateHeightModel(hm, treeDap));
          }

          overallDap += treeDap;
          overallHt += treeHt;
          overallTreesCount++;
        }
      });
    });

    const dapMedioGeral = overallTreesCount > 0 ? overallDap / overallTreesCount : 0;
    const alturaMediaGeral = overallTreesCount > 0 ? overallHt / overallTreesCount : 0;

    // Determinar modo de amostragem efetivo
    let effectiveConsMode: 'talhao' | 'stratum';
    if (consMode === 'auto') {
      const hasStrataWithArea = activeStrata.some(s => (s.area || 0) > 0) && strataSnapshots.some(s => s.parcelasUtilizadas > 0);
      effectiveConsMode = hasStrataWithArea ? 'stratum' : 'talhao';
    } else {
      effectiveConsMode = consMode;
    }

    let areaTotal = 0;
    let volumeTotalEstimado = 0;
    let volumeTotalEstimadoSemCasca = 0;

    if (effectiveConsMode === 'stratum' && strataSnapshots.length > 0) {
      areaTotal = strataSnapshots.reduce((acc, curr) => acc + curr.areaEstrato, 0);
      volumeTotalEstimado = strataSnapshots.reduce((acc, curr) => acc + curr.volumeTotalEstimado, 0);
      volumeTotalEstimadoSemCasca = strataSnapshots.reduce((acc, curr) => acc + (curr.volumeTotalEstimadoSemCasca || 0), 0);
    } else if (effectiveConsMode === 'talhao' && talhoesSnapshots.length > 0) {
      areaTotal = talhoesSnapshots.reduce((acc, curr) => acc + curr.areaTalhao, 0);
      volumeTotalEstimado = talhoesSnapshots.reduce((acc, curr) => acc + curr.volumeTotalEstimado, 0);
      volumeTotalEstimadoSemCasca = talhoesSnapshots.reduce((acc, curr) => acc + (curr.volumeTotalEstimadoSemCasca || 0), 0);
    } else {
      const totalAreaConfig = activeTalhoes.reduce((acc, curr) => acc + (curr.area || 0), 0);
      areaTotal = totalAreaConfig > 0 ? totalAreaConfig : (totalSampledArea / 10000);
      volumeTotalEstimado = avgVolHa * areaTotal;
      volumeTotalEstimadoSemCasca = avgVolHaSemCasca * areaTotal;
    }

    const trabalhoConsolidation: TrabalhoConsolidation = {
      areaTotal: Number(areaTotal.toFixed(2)),
      areaAmostrada: Number((totalSampledArea / 10000).toFixed(4)),
      numeroTalhoes: activeTalhoes.length,
      numeroEstratos: activeStrata.length,
      numeroParcelas: totalParcelsCount,
      numeroArvores: totalTreesCount,
      volumeMedioHa: Number(avgVolHa.toFixed(2)),
      volumeMedioHaSemCasca: Number(avgVolHaSemCasca.toFixed(2)),
      volumeTotalEstimado: Number(volumeTotalEstimado.toFixed(2)),
      volumeTotalEstimadoSemCasca: Number(volumeTotalEstimadoSemCasca.toFixed(2)),
      areaBasalMediaHa: Number(avgBasalHa.toFixed(3)),
      densidadeMedia: Number(avgDensityHa.toFixed(1)),
      dapMedio: Number(dapMedioGeral.toFixed(2)),
      alturaMedia: Number(alturaMediaGeral.toFixed(2))
    };

    const newProcessing: InventoryProcessing = {
      id: `proc_${Date.now()}`,
      fieldWorkId: activeFwId,
      nomeProcessamento: nomeProc,
      dataProcessamento: new Date().toLocaleDateString('pt-BR'),
      heightModelSnapshot,
      volumeModelSnapshot,
      consolidationMode: consMode,
      effectiveConsolidationMode: effectiveConsMode,
      numeroParcelas: totalParcelsCount,
      areaAmostrada: totalSampledArea,
      volumeTotalEstimado: trabalhoConsolidation.volumeTotalEstimado,
      volumeTotalEstimadoSemCasca: trabalhoConsolidation.volumeTotalEstimadoSemCasca,
      volumeMedioHa: trabalhoConsolidation.volumeMedioHa,
      volumeMedioHaSemCasca: trabalhoConsolidation.volumeMedioHaSemCasca,
      fatorCasca: k,
      areaBasalMediaHa: trabalhoConsolidation.areaBasalMediaHa,
      dapMedio: trabalhoConsolidation.dapMedio,
      alturaMedia: trabalhoConsolidation.alturaMedia,
      warnings,
      parcelasIgnoradas,
      arvoresIgnoradas,
      arvoresSemDAP,
      arvoresSemAltura,
      arvoresSemVolume,
      status: 'Oficial',
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.displayName || currentUser?.email || 'Usuário',
      parcelas: parcelasSnapshots,
      talhoes: talhoesSnapshots,
      strata: strataSnapshots,
      trabalho: trabalhoConsolidation
    };

    try {
      await saveProcessing(newProcessing);
      alert("Processamento e consolidação executados com sucesso!");
    } catch (e: any) {
      console.error(e);
      alert("Erro ao gravar snapshot de processamento: " + e.message);
    }
  };

  const handleDuplicarConfiguracao = (proc: InventoryProcessing) => {
    if (proc.heightModelSnapshot) {
      setSelectedHeightModelId(proc.heightModelSnapshot.id);
    } else {
      setSelectedHeightModelId('none');
    }
    
    if (proc.volumeModelSnapshot) {
      if (proc.volumeModelSnapshot.id === 'legacy') {
        setSelectedVolumeModelId('legacy');
        setProcessingFatorForma(proc.volumeModelSnapshot.coeficientes.beta0.toString());
      } else {
        setSelectedVolumeModelId(proc.volumeModelSnapshot.id);
      }
    } else {
      setSelectedVolumeModelId('legacy');
      setProcessingFatorForma('0.7');
    }

    setNewProcessConsolidationMode(proc.consolidationMode);
    setNewProcessFatorCasca(proc.fatorCasca !== undefined ? proc.fatorCasca.toString() : '0.90');
    setNewProcessName(`${proc.nomeProcessamento} (Nova Execução)`);
    setShowNewProcessModal(true);
  };

  const handleExportAdvancedXLSX = (proc: InventoryProcessing) => {
    const wb = XLSX.utils.book_new();

    const resumoData = [
      { Métrica: "Nome do Trabalho", Valor: activeFw?.nome || "" },
      { Métrica: "Nome do Processamento", Valor: proc.nomeProcessamento },
      { Métrica: "Data do Processamento", Valor: proc.dataProcessamento },
      { Métrica: "Responsável", Valor: proc.createdBy },
      { Métrica: "Configuração de Consolidação", Valor: proc.consolidationMode === "stratum" ? "Estrato" : proc.consolidationMode === "talhao" ? "Talhão" : "Automático" },
      { Métrica: "Modo de Consolidação Efetivo", Valor: proc.effectiveConsolidationMode === "stratum" ? "Estrato" : "Talhão" },
      { Métrica: "Fator de Casca (k)", Valor: proc.fatorCasca !== undefined ? proc.fatorCasca : 1.0 },
      { Métrica: "Área Total Inventariada (ha)", Valor: proc.trabalho.areaTotal },
      { Métrica: "Área Total Amostrada (ha)", Valor: proc.trabalho.areaAmostrada },
      { Métrica: "Volume Total CC Estimado (m³)", Valor: proc.trabalho.volumeTotalEstimado },
      { Métrica: "Volume Total SC Estimado (m³)", Valor: proc.trabalho.volumeTotalEstimadoSemCasca || 0 },
      { Métrica: "Volume Médio CC Geral (m³/ha)", Valor: proc.trabalho.volumeMedioHa },
      { Métrica: "Volume Médio SC Geral (m³/ha)", Valor: proc.trabalho.volumeMedioHaSemCasca || 0 },
      { Métrica: "Área Basal Média Geral (m²/ha)", Valor: proc.trabalho.areaBasalMediaHa },
      { Métrica: "Densidade Média Geral (árv/ha)", Valor: proc.trabalho.densidadeMedia },
      { Métrica: "DAP Médio Geral (cm)", Valor: proc.trabalho.dapMedio },
      { Métrica: "Altura Média Geral (m)", Valor: proc.trabalho.alturaMedia },
      { Métrica: "Nº de Talhões", Valor: proc.trabalho.numeroTalhoes },
      { Métrica: "Nº de Estratos", Valor: proc.trabalho.numeroEstratos },
      { Métrica: "Nº de Parcelas", Valor: proc.trabalho.numeroParcelas },
      { Métrica: "Nº de Árvores", Valor: proc.trabalho.numeroArvores }
    ];
    const wsResumo = XLSX.utils.json_to_sheet(resumoData);

    const talhoesData = proc.talhoes.map(t => ({
      "Talhão": t.nome,
      "Área (ha)": t.areaTalhao,
      "Parcelas Utilizadas": t.parcelasUtilizadas,
      "Árvores Utilizadas": t.arvoresUtilizadas,
      "Volume Médio CC / ha (m³)": t.volumeMedioHa,
      "Volume Médio SC / ha (m³)": t.volumeMedioHaSemCasca || 0,
      "Volume Total CC Estimado (m³)": t.volumeTotalEstimado,
      "Volume Total SC Estimado (m³)": t.volumeTotalEstimadoSemCasca || 0,
      "Área Basal / ha (m²)": t.areaBasalMediaHa,
      "Densidade / ha (árv)": t.densidadeMediaHa,
      "DAP Médio (cm)": t.dapMedio,
      "Altura Média (m)": t.alturaMedia
    }));
    const wsTalhoes = XLSX.utils.json_to_sheet(talhoesData);

    const estratosData = proc.strata.map(s => ({
      "Estrato": s.nome,
      "Área (ha)": s.areaEstrato,
      "Parcelas Utilizadas": s.parcelasUtilizadas,
      "Árvores Utilizadas": s.arvoresUtilizadas,
      "Volume Médio CC / ha (m³)": s.volumeMedioHa,
      "Volume Médio SC / ha (m³)": s.volumeMedioHaSemCasca || 0,
      "Volume Total CC Estimado (m³)": s.volumeTotalEstimado,
      "Volume Total SC Estimado (m³)": s.volumeTotalEstimadoSemCasca || 0,
      "Área Basal / ha (m²)": s.areaBasalMediaHa,
      "Densidade / ha (árv)": s.densidadeMediaHa,
      "DAP Médio (cm)": s.dapMedio,
      "Altura Média (m)": s.alturaMedia
    }));
    const wsEstratos = XLSX.utils.json_to_sheet(estratosData);

    const parcelasData = proc.parcelas.map(p => ({
      "Parcela": p.nome,
      "Área (m²)": p.areaParcela,
      "Fator de Expansão": p.fatorExpansao,
      "Volume Total CC (m³)": p.volumeTotal,
      "Volume Total SC (m³)": p.volumeTotalSemCasca || 0,
      "Volume CC / ha (m³)": p.volumePorHa,
      "Volume SC / ha (m³)": p.volumePorHaSemCasca || 0,
      "Área Basal / ha (m²)": p.areaBasalPorHa,
      "Densidade / ha (árv)": p.densidadePorHa,
      "Número de Árvores": p.numeroArvores
    }));
    const wsParcelas = XLSX.utils.json_to_sheet(parcelasData);

    const modelosData = [];
    if (proc.heightModelSnapshot) {
      modelosData.push({
        Módulo: "Hipsometria (Altura)",
        Nome: proc.heightModelSnapshot.nome,
        Tipo: proc.heightModelSnapshot.tipoModelo,
        Equação: proc.heightModelSnapshot.formula,
        "Beta 0": proc.heightModelSnapshot.coeficientes.beta0,
        "Beta 1": proc.heightModelSnapshot.coeficientes.beta1 || 0,
        "Beta 2": proc.heightModelSnapshot.coeficientes.beta2 || 0,
        "Beta 3": proc.heightModelSnapshot.coeficientes.beta3 || 0,
        Unidades: `DAP: ${proc.heightModelSnapshot.unidadeDap} | Altura: ${proc.heightModelSnapshot.unidadeAltura}`,
        Bibliografia: proc.heightModelSnapshot.fonteBibliografica || "",
        Observações: proc.heightModelSnapshot.observacoes || ""
      });
    } else {
      modelosData.push({ Módulo: "Hipsometria (Altura)", Nome: "Altura Medida ou Estimada Geral", Tipo: "Nenhum", Equação: "-", "Beta 0": "-", "Beta 1": "-", "Beta 2": "-", "Beta 3": "-", Unidades: "-", Bibliografia: "-", Observações: "-" });
    }

    if (proc.volumeModelSnapshot) {
      modelosData.push({
        Módulo: "Volumetria (Volume)",
        Nome: proc.volumeModelSnapshot.nome,
        Tipo: proc.volumeModelSnapshot.tipoModelo,
        Equação: proc.volumeModelSnapshot.formula,
        "Beta 0": proc.volumeModelSnapshot.coeficientes.beta0,
        "Beta 1": proc.volumeModelSnapshot.coeficientes.beta1 || 0,
        "Beta 2": proc.volumeModelSnapshot.coeficientes.beta2 || 0,
        "Beta 3": proc.volumeModelSnapshot.coeficientes.beta3 || 0,
        Unidades: `DAP: ${proc.volumeModelSnapshot.unidadeDap} | Volume: ${proc.volumeModelSnapshot.unidadeVolume}`,
        Bibliografia: proc.volumeModelSnapshot.fonteBibliografica || "",
        Observações: proc.volumeModelSnapshot.observacoes || ""
      });
    }
    const wsModelos = XLSX.utils.json_to_sheet(modelosData);

    const metadadosData = [
      { Campo: "ID do Processamento", Valor: proc.id },
      { Campo: "Data/Hora Criação", Valor: proc.createdAt },
      { Campo: "Criado Por", Valor: proc.createdBy },
      { Campo: "Status", Valor: proc.status },
      { Campo: "Total Parcelas Ignoradas", Valor: proc.parcelasIgnoradas.length },
      { Campo: "Nomes Parcelas Ignoradas", Valor: proc.parcelasIgnoradas.join(", ") || "Nenhuma" },
      { Campo: "Total Árvores Ignoradas (Sem DAP)", Valor: proc.arvoresIgnoradas },
      { Campo: "Total Árvores Sem DAP", Valor: proc.arvoresSemDAP },
      { Campo: "Total Árvores Sem Altura", Valor: proc.arvoresSemAltura },
      { Campo: "Total Árvores Sem Volume", Valor: proc.arvoresSemVolume },
      { Campo: "Avisos de Inconsistência", Valor: proc.warnings.join(" | ") || "Nenhum aviso" }
    ];
    const wsMetadados = XLSX.utils.json_to_sheet(metadadosData);

    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Executivo");
    XLSX.utils.book_append_sheet(wb, wsTalhoes, "Talhões");
    XLSX.utils.book_append_sheet(wb, wsEstratos, "Estratos");
    XLSX.utils.book_append_sheet(wb, wsParcelas, "Parcelas");
    XLSX.utils.book_append_sheet(wb, wsModelos, "Modelos Utilizados");
    XLSX.utils.book_append_sheet(wb, wsMetadados, "Metadados e Auditoria");

    XLSX.writeFile(wb, `Consolidacao_${activeFw?.nome.replace(/\s+/g, '_')}_${proc.nomeProcessamento.replace(/\s+/g, '_')}.xlsx`);
  };

  const activeCubageSessions = useMemo(() => {
    return inventories.filter(i => i.fieldWorkId === activeFwId && i.template === 'cubagem');
  }, [inventories, activeFwId]);

  const allCubagedTrees = useMemo(() => {
    const treesList: any[] = [];
    activeCubageSessions.forEach(session => {
      if (session.dados && Array.isArray(session.dados)) {
        session.dados.forEach(tree => {
          treesList.push({
            ...tree,
            sessionName: session.nome,
            modoColeta: session.modoColeta || tree.modo || 'relativo',
            metodoCalculo: tree.metodoCalculo || session.metodoCalculo || 'smalian'
          });
        });
      }
    });

    if (cubageSortOrder === 'asc') {
      treesList.sort((a, b) => (a.volumeTotal || 0) - (b.volumeTotal || 0));
    } else if (cubageSortOrder === 'desc') {
      treesList.sort((a, b) => (b.volumeTotal || 0) - (a.volumeTotal || 0));
    }

    return treesList;
  }, [activeCubageSessions, cubageSortOrder]);

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

  const isFilterActive = dateFilter || talhaoFilter || stratumFilter || statusFilter;

  const filteredParcelsList = useMemo(() => {
    let list = activeParcels;
    if (selectedTalhaoId) {
      list = list.filter(p => p.talhaoId === selectedTalhaoId);
    }
    if (talhaoFilter) {
      if (talhaoFilter === 'sem-talhao') {
        list = list.filter(p => !p.talhaoId);
      } else {
        list = list.filter(p => p.talhaoId === talhaoFilter);
      }
    }
    if (dateFilter) {
      const formattedFilter = new Date(dateFilter + 'T12:00:00').toLocaleDateString('pt-BR');
      list = list.filter(p => p.dataInicio === formattedFilter || p.ultimaColeta === formattedFilter);
    }
    if (stratumFilter) {
      list = list.filter(p => p.stratumId === stratumFilter);
    }
    if (statusFilter) {
      list = list.filter(p => p.status === statusFilter);
    }
    return list;
  }, [activeParcels, selectedTalhaoId, talhaoFilter, dateFilter, stratumFilter, statusFilter]);

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
          let maxHtObj = ind.alturaUtilizada !== undefined ? ind.alturaUtilizada : (ind.ht ? parseFloat(ind.ht.toString()) : 0);
          let stemsProps: { cap: number, ht: number, volumeProcessado?: number }[] = [];
          
          if (ind.multipleStems && ind.stems) {
            ind.stems.forEach((st: any) => {
              stemsProps.push({
                cap: parseFloat((st.cap||'0').toString()),
                ht: st.alturaProcessada !== undefined ? st.alturaProcessada : parseFloat((st.altura||'0').toString()),
                volumeProcessado: st.volumeProcessado
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

  // Project-level Processed Excel Export (separate from raw data)
  const handleExportAllProcessed = () => {
    if (!activeFw) return;
    const allData: any[] = [];
    activeParcels.forEach(inv => {
      const currentTal = talhoes.find(t => t.id === inv.talhaoId);
      inv.dados.forEach(ind => {
        let baseData: any = {
          'Talhão': currentTal ? currentTal.nome : 'Sem Talhão',
          'Parcela': inv.nome,
          'Parcela Coordenadas': inv.coordenadas || '',
          'Número': ind.numeroIndividuo,
          'Data / Hora': ind.timestamp,
        };

        // Adicionar as colunas dinâmicas como referência de DAP/HC/HT
        inv.colunas.forEach(col => {
          baseData[col.nome] = ind[col.id] || '';
        });

        // DAP Equivalente
        baseData['DAP_Equivalente (cm)'] = ind.cap ? (parseFloat(ind.cap) / Math.PI).toFixed(2) : '0';

        // Área Basal
        const g = calculateBasalArea(parseFloat(ind.cap || 0));
        baseData['Area_Basal (m2)'] = g.toFixed(4);

        // Altura Utilizada
        if (ind.alturaUtilizada !== undefined) {
          baseData['Altura Utilizada (m)'] = ind.alturaUtilizada;
          baseData['Altura Medida/Estimada'] = ind.alturaMedidaOuEstimada === 'medida' ? 'Medida' : 'Estimada';
        } else {
          baseData['Altura Utilizada (m)'] = parseFloat((ind.ht || 0).toString());
          baseData['Altura Medida/Estimada'] = 'Medida';
        }

        // Volume Calculado
        if (ind.volumeCalculado !== undefined) {
          baseData['Volume Calculado (m3)'] = ind.volumeCalculado;
        } else {
          baseData['Volume Calculado (m3)'] = calculateVolume(g, parseFloat((ind.ht || 0).toString()), 0.7);
        }

        // Modelo Utilizado
        if (ind.modeloUtilizado) {
          baseData['Modelo Utilizado'] = ind.modeloUtilizado;
        } else {
          baseData['Modelo Utilizado'] = 'Fator de Forma Comercial (0.7)';
        }

        // Tratamento para fustes múltiplos / bifurcados
        if (ind.multipleStems && ind.stems) {
          ind.stems.forEach((stem: any, i: number) => {
            baseData[`Fuste_${i+1}_CAP`] = stem.cap || '';
            baseData[`Fuste_${i+1}_Altura_Calc`] = stem.alturaProcessada !== undefined ? stem.alturaProcessada : (stem.altura || '');
            baseData[`Fuste_${i+1}_Medida/Estimada`] = stem.alturaMedidaOuEstimada === 'medida' ? 'Medida' : 'Estimada';
            baseData[`Fuste_${i+1}_Volume`] = stem.volumeProcessado !== undefined ? stem.volumeProcessado : '';
          });
        }

        allData.push(baseData);
      });
    });

    if (allData.length === 0) return alert("Nenhum dado processado encontrado neste trabalho.");
    
    const worksheet = XLSX.utils.json_to_sheet(allData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados Processados");
    XLSX.writeFile(workbook, `Projeto_${activeFw.nome.replace(/\s+/g, '_')}_Processado.xlsx`);
  };

  const handleSyncGoogleSheets = async () => {
    if (!activeFw || !activeFw.googleSheetsUrl) return alert("Por favor, vincule uma planilha do Google nas configurações primeiro.");

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

    const headers = Array.from(new Set(allData.flatMap(Object.keys)));
    const payload = { headers, rows: allData };

    setIsSyncingSheets(true);
    try {
      const response = await fetch(activeFw.googleSheetsUrl, {
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
    XLSX.writeFile(workbook, `Talhão_${talhaoNome.replace(/\s+/g, '_')}.xlsx`);
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

      // Deletar chaves internas de processamento profissional para colocar com nomes amigáveis no final
      delete baseData.alturaUtilizada;
      delete baseData.alturaMedidaOuEstimada;
      delete baseData.volumeCalculado;
      delete baseData.modeloUtilizado;

      const g = calculateBasalArea(parseFloat(ind.cap || 0));
      baseData['Area_Basal (m2)'] = g.toFixed(4);
      
      if (ind.volumeCalculado !== undefined) {
        baseData['Volume (m3)'] = ind.volumeCalculado;
      } else {
        baseData['Volume (m3)'] = calculateVolume(g, parseFloat(ind.ht || 0), 0.7).toFixed(4);
      }
      
      baseData['DAP_Equivalente (cm)'] = ind.cap ? (parseFloat(ind.cap) / Math.PI).toFixed(2) : '0';

      if (ind.alturaUtilizada !== undefined) {
        baseData['Altura Utilizada (m)'] = ind.alturaUtilizada;
        baseData['Altura Medida/Estimada'] = ind.alturaMedidaOuEstimada === 'medida' ? 'Medida' : 'Estimada';
      }
      if (ind.volumeCalculado !== undefined) {
        baseData['Volume Calculado (m3)'] = ind.volumeCalculado;
      }
      if (ind.modeloUtilizado) {
        baseData['Modelo Utilizado'] = ind.modeloUtilizado;
      }
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

  // SVG Stem drawing for desktop visualization modal
  const renderTrunkVisualizerSvg = (tree: any) => {
    if (!tree) return null;

    if (tree.modoColeta === 'relativo') {
      return (
        <svg viewBox="0 0 160 480" style={{ width: '100%', height: '420px', display: 'block' }}>
          <defs>
            <linearGradient id="trunkVisualGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1b3f20" />
              <stop offset="50%" stopColor="#2e7d32" />
              <stop offset="100%" stopColor="#122c15" />
            </linearGradient>
          </defs>

          {/* Background Trunk */}
          <path d="M 50 450 L 60 50 L 100 50 L 110 450 Z" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* Filled segments */}
          {PONTOS_RELATIVOS.map((p, i) => {
            if (i === 0) return null;
            const prevP = PONTOS_RELATIVOS[i - 1];
            const hasPrev = parseFloat(tree.dadosRelativos?.[prevP] || '0') > 0;
            const hasCurr = parseFloat(tree.dadosRelativos?.[p] || '0') > 0;
            
            const y1 = 450 - (i - 1) * 40;
            const y2 = 450 - i * 40;
            const xLeft1 = 50 + (i - 1) * 1;
            const xLeft2 = 50 + i * 1;
            const xRight1 = 110 - (i - 1) * 1;
            const xRight2 = 110 - i * 1;

            const isFilled = hasPrev && hasCurr;
            const isHighlighted = selectedVisualizerPoint === p || selectedVisualizerPoint === prevP;

            return (
              <path
                key={i}
                d={`M ${xLeft1} ${y1} L ${xLeft2} ${y2} L ${xRight2} ${y2} L ${xRight1} ${y1} Z`}
                fill={isFilled ? 'url(#trunkVisualGrad)' : 'rgba(255,255,255,0.02)'}
                stroke={isHighlighted ? '#00e676' : 'transparent'}
                strokeWidth={isHighlighted ? 2.5 : 0}
                style={{ transition: 'all 0.3s ease' }}
              />
            );
          })}

          {/* Interactive measuring points */}
          {PONTOS_RELATIVOS.map((p, i) => {
            const y = 450 - i * 40;
            const x = 80;
            const isCompleted = parseFloat(tree.dadosRelativos?.[p] || '0') > 0;
            const isSelected = selectedVisualizerPoint === p;

            return (
              <g 
                key={p} 
                onClick={() => setSelectedVisualizerPoint(p)}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && (
                  <circle cx={x} cy={y} r="12" fill="rgba(0, 230, 118, 0.25)" />
                )}
                <circle 
                  cx={x} 
                  cy={y} 
                  r={isSelected ? '7' : '5'} 
                  fill={isCompleted ? '#00e676' : 'rgba(255,255,255,0.15)'}
                  stroke={isSelected ? '#ffffff' : 'rgba(0,0,0,0.5)'}
                  strokeWidth="1.5"
                  style={{ transition: 'all 0.2s ease' }}
                />
                <text 
                  x={x + 14} 
                  y={y + 4} 
                  fill={isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)'} 
                  fontSize="9.5px" 
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  fontFamily="'Plus Jakarta Sans', sans-serif"
                >
                  {p} {tree.dadosRelativos?.[p] ? `(${tree.dadosRelativos[p]} cm)` : ''}
                </text>
              </g>
            );
          })}
        </svg>
      );
    } else {
      let currentHeight = 0;
      const stack = (tree.secoes || []).map((s: any) => {
        const comp = parseFloat(s.comprimento || '0');
        const startH = currentHeight;
        currentHeight += comp;
        return {
          ...s,
          startH,
          endH: currentHeight
        };
      });

      const totalH = Math.max(currentHeight, 10);

      return (
        <svg viewBox="0 0 160 480" style={{ width: '100%', height: '420px', display: 'block' }}>
          <defs>
            <linearGradient id="secVisualGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1b5e20" />
              <stop offset="50%" stopColor="#388e3c" />
              <stop offset="100%" stopColor="#1b5e20" />
            </linearGradient>
          </defs>

          {/* Reference Background */}
          <path d="M 50 450 L 65 50 L 95 50 L 110 450 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />

          {/* Render sections */}
          {stack.map((s: any, idx: number) => {
            const y1 = 450 - (s.startH / totalH) * 400;
            const y2 = 450 - (s.endH / totalH) * 400;
            
            const w1 = 110 - (s.startH / totalH) * 30;
            const w2 = 110 - (s.endH / totalH) * 30;

            const xLeft1 = 80 - w1 / 2;
            const xRight1 = 80 + w1 / 2;
            const xLeft2 = 80 - w2 / 2;
            const xRight2 = 80 + w2 / 2;

            const isSelected = selectedVisualizerSectionId === s.id;

            return (
              <g 
                key={s.id} 
                onClick={() => setSelectedVisualizerSectionId(s.id)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={`M ${xLeft1} ${y1} L ${xLeft2} ${y2} L ${xRight2} ${y2} L ${xRight1} ${y1} Z`}
                  fill="url(#secVisualGrad)"
                  stroke={isSelected ? '#00e676' : 'rgba(0, 0, 0, 0.4)'}
                  strokeWidth={isSelected ? 2.5 : 1}
                  style={{ transition: 'all 0.3s ease' }}
                />
                <text 
                  x="80" 
                  y={(y1 + y2) / 2 + 3} 
                  textAnchor="middle" 
                  fill="#ffffff" 
                  fontSize="8.5px" 
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                >
                  S{idx + 1} ({s.comprimento}m)
                </text>
              </g>
            );
          })}
        </svg>
      );
    }
  };

  // SVG Taper curve graph for desktop visualization modal
  const renderTaperVisualizerGraph = (tree: any) => {
    if (!tree) return null;

    let coords: { h: number; d: number }[] = [];

    if (tree.modoColeta === 'relativo') {
      const hTotal = tree.alturaTotal || 10;
      PONTOS_RELATIVOS.forEach((p, idx) => {
        const val = parseFloat(tree.dadosRelativos?.[p] || '0');
        if (val > 0) {
          const pct = idx * 10;
          coords.push({
            h: (pct / 100) * hTotal,
            d: val
          });
        }
      });
    } else {
      let curH = 0;
      (tree.secoes || []).forEach((s: any) => {
        const comp = parseFloat(s.comprimento || '0');
        const dIni = parseFloat(s.dInicial || s.dMedio || '0');
        const dFin = parseFloat(s.dFinal || s.dMedio || '0');
        if (dIni > 0) {
          coords.push({ h: curH, d: dIni });
        }
        curH += comp;
        if (dFin > 0) {
          coords.push({ h: curH, d: dFin });
        }
      });
    }

    if (coords.length < 2) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
          Dados insuficientes para traçar a curva de afilamento.
        </div>
      );
    }

    coords.sort((a, b) => a.h - b.h);

    const maxH = Math.max(...coords.map(c => c.h), 5);
    const maxD = Math.max(...coords.map(c => c.d), 10);

    const graphWidth = 260;
    const graphHeight = 350;
    const padding = 35;

    const getX = (d: number) => padding + (d / maxD) * (graphWidth - padding * 2);
    const getY = (h: number) => graphHeight - padding - (h / maxH) * (graphHeight - padding * 2);

    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${getX(c.d)} ${getY(c.h)}`).join(' ');

    return (
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ fontSize: '13.5px', color: 'var(--primary-hover)', fontWeight: 'bold', marginBottom: '12px' }}>Curva de Afilamento (Altura x Diâmetro)</h4>
        <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ width: '100%', maxWidth: '320px', margin: '0 auto', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[0, 0.25, 0.5, 0.75, 1].map(r => {
            const hVal = r * maxH;
            const dVal = r * maxD;
            const y = getY(hVal);
            const x = getX(dVal);
            return (
              <g key={r}>
                <line x1={padding} y1={y} x2={graphWidth - padding} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
                <text x={padding - 8} y={y + 3} fill="rgba(255,255,255,0.3)" fontSize="8px" textAnchor="end">{hVal.toFixed(1)} m</text>
                
                <line x1={x} y1={padding} x2={x} y2={graphHeight - padding} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
                <text x={x} y={graphHeight - padding + 12} fill="rgba(255,255,255,0.3)" fontSize="8px" textAnchor="middle">{dVal.toFixed(0)} cm</text>
              </g>
            );
          })}

          <line x1={padding} y1={padding} x2={padding} y2={graphHeight - padding} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1={padding} y1={graphHeight - padding} x2={graphWidth - padding} y2={graphHeight - padding} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

          <path d={linePath} fill="none" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(0,230,118,0.4))' }} />

          {coords.map((c, i) => (
            <circle key={i} cx={getX(c.d)} cy={getY(c.h)} r="4" fill="#00b0ff" stroke="#ffffff" strokeWidth="1" />
          ))}
        </svg>
      </div>
    );
  };

  // ==========================================================================
  // CÁLCULOS E HELPER MÉTODOS DO CENTRO DE OPERAÇÕES
  // ==========================================================================
  
  const getStageStatus = (stageId: number): 'complete' | 'progress' | 'warning' | 'empty' => {
    if (!activeFwId) return 'empty';
    switch (stageId) {
      case 1: // Projeto
        return activeFw ? 'complete' : 'empty';
      case 2: // Talhões
        if (activeTalhoes.length === 0) return 'empty';
        if (activeTalhoes.some(t => !t.area || t.area <= 0)) return 'warning';
        return 'complete';
      case 3: // Estratos
        return activeStrata.length > 0 ? 'complete' : 'empty';
      case 4: // Parcelas
        if (activeParcels.length === 0) return 'empty';
        if (activeParcels.some(p => !p.areaParcela || p.areaParcela <= 0)) return 'warning';
        if (activeParcels.some(p => p.status !== 'Concluído')) return 'progress';
        return 'complete';
      case 5: // Coleta de Campo
        if (activeParcels.length === 0) return 'empty';
        let totalTrees = 0;
        let missingDapCap = 0;
        activeParcels.forEach(p => {
          if (p.dados) {
            totalTrees += p.dados.length;
            p.dados.forEach(t => {
              const dap = getDapOfTreeOrStem(t);
              if (dap <= 0) missingDapCap++;
            });
          }
        });
        if (totalTrees > 0 && (missingDapCap / totalTrees) > 0.05) return 'warning';
        if (activeParcels.some(p => !p.dados || p.dados.length === 0 || p.status !== 'Concluído')) return 'progress';
        return 'complete';
      case 6: // Cubagem
        if (activeCubageSessions.length === 0) return 'empty';
        if (activeCubageSessions.some(s => !s.dados || s.dados.length === 0 || s.dados.some(t => !((t.volumeTotal || 0) > 0)))) {
          return 'progress';
        }
        return 'complete';
      case 7: // Modelos
        const hasHeight = selectedHeightModelId !== 'none';
        const hasVolume = selectedVolumeModelId !== 'legacy';
        if (hasHeight && hasVolume) return 'complete';
        if (!hasHeight && !hasVolume) return 'warning';
        return 'progress';
      case 8: // Processamento
        if (latestOfficialProcessing !== null) return 'complete';
        const hasProcessedTrees = activeParcels.some(p => p.dados && p.dados.length > 0 && p.dados.some(t => t.volumeCalculado !== undefined && t.volumeCalculado > 0));
        if (hasProcessedTrees) return 'progress';
        return 'empty';
      case 9: // Extrapolação
        if (latestOfficialProcessing === null) return 'empty';
        const hasTalhaoOrStrataMissingArea = activeTalhoes.some(t => !t.area || t.area <= 0) || activeStrata.some(s => !s.area || s.area <= 0);
        if (hasTalhaoOrStrataMissingArea) return 'warning';
        return 'complete';
      case 10: // Sortimento
        if (activeSortimentResults.length > 0) return 'complete';
        if (sortimentRules.length > 0) return 'progress';
        return 'empty';
      case 11: // Relatório Final
        if (reportGenerated) return 'complete';
        if (latestOfficialProcessing !== null) return 'progress';
        return 'empty';
      default:
        return 'empty';
    }
  };

  const getStagePercent = (stageId: number): number => {
    if (!activeFwId) return 0;
    switch (stageId) {
      case 1: return activeFw ? 100 : 0;
      case 2: {
        if (activeTalhoes.length === 0) return 0;
        const withArea = activeTalhoes.filter(t => t.area && t.area > 0).length;
        return Math.round((withArea / activeTalhoes.length) * 100);
      }
      case 3: return activeStrata.length > 0 ? 100 : 0;
      case 4: {
        if (activeParcels.length === 0) return 0;
        const done = activeParcels.filter(p => p.status === 'Concluído').length;
        return Math.round((done / activeParcels.length) * 100);
      }
      case 5: {
        if (activeParcels.length === 0) return 0;
        const collected = activeParcels.filter(p => p.dados && p.dados.length > 0).length;
        return Math.round((collected / activeParcels.length) * 100);
      }
      case 6: {
        if (activeCubageSessions.length === 0) return 0;
        const finishedSessions = activeCubageSessions.filter(s => s.dados && s.dados.length > 0 && s.dados.every(t => (t.volumeTotal || 0) > 0)).length;
        return Math.round((finishedSessions / activeCubageSessions.length) * 100);
      }
      case 7: {
        let p = 0;
        if (selectedHeightModelId !== 'none') p += 50;
        if (selectedVolumeModelId !== 'legacy') p += 50;
        return p;
      }
      case 8: return latestOfficialProcessing ? 100 : (activeParcels.some(p => p.dados && p.dados.length > 0 && p.dados.some(t => t.volumeCalculado !== undefined)) ? 50 : 0);
      case 9: return latestOfficialProcessing ? 100 : 0;
      case 10: return activeSortimentResults.length > 0 ? 100 : (sortimentRules.length > 0 ? 50 : 0);
      case 11: return reportGenerated ? 100 : 0;
      default: return 0;
    }
  };

  const getStageKpi = (stageId: number): string => {
    if (!activeFwId) return '-';
    switch (stageId) {
      case 1: return activeFw ? activeFw.nome : '-';
      case 2: return `${activeTalhoes.length} talhões`;
      case 3: return `${activeStrata.length} estratos`;
      case 4: return `${activeParcels.length} parcelas`;
      case 5: {
        const total = activeParcels.reduce((acc, p) => acc + (p.dados ? p.dados.length : 0), 0);
        return `${total} árvores`;
      }
      case 6: return `${allCubagedTrees.length} árvores`;
      case 7: {
        const hName = selectedHeightModelId !== 'none' ? heightModels.find(m => m.id === selectedHeightModelId)?.nome || 'Definido' : 'Medida / Sem Modelo';
        const vName = selectedVolumeModelId !== 'legacy' ? volumeModels.find(m => m.id === selectedVolumeModelId)?.nome || 'Definido' : `Forma: ${processingFatorForma}`;
        return `${hName} | ${vName}`;
      }
      case 8: return latestOfficialProcessing ? latestOfficialProcessing.nomeProcessamento : 'Pendente';
      case 9: return latestOfficialProcessing ? 'Consolidação salva' : 'Pendente';
      case 10: return `${activeSortimentResults.length} resultados`;
      case 11: return reportGenerated ? 'Exportado' : 'Pendente';
      default: return '-';
    }
  };

  const getStageDescription = (stageId: number): string => {
    switch (stageId) {
      case 1: return 'Configurações e metadados do projeto';
      case 2: return 'Divisão territorial com área produtiva';
      case 3: return 'Agrupamentos homogêneos de tipologia florestal';
      case 4: return 'Instalação das parcelas amostrais';
      case 5: return 'Coleta de DAP e Altura em campo';
      case 6: return 'Cubagem rigorosa para calibração de modelos';
      case 7: return 'Seleção e ajuste de equações matemáticas';
      case 8: return 'Processamento estatístico e volume';
      case 9: return 'Expansão de médias e totais para a área total';
      case 10: return 'Divisão volumétrica por classes comerciais';
      case 11: return 'Geração do relatório executivo final';
      default: return '';
    }
  };

  const getStageName = (stageId: number): string => {
    switch (stageId) {
      case 1: return 'Projeto';
      case 2: return 'Talhões';
      case 3: return 'Estratos';
      case 4: return 'Parcelas';
      case 5: return 'Coleta de Campo';
      case 6: return 'Cubagem';
      case 7: return 'Modelos';
      case 8: return 'Processamento';
      case 9: return 'Extrapolação';
      case 10: return 'Sortimento';
      case 11: return 'Relatório Final';
      default: return '';
    }
  };

  const getNodeIcon = (stageId: number): React.ReactNode => {
    switch (stageId) {
      case 1:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        );
      case 2:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        );
      case 3:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        );
      case 4:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>
        );
      case 5:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        );
      case 6:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line><line x1="2" y1="20" x2="22" y2="20"></line></svg>
        );
      case 7:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
        );
      case 8:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        );
      case 9:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
        );
      case 10:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        );
      case 11:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        );
      default:
        return null;
    }
  };

  const handleStageClick = (stageId: number) => {
    setFocusedNode(stageId);
    setTimeout(() => {
      const element = document.getElementById(`op-node-${stageId}`);
      if (element && canvasRef.current) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 100);
  };

  const getNextRecommendedStep = (): string => {
    if (!activeFwId) return "Selecione um projeto de campo.";
    if (activeTalhoes.length === 0) {
      return "Cadastre os talhões do projeto.";
    }
    if (activeParcels.length === 0) {
      return "Crie as parcelas amostrais.";
    }
    if (activeParcels.some(p => !p.dados || p.dados.length === 0)) {
      return "Conclua a coleta de campo.";
    }
    if (selectedHeightModelId === 'none' && selectedVolumeModelId === 'legacy') {
      return "Cadastre ou selecione modelos hipsométricos e volumétricos.";
    }
    if (latestOfficialProcessing === null) {
      return "Execute o processamento oficial.";
    }
    if (activeSortimentResults.length === 0) {
      return "Configure regras de sortimento ou finalize o relatório.";
    }
    return "Gerar relatório final.";
  };

  const getBottlenecks = (): string[] => {
    const list: string[] = [];
    if (!activeFwId) return list;
    
    if (activeTalhoes.some(t => !t.area || t.area <= 0)) {
      list.push("Talhões sem área");
    }
    if (activeParcels.some(p => !p.areaParcela || p.areaParcela <= 0)) {
      list.push("Parcelas sem área");
    }
    if (activeParcels.some(p => !p.dados || p.dados.length === 0)) {
      list.push("Parcelas sem árvores");
    }
    
    // Check missing values
    let missingDapCapCount = 0;
    let missingHeightCount = 0;
    activeParcels.forEach(p => {
      if (p.dados) {
        p.dados.forEach(t => {
          const dap = getDapOfTreeOrStem(t);
          if (dap <= 0) missingDapCapCount++;
          
          if (t.multipleStems && t.stems) {
            if (t.stems.some((s: any) => !s.altura || parseFloat(s.altura) <= 0)) {
              missingHeightCount++;
            }
          } else {
            if (!t.ht || parseFloat(t.ht) <= 0) {
              missingHeightCount++;
            }
          }
        });
      }
    });
    
    if (missingDapCapCount > 0) {
      list.push(`${missingDapCapCount} árvores sem DAP/CAP`);
    }
    if (missingHeightCount > 0) {
      list.push(`${missingHeightCount} árvores sem altura`);
    }
    
    if (selectedHeightModelId === 'none') {
      list.push("Modelos Hipsométricos não definidos");
    }
    if (selectedVolumeModelId === 'legacy') {
      list.push("Modelos Volumétricos não definidos");
    }
    if (latestOfficialProcessing === null) {
      list.push("Processamento não oficializado");
    }
    
    let cubagemSemVolumeCount = 0;
    activeCubageSessions.forEach(s => {
      if (s.dados) {
        s.dados.forEach(t => {
          if (!((t.volumeTotal || 0) > 0)) cubagemSemVolumeCount++;
        });
      }
    });
    if (cubagemSemVolumeCount > 0) {
      list.push("Cubagem sem volume");
    }
    
    if (sortimentRules.length === 0) {
      list.push("Sortimento sem regras");
    }
    if (!reportGenerated) {
      list.push("Relatório não gerado");
    }
    
    return list;
  };

  // Node orbital positioning helper
  const [cols, setCols] = useState<number>(4);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getNodePos = (id: number, columns: number) => {
    if (columns === 1) {
      return {
        x: 50,
        y: (id - 1) * 8.5 + 7.5
      };
    }
    if (id === 1) return { x: 50, y: 50 };
    const angle = -Math.PI / 2 + (id - 2) * (2 * Math.PI / 10);
    const radius = 36;
    return {
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle)
    };
  };

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      let newCols = 4;
      if (w <= 550) {
        newCols = 1;
      } else if (w <= 850) {
        newCols = 2;
      } else if (w <= 1200) {
        newCols = 3;
      }
      setCols(newCols);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);


  const sidebarProps = {
    sidebarOpen,
    activeFwId,
    setActiveFwId,
    interfaceMode,
    toggleInterfaceMode,
    searchProjectQuery,
    setSearchProjectQuery,
    kpis,
    activeParcels,
    activeMenuFwId,
    setActiveMenuFwId,
    handleEditClick,
    handleExportFieldWork,
    setShowSettingsModal,
    collaborators,
  };

  const hudProps = {
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
    setReportGenerated,
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
    googleSheetsUrlInput,
    setGoogleSheetsUrlInput,
    isSyncingSheets,
    editingTalhao,
    setEditingTalhao,
    editTalhaoName,
    setEditTalhaoName,
    editTalhaoArea,
    setEditTalhaoArea,
    editTalhaoObs,
    setEditTalhaoObs,
    showStratumModal,
    setShowStratumModal,
    showColetaModal,
    setShowColetaModal,
    showRelatorioModal,
    setShowRelatorioModal,
    showBatchProcessModal,
    setShowBatchProcessModal,
    showSheetsModal,
    setShowSheetsModal,
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
    handleExportAll: () => handleExportFieldWork(activeFw),
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
    cols: 4,
    mapContainerRef: { current: null },
    canvasRef: { current: null },
  };

  const classicProps = {
    activeFw,
    activeTab,
    setActiveTab,
    activeParcels,
    activeTalhoes,
    activeStrata,
    activeSortimentResults: sortimentResults,
    latestOfficialProcessing,
    extrapolationData: {},
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
    handleExportAll: () => handleExportFieldWork(activeFw),
    handleExportAllProcessed,
    handleSyncGoogleSheets,
    handleExportTalhao,
    handleExportParcelProcessed: () => {},
    heightModels,
    volumeModels,
    selectedHeightModelId,
    setSelectedHeightModelId,
    selectedVolumeModelId,
    setSelectedVolumeModelId,
    processingFatorForma,
    setProcessingFatorForma,
    handleProcessParcelDataInOffice,
    auditParcel: activeParcels.find(p => p.id === auditParcelId) || null,
    auditParcelKpis: {},
    setSelectedVisualizerTree,
    setSelectedVisualizerPoint,
    setSelectedVisualizerSectionId,
    activeProcessings,
    deleteProcessing,
    handleDuplicarConfiguracao: () => {},
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
    setReportGenerated,
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
    cols: 4,
    mapContainerRef: { current: null }
  };

  return (
    <div className="office-dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: "'Plus Jakarta Sans', sans-serif", overflowX: 'hidden' }}>
      
      {/* Sidebar List of Projects */}
      <ProjectSelectionView {...sidebarProps} />

      {/* Main Content Area */}
      <div 
        className="office-content" 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100vh', 
          overflowY: interfaceMode === 'hud' ? 'hidden' : 'auto',
          position: 'relative'
        }}
      >
        {activeFw ? (
          interfaceMode === 'hud' ? (
            <HUDOfficeDashboard {...hudProps} />
          ) : (
            <ClassicOfficeDashboard {...classicProps} />
          )
        ) : (
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <img src="/logo.png" alt="LeafTag" style={{ width: '80px', height: '80px', opacity: 0.15, marginBottom: '24px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: '0 0 8px 0' }}>Nenhum Projeto Selecionado</h3>
            <p style={{ fontSize: '13.5px', margin: 0, opacity: 0.7 }}>Selecione ou crie um trabalho de campo na barra lateral para começar.</p>
          </div>
        )}
      </div>

      {/* Modals rendered at the bottom */}
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
        onOpenTeamModal={() => setShowTeamModal(true)} 
      />

      <TeamModal 
        isOpen={showTeamModal} 
        onClose={() => setShowTeamModal(false)} 
      />

      {activeFw && (
        <GoogleSheetsModal 
          isOpen={showSheetsModal} 
          onClose={() => setShowSheetsModal(false)} 
          activeFw={activeFw} 
        />
      )}

      {activeFw && (
        <BatchProcessModal 
          isOpen={showBatchProcessModal} 
          onClose={() => setShowBatchProcessModal(false)} 
          activeFwId={activeFwId}
        />
      )}

      {showNewProcessModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '450px', background: '#0e1511', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary-hover)', fontWeight: '800' }}>Salvar Novo Processamento</h3>
            <p style={{ margin: '4px 0 16px 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>Oficialize as configurações de cálculo e salve um snapshot do inventário</p>
            <input className="input-field" placeholder="Nome (Ex: Inventário 2026 - Oficial)" value={newProcessName} onChange={e => setNewProcessName(e.target.value)} style={{ borderRadius: '6px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Modo de Consolidação</label>
              <select className="input-field" value={newProcessConsolidationMode} onChange={e => setNewProcessConsolidationMode(e.target.value as any)} style={{ borderRadius: '6px' }}>
                <option value="auto">Automático (Ponderado por Área)</option>
                <option value="talhao">Somente por Talhão</option>
                <option value="stratum">Somente por Estrato</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Fator de Casca Médio (k)</label>
              <input type="number" className="input-field" value={newProcessFatorCasca} onChange={e => setNewProcessFatorCasca(e.target.value)} step="0.01" style={{ borderRadius: '6px' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-secondary" style={{ borderRadius: '6px' }} onClick={() => setShowNewProcessModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ borderRadius: '6px' }} onClick={() => handleCreateInventoryProcessing(newProcessName, newProcessConsolidationMode)}>Salvar Processamento</button>
            </div>
          </div>
        </div>
      )}

      {showStratumModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', background: '#0e1511', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary-hover)', fontWeight: '800' }}>Cadastrar Novo Estrato</h3>
            <p style={{ margin: '4px 0 16px 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>Agrupar parcelas homogêneas para cálculo estratificado</p>
            <input className="input-field" placeholder="Nome do Estrato (Ex: Estrato Alto)" value={newStratumName} onChange={e => setNewStratumName(e.target.value)} style={{ borderRadius: '6px' }} />
            <input type="number" className="input-field" placeholder="Área Total do Estrato (ha)" value={newStratumArea} onChange={e => setNewStratumArea(e.target.value)} style={{ borderRadius: '6px' }} />
            <input className="input-field" placeholder="Observações" value={newStratumDesc} onChange={e => setNewStratumDesc(e.target.value)} style={{ borderRadius: '6px' }} />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-secondary" style={{ borderRadius: '6px' }} onClick={() => setShowStratumModal(false)}>Cancelar</button>
              <button 
                className="btn btn-primary" 
                style={{ borderRadius: '6px' }}
                onClick={async () => {
                  if (!newStratumName) return alert('Por favor, informe o nome do estrato.');
                  const areaNum = parseFloat(newStratumArea);
                  if (isNaN(areaNum) || areaNum <= 0) return alert('Por favor, informe uma área válida maior que zero.');
                  try {
                    await createStratum({
                      fieldWorkId: activeFwId,
                      nome: newStratumName,
                      area: areaNum,
                      descricao: newStratumDesc
                    });
                    setNewStratumName('');
                    setNewStratumArea('');
                    setNewStratumDesc('');
                    setShowStratumModal(false);
                  } catch (err: any) {
                    alert("Erro ao criar estrato: " + err.message);
                  }
                }}
              >
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVisualizerTree && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '1000px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px', 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            padding: '24px',
            background: 'rgba(10, 18, 12, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px', // Clamped to 12px
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ color: '#ffffff', fontSize: '20px', fontWeight: '800', margin: 0 }}>
                    Árvore # {selectedVisualizerTree.numeroIndividuo}
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Modelo hipsométrico e cubagem rigorosa de fustes seccionais
                </p>
              </div>
              <button 
                onClick={() => setSelectedVisualizerTree(null)} 
                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>

            {/* Visualizer content grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: '20px' }}>
              
              {/* Left Column: Stats & selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Metadados do Indivíduo</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px', fontSize: '12.5px' }}>
                    <div>Espécie: <strong style={{ color: '#fff' }}>{selectedVisualizerTree.nomePopular || 'Desconhecida'}</strong></div>
                    <div>DAP: <strong style={{ color: '#fff' }}>{getDapOfTreeOrStem(selectedVisualizerTree).toFixed(1)} cm</strong></div>
                    <div>Altura H: <strong style={{ color: '#fff' }}>{(selectedVisualizerTree.alturaUtilizada || 0).toFixed(1)} m</strong></div>
                    <div>Volume CC: <strong style={{ color: '#00e676' }}>{(selectedVisualizerTree.volumeCalculado || 0).toFixed(4)} m³</strong></div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Selecione a Seção</label>
                  <select 
                    className="input-field" 
                    style={{ marginTop: '6px', marginBottom: 0, borderRadius: '6px' }}
                    value={selectedVisualizerPoint}
                    onChange={(e) => {
                      const pt = e.target.value;
                      setSelectedVisualizerPoint(pt);
                      if (selectedVisualizerTree.secoes) {
                        const matchedSec = selectedVisualizerTree.secoes.find((s: any) => s.pontoMedicao === pt);
                        setSelectedVisualizerSectionId(matchedSec ? matchedSec.id : null);
                      }
                    }}
                  >
                    {PONTOS_RELATIVOS.map(pt => (
                      <option key={pt} value={pt}>{pt}</option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const currentSec = selectedVisualizerTree.secoes?.find((s: any) => s.pontoMedicao === selectedVisualizerPoint);
                  return currentSec ? (
                    <div style={{ background: 'rgba(0, 230, 118, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0, 230, 118, 0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#00e676', textTransform: 'uppercase', fontWeight: 'bold' }}>Seção Inspecionada ({selectedVisualizerPoint})</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Diâmetro CC:</span>
                          <strong style={{ color: '#fff' }}>{(currentSec.diametroComCasca || 0).toFixed(2)} cm</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Diâmetro SC:</span>
                          <strong style={{ color: '#fff' }}>{(currentSec.diametroSemCasca || 0).toFixed(2)} cm</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Volume Secional CC:</span>
                          <strong style={{ color: '#00e676' }}>{(currentSec.volumeComCasca || 0).toFixed(4)} m³</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Volume Secional SC:</span>
                          <strong style={{ color: '#00b0ff' }}>{(currentSec.volumeSemCasca || 0).toFixed(4)} m³</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic', margin: '12px 0 0 0' }}>
                      Clique em uma seção no desenho do tronco para ver os detalhes seccionais.
                    </p>
                  );
                })()}

                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                  {selectedVisualizerTree.modoColeta === 'relativo' 
                    ? 'Use os pontos do tronco para navegar e ver detalhes.' 
                    : 'Clique nas seções empilhadas para inspecionar os diâmetros.'
                  }
                </span>

              </div>

              {/* Middle Column: SVG Stem drawing */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--primary-hover)', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '0.5px' }}>
                  Esquema Tridimensional do Fuste
                </h4>
                {renderTrunkVisualizerSvg(selectedVisualizerTree)}
              </div>

              {/* Right Column: Taper graph plot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {renderTaperVisualizerGraph(selectedVisualizerTree)}
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', marginTop: '8px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ width: 'auto', padding: '10px 24px', borderRadius: '6px' }} 
                onClick={() => setSelectedVisualizerTree(null)}
              >
                Fechar Visualização
              </button>
            </div>

          </div>
        </div>
      )}

      {editingFw && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
           <div className="glass-card" style={{ width: '100%', maxWidth: '400px', background: '#141c18', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary-hover)', fontWeight: '800' }}>Editar Trabalho</h3>
              <input className="input-field" placeholder="Nome (Ex: Inventário 2026)" value={editName} onChange={e => setEditName(e.target.value)} style={{ marginTop: '16px', borderRadius: '6px' }} />
              <input className="input-field" placeholder="Local / Fazenda" value={editLocal} onChange={e => setEditLocal(e.target.value)} style={{ borderRadius: '6px' }} />
              <input type="date" className="input-field" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ borderRadius: '6px' }} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="btn btn-secondary" style={{ borderRadius: '6px' }} onClick={() => setEditingFw(null)}>Cancelar</button>
                <button className="btn btn-primary" style={{ borderRadius: '6px' }} onClick={handleUpdateFw}>Salvar</button>
              </div>
           </div>
        </div>
      )}

      {/* COLETA MODAL: LISTA DE PARCELAS */}
      {showColetaModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '800px', background: '#0e1511', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', borderRadius: '12px', padding: '28px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--primary-hover)', fontWeight: '800' }}>Status de Coleta por Parcela</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Lista de parcelas instaladas no campo</p>
              </div>
              <button 
                onClick={() => setShowColetaModal(false)} 
                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>

            {/* List and search */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              {activeParcels.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhuma parcela cadastrada neste projeto.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th>Parcela</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Árvores Coletadas</th>
                      <th>Coordenadas</th>
                      <th style={{ textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeParcels.map(p => {
                      let statusColor = '#a1a1aa';
                      if (p.status === 'Concluído') statusColor = '#00e676';
                      else if (p.status === 'Em Andamento') statusColor = '#00b0ff';
                      else if (p.status === 'Aberto') statusColor = '#ff9800';

                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ fontWeight: 'bold' }}>{p.nome}</td>
                          <td>
                            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: statusColor, border: '1px solid rgba(255,255,255,0.02)', fontWeight: 'bold' }}>
                              {p.status || 'Aberto'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: '700' }}>{p.dados ? p.dados.length : 0}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{p.coordenadas || 'Sem GPS'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', height: '30px', borderRadius: '6px' }}
                              onClick={() => {
                                setShowColetaModal(false);
                                setActiveTab('parcelas');
                              }}
                            >
                              Ver Parcela
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px', marginTop: '20px' }}>
              <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 24px', borderRadius: '6px' }} onClick={() => setShowColetaModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* RELATÓRIO MODAL: EXPORTAÇÃO E DOWNLOADS */}
      {showRelatorioModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '550px', background: '#0e1511', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', borderRadius: '12px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--primary-hover)', fontWeight: '800' }}>Relatórios e Exportações</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Gere os entregáveis finais do inventário</p>
              </div>
              <button 
                onClick={() => setShowRelatorioModal(false)} 
                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}
              >
                &times;
              </button>
            </div>

            {latestOfficialProcessing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                  <h4 style={{ fontSize: '14px', margin: '0 0 8px 0', color: 'var(--primary-hover)' }}>Processamento Oficial Ativo</h4>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    <div>Nome: <strong style={{ color: '#fff' }}>{latestOfficialProcessing.nomeProcessamento}</strong></div>
                    <div>Data: <strong style={{ color: '#fff' }}>{latestOfficialProcessing.dataProcessamento}</strong></div>
                    <div>Fator Casca: <strong style={{ color: '#fff' }}>{latestOfficialProcessing.fatorCasca}</strong></div>
                    <div>Volume Total: <strong style={{ color: '#fff' }}>{Math.round(latestOfficialProcessing.volumeTotalEstimado).toLocaleString()} m³</strong></div>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Escolha o formato de relatório para download:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ justifyContent: 'flex-start', padding: '12px 16px', borderRadius: '6px' }}
                    onClick={() => {
                      handleExportAdvancedXLSX(latestOfficialProcessing);
                      localStorage.setItem('report_generated_' + activeFwId, 'true');
                      setReportGenerated(true);
                      setShowRelatorioModal(false);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Exportar Planilha Avançada Consolidada
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ justifyContent: 'flex-start', padding: '12px 16px', borderRadius: '6px' }}
                    onClick={() => {
                      handleExportAllProcessed();
                      localStorage.setItem('report_generated_' + activeFwId, 'true');
                      setReportGenerated(true);
                      setShowRelatorioModal(false);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Exportar Processamento Geral (XLSX)
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ justifyContent: 'flex-start', padding: '12px 16px', borderRadius: '6px' }}
                    onClick={() => {
                      if (activeFw) {
                        handleExportFieldWork(activeFw);
                        localStorage.setItem('report_generated_' + activeFwId, 'true');
                        setReportGenerated(true);
                        setShowRelatorioModal(false);
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Exportar Dados Brutos de Campo (XLSX)
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
                <div style={{ padding: '24px', background: 'rgba(239, 35, 60, 0.08)', border: '1px solid rgba(239, 35, 60, 0.2)', borderRadius: '12px', color: '#ff4d6d' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  <h4 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 6px 0' }}>Processamento Oficial Pendente</h4>
                  <p style={{ fontSize: '12.5px', margin: 0, opacity: 0.85, lineHeight: '1.4' }}>
                    Não existe nenhum processamento oficial salvo para este projeto. O relatório avançado consolidado exige a oficialização prévia.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, borderRadius: '6px' }} onClick={() => setShowRelatorioModal(false)}>Fechar</button>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 1, borderRadius: '6px' }} 
                    onClick={() => {
                      setShowRelatorioModal(false);
                      setActiveTab('processamentos');
                    }}
                  >
                    Ir para Processamentos
                  </button>
                </div>
              </div>
            )}

            {latestOfficialProcessing && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px', marginTop: '20px' }}>
                <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 24px', borderRadius: '6px' }} onClick={() => setShowRelatorioModal(false)}>Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
