import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { StatisticalDashboard } from '../components/StatisticalDashboard';
import { SortimentoTab } from '../components/SortimentoTab';
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
  const [newEmail, setNewEmail] = useState('');
  const [isTeamLoading, setIsTeamLoading] = useState(false);
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

  const handleAddCollaborator = async () => {
    if (!currentUser) return;
    const emailToTrim = newEmail.trim().toLowerCase();
    if (!emailToTrim) return alert("Digite um e-mail válido.");
    
    if (collaborators.includes(emailToTrim)) {
      return alert("Este e-mail já faz parte do seu time.");
    }
    
    if (status !== 'admin' && collaborators.length >= 2) {
      return alert("Você atingiu o limite máximo de 2 colaboradores no seu time.");
    }

    setIsTeamLoading(true);
    const updatedCollaborators = [...collaborators, emailToTrim];
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      await updateDoc(docRef, { collaborators: updatedCollaborators });
      
      // Salva mapeamento para login robusto
      await setDoc(doc(db, 'collaborators_mapping', emailToTrim), { ownerUid: currentUser.uid });

      setCollaborators(updatedCollaborators);
      setNewEmail('');
      alert("Colaborador adicionado com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao adicionar colaborador. Tente novamente.");
    } finally {
      setIsTeamLoading(false);
    }
  };

  const handleRemoveCollaborator = async (emailToRemove: string) => {
    if (!currentUser) return;
    if (!confirm(`Deseja realmente remover o e-mail ${emailToRemove} do seu time?`)) return;

    setIsTeamLoading(true);
    const updatedCollaborators = collaborators.filter(email => email !== emailToRemove);
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      await updateDoc(docRef, { collaborators: updatedCollaborators });
      
      // Remove o mapeamento do banco
      await deleteDoc(doc(db, 'collaborators_mapping', emailToRemove));

      setCollaborators(updatedCollaborators);
      alert("Colaborador removido com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao remover colaborador. Tente novamente.");
    } finally {
      setIsTeamLoading(false);
    }
  };

  const [activeFwId, setActiveFwId] = useState<string>('');
  const [searchProjectQuery, setSearchProjectQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'centro-operacoes' | 'talhoes' | 'parcelas' | 'estratos' | 'cubagem' | 'extrapolacao' | 'processamentos' | 'sortimento'>('centro-operacoes');
  const [extraTab, setExtraTab] = useState<'parcelas' | 'talhoes' | 'estratos' | 'trabalho'>('parcelas');
  const [cubageSortOrder, setCubageSortOrder] = useState<'asc' | 'desc' | null>('desc');
  
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
    switch (stageId) {
      case 1:
        if (activeFw) handleEditClick(activeFw);
        break;
      case 2:
        setActiveTab('talhoes');
        break;
      case 3:
        setActiveTab('estratos');
        break;
      case 4:
        setActiveTab('parcelas');
        break;
      case 5:
        setShowColetaModal(true);
        break;
      case 6:
        setActiveTab('cubagem');
        break;
      case 7:
        navigate('/modelos');
        break;
      case 8:
        setActiveTab('processamentos');
        break;
      case 9:
        setActiveTab('extrapolacao');
        break;
      case 10:
        setActiveTab('sortimento');
        break;
      case 11:
        setShowRelatorioModal(true);
        break;
    }
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

  // Node center calculations for glowing connection lines
  const [nodeCoords, setNodeCoords] = useState<{ x: number; y: number }[]>([]);
  const [cols, setCols] = useState<number>(4);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const calculateNodeCoords = () => {
    if (!mapContainerRef.current) return;
    const containerRect = mapContainerRef.current.getBoundingClientRect();
    const newCoords = [];
    for (let i = 1; i <= 11; i++) {
      const el = document.getElementById(`op-node-${i}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        newCoords.push({
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2
        });
      }
    }
    setNodeCoords(newCoords);
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
      calculateNodeCoords();
    };

    if (activeTab === 'centro-operacoes') {
      handleResize();
      const t1 = setTimeout(calculateNodeCoords, 100);
      const t2 = setTimeout(calculateNodeCoords, 400);
      const t3 = setTimeout(calculateNodeCoords, 800);
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [activeTab, activeFwId]);

  useEffect(() => {
    if (activeTab === 'centro-operacoes') {
      calculateNodeCoords();
      const t1 = setTimeout(calculateNodeCoords, 50);
      const t2 = setTimeout(calculateNodeCoords, 150);
      const t3 = setTimeout(calculateNodeCoords, 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [cols, activeTab]);

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
        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '20px', marginBottom: 0 }}>
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
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.3px' }}>Área Total</span>
                <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '2px' }}>{totalArea.toFixed(2)} ha</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.3px' }}>Parcelas Col.</span>
                <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '2px', color: '#00b0ff' }}>{completedParcelsCount} / {activeParcels.length}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.3px' }}>Volume CC Est.</span>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#00e676', marginTop: '2px' }}>
                  {totalVolume > 0 ? `${Math.round(totalVolume).toLocaleString('pt-BR')} m³` : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAPA OPERACIONAL COM SVG CONNECTOR */}
        <div className="operation-map-container" ref={mapContainerRef}>
          {nodeCoords.length > 0 && (
            <svg className="operation-svg-overlay">
              <defs>
                <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              {nodeCoords.map((start, idx) => {
                if (idx === nodeCoords.length - 1) return null;
                const end = nodeCoords[idx + 1];
                const targetStatus = getStageStatus(idx + 2);
                let lineClass = 'line-empty';
                if (targetStatus === 'complete') lineClass = 'line-complete';
                else if (targetStatus === 'progress') lineClass = 'line-progress';
                else if (targetStatus === 'warning') lineClass = 'line-warning';
                
                return (
                  <line
                    key={idx}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    className={`operation-link ${lineClass}`}
                    style={{ filter: lineClass !== 'line-empty' ? 'url(#line-glow)' : 'none' }}
                  />
                );
              })}
            </svg>
          )}

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
                    gridColumn: colIndex + 1
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '9.5px', fontWeight: '800', opacity: 0.5, letterSpacing: '0.5px' }}>ETAPA {String(id).padStart(2, '0')}</span>
                    <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: statusColor, fontWeight: '700', border: `1px solid rgba(255,255,255,0.01)` }}>
                      {statusLabel}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: statusColor }}>
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
        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(239,35,60,0.2)', background: 'rgba(239,35,60,0.05)', color: '#ff4d6d' }}>
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
    <div className="office-dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: "'Plus Jakarta Sans', sans-serif", overflowX: 'hidden' }}>
      
      {/* Sidebar (List of projects) */}
      <div className="office-sidebar" style={{ width: '320px', background: 'rgba(5, 13, 8, 0.4)', backdropFilter: 'blur(30px)', borderRight: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* Brand Header */}
        <div style={{ padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ color: 'var(--primary-color)', fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '0.5px' }}>LeafTag</h1>
                
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
                  title={isSynced ? "Dados 100% Sincronizados" : "Sincronizando com a Nuvem..."}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="10" 
                    height="10" 
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
                color: 'var(--text-muted)',
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
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
              Ir para Modo Campo
            </button>
          </div>
        </div>

        {/* Biblioteca de Modelos Button */}
        <div style={{ padding: '12px 24px 4px' }}>
          <button 
            onClick={() => navigate('/modelos')}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(0, 176, 255, 0.15) 100%)',
              border: '1px solid rgba(0, 230, 118, 0.35)',
              borderRadius: '12px',
              color: '#ffffff',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0, 230, 118, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.border = '1px solid #00e676';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 230, 118, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = '1px solid rgba(0, 230, 118, 0.35)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 230, 118, 0.05)';
            }}
          >
            <span>Biblioteca de Equações</span>
          </button>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
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
              const countTalhoes = talhoes.filter(t => t.fieldWorkId === fw.id).length;
              const countParcelas = inventories.filter(i => i.fieldWorkId === fw.id && i.template !== 'cubagem').length;
              const countArvores = inventories
                .filter(i => i.fieldWorkId === fw.id)
                .reduce((acc, curr) => acc + (curr.dados ? curr.dados.length : 0), 0);
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
                    position: 'relative',
                    overflow: 'visible'
                  }}
                >
                  {isActive && (
                    <div style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '20px', background: 'var(--primary-color)', borderRadius: '0 4px 4px 0' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: '13.5px', margin: 0, fontWeight: '700', color: isActive ? 'var(--primary-hover)' : '#fff', flex: 1, paddingRight: '8px' }}>{fw.nome}</h4>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuFwId(activeMenuFwId === fw.id ? null : fw.id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '18px',
                          cursor: 'pointer',
                          padding: '0 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.2s',
                          lineHeight: 1
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        •••
                      </button>
                      
                      {activeMenuFwId === fw.id && (
                        <div 
                          style={{
                            position: 'absolute',
                            top: '24px',
                            right: '0',
                            background: '#1a1a1a',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                            zIndex: 100,
                            minWidth: '130px',
                            overflow: 'hidden',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(fw);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '13px',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              display: 'block',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActiveMenuFwId(null);
                              if (confirm(`Deseja duplicar o trabalho de campo "${fw.nome}"?`)) {
                                try {
                                  await duplicateFieldWork(fw.id);
                                  alert("Trabalho de campo duplicado com sucesso.");
                                } catch (err: any) {
                                  alert("Erro ao duplicar: " + err.message);
                                }
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '13px',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              display: 'block',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuFwId(null);
                              handleExportFieldWork(fw);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              background: 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '13px',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              display: 'block',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            Exportar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Local: {fw.local}
                  </span>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px', opacity: 0.8 }}>
                    {countTalhoes} {countTalhoes === 1 ? 'talhão' : 'talhões'} • {countParcelas} {countParcelas === 1 ? 'parcela' : 'parcelas'} • {countArvores} {countArvores === 1 ? 'árvore' : 'árvores'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Profile Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '12.5px', color: '#fff', fontWeight: 'bold', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{currentUser?.displayName || 'Escritório'}</span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{currentUser?.email}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <button 
                onClick={() => setShowSettingsModal(true)}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  padding: '4px'
                }}
                title="Configurações"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="office-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
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
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ 
                      width: 'auto', 
                      padding: '10px 20px', 
                      background: 'linear-gradient(135deg, #ffd54f 0%, #fbc02d 100%)', 
                      border: 'none',
                      color: '#000000',
                      fontWeight: '800',
                      borderRadius: '8px',
                      boxShadow: '0 4px 14px rgba(251, 192, 45, 0.2)'
                    }} 
                    onClick={() => {
                      setBatchScope('total');
                      setBatchTalhaoId('');
                      setBatchParcelId(null);
                      setShowBatchProcessModal(true);
                    }}
                  >
                    Processamento em Lote
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '10px 20px', borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)' }} 
                    onClick={() => setShowProjectDashboard(true)}
                  >
                    Dashboard Geral
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '10px 20px' }} 
                    onClick={handleExportAll}
                  >
                    Exportar Excel Completo
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '10px 20px', borderColor: '#fbc02d', color: '#ffd54f', background: 'rgba(251, 192, 45, 0.08)' }} 
                    onClick={handleExportAllProcessed}
                  >
                    Exportar Processamento (Excel)
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ 
                      width: 'auto', 
                      padding: '10px 20px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      borderColor: activeFw.googleSheetsUrl ? 'var(--primary-hover)' : 'rgba(255,255,255,0.1)' 
                    }} 
                    onClick={() => setShowSheetsModal(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="3" y1="9" x2="21" y2="9"></line>
                      <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                    {activeFw.googleSheetsUrl ? "Planilha Vinculada" : "Vincular Planilha"}
                  </button>
                  {activeFw.googleSheetsUrl && (
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      style={{ 
                        width: 'auto', 
                        padding: '10px 20px', 
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
                </div>
              )}
            </div>

            {/* Abas layout for Talões / Parcelas / Estratos */}
            <div className="office-tab-bar">
              <button 
                onClick={() => setActiveTab('centro-operacoes')}
                className={`office-tab-button ${activeTab === 'centro-operacoes' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Centro de Operações</span>
                  <span style={{ fontSize: '10.5px', opacity: 0.7, marginTop: '2px' }}>Mapa de Processo</span>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('talhoes')}
                className={`office-tab-button ${activeTab === 'talhoes' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                  <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Talões</span>
                  <span style={{ fontSize: '10.5px', opacity: 0.7, marginTop: '2px' }}>{activeTalhoes.length} cadastrados</span>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('parcelas')}
                className={`office-tab-button ${activeTab === 'parcelas' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="22" y1="12" x2="18" y2="12"></line>
                  <line x1="6" y1="12" x2="2" y2="12"></line>
                  <line x1="12" y1="6" x2="12" y2="2"></line>
                  <line x1="12" y1="22" x2="12" y2="18"></line>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Parcelas</span>
                  <span style={{ fontSize: '10.5px', opacity: 0.7, marginTop: '2px' }}>{activeParcels.length} registradas</span>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('estratos')}
                className={`office-tab-button ${activeTab === 'estratos' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Estratos</span>
                  <span style={{ fontSize: '10.5px', opacity: 0.7, marginTop: '2px' }}>{activeStrata.length} grupos</span>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('cubagem')}
                className={`office-tab-button ${activeTab === 'cubagem' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                  <path d="M12 20V10M18 20V4M6 20V16"/>
                  <line x1="2" y1="20" x2="22" y2="20"></line>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Cubagem</span>
                  <span style={{ fontSize: '10.5px', opacity: 0.7, marginTop: '2px' }}>{allCubagedTrees.length} fustes</span>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('extrapolacao')}
                className={`office-tab-button ${activeTab === 'extrapolacao' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                  <line x1="2" y1="20" x2="22" y2="20"></line>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Extrapolação</span>
                  <span style={{ fontSize: '10.5px', opacity: 0.7, marginTop: '2px' }}>Médias e Totais</span>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('processamentos')}
                className={`office-tab-button ${activeTab === 'processamentos' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Processamentos</span>
                  <span style={{ fontSize: '10.5px', opacity: 0.7, marginTop: '2px' }}>{activeProcessings.length} snapshots</span>
                </div>
              </button>

              <button 
                onClick={() => setActiveTab('sortimento')}
                className={`office-tab-button ${activeTab === 'sortimento' ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Sortimento</span>
                  <span style={{ fontSize: '10.5px', opacity: 0.7, marginTop: '2px' }}>Otimização e Toras</span>
                </div>
              </button>
            </div>

            {/* KPI Cards Row */}
            {activeTab !== 'centro-operacoes' && (
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
            )}

            {/* TAB CONTENT */}
            {activeTab === 'centro-operacoes' ? (
              renderCentroOperacoes()
            ) : activeTab === 'talhoes' ? (
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
                                      margin: 0 
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
                                          margin: 0 
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
                                          margin: 0 
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
                                      margin: 0 
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
                                      margin: 0 
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
              <div className="glass-card" style={{ padding: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
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
                      fontSize: '12px'
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
                            style={{ marginBottom: 0, padding: '8px 12px', height: '38px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} 
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
                              <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{p.coordenadas || 'Não coletada'}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.areaParcela}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'center', color: '#aed581', fontWeight: 'bold' }}>{p.dados.length}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ width: 'auto', padding: '4px 8px', fontSize: '10px', height: '26px', margin: 0 }} 
                                    onClick={() => setAuditParcelId(p.id)}
                                  >
                                    Auditar Dados
                                  </button>
                                  {p.dados.length > 0 && (
                                    <>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ width: 'auto', padding: '4px 8px', fontSize: '10px', height: '26px', borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)', margin: 0 }} 
                                        onClick={() => setShowParcelDashboardId(p.id)}
                                      >
                                        Dashboard
                                      </button>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ width: 'auto', padding: '4px 8px', fontSize: '10px', height: '26px', borderColor: 'var(--primary-color)', color: 'var(--primary-color)', margin: 0 }} 
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
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome do Estrato</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descrição</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Área (ha)</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Peso (Wh)</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Nº Parcelas</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '220px' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stratifiedStats.strataDetails.map(d => (
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
                                        margin: 0 
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
                                      margin: 0 
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
                            <span style={{ fontSize: '10px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '4px' }}>
                              {stratifiedStats.errorRel <= 10 ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aed581" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                                  Dentro do limite (10%)
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffb74d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                  Fora do limite (10%)
                                </>
                              )}
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
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, display: 'flex', alignItems: 'center' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        <span><strong>Nota Silvicultural</strong>: Os cálculos utilizam a metodologia oficial de Amostragem Casual Estratificada (Student t = {2.0} com 95% de confiança). Para resultados estatisticamente válidos, certifique-se de cadastrar pelo menos 2 parcelas em cada estrato.</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : activeTab === 'cubagem' ? (
              /* CUBAGEM TAB VIEW */
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                                  color: isLight ? '#16a34a' : '#00e676'
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
              /* EXTRAPOLATION VIEW CONTENT */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* SUB TABS */}
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  {(['parcelas', 'talhoes', 'estratos', 'trabalho'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setExtraTab(tab)}
                      style={{
                        background: extraTab === tab ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        color: extraTab === tab ? '#fff' : 'var(--text-muted)',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                        textTransform: 'capitalize'
                      }}
                    >
                      {tab === 'trabalho' ? 'Trabalho Total' : tab}
                    </button>
                  ))}
                </div>

                {extrapolationData && (
                  <div>
                    {extraTab === 'parcelas' && (
                      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parcela</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área (m²)</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fator Expansão</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vol. Total (m³)</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--primary-hover)', textTransform: 'uppercase' }}>Vol. / ha (m³)</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>G / ha (m²)</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Árvores / ha</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {extrapolationData.processedParcels.map(p => (
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
                        {extrapolationData.processedParcels.some(p => !p.isProcessed) && (
                          <div style={{ padding: '12px 16px', background: 'rgba(244, 67, 54, 0.08)', borderTop: '1px solid rgba(244, 67, 54, 0.15)', color: '#ef5350', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            <span>Esta parcela ainda não foi processada.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {extraTab === 'talhoes' && (
                      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                              {extrapolationData.talhoesResults.map(t => (
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
                      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                              {extrapolationData.strataResults.map(s => (
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
                        
                        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Área Total Inventariada</span>
                          <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#64b5f6' }}>{extrapolationData.trabalho.areaTotalInventariada.toFixed(2)} ha</h3>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Soma dos talhões/estratos cadastrados</span>
                        </div>

                        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Área Total Amostrada</span>
                          <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#81c784' }}>{(extrapolationData.trabalho.areaTotalAmostrada / 10000).toFixed(4)} ha</h3>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{extrapolationData.trabalho.areaTotalAmostrada.toFixed(0)} m² no total</span>
                        </div>

                        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Parcelas Processadas</span>
                          <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#ffb74d' }}>{extrapolationData.trabalho.numTotalParcelas}</h3>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Parcelas consideradas na amostragem</span>
                        </div>

                        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Árvores Medidas</span>
                          <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#ba68c8' }}>{extrapolationData.trabalho.numTotalArvoresMedidas}</h3>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Registradas nas parcelas válidas</span>
                        </div>

                        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Volume Médio / ha</span>
                          <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#e57373' }}>{extrapolationData.trabalho.volumeMedioGeralPorHa.toFixed(2)} m³/ha</h3>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Média aritmética por hectare</span>
                        </div>

                        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0, 230, 118, 0.08)', borderRadius: '16px', marginBottom: 0 }}>
                          <span style={{ fontSize: '10px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold' }}>Volume Total Estimado</span>
                          <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#00e676' }}>{extrapolationData.trabalho.volumeTotalEstimado.toFixed(2)} m³</h3>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Extrapolação para a área total</span>
                        </div>

                        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Área Basal / ha</span>
                          <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#a1887f' }}>{extrapolationData.trabalho.areaBasalMediaPorHa.toFixed(3)} m²/ha</h3>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Média de área transversal acumulada</span>
                        </div>

                        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Densidade Média / ha</span>
                          <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#4db6ac' }}>{extrapolationData.trabalho.densidadeMediaPorHa.toFixed(1)} árv/ha</h3>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Média de árvores por hectare</span>
                        </div>

                      </div>
                    )}
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
                    style={{ width: 'auto', padding: '12px 24px' }}
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
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                                    style={{ width: 'auto', padding: '6px 10px', height: '28px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => setSelectedReportProcessing(proc)}
                                    title="Visualizar Relatório Executivo"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                                    Relatório
                                  </button>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ width: 'auto', padding: '6px 10px', height: '28px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => handleDuplicarConfiguracao(proc)}
                                    title="Duplicar Configurações no Painel"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    Duplicar Configuração
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
                                      margin: 0 
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
                  <div className="glass-card" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
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
                          style={{ marginBottom: 0 }}
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
                          style={{ marginBottom: 0 }}
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
                inventories={inventories} 
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
                <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', marginBottom: 0 }}>
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
                        style={{ marginBottom: 0 }}
                        placeholder="Ex: Processamento Consolidação Junho"
                        value={newProcessName}
                        onChange={e => setNewProcessName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="input-label">Modo de Consolidação de Área</label>
                      <select 
                        className="input-field" 
                        style={{ marginBottom: 0 }}
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
                        style={{ marginBottom: 0 }}
                        placeholder="Ex: 0.90"
                        value={newProcessFatorCasca}
                        onChange={e => setNewProcessFatorCasca(e.target.value)}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Utilizado para deduzir o diâmetro sem casca: DAPsc = DAPcc * k
                      </span>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                      onClick={() => setShowNewProcessModal(false)}
                    >
                      Cancelar
                    </button>
                    <button 
                      className="btn btn-primary"
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
                <div className="glass-card printable-report" style={{ width: '100%', maxWidth: '900px', marginTop: '30px', marginBottom: '30px', padding: '32px' }}>
                  
                  {/* Header com botões - Ocultado na Impressão via CSS */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }} className="no-print">
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold' }}>Relatório Oficial Consolidado</span>
                      <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: '2px 0 0 0' }}>{selectedReportProcessing.nomeProcessamento}</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ width: 'auto', padding: '8px 16px', fontSize: '11px', height: '36px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => window.print()}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Imprimir / PDF
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ width: 'auto', padding: '8px 16px', fontSize: '11px', height: '36px', borderColor: '#4caf50', color: '#4caf50', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleExportAdvancedXLSX(selectedReportProcessing)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Planilha XLSX
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ width: 'auto', padding: '8px 16px', fontSize: '11px', height: '36px' }}
                        onClick={() => setSelectedReportProcessing(null)}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>

                  {/* CONTEÚDO DO RELATÓRIO */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    
                    {/* CABEÇALHO DA PÁGINA (Aparece na impressão) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary-hover)' }}>LeafTag - Relatório de Inventário</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                          Projeto de Campo: <strong>{activeFw?.nome}</strong> ({activeFw?.local || 'Local não especificado'})
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Data Processamento: <strong>{selectedReportProcessing.dataProcessamento}</strong></span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Responsável: <strong>{selectedReportProcessing.createdBy}</strong></span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Fator de Casca (k): <strong>{selectedReportProcessing.fatorCasca !== undefined ? selectedReportProcessing.fatorCasca.toFixed(2) : '1,00'}</strong></span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Modo Consolidação: <strong>{selectedReportProcessing.effectiveConsolidationMode === 'stratum' ? 'Estrato' : 'Talhão'}{selectedReportProcessing.consolidationMode === 'auto' ? ' (Automático)' : ''}</strong></span>
                      </div>
                    </div>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>

                    {/* 1. RESUMO EXECUTIVO DO TRABALHO */}
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                        1. Resumo Executivo
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                        <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume Total Estimado</span>
                          <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#00e676', marginTop: '4px' }}>{selectedReportProcessing.trabalho.volumeTotalEstimado.toLocaleString('pt-BR')} m³ <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>CC</span></h4>
                          <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#00b0ff', marginTop: '2px' }}>{(selectedReportProcessing.volumeTotalEstimadoSemCasca || selectedReportProcessing.trabalho.volumeTotalEstimadoSemCasca || 0).toLocaleString('pt-BR')} m³ <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>SC</span></h4>
                        </div>
                        <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume Médio por Hectare</span>
                          <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{selectedReportProcessing.trabalho.volumeMedioHa.toFixed(2)} m³/ha <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>CC</span></h4>
                          <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#00b0ff', marginTop: '2px' }}>{(selectedReportProcessing.volumeMedioHaSemCasca || selectedReportProcessing.trabalho.volumeMedioHaSemCasca || 0).toFixed(2)} m³/ha <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>SC</span></h4>
                        </div>
                        <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área Total Inventariada</span>
                          <h4 style={{ fontSize: '20px', fontWeight: '800', color: '#64b5f6', marginTop: '4px' }}>{selectedReportProcessing.trabalho.areaTotal} ha</h4>
                        </div>
                        <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área Total Amostrada</span>
                          <h4 style={{ fontSize: '20px', fontWeight: '800', color: '#ffb74d', marginTop: '4px' }}>{selectedReportProcessing.trabalho.areaAmostrada} ha</h4>
                        </div>
                        <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área Basal Média</span>
                          <h4 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{selectedReportProcessing.trabalho.areaBasalMediaHa.toFixed(3)} m²/ha</h4>
                        </div>
                        <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>DAP / Altura Média</span>
                          <h4 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{selectedReportProcessing.trabalho.dapMedio.toFixed(1)} cm / {selectedReportProcessing.trabalho.alturaMedia.toFixed(1)} m</h4>
                        </div>
                      </div>
                    </div>

                    {/* 2. METODOLOGIA E MODELOS MATEMÁTICOS */}
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                        2. Metodologia e Modelos Matemáticos
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Hipsometria */}
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold' }}>Relação Hipsométrica (Altura)</span>
                          <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginTop: '8px' }}>
                            {selectedReportProcessing.heightModelSnapshot ? selectedReportProcessing.heightModelSnapshot.nome : 'Alturas Medidas em Campo'}
                          </h4>
                          {selectedReportProcessing.heightModelSnapshot && (
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span>Tipo: <strong>{selectedReportProcessing.heightModelSnapshot.tipoModelo}</strong></span>
                              <span>Fórmula: <code>{selectedReportProcessing.heightModelSnapshot.formula}</code></span>
                              <span>Coeficientes: <br />
                                <code>B0: {selectedReportProcessing.heightModelSnapshot.coeficientes.beta0} | B1: {selectedReportProcessing.heightModelSnapshot.coeficientes.beta1}</code>
                              </span>
                              {selectedReportProcessing.heightModelSnapshot.fonteBibliografica && (
                                <span>Fonte: {selectedReportProcessing.heightModelSnapshot.fonteBibliografica}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Volumetria */}
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold' }}>Cálculo Volumétrico (Volume)</span>
                          <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginTop: '8px' }}>
                            {selectedReportProcessing.volumeModelSnapshot ? selectedReportProcessing.volumeModelSnapshot.nome : '-'}
                          </h4>
                          {selectedReportProcessing.volumeModelSnapshot && (
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span>Tipo: <strong>{selectedReportProcessing.volumeModelSnapshot.tipoModelo}</strong></span>
                              <span>Fórmula: <code>{selectedReportProcessing.volumeModelSnapshot.formula}</code></span>
                              <span>Coeficientes: <br />
                                <code>B0: {selectedReportProcessing.volumeModelSnapshot.coeficientes.beta0}
                                  {selectedReportProcessing.volumeModelSnapshot.coeficientes.beta1 !== undefined && ` | B1: ${selectedReportProcessing.volumeModelSnapshot.coeficientes.beta1}`}
                                  {selectedReportProcessing.volumeModelSnapshot.coeficientes.beta2 !== undefined && ` | B2: ${selectedReportProcessing.volumeModelSnapshot.coeficientes.beta2}`}
                                </code>
                              </span>
                              {selectedReportProcessing.volumeModelSnapshot.fonteBibliografica && (
                                <span>Fonte: {selectedReportProcessing.volumeModelSnapshot.fonteBibliografica}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 3. AUDITORIA E CONSISTÊNCIA DE DADOS */}
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                        3. Auditoria e Validação Técnica
                      </h3>
                      <div style={{ padding: '16px', background: 'rgba(239, 35, 60, 0.02)', border: '1px solid rgba(239, 35, 60, 0.15)', borderRadius: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                          <span style={{ fontSize: '13px' }}>Parcelas Ignoradas: <strong>{selectedReportProcessing.parcelasIgnoradas.length}</strong></span>
                          <span style={{ fontSize: '13px' }}>Árvores Ignoradas: <strong>{selectedReportProcessing.arvoresIgnoradas}</strong></span>
                          <span style={{ fontSize: '13px' }}>Árvores sem DAP: <strong>{selectedReportProcessing.arvoresSemDAP}</strong></span>
                          <span style={{ fontSize: '13px' }}>Árvores sem Altura: <strong>{selectedReportProcessing.arvoresSemAltura}</strong></span>
                          <span style={{ fontSize: '13px' }}>Árvores sem Volume: <strong>{selectedReportProcessing.arvoresSemVolume}</strong></span>
                        </div>

                        {selectedReportProcessing.warnings.length > 0 && (
                          <div>
                            <span style={{ fontSize: '11px', color: '#ff5252', fontWeight: 'bold', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                              Inconsistências encontradas ({selectedReportProcessing.warnings.length})
                            </span>
                            <div style={{ maxHeight: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                              {selectedReportProcessing.warnings.map((warn, i) => (
                                <div key={i} style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', gap: '6px' }}>
                                  <span>•</span> <span>{warn}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4. RESULTADOS POR TALHÃO */}
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                        4. Resultados Consolidados por Talhão
                      </h3>
                      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <th style={{ padding: '12px 16px', fontSize: '10px' }}>Talhão</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'center' }}>Área (ha)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'center' }}>Parc. Usadas</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'center' }}>Árv. Usadas</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol CC / ha (m³)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol SC / ha (m³)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Área Basal / ha (m²)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Densidade / ha</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol Total CC (m³)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol Total SC (m³)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedReportProcessing.talhoes.map(t => (
                              <tr key={t.talhaoId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{t.nome}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{t.areaTalhao.toFixed(2)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{t.parcelasUtilizadas}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{t.arvoresUtilizadas}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{t.volumeMedioHa.toFixed(2)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{(t.volumeMedioHaSemCasca || 0).toFixed(2)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{t.areaBasalMediaHa.toFixed(3)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{t.densidadeMediaHa.toFixed(0)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: '#81c784' }}>{t.volumeTotalEstimado.toLocaleString('pt-BR')}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: '#29b6f6' }}>{(t.volumeTotalEstimadoSemCasca || 0).toLocaleString('pt-BR')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 5. RESULTADOS POR ESTRATO */}
                    {selectedReportProcessing.strata.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                          5. Resultados Consolidados por Estrato
                        </h3>
                        <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <th style={{ padding: '12px 16px', fontSize: '10px' }}>Estrato</th>
                                <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'center' }}>Área (ha)</th>
                                <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'center' }}>Parc. Usadas</th>
                                <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'center' }}>Árv. Usadas</th>
                                <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol CC / ha (m³)</th>
                                <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol SC / ha (m³)</th>
                                <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Área Basal / ha (m²)</th>
                                <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Densidade / ha</th>
                                <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol Total CC (m³)</th>
                                <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol Total SC (m³)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedReportProcessing.strata.map(s => (
                                <tr key={s.stratumId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{s.nome}</td>
                                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>{s.areaEstrato.toFixed(2)}</td>
                                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>{s.parcelasUtilizadas}</td>
                                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>{s.arvoresUtilizadas}</td>
                                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{s.volumeMedioHa.toFixed(2)}</td>
                                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{(s.volumeMedioHaSemCasca || 0).toFixed(2)}</td>
                                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{s.areaBasalMediaHa.toFixed(3)}</td>
                                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{s.densidadeMediaHa.toFixed(0)}</td>
                                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: '#81c784' }}>{s.volumeTotalEstimado.toLocaleString('pt-BR')}</td>
                                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: '#29b6f6' }}>{(s.volumeTotalEstimadoSemCasca || 0).toLocaleString('pt-BR')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 6. RESULTADOS DETALHADOS POR PARCELA */}
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                        {selectedReportProcessing.strata.length > 0 ? '6. Detalhamento das Unidades Amostrais' : '5. Detalhamento das Unidades Amostrais'}
                      </h3>
                      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <th style={{ padding: '12px 16px', fontSize: '10px' }}>Parcela</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'center' }}>Área (m²)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'center' }}>Fator Expansão</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'center' }}>Árvores Medidas</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol CC Parcela (m³)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol SC Parcela (m³)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol CC / ha (m³)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Vol SC / ha (m³)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Área Basal / ha (m²)</th>
                              <th style={{ padding: '12px 16px', fontSize: '10px', textAlign: 'right' }}>Densidade / ha (árv)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedReportProcessing.parcelas.map(p => (
                              <tr key={p.parcelaId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{p.nome}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.areaParcela}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.fatorExpansao.toFixed(2)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.numeroArvores}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{p.volumeTotal.toFixed(4)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{(p.volumeTotalSemCasca || 0).toFixed(4)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold' }}>{p.volumePorHa.toFixed(2)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold' }}>{(p.volumePorHaSemCasca || 0).toFixed(2)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{p.areaBasalPorHa.toFixed(3)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{p.densidadePorHa.toFixed(0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
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
                    Exportar Excel da Parcela
                  </button>
                )}
              </div>

              {/* Processamento Profissional (Modelos Florestais) no Escritório */}
              {auditParcel.dados.length > 0 && (
                <div style={{ 
                  background: 'rgba(251, 192, 45, 0.03)', 
                  border: '1px solid rgba(251, 192, 45, 0.25)', 
                  boxShadow: '0 4px 24px rgba(251, 192, 45, 0.04)',
                  padding: '20px', 
                  borderRadius: '16px', 
                  marginBottom: '20px' 
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '800', color: '#ffd54f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Processamento Profissional (Modelos Florestais)
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 16px 0', flexWrap: 'wrap', gap: '8px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', lineHeight: '1.4', margin: 0, flex: 1 }}>
                      Estime alturas faltantes e volumes de fustes individuais utilizando equações cadastradas na sua biblioteca de modelos.
                    </p>
                    <button 
                      className="btn btn-secondary" 
                      style={{ fontSize: '12px', padding: '6px 12px', height: 'auto', width: 'auto', borderColor: '#ffd54f', color: '#ffd54f', background: 'transparent' }}
                      onClick={() => navigate('/modelos')}
                    >
                      Gerenciar Biblioteca
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    {/* Etapa 1: Hipsometria */}
                    <div>
                      <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px' }}>ETAPA 1: Selecionar Modelo Hipsométrico (Altura)</label>
                      <select
                        className="input-field"
                        style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px' }}
                        value={selectedHeightModelId}
                        onChange={e => setSelectedHeightModelId(e.target.value)}
                      >
                        <option value="none">Não utilizar modelo (ignorar estimativa)</option>
                        {heightModels.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.nome} ({m.especie} | {m.regiao})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Etapa 2: Volumetria */}
                    <div>
                      <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px' }}>ETAPA 2: Selecionar Modelo Volumétrico (Volume)</label>
                      <select
                        className="input-field"
                        style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px' }}
                        value={selectedVolumeModelId}
                        onChange={e => setSelectedVolumeModelId(e.target.value)}
                      >
                        <option value="legacy">Fator de Forma Comercial (Legacy)</option>
                        {volumeModels.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.nome} ({m.especie} | {m.regiao})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fator de forma se selecionado legacy */}
                    {selectedVolumeModelId === 'legacy' && (
                      <div>
                        <label className="input-label" style={{ fontSize: '11.5px' }}>Fator de Forma Comercial (Legacy) *</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px' }}
                          value={processingFatorForma}
                          onChange={e => setProcessingFatorForma(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      style={{ 
                        width: 'auto', 
                        padding: '10px 24px', 
                        fontSize: '13px', 
                        fontWeight: '800',
                        background: 'linear-gradient(135deg, #ffd54f 0%, #fbc02d 100%)', 
                        border: 'none',
                        color: '#000000',
                        borderRadius: '8px',
                        boxShadow: '0 4px 14px rgba(251, 192, 45, 0.2)'
                      }}
                      onClick={() => handleProcessParcelDataInOffice(auditParcel)}
                    >
                      Executar Processamento e Salvar na Parcela
                    </button>
                  </div>
                </div>
              )}

              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 18px', borderRadius: '12px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                <strong>Painel de Auditoria (Modo de Leitura)</strong>: Este espaço destina-se apenas à verificação e auditoria de consistência das árvores cadastradas em campo. Modificações ou exclusões acidentais estão bloqueadas no ambiente de escritório.
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
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>H. Calc. (m)</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vol (m³)</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Modelo</th>
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
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: ind.alturaMedidaOuEstimada === 'estimada' ? '#ffd54f' : '#81c784' }}>
                            {ind.alturaUtilizada !== undefined ? `${ind.alturaUtilizada.toFixed(2)} ${ind.alturaMedidaOuEstimada === 'estimada' ? '(E)' : '(M)'}` : '-'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#ffb74d' }}>
                            {ind.volumeCalculado !== undefined ? ind.volumeCalculado.toFixed(4) : '-'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {ind.modeloUtilizado || '-'}
                          </td>
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

      {/* Talhão Edit Modal */}
      {editingTalhao && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', margin: 0 }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary-hover)', fontWeight: '800' }}>Editar Talhão</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', marginBottom: '16px' }}>Edite as informações do talhão.</p>
            
            <input 
              className="input-field" 
              placeholder="Nome do Talhão" 
              value={editTalhaoName} 
              onChange={e => setEditTalhaoName(e.target.value)} 
              style={{ marginTop: '8px' }} 
            />
            <input 
              type="number" 
              step="0.01" 
              className="input-field" 
              placeholder="Área em Hectares (Ex: 10.5)" 
              value={editTalhaoArea} 
              onChange={e => setEditTalhaoArea(e.target.value)} 
            />
            <textarea 
              className="input-field" 
              placeholder="Observações do talhão (Opcional)" 
              value={editTalhaoObs} 
              onChange={e => setEditTalhaoObs(e.target.value)} 
              style={{ minHeight: '80px', fontFamily: 'inherit' }} 
            />
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => {
                setEditingTalhao(null);
                setEditTalhaoName('');
                setEditTalhaoArea('');
                setEditTalhaoObs('');
              }}>Cancelar</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!editTalhaoName.trim()) return alert('Por favor, dê um nome ao talhão.');
                
                await createTalhao({
                  ...editingTalhao,
                  nome: editTalhaoName.trim(),
                  area: editTalhaoArea ? parseFloat(editTalhaoArea) : undefined,
                  observacoes: editTalhaoObs.trim()
                });

                setEditingTalhao(null);
                setEditTalhaoName('');
                setEditTalhaoArea('');
                setEditTalhaoObs('');
              }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Process Modal */}
      {showBatchProcessModal && activeFw && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', margin: 0, maxHeight: '95vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#ffd54f', fontWeight: '800' }}>Processamento em Lote</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '6px', marginBottom: '20px', lineHeight: '1.4' }}>
              Execute o processamento matemático em lote para estimar as alturas faltantes e os volumes de fustes em várias parcelas simultaneamente.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {/* Escopo de Processamento */}
              <div>
                <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>Escopo do Processamento</label>
                <select
                  className="input-field"
                  style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px' }}
                  value={batchScope}
                  onChange={e => {
                    const val = e.target.value as 'total' | 'talhao' | 'parcela';
                    setBatchScope(val);
                    setBatchTalhaoId('');
                    setBatchParcelId(null);
                  }}
                >
                  <option value="total">Trabalho Completo (Todas as Parcelas)</option>
                  <option value="talhao">Por Talhão</option>
                  <option value="parcela">Por Parcela</option>
                </select>
              </div>

              {/* Se o escopo for talhao, escolhe o talhao */}
              {batchScope === 'talhao' && (
                <div>
                  <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>Selecionar Talhão</label>
                  <select
                    className="input-field"
                    style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px' }}
                    value={batchTalhaoId}
                    onChange={e => setBatchTalhaoId(e.target.value)}
                  >
                    <option value="">Selecione um talhão...</option>
                    {activeTalhoes.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Se o escopo for parcela, escolhe a parcela */}
              {batchScope === 'parcela' && (
                <div>
                  <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>Selecionar Parcela</label>
                  <select
                    className="input-field"
                    style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px' }}
                    value={batchParcelId || ''}
                    onChange={e => setBatchParcelId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Selecione uma parcela...</option>
                    {activeParcels.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Modelo Hipsométrico */}
              <div>
                <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>ETAPA 1: Selecionar Modelo Hipsométrico (Altura)</label>
                <select
                  className="input-field"
                  style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px' }}
                  value={selectedHeightModelId}
                  onChange={e => setSelectedHeightModelId(e.target.value)}
                >
                  <option value="none">Não utilizar modelo (ignorar estimativa)</option>
                  {heightModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.especie} | {m.regiao})
                    </option>
                  ))}
                </select>
              </div>

              {/* Modelo Volumétrico */}
              <div>
                <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>ETAPA 2: Selecionar Modelo Volumétrico (Volume)</label>
                <select
                  className="input-field"
                  style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px' }}
                  value={selectedVolumeModelId}
                  onChange={e => setSelectedVolumeModelId(e.target.value)}
                >
                  <option value="legacy">Fator de Forma Comercial (Legacy)</option>
                  {volumeModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.especie} | {m.regiao})
                    </option>
                  ))}
                </select>
              </div>

              {/* Fator de Forma (se selecionado legacy) */}
              {selectedVolumeModelId === 'legacy' && (
                <div>
                  <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>Fator de Forma Comercial (Legacy) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px' }}
                    value={processingFatorForma}
                    onChange={e => setProcessingFatorForma(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                style={{ width: 'auto' }}
                onClick={() => {
                  setShowBatchProcessModal(false);
                }}
                disabled={isBatchProcessing}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                style={{ 
                  width: 'auto',
                  background: 'linear-gradient(135deg, #ffd54f 0%, #fbc02d 100%)', 
                  border: 'none',
                  color: '#000000',
                  fontWeight: '800',
                  boxShadow: '0 4px 14px rgba(251, 192, 45, 0.2)'
                }}
                onClick={handleBatchProcess}
                disabled={isBatchProcessing}
              >
                {isBatchProcessing ? 'Processando...' : 'Executar Processamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Integration Modal */}
      {showSheetsModal && activeFw && (
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
                    ...activeFw,
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

      {/* Embedded Sub-dashboards */}
      {showProjectDashboard && filteredParcelsList.length > 0 && (
        <StatisticalDashboard 
          inventories={filteredParcelsList} 
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

    {/* Modal de Configurações Unificado */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800', margin: 0 }}>Configurações</h3>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            {/* User Profile Info */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Conta</span>
              <span style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>{currentUser?.displayName || 'Escritório'}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>{currentUser?.email}</span>
            </div>

            {/* Theme Toggle Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold', display: 'block' }}>Tema do Aplicativo</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Alternar entre modo claro e escuro</span>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={toggleTheme}
                style={{ 
                  width: 'auto', 
                  padding: '6px 14px', 
                  fontSize: '11.5px', 
                  borderColor: theme === 'dark' ? '#ffb74d' : '#f57c00', 
                  color: theme === 'dark' ? '#ffb74d' : '#f57c00',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}
              >
                {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              </button>
            </div>

            {/* Action List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Minha Equipe (Only if owner or active) */}
              {currentUser && (
                <button 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}
                  onClick={() => {
                    setShowTeamModal(true);
                  }}
                >
                  <span>Minha Equipe</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{collaborators.length} membros</span>
                </button>
              )}

              {/* Modelos de Altura e Volume */}
              {currentUser && (
                <button 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderColor: '#a5d6a7', color: '#a5d6a7' }}
                  onClick={() => {
                    setShowSettingsModal(false);
                    navigate('/modelos');
                  }}
                >
                  <span>Modelos (Altura / Volume)</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>Gerenciar</span>
                </button>
              )}

              {/* Modo Campo Switch */}
              <button 
                className="btn btn-secondary" 
                style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', borderColor: '#00e676', color: '#00e676', background: 'rgba(0, 230, 118, 0.08)' }}
                onClick={() => {
                  localStorage.setItem('preferredMode', 'field');
                  navigate('/');
                }}
              >
                Ir para Modo Campo
              </button>

              {/* Painel Admin (If Admin) */}
              {status === 'admin' && (
                <button 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', borderColor: '#ffb74d', color: '#ffb74d' }}
                  onClick={() => {
                    navigate('/admin');
                  }}
                >
                  🛡️ Painel de Administrador
                </button>
              )}

            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                className="btn btn-danger" 
                style={{ flex: 1 }}
                onClick={() => {
                  signOut();
                  setShowSettingsModal(false);
                }}
              >
                Sair da Conta
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSettingsModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Team management modal inside office view */}
      {showTeamModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100001, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '460px', marginBottom: 0 }}>
              {isOwner ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800', margin: 0 }}>Minha Equipe</h3>
                    <button onClick={() => setShowTeamModal(false)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                    {status === 'admin' 
                      ? 'Adicione colaboradores pelo e-mail do Google. Eles terão acesso completo para visualizar, criar e coletar dados na sua mesma conta simultaneamente.'
                      : 'Adicione até 2 colaboradores pelo e-mail do Google. Eles terão acesso completo para visualizar, criar e coletar dados na sua mesma conta simultaneamente.'}
                  </p>

                  <div style={{ marginBottom: '20px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                      {status === 'admin' 
                        ? `Colaboradores Adicionados (${collaborators.length})`
                        : `Colaboradores Adicionados (${collaborators.length}/2)`}
                    </span>
                    {collaborators.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', margin: '4px 0' }}>
                        Nenhum colaborador adicionado ainda.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {collaborators.map(email => (
                          <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <span style={{ fontSize: '13.5px', color: '#fff' }}>{email}</span>
                            <button 
                              className="btn btn-danger" 
                              style={{ width: 'auto', padding: '4px 10px', fontSize: '10px', height: 'auto' }}
                              onClick={() => handleRemoveCollaborator(email)}
                              disabled={isTeamLoading}
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {(status === 'admin' || collaborators.length < 2) && (
                    <div style={{ marginBottom: '16px' }}>
                      <label className="input-label">Adicionar Colaborador (E-mail Google)</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <input 
                          type="email"
                          className="input-field" 
                          placeholder="Ex: joao.silva@gmail.com" 
                          value={newEmail} 
                          onChange={e => setNewEmail(e.target.value)} 
                          style={{ marginBottom: 0, flex: 1 }} 
                        />
                        <button 
                          className="btn btn-primary" 
                          style={{ width: 'auto', padding: '0 18px', height: '42px', fontSize: '12px' }}
                          onClick={handleAddCollaborator}
                          disabled={isTeamLoading}
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowTeamModal(false)}>Fechar</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800', margin: 0 }}>Gerenciamento de Equipe</h3>
                    <button onClick={() => setShowTeamModal(false)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
                  </div>
                  <div style={{ height: '3px', background: 'var(--primary-color)', width: '48px', marginBottom: '20px', borderRadius: '4px' }}></div>
                  <p style={{ color: '#fff', fontSize: '14.5px', fontWeight: 'bold', lineHeight: 1.5, marginBottom: '12px' }}>
                    Recurso Exclusivo para Contas Ativas
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5, marginBottom: '24px' }}>
                    A funcionalidade de adicionar e gerenciar colaboradores é exclusiva para o administrador principal da equipe (contas ativas).
                    <br/><br/>
                    Como colaborador, você já tem acesso total aos talhões e dados da sua equipe, mas não pode gerenciar outros colaboradores.
                    Se você deseja ativar uma conta própria para gerenciar sua equipe mestre, entre em contato conosco.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <a 
                      href="https://wa.me/5547920022746?text=Olá!%20Gostaria%20de%20ativar%20uma%20conta%20mestre%20no%20LeafTag%20para%20gerenciar%20minha%20própria%20equipe."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{ 
                        textDecoration: 'none', 
                        display: 'inline-flex', 
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: 'rgba(37, 211, 102, 0.15)', 
                        border: '1px solid rgba(37, 211, 102, 0.45)', 
                        color: '#25D366',
                        boxShadow: '0 4px 15px rgba(37, 211, 102, 0.1)',
                        fontWeight: 'bold',
                        padding: '12px 16px'
                      }}
                    >
                      Falar no WhatsApp
                    </a>
                    <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowTeamModal(false)}>Fechar</button>
                  </div>
                </>
              )}
            </div>
         </div>
      )}

      {/* Desktop Stem & Taper Visualizer Modal */}
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
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ color: '#ffffff', fontSize: '20px', fontWeight: '800', margin: 0 }}>
                    Árvore #{selectedVisualizerTree.numeroIndividuo}
                  </h3>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: 'rgba(0, 230, 118, 0.12)',
                    color: '#00e676',
                    textTransform: 'uppercase'
                  }}>
                    {selectedVisualizerTree.modoColeta}
                  </span>
                </div>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Sessão: {selectedVisualizerTree.sessionName}
                </span>
              </div>
              <button 
                onClick={() => setSelectedVisualizerTree(null)} 
                style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Three Column Side-by-Side Content */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '24px', alignItems: 'start' }}>
              
              {/* Left Column: Metrics & interactive reading */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* General KPI Card */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary-hover)', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '0.5px' }}>
                    Dados Fisiográficos & Volume
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Espécie</span>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', fontStyle: 'italic', marginTop: '2px' }}>{selectedVisualizerTree.especie || 'N/A'}</div>
                    </div>
                    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Altura Total</span>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '2px' }}>{selectedVisualizerTree.alturaTotal ? `${selectedVisualizerTree.alturaTotal.toFixed(2)} m` : 'N/A'}</div>
                    </div>
                    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Volume Com Casca</span>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#00e676', marginTop: '2px' }}>
                        {selectedVisualizerTree.volumeTotal ? `${selectedVisualizerTree.volumeTotal.toFixed(4)} m³` : '0,0000 m³'}
                      </div>
                    </div>
                    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Volume Sem Casca</span>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#00b0ff', marginTop: '2px' }}>
                        {selectedVisualizerTree.volumeTotalSemCasca ? `${selectedVisualizerTree.volumeTotalSemCasca.toFixed(4)} m³` : '0,0000 m³'}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Cálculo: <strong style={{ color: '#fff', textTransform: 'capitalize' }}>{selectedVisualizerTree.metodoCalculo}</strong></span>
                    <span>Status: <strong style={{ color: selectedVisualizerTree.status === 'Concluído' ? '#00e676' : '#ff9800' }}>{selectedVisualizerTree.status || 'N/A'}</strong></span>
                  </div>
                </div>

                {/* Detail card of selected point/section */}
                {selectedVisualizerTree.modoColeta === 'relativo' ? (
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0, 230, 118, 0.2)', minHeight: '140px' }}>
                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary-hover)', fontWeight: 'bold', marginBottom: '8px' }}>
                      Ponto Selecionado: {selectedVisualizerPoint}
                    </h4>
                    {selectedVisualizerTree.dadosRelativos?.[selectedVisualizerPoint] ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Diâmetro:</span>
                          <strong style={{ color: '#fff' }}>{selectedVisualizerTree.dadosRelativos[selectedVisualizerPoint]} cm</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Espessura Casca:</span>
                          <strong style={{ color: '#00b0ff' }}>
                            {selectedVisualizerTree.cascaRelativos?.[selectedVisualizerPoint] 
                              ? `${selectedVisualizerTree.cascaRelativos[selectedVisualizerPoint]} mm` 
                              : 'Não informada'}
                          </strong>
                        </div>
                        {selectedVisualizerTree.alturaTotal && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Altura do Ponto:</span>
                            <strong style={{ color: '#fff' }}>
                              {(selectedVisualizerPoint === 'Base' ? 0.3 : 
                                selectedVisualizerPoint === 'Topo' ? selectedVisualizerTree.alturaTotal : 
                                selectedVisualizerPoint === '10%' ? selectedVisualizerTree.alturaTotal * 0.1 : 
                                selectedVisualizerPoint === '20%' ? selectedVisualizerTree.alturaTotal * 0.2 : 
                                selectedVisualizerPoint === '30%' ? selectedVisualizerTree.alturaTotal * 0.3 : 
                                selectedVisualizerPoint === '40%' ? selectedVisualizerTree.alturaTotal * 0.4 : 
                                selectedVisualizerPoint === '50%' ? selectedVisualizerTree.alturaTotal * 0.5 : 
                                selectedVisualizerPoint === '60%' ? selectedVisualizerTree.alturaTotal * 0.6 : 
                                selectedVisualizerPoint === '70%' ? selectedVisualizerTree.alturaTotal * 0.7 : 
                                selectedVisualizerPoint === '80%' ? selectedVisualizerTree.alturaTotal * 0.8 : 
                                selectedVisualizerPoint === '90%' ? selectedVisualizerTree.alturaTotal * 0.9 : 0.3).toFixed(2)} m
                            </strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic', margin: '12px 0 0 0' }}>
                        Sem dados medidos neste ponto.
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0, 230, 118, 0.2)', minHeight: '140px' }}>
                    {(() => {
                      const currentSecIdx = (selectedVisualizerTree.secoes || []).findIndex((s: any) => s.id === selectedVisualizerSectionId);
                      const currentSec = (selectedVisualizerTree.secoes || [])[currentSecIdx];
                      return currentSec ? (
                        <>
                          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary-hover)', fontWeight: 'bold', marginBottom: '8px' }}>
                            Seção Selecionada: S{currentSecIdx + 1}
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', marginTop: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Comprimento:</span>
                              <strong>{currentSec.comprimento} m</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Diâmetro Inicial:</span>
                              <strong>{currentSec.dInicial ? `${currentSec.dInicial} cm` : '-'}</strong>
                            </div>
                            {currentSec.dMedio && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Diâmetro Médio:</span>
                                <strong>{currentSec.dMedio} cm</strong>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Diâmetro Final:</span>
                              <strong>{currentSec.dFinal ? `${currentSec.dFinal} cm` : '-'}</strong>
                            </div>
                            {(currentSec.eInicial || currentSec.eMedio || currentSec.eFinal) && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Casca (Ini/Med/Fin):</span>
                                <strong style={{ color: '#00b0ff' }}>
                                  {currentSec.eInicial || '0'} / {currentSec.eMedio || '0'} / {currentSec.eFinal || '0'} mm
                                </strong>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px', marginTop: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Volume Secional CC:</span>
                              <strong style={{ color: '#00e676' }}>{(currentSec.volume || 0).toFixed(4)} m³</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Volume Secional SC:</span>
                              <strong style={{ color: '#00b0ff' }}>{(currentSec.volumeSemCasca || 0).toFixed(4)} m³</strong>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic', margin: '12px 0 0 0' }}>
                          Clique em uma seção no desenho do tronco para ver os detalhes seccionais.
                        </p>
                      );
                    })()}
                  </div>
                )}
                
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                  {selectedVisualizerTree.modoColeta === 'relativo' 
                    ? 'Use os pontos do tronco para navegar e ver detalhes.' 
                    : 'Clique nas seções empilhadas para inspecionar os diâmetros.'
                  }
                </span>

              </div>

              {/* Middle Column: SVG Stem drawing */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--primary-hover)', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '0.5px' }}>
                  Esquema Tridimensional do Fuste
                </h4>
                {renderTrunkVisualizerSvg(selectedVisualizerTree)}
              </div>

              {/* Right Column: Taper graph plot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {renderTaperVisualizerGraph(selectedVisualizerTree)}
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', marginTop: '8px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ width: 'auto', padding: '10px 24px' }} 
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
           <div className="glass-card" style={{ width: '100%', maxWidth: '400px', background: '#141c18', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary-hover)', fontWeight: '800' }}>Editar Trabalho</h3>
              <input className="input-field" placeholder="Nome (Ex: Inventário 2026)" value={editName} onChange={e => setEditName(e.target.value)} style={{ marginTop: '16px' }} />
              <input className="input-field" placeholder="Local / Fazenda" value={editLocal} onChange={e => setEditLocal(e.target.value)} />
              <input type="date" className="input-field" value={editDate} onChange={e => setEditDate(e.target.value)} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setEditingFw(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleUpdateFw}>Salvar</button>
              </div>
           </div>
        </div>
      )}

      {/* COLETA MODAL: LISTA DE PARCELAS */}
      {showColetaModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '800px', background: '#0e1511', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', borderRadius: '24px', padding: '28px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
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
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', height: '30px' }}
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
              <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => setShowColetaModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* RELATÓRIO MODAL: EXPORTAÇÃO E DOWNLOADS */}
      {showRelatorioModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '550px', background: '#0e1511', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', borderRadius: '24px', padding: '28px' }}>
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
                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
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
                    style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                    onClick={() => {
                      handleExportAdvancedXLSX(latestOfficialProcessing);
                      localStorage.setItem(`report_generated_${activeFwId}`, 'true');
                      setReportGenerated(true);
                      setShowRelatorioModal(false);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Exportar Planilha Avançada Consolidada
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                    onClick={() => {
                      handleExportAllProcessed();
                      localStorage.setItem(`report_generated_${activeFwId}`, 'true');
                      setReportGenerated(true);
                      setShowRelatorioModal(false);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Exportar Processamento Geral (XLSX)
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
                    onClick={() => {
                      if (activeFw) {
                        handleExportFieldWork(activeFw);
                        localStorage.setItem(`report_generated_${activeFwId}`, 'true');
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
                <div style={{ padding: '24px', background: 'rgba(239, 35, 60, 0.08)', border: '1px solid rgba(239, 35, 60, 0.2)', borderRadius: '16px', color: '#ff4d6d' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  <h4 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 6px 0' }}>Processamento Oficial Pendente</h4>
                  <p style={{ fontSize: '12.5px', margin: 0, opacity: 0.85, lineHeight: '1.4' }}>
                    Não existe nenhum processamento oficial salvo para este projeto. O relatório avançado consolidado exige a oficialização prévia.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowRelatorioModal(false)}>Fechar</button>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 1 }} 
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
                <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => setShowRelatorioModal(false)}>Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
