import React, { useState, useMemo, useRef } from 'react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import html2canvas from 'html2canvas';
import type { Inventory, IndividualData } from '../types';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { calculateShannonIndex, calculateSimpsonIndex, calculatePielouIndex, calculateBasalArea, calculateVolume } from '../utils/forestryCalculations';

const getContrastColor = (baseColor: string, isLight: boolean) => {
  if (!isLight) return baseColor;
  switch (baseColor) {
    case '#4fc3f7': return '#0284c7'; // Sky-600
    case '#aed581': return '#16a34a'; // Green-600
    case '#ba68c8': return '#9333ea'; // Purple-600
    case '#e57373': return '#dc2626'; // Red-600
    case '#ffb74d': return '#d97706'; // Amber-600
    case '#ff8a65': return '#ea580c'; // Orange-600
    case '#26a69a': return '#0d9488'; // Teal-600
    case '#78909c': return '#475569'; // Slate-600
    default: return baseColor;
  }
};

interface DashboardProps {
  inventories: Inventory[];
  onClose: () => void;
}

// Custom Glassmorphic Tooltip Component for Premium Analytics
const CustomTooltip = ({ active, payload, label, isLight }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(5, 13, 8, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.08)',
        padding: '12px 16px',
        borderRadius: '12px',
        boxShadow: isLight ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 8px 32px rgba(0, 0, 0, 0.5)'
      }}>
        <p style={{ margin: 0, fontSize: '11px', color: isLight ? '#64748b' : 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
        <p style={{ margin: '6px 0 0', fontSize: '14.5px', color: isLight ? '#16a34a' : 'var(--primary-hover)', fontWeight: '800' }}>
          {payload[0].name}: <span style={{ color: isLight ? '#0f172a' : '#fff', fontWeight: 'bold' }}>{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const StatisticalDashboard: React.FC<DashboardProps> = ({ inventories, onClose }) => {
  const { talhoes, strata } = useInventory();
  const { theme } = useAuth();
  const isLight = theme === 'light';
  const [classInterval, setClassInterval] = useState<number>(10);
  const [alturaInterval, setAlturaInterval] = useState<number>(5);
  const [fatorForma, setFatorForma] = useState<number>(0.7);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [viewType, setViewType] = useState<'trabalho' | 'talhao' | 'estrato' | 'parcela' | 'especie'>('trabalho');
  
  // Sorting states
  const [talhaoSortField, setTalhaoSortField] = useState<string>('volumeHa');
  const [talhaoSortDirection, setTalhaoSortDirection] = useState<'asc' | 'desc'>('desc');
  const [estratoSortField, setEstratoSortField] = useState<string>('volumeHa');
  const [estratoSortDirection, setEstratoSortDirection] = useState<'asc' | 'desc'>('desc');
  const [parcelaSortField, setParcelaSortField] = useState<string>('nome');
  const [parcelaSortDirection, setParcelaSortDirection] = useState<'asc' | 'desc'>('asc');
  const [speciesSortField, setSpeciesSortField] = useState<string>('volume');
  const [speciesSortDirection, setSpeciesSortDirection] = useState<'asc' | 'desc'>('desc');

  const renderSortableHeader = (
    field: string,
    label: string,
    currentField: string,
    currentDir: 'asc' | 'desc',
    setField: (f: string) => void,
    setDir: (d: 'asc' | 'desc') => void,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    const isSorted = currentField === field;
    const arrow = isSorted ? (currentDir === 'desc' ? ' ▼' : ' ▲') : '';
    
    return (
      <th 
        style={{ 
          padding: '12px 8px', 
          fontSize: '11px', 
          color: isSorted ? 'var(--primary-hover)' : 'var(--text-muted)', 
          textTransform: 'uppercase', 
          cursor: 'pointer',
          userSelect: 'none',
          textAlign: align
        }}
        onClick={() => {
          if (isSorted) {
            setDir(currentDir === 'desc' ? 'asc' : 'desc');
          } else {
            setField(field);
            setDir('desc');
          }
        }}
      >
        {label}{arrow}
      </th>
    );
  };

  const hasUnprocessedParcels = useMemo(() => {
    return inventories.some(inv => {
      return inv.dados && inv.dados.length > 0 && !inv.dados.some(t => t.volumeCalculado !== undefined);
    });
  }, [inventories]);

  const getIndividualStemsData = (ind: any, fallbackHt: number, formFactor: number) => {
    const stemsList: { dap: number; cap: number; ht: number; basalArea: number; volume: number; isProcessed: boolean }[] = [];
    const isIndProcessed = ind.volumeCalculado !== undefined;
    const htVal = isIndProcessed ? ind.alturaUtilizada : (ind.ht ? parseFloat(ind.ht.toString()) : 0);
    const actualHt = (htVal && !isNaN(htVal) && htVal > 0) ? htVal : fallbackHt;

    const processCapDap = (capVal?: any, dapVal?: any) => {
       let d = 0;
       if (dapVal) d = parseFloat(dapVal.toString());
       else if (capVal) d = parseFloat(capVal.toString()) / Math.PI;
       return isNaN(d) ? 0 : d;
    };

    if (ind.multipleStems && ind.stems && Array.isArray(ind.stems)) {
      ind.stems.forEach((s: any) => {
        const stemDap = processCapDap(s.cap, undefined);
        const stemHt = s.alturaProcessada !== undefined ? s.alturaProcessada : parseFloat((s.altura||'0').toString());
        const finalHt = stemHt > 0 ? stemHt : actualHt;
        const g = calculateBasalArea(stemDap, true);
        let v = 0;
        if (s.volumeProcessado !== undefined) {
          v = s.volumeProcessado;
        } else {
          v = calculateVolume(g, finalHt, formFactor);
        }
        if (stemDap > 0) {
          stemsList.push({
            dap: stemDap,
            cap: s.cap ? parseFloat(s.cap.toString()) : stemDap * Math.PI,
            ht: finalHt,
            basalArea: g,
            volume: v,
            isProcessed: s.volumeProcessado !== undefined || isIndProcessed
          });
        }
      });
    } else {
      const mainDap = processCapDap(ind.cap, ind.dap);
      const finalHt = actualHt;
      if (mainDap > 0) {
        const g = calculateBasalArea(mainDap, true);
        let v = 0;
        if (isIndProcessed) {
          v = ind.volumeCalculado;
        } else {
          v = calculateVolume(g, finalHt, formFactor);
        }
        stemsList.push({
          dap: mainDap,
          cap: ind.cap ? parseFloat(ind.cap.toString()) : mainDap * Math.PI,
          ht: finalHt,
          basalArea: g,
          volume: v,
          isProcessed: isIndProcessed
        });
      }
    }
    return stemsList;
  };

  // 1. Grouping by Talhão
  const talhoesStats = useMemo(() => {
    const talhaoIdsInInventories = Array.from(new Set(inventories.map(inv => inv.talhaoId)));
    
    return talhaoIdsInInventories.map(talhaoId => {
      const tObj = talhoes.find(t => t.id === talhaoId) || { id: talhaoId || 'sem-talhao', nome: 'Sem Talhão', area: 0 };
      const talParcels = inventories.filter(inv => inv.talhaoId === talhaoId);
      const numParcelas = talParcels.length;
      const areaAmostrada = talParcels.reduce((acc, p) => acc + (p.areaParcela || 0), 0) / 10000;
      const areaTotal = tObj.area || 0;

      let totalVolume = 0;
      let totalBasalArea = 0;
      let totalFustes = 0;
      let sumDap = 0;
      let sumHt = 0;
      let totalTrees = 0;

      const spCount: Record<string, number> = {};

      talParcels.forEach(p => {
        totalTrees += p.dados.length;
        p.dados.forEach(ind => {
          const spName = (ind.nomePopular || ind.nomeCientifico || 'Não Identificada').trim() || 'Não Identificada';
          spCount[spName] = (spCount[spName] || 0) + 1;

          const fallbackHt = parseFloat((ind.ht||'0').toString());
          const stems = getIndividualStemsData(ind, fallbackHt, fatorForma);
          stems.forEach(stem => {
            totalFustes++;
            totalVolume += stem.volume;
            totalBasalArea += stem.basalArea;
            sumDap += stem.dap;
            sumHt += stem.ht;
          });
        });
      });

      const volumeHa = areaAmostrada > 0 ? totalVolume / areaAmostrada : 0;
      const basalAreaHa = areaAmostrada > 0 ? totalBasalArea / areaAmostrada : 0;
      const densidadeHa = areaAmostrada > 0 ? totalFustes / areaAmostrada : 0;
      const dapMedio = totalFustes > 0 ? sumDap / totalFustes : 0;
      const alturaMedia = totalFustes > 0 ? sumHt / totalFustes : 0;
      const volumeTotalEst = volumeHa * areaTotal;

      const shannon = calculateShannonIndex(spCount);
      const simpson = calculateSimpsonIndex(spCount);
      const speciesCount = Object.keys(spCount).length;
      const pielou = calculatePielouIndex(shannon, speciesCount);

      return {
        id: tObj.id,
        nome: tObj.nome,
        numParcelas,
        numArvores: totalTrees,
        areaAmostrada,
        areaTotal,
        volumeAmostrado: totalVolume,
        volumeHa,
        volumeTotalEst,
        basalAreaHa,
        densidadeHa,
        dapMedio,
        alturaMedia,
        shannon,
        simpson,
        pielou,
        speciesCount
      };
    });
  }, [inventories, talhoes, fatorForma]);

  // 2. Grouping by Estrato
  const strataStats = useMemo(() => {
    const stratumIdsInInventories = Array.from(new Set(inventories.map(inv => inv.stratumId)));
    
    return stratumIdsInInventories.map(stratumId => {
      const sObj = strata.find(s => s.id === stratumId) || { id: stratumId || 'sem-estrato', nome: 'Sem Estrato', area: 0 };
      const stratParcels = inventories.filter(inv => inv.stratumId === stratumId);
      const numParcelas = stratParcels.length;
      const areaAmostrada = stratParcels.reduce((acc, p) => acc + (p.areaParcela || 0), 0) / 10000;
      const areaTotal = sObj.area || 0;

      let totalVolume = 0;
      let totalBasalArea = 0;
      let totalFustes = 0;
      let sumDap = 0;
      let sumHt = 0;
      let totalTrees = 0;

      stratParcels.forEach(p => {
        totalTrees += p.dados.length;
        p.dados.forEach(ind => {
          const fallbackHt = parseFloat((ind.ht||'0').toString());
          const stems = getIndividualStemsData(ind, fallbackHt, fatorForma);
          stems.forEach(stem => {
            totalFustes++;
            totalVolume += stem.volume;
            totalBasalArea += stem.basalArea;
            sumDap += stem.dap;
            sumHt += stem.ht;
          });
        });
      });

      const volumeHa = areaAmostrada > 0 ? totalVolume / areaAmostrada : 0;
      const basalAreaHa = areaAmostrada > 0 ? totalBasalArea / areaAmostrada : 0;
      const densidadeHa = areaAmostrada > 0 ? totalFustes / areaAmostrada : 0;
      const dapMedio = totalFustes > 0 ? sumDap / totalFustes : 0;
      const alturaMedia = totalFustes > 0 ? sumHt / totalFustes : 0;
      const volumeTotalEst = volumeHa * areaTotal;

      return {
        id: sObj.id,
        nome: sObj.nome,
        numParcelas,
        numArvores: totalTrees,
        areaAmostrada,
        areaTotal,
        volumeAmostrado: totalVolume,
        volumeHa,
        volumeTotalEst,
        basalAreaHa,
        densidadeHa,
        dapMedio,
        alturaMedia
      };
    });
  }, [inventories, strata, fatorForma]);

  // 3. Stats by Parcela
  const parcelasStats = useMemo(() => {
    return inventories.map(p => {
      const areaParcela = p.areaParcela || 0;
      const areaParcelaHa = areaParcela / 10000;
      const numArvores = p.dados.length;

      let totalVolume = 0;
      let totalBasalArea = 0;
      let totalFustes = 0;
      let sumDap = 0;
      let sumHt = 0;

      p.dados.forEach(ind => {
        const fallbackHt = parseFloat((ind.ht||'0').toString());
        const stems = getIndividualStemsData(ind, fallbackHt, fatorForma);
        stems.forEach(stem => {
          totalFustes++;
          totalVolume += stem.volume;
          totalBasalArea += stem.basalArea;
          sumDap += stem.dap;
          sumHt += stem.ht;
        });
      });

      const volumeHa = areaParcelaHa > 0 ? totalVolume / areaParcelaHa : 0;
      const basalAreaHa = areaParcelaHa > 0 ? totalBasalArea / areaParcelaHa : 0;
      const densidadeHa = areaParcelaHa > 0 ? totalFustes / areaParcelaHa : 0;
      const dapMedio = totalFustes > 0 ? sumDap / totalFustes : 0;
      const alturaMedia = totalFustes > 0 ? sumHt / totalFustes : 0;

      return {
        id: p.id,
        nome: p.nome,
        numArvores,
        areaParcela,
        areaParcelaHa,
        volumeTotal: totalVolume,
        volumeHa,
        basalAreaHa,
        densidadeHa,
        dapMedio,
        alturaMedia
      };
    });
  }, [inventories, fatorForma]);

  // 4. Grouping by Espécie
  const especiesStats = useMemo(() => {
    const spStatsMap: Record<string, {
      nome: string;
      numIndividuos: number;
      volumeTotal: number;
      basalAreaTotal: number;
      numFustes: number;
      parcelsContaining: Set<string | number>;
    }> = {};

    let grandTotalVolume = 0;
    let grandTotalBasalArea = 0;

    inventories.forEach(p => {
      p.dados.forEach(ind => {
        const spName = (ind.nomePopular || ind.nomeCientifico || 'Não Identificada').trim() || 'Não Identificada';
        
        if (!spStatsMap[spName]) {
          spStatsMap[spName] = {
            nome: spName,
            numIndividuos: 0,
            volumeTotal: 0,
            basalAreaTotal: 0,
            numFustes: 0,
            parcelsContaining: new Set<string | number>()
          };
        }

        spStatsMap[spName].numIndividuos++;
        spStatsMap[spName].parcelsContaining.add(p.id);

        const fallbackHt = parseFloat((ind.ht||'0').toString());
        const stems = getIndividualStemsData(ind, fallbackHt, fatorForma);
        stems.forEach(stem => {
          spStatsMap[spName].numFustes++;
          spStatsMap[spName].volumeTotal += stem.volume;
          spStatsMap[spName].basalAreaTotal += stem.basalArea;

          grandTotalVolume += stem.volume;
          grandTotalBasalArea += stem.basalArea;
        });
      });
    });

    const totalSampleAreaHa = inventories.reduce((acc, p) => acc + (p.areaParcela || 0), 0) / 10000;
    const totalParcels = inventories.length;

    const speciesListRaw = Object.values(spStatsMap).map(sp => {
      const freqAbsoluta = (sp.parcelsContaining.size / totalParcels) * 100;
      return {
        ...sp,
        freqAbsoluta
      };
    });

    const sumFreqAbsolutas = speciesListRaw.reduce((acc, sp) => acc + sp.freqAbsoluta, 0);

    const speciesList = speciesListRaw.map(sp => {
      const volumeHa = totalSampleAreaHa > 0 ? sp.volumeTotal / totalSampleAreaHa : 0;
      const frequenciaRelativa = sumFreqAbsolutas > 0 ? (sp.freqAbsoluta / sumFreqAbsolutas) * 100 : 0;
      const dominanciaRelativa = grandTotalBasalArea > 0 ? (sp.basalAreaTotal / grandTotalBasalArea) * 100 : 0;
      const participacaoVolume = grandTotalVolume > 0 ? (sp.volumeTotal / grandTotalVolume) * 100 : 0;

      return {
        nome: sp.nome,
        numIndividuos: sp.numIndividuos,
        volumeTotal: sp.volumeTotal,
        volumeHa,
        basalArea: sp.basalAreaTotal,
        frequenciaRelativa,
        dominanciaRelativa,
        participacaoVolume
      };
    });

    return {
      speciesList,
      grandTotalVolume,
      grandTotalBasalArea
    };
  }, [inventories, fatorForma]);

  // Sorted list selectors
  const sortedTalhoes = useMemo(() => {
    let sorted = [...talhoesStats];
    sorted.sort((a: any, b: any) => {
      let aVal = a[talhaoSortField];
      let bVal = b[talhaoSortField];
      if (typeof aVal === 'string') {
        return talhaoSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return talhaoSortDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
    return sorted;
  }, [talhoesStats, talhaoSortField, talhaoSortDirection]);

  const sortedStrata = useMemo(() => {
    let sorted = [...strataStats];
    sorted.sort((a: any, b: any) => {
      let aVal = a[estratoSortField];
      let bVal = b[estratoSortField];
      if (typeof aVal === 'string') {
        return estratoSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return estratoSortDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
    return sorted;
  }, [strataStats, estratoSortField, estratoSortDirection]);

  const sortedParcelas = useMemo(() => {
    let sorted = [...parcelasStats];
    sorted.sort((a: any, b: any) => {
      let aVal = a[parcelaSortField];
      let bVal = b[parcelaSortField];
      if (typeof aVal === 'string') {
        return parcelaSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return parcelaSortDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
    return sorted;
  }, [parcelasStats, parcelaSortField, parcelaSortDirection]);

  const sortedEspecies = useMemo(() => {
    let sorted = [...especiesStats.speciesList];
    sorted.sort((a: any, b: any) => {
      let aVal: any = a[speciesSortField];
      let bVal: any = b[speciesSortField];
      
      if (speciesSortField === 'volume') {
        aVal = a.volumeTotal;
        bVal = b.volumeTotal;
      } else if (speciesSortField === 'individuos') {
        aVal = a.numIndividuos;
        bVal = b.numIndividuos;
      } else if (speciesSortField === 'areaBasal') {
        aVal = a.basalArea;
        bVal = b.basalArea;
      } else if (speciesSortField === 'frequencia') {
        aVal = a.frequenciaRelativa;
        bVal = b.frequenciaRelativa;
      } else if (speciesSortField === 'dominancia') {
        aVal = a.dominanciaRelativa;
        bVal = b.dominanciaRelativa;
      } else if (speciesSortField === 'participacao') {
        aVal = a.participacaoVolume;
        bVal = b.participacaoVolume;
      }

      if (typeof aVal === 'string') {
        return speciesSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return speciesSortDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
    return sorted;
  }, [especiesStats.speciesList, speciesSortField, speciesSortDirection]);

  // Aggregation Logic (100% matched and preserved)
  const stats = useMemo(() => {
    let allInd: IndividualData[] = [];
    inventories.forEach(inv => {
      allInd = allInd.concat(inv.dados);
    });

    const spCount: Record<string, number> = {};
    const spDiscoveredSet = new Set<string>();
    
    // Accumulation array for Collector's Curve
    const collectorCurveData: { ind: number, speciesCount: number }[] = [];

    const distDiametric: Record<string, number> = {};
    const distBasal: Record<string, number> = {};
    const distVolume: Record<string, number> = {};
    const distAltura: Record<string, number> = {};

    let totalG = 0;
    let totalV = 0;
    let totalFustes = 0;

    // Detect if trees are already processed by professional models
    const firstProcessedTree = allInd.find(t => t.volumeCalculado !== undefined);
    const isProcessed = !!firstProcessedTree;

    let hModelName = 'Não Utilizado';
    let vModelName = 'Fator de Forma (Legacy)';
    let measuredHtCount = 0;
    let estimatedHtCount = 0;

    if (isProcessed) {
      const modelDesc = firstProcessedTree?.modeloUtilizado || '';
      if (modelDesc) {
        const parts = modelDesc.split(' | ');
        if (parts[0]) hModelName = parts[0].replace('Hipsometria: ', '');
        if (parts[1]) vModelName = parts[1].replace('Volume: ', '');
      }

      allInd.forEach(ind => {
        if (ind.alturaMedidaOuEstimada === 'medida') {
          measuredHtCount++;
        } else if (ind.alturaMedidaOuEstimada === 'estimada') {
          estimatedHtCount++;
        }
      });
    }

    // Helper process CAP/DAP logic
    const processCapDap = (capVal?: any, dapVal?: any) => {
       let d = 0;
       if (dapVal) d = parseFloat(dapVal.toString());
       else if (capVal) d = parseFloat(capVal.toString()) / Math.PI;
       return isNaN(d) ? 0 : d;
     };

    allInd.forEach((ind, globalIndex) => {
      // Species
      const spName = (ind.nomePopular || ind.nomeCientifico || 'Não Identificada').trim() || 'Não Identificada';
      spCount[spName] = (spCount[spName] || 0) + 1;
      spDiscoveredSet.add(spName);
      
      // Every 5 individuals, push to the collector's curve to optimize rendering
      if (globalIndex === 0 || globalIndex % 5 === 0 || globalIndex === allInd.length - 1) {
        collectorCurveData.push({ ind: globalIndex + 1, speciesCount: spDiscoveredSet.size });
      }

      // Height
      let maxHtObj = 0;
      const htVal = isProcessed ? ind.alturaUtilizada : parseFloat(ind.ht || '0');
      if (htVal) {
        maxHtObj = parseFloat(htVal.toString());
        if (!isNaN(maxHtObj) && maxHtObj > 0) {
          const htGroup = Math.floor(maxHtObj / alturaInterval) * alturaInterval;
          const htLabel = `${htGroup} - ${htGroup + alturaInterval}m`;
          distAltura[htLabel] = (distAltura[htLabel] || 0) + 1;
        }
      }

      // Stems / CAP
      let stemsProps: { dap: number, cap: number, ht: number, volumeProcessado?: number }[] = [];
      if (ind.multipleStems && ind.stems) {
         ind.stems.forEach(s => {
           stemsProps.push({ 
             dap: processCapDap(s.cap, undefined), 
             cap: parseFloat((s.cap||'0').toString()), 
             ht: parseFloat((s.altura||'0').toString()),
             volumeProcessado: s.volumeProcessado
           });
         });
      } else {
         const mainDap = processCapDap(ind.cap, ind.dap);
         const ht = parseFloat((ind.ht||'0').toString());
         if (mainDap > 0) {
            stemsProps.push({ 
              dap: mainDap, 
              cap: ind.cap ? parseFloat(ind.cap.toString()) : mainDap*Math.PI, 
              ht: ht 
            });
         }
      }

      stemsProps.forEach(stem => {
         if (stem.dap > 0) {
           totalFustes++;
           const groupBase = Math.floor(stem.dap / classInterval) * classInterval;
           const diamLabel = `${groupBase} - ${groupBase + classInterval}cm`;
           
           distDiametric[diamLabel] = (distDiametric[diamLabel] || 0) + 1;

           // Calculate Metrics
           let g = 0;
           let v = 0;

           if (isProcessed) {
             g = calculateBasalArea(stem.cap);
             if (ind.multipleStems) {
               v = stem.volumeProcessado !== undefined ? stem.volumeProcessado : calculateVolume(g, stem.ht || maxHtObj, fatorForma);
             } else {
               v = ind.volumeCalculado !== undefined ? ind.volumeCalculado : calculateVolume(g, stem.ht || maxHtObj, fatorForma);
             }
           } else {
             g = calculateBasalArea(stem.cap);
             v = calculateVolume(g, stem.ht || maxHtObj, fatorForma);
           }
           
           distBasal[diamLabel] = (distBasal[diamLabel] || 0) + g;
           distVolume[diamLabel] = (distVolume[diamLabel] || 0) + v;
           
           totalG += g;
           totalV += v;
         }
      });
    });

    // Formatting outputs
    const formatDistMap = (mapStr: Record<string, number>, isDecimal=false) => {
      return Object.keys(mapStr)
        .sort((a,b) => parseInt(a) - parseInt(b))
        .map(k => ({ name: k, value: isDecimal ? parseFloat(mapStr[k].toFixed(4)) : mapStr[k] }));
    };

    const diametricFinal = formatDistMap(distDiametric);
    const basalFinal = formatDistMap(distBasal, true);
    const volumeFinal = formatDistMap(distVolume, true);
    const alturaFinal = formatDistMap(distAltura);

    const speciesFinal = Object.keys(spCount)
      .map(k => ({ name: k, count: spCount[k] }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 10);

    const speciesCount = Object.keys(spCount).length;
    const shannon = calculateShannonIndex(spCount);
    const simpson = calculateSimpsonIndex(spCount);
    const pielou = calculatePielouIndex(shannon, speciesCount);

    return { 
      totalInd: allInd.length, 
      totalFustes,
      totalG, 
      totalV,
      shannon,
      simpson,
      pielou,
      speciesCount,
      collectorCurveData,
      diametricFinal,
      basalFinal,
      volumeFinal,
      alturaFinal,
      speciesFinal,
      isProcessed,
      hModelName,
      vModelName,
      measuredHtCount,
      estimatedHtCount
    };
  }, [inventories, classInterval, alturaInterval, fatorForma]);

  const areaHa = useMemo(() => {
    if (inventories.length === 0) return undefined;
    
    // Check if we are viewing a single Talhão
    const firstTalhaoId = inventories[0].talhaoId;
    if (firstTalhaoId && inventories.every(inv => inv.talhaoId === firstTalhaoId)) {
      const talhao = talhoes.find(t => t.id === firstTalhaoId);
      if (talhao && talhao.area !== undefined) return talhao.area;
    }
    
    // Check if we are viewing a single Stratum
    const firstStratumId = inventories[0].stratumId;
    if (firstStratumId && inventories.every(inv => inv.stratumId === firstStratumId)) {
      const stratum = strata.find(s => s.id === firstStratumId);
      if (stratum && stratum.area !== undefined) return stratum.area;
    }

    // Otherwise, compute project-wide area
    const activeFwId = inventories[0].fieldWorkId;
    const fwTalhoes = talhoes.filter(t => t.fieldWorkId === activeFwId);
    const fwStrata = strata.filter(s => s.fieldWorkId === activeFwId);
    
    const totalStrataArea = fwStrata.reduce((acc, s) => acc + (s.area || 0), 0);
    const totalTalhaoArea = fwTalhoes.reduce((acc, t) => acc + (t.area || 0), 0);
    const totalArea = totalStrataArea > 0 ? totalStrataArea : totalTalhaoArea;

    return totalArea > 0 ? totalArea : undefined;
  }, [inventories, talhoes, strata]);

  const totalSampleAreaHa = useMemo(() => {
    const sumSqm = inventories.reduce((acc, inv) => acc + (inv.areaParcela || 0), 0);
    return sumSqm / 10000;
  }, [inventories]);

  const scaledStats = useMemo(() => {
    const { totalV, totalG, totalFustes } = stats;
    
    if (totalSampleAreaHa <= 0) {
      return {
        vHa: 0,
        vTotalEst: 0,
        gHa: 0,
        gTotalEst: 0,
        nHa: 0,
        nTotalEst: 0
      };
    }

    const vHa = totalV / totalSampleAreaHa;
    const gHa = totalG / totalSampleAreaHa;
    const nHa = totalFustes / totalSampleAreaHa;

    return {
      vHa,
      vTotalEst: areaHa !== undefined ? vHa * areaHa : undefined,
      gHa,
      gTotalEst: areaHa !== undefined ? gHa * areaHa : undefined,
      nHa,
      nTotalEst: areaHa !== undefined ? nHa * areaHa : undefined
    };
  }, [stats, totalSampleAreaHa, areaHa]);

  const handleExportSnapshot = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(containerRef.current, { 
        backgroundColor: document.body.classList.contains('light-theme') ? '#f4f6f4' : '#020503', 
        scale: 2 
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laudo_Fitossociologico_${Date.now()}.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar print dos gráficos.');
    } finally {
      setIsExporting(false);
    }
  };

  const TopStatCard = ({ title, value, sub, color, icon }: { title: string, value: string, sub: string, color: string, icon: React.ReactNode }) => {
    const contrastColor = getContrastColor(color, isLight);
    return (
      <div style={{ 
        background: isLight ? '#ffffff' : 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)', 
        padding: '12px 14px', 
        borderRadius: '16px', 
        border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255, 255, 255, 0.06)', 
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: isLight ? '0 10px 25px rgba(0, 0, 0, 0.03)' : 'none',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '100px', 
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative inner glowing blob */}
        <div style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '60px',
          height: '60px',
          background: contrastColor,
          opacity: isLight ? 0.05 : 0.08,
          borderRadius: '50%',
          filter: 'blur(16px)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '9px', color: isLight ? '#64748b' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {title}
          </span>
          <div style={{ color: contrastColor, opacity: 0.9, flexShrink: 0, marginLeft: '4px' }}>
            {icon}
          </div>
        </div>
        
        <div style={{ marginTop: '6px' }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff', fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.5px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {value}
          </div>
          <div style={{ fontSize: '10px', color: contrastColor, fontWeight: '700', marginTop: '2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {sub}
          </div>
        </div>
      </div>
    );
  };

  const gridStroke = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.03)';
  const axisStroke = isLight ? '#cbd5e1' : '#666';
  const tickFill = isLight ? '#64748b' : '#aaa';

  const colorColetor = getContrastColor('#ffb74d', isLight);
  const colorDiametrico = getContrastColor('#4fc3f7', isLight);
  const colorVolume = getContrastColor('#ba68c8', isLight);
  const colorBasal = getContrastColor('#e57373', isLight);
  const colorAltura = getContrastColor('#aed581', isLight);
  const colorEspecie = isLight ? '#2e7d32' : '#4caf50';

  // Top species helpers
  const top10VolumeSpecies = useMemo(() => {
    return [...especiesStats.speciesList].sort((a,b) => b.volumeTotal - a.volumeTotal).slice(0, 10);
  }, [especiesStats.speciesList]);

  const top10IndividuosSpecies = useMemo(() => {
    return [...especiesStats.speciesList].sort((a,b) => b.numIndividuos - a.numIndividuos).slice(0, 10);
  }, [especiesStats.speciesList]);

  const top10BasalAreaSpecies = useMemo(() => {
    return [...especiesStats.speciesList].sort((a,b) => b.basalArea - a.basalArea).slice(0, 10);
  }, [especiesStats.speciesList]);

  const topAbundantSpecies = useMemo(() => {
    if (especiesStats.speciesList.length === 0) return { nome: 'Nenhuma', count: 0 };
    const sorted = [...especiesStats.speciesList].sort((a,b) => b.numIndividuos - a.numIndividuos);
    return { nome: sorted[0].nome, count: sorted[0].numIndividuos };
  }, [especiesStats.speciesList]);

  const topDominantSpecies = useMemo(() => {
    if (especiesStats.speciesList.length === 0) return { nome: 'Nenhuma', area: 0 };
    const sorted = [...especiesStats.speciesList].sort((a,b) => b.basalArea - a.basalArea);
    return { nome: sorted[0].nome, area: sorted[0].basalArea };
  }, [especiesStats.speciesList]);

  const topVolumeSpecies = useMemo(() => {
    if (especiesStats.speciesList.length === 0) return { nome: 'Nenhuma', volume: 0 };
    const sorted = [...especiesStats.speciesList].sort((a,b) => b.volumeTotal - a.volumeTotal);
    return { nome: sorted[0].nome, volume: sorted[0].volumeTotal };
  }, [especiesStats.speciesList]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: isLight 
        ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)' 
        : 'linear-gradient(135deg, #020503 0%, #050d08 50%, #000000 100%)', 
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      overflowX: 'hidden', maxWidth: '100vw'
    }}>
      {/* Premium Header */}
      <div style={{ 
        padding: '20px 24px', 
        background: isLight ? '#ffffff' : 'rgba(5, 13, 8, 0.4)', 
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid var(--border-color)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        zIndex: 10
      }}>
        <div>
          <h2 style={{ 
            background: isLight 
              ? 'linear-gradient(135deg, #0f172a 0%, #334155 100%)' 
              : 'linear-gradient(135deg, #ffffff 0%, var(--primary-hover) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: '18px',
            fontWeight: '800',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Dashboard Analítico
          </h2>
          <span style={{ fontSize: '12px', color: isLight ? '#475569' : 'var(--text-muted)', display: 'block', marginTop: '3px', fontWeight: '500' }}>
            Análise Fitossociológica de Parcelas Florestais
            {areaHa !== undefined && ` • Área Total: ${areaHa.toFixed(2)} ha`}
            {totalSampleAreaHa > 0 && ` • Área Amostrada: ${totalSampleAreaHa.toFixed(4)} ha`}
          </span>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ 
            width: 'auto', 
            padding: '8px 20px', 
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '800',
            background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.08)',
            color: isLight ? '#1e293b' : 'var(--text-main)'
          }} 
          onClick={onClose}
        >
          Fechar
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px', width: '100%', boxSizing: 'border-box' }} ref={containerRef}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Warning Banner for Unprocessed Parcels */}
          {hasUnprocessedParcels && (
            <div style={{
              background: isLight ? '#fffbeb' : 'rgba(217, 119, 6, 0.15)',
              border: isLight ? '1px solid #fef3c7' : '1px solid rgba(217, 119, 6, 0.3)',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: isLight ? '#b45309' : '#fbbf24',
              fontSize: '13px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <span style={{ fontWeight: '800' }}>Aviso de Processamento:</span> Algumas parcelas deste inventário ainda não foram processadas profissionalmente. O sistema utilizará os dados de CAP/DAP brutos e o fator de forma geral ({fatorForma}) como fallback para os cálculos de volume e área basal dessas parcelas.
              </div>
            </div>
          )}

          {/* Dynamic Parameter Grid (Leverages vertical/horizontal spaces cleanly) */}
          <div className="glass-card" style={{ 
            padding: '20px', 
            borderRadius: '20px', 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '16px',
            alignItems: 'end',
            background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: stats.isProcessed ? 0.5 : 1 }}>
              <label style={{ fontSize: '11px', color: isLight ? '#475569' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                Fator de Forma Geral (v) {stats.isProcessed && <span style={{ color: '#ff8a80', fontSize: '9px', textTransform: 'none' }}>(Inativo)</span>}
              </label>
              <input 
                type="number" 
                step="0.01" 
                className="input-field" 
                style={{ 
                  marginBottom: 0, 
                  padding: '10px 14px', 
                  borderRadius: '12px', 
                  background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.3)', 
                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.08)',
                  color: isLight ? '#0f172a' : '#ffffff'
                }} 
                value={fatorForma} 
                onChange={e => setFatorForma(parseFloat(e.target.value) || 0.7)} 
                disabled={stats.isProcessed}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: isLight ? '#475569' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Classe de DAP (cm)</label>
              <input 
                type="number" 
                className="input-field" 
                style={{ 
                  marginBottom: 0, 
                  padding: '10px 14px', 
                  borderRadius: '12px', 
                  background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.3)', 
                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.08)',
                  color: isLight ? '#0f172a' : '#ffffff'
                }} 
                value={classInterval} 
                onChange={e => setClassInterval(parseInt(e.target.value) || 10)} 
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: isLight ? '#475569' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Classe de HT (m)</label>
              <input 
                type="number" 
                className="input-field" 
                style={{ 
                  marginBottom: 0, 
                  padding: '10px 14px', 
                  borderRadius: '12px', 
                  background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.3)', 
                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.08)',
                  color: isLight ? '#0f172a' : '#ffffff'
                }} 
                value={alturaInterval} 
                onChange={e => setAlturaInterval(parseInt(e.target.value) || 5)} 
              />
            </div>
            <button 
              className="btn btn-primary" 
              style={{ 
                height: '42px', 
                borderRadius: '12px', 
                fontSize: '12px', 
                fontWeight: 'bold', 
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }} 
              onClick={handleExportSnapshot} 
              disabled={isExporting}
            >
              {isExporting ? (
                'Processando...'
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Gerar Laudo (PNG)
                </>
              )}
            </button>
          </div>

          {/* View Selector Row */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            padding: '6px', 
            background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255, 255, 255, 0.02)',
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '16px',
            alignSelf: 'flex-start',
            flexWrap: 'wrap'
          }}>
            {[
              { id: 'trabalho', label: 'Trabalho Completo' },
              { id: 'talhao', label: 'Talhão' },
              { id: 'estrato', label: 'Estrato' },
              { id: 'parcela', label: 'Parcela' },
              { id: 'especie', label: 'Espécie' }
            ].map(opt => {
              const isActive = viewType === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setViewType(opt.id as any)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: isActive 
                      ? (isLight ? '#16a34a' : 'var(--primary-hover)') 
                      : 'transparent',
                    color: isActive 
                      ? '#ffffff' 
                      : (isLight ? '#475569' : 'var(--text-muted)'),
                    boxShadow: isActive ? '0 4px 12px rgba(22, 163, 74, 0.25)' : 'none'
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* VIEW TYPE: TRABALHO COMPLETO */}
          {viewType === 'trabalho' && (
            <>
              {/* Top High Level Stats (Premium Grids) */}
              <div className="dashboard-kpi-grid">
                 <TopStatCard 
                   title={areaHa !== undefined ? "Fustes (Estimado)" : "Amostragem Base"} 
                   value={areaHa !== undefined && scaledStats.nTotalEst !== undefined
                     ? Math.round(scaledStats.nTotalEst).toLocaleString()
                     : stats.totalFustes.toString()
                   } 
                   sub={areaHa !== undefined
                     ? `${scaledStats.nHa.toFixed(1)}/ha (Amostra: ${stats.totalFustes})`
                     : `${stats.totalInd} Indivíduos`
                   } 
                   color="#4fc3f7"
                   icon={
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                       <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                     </svg>
                   }
                 />
                 <TopStatCard 
                   title="Especialização" 
                   value={stats.speciesCount.toString()} 
                   sub="Espécies Mapeadas" 
                   color="#aed581"
                   icon={
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                       <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                     </svg>
                   }
                 />
                 <TopStatCard 
                   title={areaHa !== undefined ? "Volume (Estimado)" : "Volume Amostrado"} 
                   value={areaHa !== undefined && scaledStats.vTotalEst !== undefined
                     ? `${scaledStats.vTotalEst.toFixed(2)} m³`
                     : `${stats.totalV.toFixed(2)} m³`
                   } 
                   sub={areaHa !== undefined
                     ? `${scaledStats.vHa.toFixed(2)} m³/ha (Amostra: ${stats.totalV.toFixed(1)} m³)`
                     : "Biomassa Estimada"
                   } 
                   color="#ba68c8"
                   icon={
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                       <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                       <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                       <line x1="12" y1="22.08" x2="12" y2="12"/>
                     </svg>
                   }
                 />
                 <TopStatCard 
                   title={areaHa !== undefined ? "Área Basal (Estimada)" : "Área Basal Amostrada"} 
                   value={areaHa !== undefined && scaledStats.gTotalEst !== undefined
                     ? `${scaledStats.gTotalEst.toFixed(4)} m²`
                     : `${stats.totalG.toFixed(4)} m²`
                   } 
                   sub={areaHa !== undefined
                     ? `${scaledStats.gHa.toFixed(4)} m²/ha (Amostra: ${stats.totalG.toFixed(3)} m²)`
                     : "Basimetria"
                   } 
                   color="#e57373"
                   icon={
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                       <circle cx="12" cy="12" r="10"></circle>
                       <circle cx="12" cy="12" r="6"></circle>
                       <circle cx="12" cy="12" r="2"></circle>
                     </svg>
                   }
                 />
                 <TopStatCard 
                   title="Shannon (H')" 
                   value={stats.shannon.toFixed(4)} 
                   sub="Índice de Diversidade" 
                   color="#ffb74d"
                   icon={
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                       <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                     </svg>
                   }
                 />
                 <TopStatCard 
                   title="Simpson (1-D)" 
                   value={stats.simpson.toFixed(4)} 
                   sub="Riqueza Ecológica" 
                   color="#ff8a65"
                   icon={
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                       <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                     </svg>
                   }
                 />
                 <TopStatCard 
                   title="Pielou (J')" 
                   value={stats.pielou.toFixed(4)} 
                   sub="Equitabilidade" 
                   color="#26a69a"
                   icon={
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                       <line x1="18" y1="20" x2="18" y2="10"></line>
                       <line x1="12" y1="20" x2="12" y2="4"></line>
                       <line x1="6" y1="20" x2="6" y2="14"></line>
                     </svg>
                   }
                 />
              </div>

              {/* Dynamic Chart Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                 
                 {/* Collector's Curve (Suficiência Amostral) */}
                 <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '18px', color: colorColetor, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Curva do Coletor (Suficiência)</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.collectorCurveData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="collectorGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={colorColetor} stopOpacity={isLight ? 0.25 : 0.35}/>
                              <stop offset="95%" stopColor={colorColetor} stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                          <XAxis dataKey="ind" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                          <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip isLight={isLight} />} />
                          <Area type="monotone" dataKey="speciesCount" name="Espécies" stroke={colorColetor} strokeWidth={3} fill="url(#collectorGrad)" isAnimationActive={true} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Diametric Chart */}
                 <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '18px', color: colorDiametrico, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distribuição Diamétrica</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.diametricFinal} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="diametricGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={colorDiametrico} stopOpacity={isLight ? 0.75 : 0.8}/>
                              <stop offset="95%" stopColor={colorDiametrico} stopOpacity={0.15}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                          <XAxis dataKey="name" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                          <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip isLight={isLight} />} />
                          <Bar dataKey="value" name="Fustes" fill="url(#diametricGrad)" stroke={colorDiametrico} strokeWidth={1} radius={[6, 6, 0, 0]} isAnimationActive={true} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Volume Chart */}
                 <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '18px', color: colorVolume, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume por Classe (m³)</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.volumeFinal} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={colorVolume} stopOpacity={0.75}/>
                              <stop offset="95%" stopColor={colorVolume} stopOpacity={0.15}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                          <XAxis dataKey="name" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                          <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip isLight={isLight} />} />
                          <Bar dataKey="value" name="Volume" fill="url(#volumeGrad)" stroke={colorVolume} strokeWidth={1} radius={[6, 6, 0, 0]} isAnimationActive={true} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Basal Area Chart */}
                 <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '18px', color: colorBasal, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Área Basal por Classe (m²)</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.basalFinal} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="basalGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={colorBasal} stopOpacity={0.75}/>
                              <stop offset="95%" stopColor={colorBasal} stopOpacity={0.15}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                          <XAxis dataKey="name" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                          <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip isLight={isLight} />} />
                          <Bar dataKey="value" name="Área Basal" fill="url(#basalGrad)" stroke={colorBasal} strokeWidth={1} radius={[6, 6, 0, 0]} isAnimationActive={true} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Height Chart */}
                 <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '18px', color: colorAltura, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distribuição de Alturas</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.alturaFinal} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="alturaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={colorAltura} stopOpacity={isLight ? 0.75 : 0.8}/>
                              <stop offset="95%" stopColor={colorAltura} stopOpacity={0.15}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                          <XAxis dataKey="name" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                          <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                          <Tooltip content={<CustomTooltip isLight={isLight} />} />
                          <Bar dataKey="value" name="Árvores" fill="url(#alturaGrad)" stroke={colorAltura} strokeWidth={1} radius={[6, 6, 0, 0]} isAnimationActive={true} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Species Chart */}
                 <div className="glass-card" style={{ padding: '24px', gridColumn: '1 / -1', overflow: 'hidden' }}>
                    <h3 style={{ marginBottom: '18px', color: colorEspecie, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Frequência de Espécies (Top 10)</h3>
                    <div style={{ height: '360px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.speciesFinal} layout="vertical" margin={{ top: 10, right: 20, left: 30, bottom: 0 }}>
                          <defs>
                            <linearGradient id="speciesGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="5%" stopColor={colorEspecie} stopOpacity={0.85}/>
                              <stop offset="95%" stopColor={isLight ? '#22c55e' : '#4caf50'} stopOpacity={0.2}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={true} vertical={false} />
                          <XAxis type="number" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" stroke={axisStroke} width={110} tick={{ fill: tickFill, fontSize: 11 }} interval={0} />
                          <Tooltip content={<CustomTooltip isLight={isLight} />} />
                          <Bar dataKey="count" name="Indivíduos" fill="url(#speciesGrad)" stroke={colorEspecie} strokeWidth={1} radius={[0, 6, 6, 0]} isAnimationActive={true} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                 </div>

              </div>
            </>
          )}

          {/* VIEW TYPE: TALHÃO */}
          {viewType === 'talhao' && (
            <>
              {/* KPI Cards */}
              <div className="dashboard-kpi-grid">
                <TopStatCard 
                  title="Talhões" 
                  value={talhoesStats.length.toString()} 
                  sub="Talhões Cadastrados" 
                  color="#4fc3f7"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  }
                />
                <TopStatCard 
                  title="Área Amostrada vs Total" 
                  value={`${talhoesStats.reduce((acc, t) => acc + t.areaAmostrada, 0).toFixed(4)} ha`} 
                  sub={`Área Total: ${talhoesStats.reduce((acc, t) => acc + t.areaTotal, 0).toFixed(2)} ha`} 
                  color="#aed581"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="9" y1="3" x2="9" y2="21"/>
                      <line x1="15" y1="3" x2="15" y2="21"/>
                      <line x1="3" y1="9" x2="21" y2="9"/>
                      <line x1="3" y1="15" x2="21" y2="15"/>
                    </svg>
                  }
                />
                <TopStatCard 
                  title="Volume Estimado Total" 
                  value={`${talhoesStats.reduce((acc, t) => acc + t.volumeTotalEst, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`} 
                  sub="Soma dos Talhões" 
                  color="#ba68c8"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                  }
                />
                <TopStatCard 
                  title="Volume Médio por Hectare" 
                  value={`${(talhoesStats.reduce((acc, t) => acc + t.volumeAmostrado, 0) / Math.max(0.0001, talhoesStats.reduce((acc, t) => acc + t.areaAmostrada, 0))).toFixed(2)} m³/ha`} 
                  sub="Média Ponderada" 
                  color="#e57373"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                  }
                />
              </div>

              {/* Table */}
              <div className="glass-card" style={{ padding: '24px', overflowX: 'auto', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                <h3 style={{ marginBottom: '18px', color: isLight ? '#1e293b' : '#ffffff', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tabela Comparativa por Talhão
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                  <thead>
                    <tr style={{ borderBottom: isLight ? '2px solid #cbd5e1' : '2px solid rgba(255,255,255,0.08)' }}>
                      {renderSortableHeader('nome', 'Talhão', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection)}
                      {renderSortableHeader('numParcelas', 'Parcelas', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'center')}
                      {renderSortableHeader('numArvores', 'Árvores', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'center')}
                      {renderSortableHeader('areaAmostrada', 'Área Amost. (ha)', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('areaTotal', 'Área Total (ha)', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('volumeAmostrado', 'Vol. Amost. (m³)', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('volumeHa', 'Vol. Médio (m³/ha)', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('volumeTotalEst', 'Vol. Total Est. (m³)', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('basalAreaHa', 'Área Basal (m²/ha)', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('densidadeHa', 'Densidade (f/ha)', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('dapMedio', 'DAP Médio (cm)', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('alturaMedia', 'HT Média (m)', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('shannon', 'Shannon (H\')', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('simpson', 'Simpson (1-D)', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                      {renderSortableHeader('pielou', 'Pielou (J\')', talhaoSortField, talhaoSortDirection, setTalhaoSortField, setTalhaoSortDirection, 'right')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTalhoes.map((t, idx) => (
                      <tr key={t.id || idx} style={{ borderBottom: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)') }}>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#0f172a' : '#fff', fontWeight: 'bold' }}>{t.nome}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'center' }}>{t.numParcelas}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'center' }}>{t.numArvores}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{t.areaAmostrada.toFixed(4)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{t.areaTotal.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{t.volumeAmostrado.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#16a34a' : 'var(--primary-hover)', fontWeight: 'bold', textAlign: 'right' }}>{t.volumeHa.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#0f172a' : '#fff', fontWeight: 'bold', textAlign: 'right' }}>{t.volumeTotalEst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{t.basalAreaHa.toFixed(4)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{t.densidadeHa.toFixed(1)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{t.dapMedio.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{t.alturaMedia.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{t.shannon.toFixed(4)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{t.simpson.toFixed(4)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{t.pielou.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Charts & Ranking */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Volume/ha Chart */}
                <div className="glass-card" style={{ padding: '24px', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                  <h3 style={{ marginBottom: '18px', color: colorVolume, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume Médio por Hectare por Talhão</h3>
                  <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={talhoesStats} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="talhaoVolGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colorVolume} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={colorVolume} stopOpacity={0.15}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="nome" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                        <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip isLight={isLight} />} />
                        <Bar dataKey="volumeHa" name="Vol. Médio (m³/ha)" fill="url(#talhaoVolGrad)" stroke={colorVolume} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Basal Area Chart */}
                <div className="glass-card" style={{ padding: '24px', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                  <h3 style={{ marginBottom: '18px', color: colorBasal, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Área Basal por Hectare por Talhão</h3>
                  <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={talhoesStats} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="talhaoBasalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colorBasal} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={colorBasal} stopOpacity={0.15}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="nome" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                        <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip isLight={isLight} />} />
                        <Bar dataKey="basalAreaHa" name="Área Basal (m²/ha)" fill="url(#talhaoBasalGrad)" stroke={colorBasal} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Volume Ranking List */}
                <div className="glass-card" style={{ padding: '24px', gridColumn: '1 / -1', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                  <h3 style={{ marginBottom: '18px', color: colorColetor, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ranking por Volume Total Estimado</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[...talhoesStats].sort((a,b) => b.volumeTotalEst - a.volumeTotalEst).map((t, idx) => {
                      const maxVol = Math.max(1, ...talhoesStats.map(x => x.volumeTotalEst));
                      const pct = (t.volumeTotalEst / maxVol) * 100;
                      return (
                        <div key={t.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                            <span style={{ color: isLight ? '#0f172a' : '#fff' }}>{idx+1}º • {t.nome}</span>
                            <span style={{ color: colorColetor }}>{t.volumeTotalEst.toLocaleString(undefined, { maximumFractionDigits: 2 })} m³ <span style={{ color: isLight ? '#64748b' : 'var(--text-muted)', fontSize: '11px', fontWeight: 'normal' }}>({t.volumeHa.toFixed(1)} m³/ha)</span></span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${colorColetor} 0%, #ff8a65 100%)`, borderRadius: '4px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* VIEW TYPE: ESTRATO */}
          {viewType === 'estrato' && (
            <>
              {/* KPI Cards */}
              <div className="dashboard-kpi-grid">
                <TopStatCard 
                  title="Estratos" 
                  value={strataStats.length.toString()} 
                  sub="Estratos Mapeados" 
                  color="#4fc3f7"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                      <polyline points="2 17 12 22 22 17"/>
                      <polyline points="2 12 12 17 22 12"/>
                    </svg>
                  }
                />
                <TopStatCard 
                  title="Área Amostrada vs Total" 
                  value={`${strataStats.reduce((acc, t) => acc + t.areaAmostrada, 0).toFixed(4)} ha`} 
                  sub={`Área Total: ${strataStats.reduce((acc, t) => acc + t.areaTotal, 0).toFixed(2)} ha`} 
                  color="#aed581"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="9" y1="3" x2="9" y2="21"/>
                      <line x1="15" y1="3" x2="15" y2="21"/>
                      <line x1="3" y1="9" x2="21" y2="9"/>
                      <line x1="3" y1="15" x2="21" y2="15"/>
                    </svg>
                  }
                />
                <TopStatCard 
                  title="Volume Estimado Total" 
                  value={`${strataStats.reduce((acc, t) => acc + t.volumeTotalEst, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`} 
                  sub="Soma dos Estratos" 
                  color="#ba68c8"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                  }
                />
                <TopStatCard 
                  title="Volume Médio por Hectare" 
                  value={`${(strataStats.reduce((acc, t) => acc + t.volumeAmostrado, 0) / Math.max(0.0001, strataStats.reduce((acc, t) => acc + t.areaAmostrada, 0))).toFixed(2)} m³/ha`} 
                  sub="Média Ponderada" 
                  color="#e57373"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                  }
                />
              </div>

              {/* Table */}
              <div className="glass-card" style={{ padding: '24px', overflowX: 'auto', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                <h3 style={{ marginBottom: '18px', color: isLight ? '#1e293b' : '#ffffff', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tabela Comparativa por Estrato
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                  <thead>
                    <tr style={{ borderBottom: isLight ? '2px solid #cbd5e1' : '2px solid rgba(255,255,255,0.08)' }}>
                      {renderSortableHeader('nome', 'Estrato', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection)}
                      {renderSortableHeader('numParcelas', 'Parcelas', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'center')}
                      {renderSortableHeader('numArvores', 'Árvores', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'center')}
                      {renderSortableHeader('areaAmostrada', 'Área Amost. (ha)', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'right')}
                      {renderSortableHeader('areaTotal', 'Área Total (ha)', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'right')}
                      {renderSortableHeader('volumeAmostrado', 'Vol. Amost. (m³)', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'right')}
                      {renderSortableHeader('volumeHa', 'Vol. Médio (m³/ha)', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'right')}
                      {renderSortableHeader('volumeTotalEst', 'Vol. Total Est. (m³)', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'right')}
                      {renderSortableHeader('basalAreaHa', 'Área Basal (m²/ha)', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'right')}
                      {renderSortableHeader('densidadeHa', 'Densidade (f/ha)', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'right')}
                      {renderSortableHeader('dapMedio', 'DAP Médio (cm)', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'right')}
                      {renderSortableHeader('alturaMedia', 'HT Média (m)', estratoSortField, estratoSortDirection, setEstratoSortField, setEstratoSortDirection, 'right')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStrata.map((s, idx) => (
                      <tr key={s.id || idx} style={{ borderBottom: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)') }}>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#0f172a' : '#fff', fontWeight: 'bold' }}>{s.nome}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'center' }}>{s.numParcelas}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'center' }}>{s.numArvores}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{s.areaAmostrada.toFixed(4)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{s.areaTotal.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{s.volumeAmostrado.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#16a34a' : 'var(--primary-hover)', fontWeight: 'bold', textAlign: 'right' }}>{s.volumeHa.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#0f172a' : '#fff', fontWeight: 'bold', textAlign: 'right' }}>{s.volumeTotalEst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{s.basalAreaHa.toFixed(4)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{s.densidadeHa.toFixed(1)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{s.dapMedio.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{s.alturaMedia.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Charts & Ranking */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Volume/ha Chart */}
                <div className="glass-card" style={{ padding: '24px', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                  <h3 style={{ marginBottom: '18px', color: colorVolume, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume Médio por Hectare por Estrato</h3>
                  <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={strataStats} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="estratoVolGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colorVolume} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={colorVolume} stopOpacity={0.15}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="nome" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                        <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip isLight={isLight} />} />
                        <Bar dataKey="volumeHa" name="Vol. Médio (m³/ha)" fill="url(#estratoVolGrad)" stroke={colorVolume} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Basal Area Chart */}
                <div className="glass-card" style={{ padding: '24px', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                  <h3 style={{ marginBottom: '18px', color: colorBasal, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Área Basal por Hectare por Estrato</h3>
                  <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={strataStats} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="estratoBasalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colorBasal} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={colorBasal} stopOpacity={0.15}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="nome" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                        <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip isLight={isLight} />} />
                        <Bar dataKey="basalAreaHa" name="Área Basal (m²/ha)" fill="url(#estratoBasalGrad)" stroke={colorBasal} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Volume Ranking List */}
                <div className="glass-card" style={{ padding: '24px', gridColumn: '1 / -1', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                  <h3 style={{ marginBottom: '18px', color: colorColetor, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ranking por Volume Total Estimado</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[...strataStats].sort((a,b) => b.volumeTotalEst - a.volumeTotalEst).map((s, idx) => {
                      const maxVol = Math.max(1, ...strataStats.map(x => x.volumeTotalEst));
                      const pct = (s.volumeTotalEst / maxVol) * 100;
                      return (
                        <div key={s.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                            <span style={{ color: isLight ? '#0f172a' : '#fff' }}>{idx+1}º • {s.nome}</span>
                            <span style={{ color: colorColetor }}>{s.volumeTotalEst.toLocaleString(undefined, { maximumFractionDigits: 2 })} m³ <span style={{ color: isLight ? '#64748b' : 'var(--text-muted)', fontSize: '11px', fontWeight: 'normal' }}>({s.volumeHa.toFixed(1)} m³/ha)</span></span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${colorColetor} 0%, #ff8a65 100%)`, borderRadius: '4px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* VIEW TYPE: PARCELA */}
          {viewType === 'parcela' && (
            <>
              {/* Detailed Table */}
              <div className="glass-card" style={{ padding: '24px', overflowX: 'auto', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                <h3 style={{ marginBottom: '18px', color: isLight ? '#1e293b' : '#ffffff', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tabela Detalhada por Parcela
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ borderBottom: isLight ? '2px solid #cbd5e1' : '2px solid rgba(255,255,255,0.08)' }}>
                      {renderSortableHeader('nome', 'Parcela', parcelaSortField, parcelaSortDirection, setParcelaSortField, setParcelaSortDirection)}
                      {renderSortableHeader('numArvores', 'Árvores', parcelaSortField, parcelaSortDirection, setParcelaSortField, setParcelaSortDirection, 'center')}
                      {renderSortableHeader('areaParcela', 'Área (m²)', parcelaSortField, parcelaSortDirection, setParcelaSortField, setParcelaSortDirection, 'right')}
                      {renderSortableHeader('volumeTotal', 'Volume Total (m³)', parcelaSortField, parcelaSortDirection, setParcelaSortField, setParcelaSortDirection, 'right')}
                      {renderSortableHeader('volumeHa', 'Volume (m³/ha)', parcelaSortField, parcelaSortDirection, setParcelaSortField, setParcelaSortDirection, 'right')}
                      {renderSortableHeader('basalAreaHa', 'Área Basal (m²/ha)', parcelaSortField, parcelaSortDirection, setParcelaSortField, setParcelaSortDirection, 'right')}
                      {renderSortableHeader('densidadeHa', 'Densidade (f/ha)', parcelaSortField, parcelaSortDirection, setParcelaSortField, setParcelaSortDirection, 'right')}
                      {renderSortableHeader('dapMedio', 'DAP Médio (cm)', parcelaSortField, parcelaSortDirection, setParcelaSortField, setParcelaSortDirection, 'right')}
                      {renderSortableHeader('alturaMedia', 'Altura Média (m)', parcelaSortField, parcelaSortDirection, setParcelaSortField, setParcelaSortDirection, 'right')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedParcelas.map((p, idx) => (
                      <tr key={p.id || idx} style={{ borderBottom: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)') }}>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#0f172a' : '#fff', fontWeight: 'bold' }}>{p.nome}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'center' }}>{p.numArvores}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{p.areaParcela.toFixed(1)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{p.volumeTotal.toFixed(3)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#16a34a' : 'var(--primary-hover)', fontWeight: 'bold', textAlign: 'right' }}>{p.volumeHa.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{p.basalAreaHa.toFixed(4)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{p.densidadeHa.toFixed(1)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{p.dapMedio.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{p.alturaMedia.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* VIEW TYPE: ESPÉCIE */}
          {viewType === 'especie' && (
            <>
              {/* KPI Cards */}
              <div className="dashboard-kpi-grid">
                <TopStatCard 
                  title="Espécies Encontradas" 
                  value={sortedEspecies.length.toString()} 
                  sub="Riqueza Florística" 
                  color="#4fc3f7"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  }
                />
                <TopStatCard 
                  title="Mais Abundante" 
                  value={topAbundantSpecies.nome} 
                  sub={`${topAbundantSpecies.count} indivíduos`} 
                  color="#aed581"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  }
                />
                <TopStatCard 
                  title="Mais Dominante" 
                  value={topDominantSpecies.nome} 
                  sub={`${topDominantSpecies.area.toFixed(4)} m² (G)`} 
                  color="#e57373"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="4"></circle>
                    </svg>
                  }
                />
                <TopStatCard 
                  title="Maior Volume" 
                  value={topVolumeSpecies.nome} 
                  sub={`${topVolumeSpecies.volume.toFixed(2)} m³`} 
                  color="#ba68c8"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                  }
                />
              </div>

              {/* Tabela de Fitossociologia */}
              <div className="glass-card" style={{ padding: '24px', overflowX: 'auto', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                <h3 style={{ marginBottom: '18px', color: isLight ? '#1e293b' : '#ffffff', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Fitossociologia e Distribuição de Espécies
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}>
                  <thead>
                    <tr style={{ borderBottom: isLight ? '2px solid #cbd5e1' : '2px solid rgba(255,255,255,0.08)' }}>
                      {renderSortableHeader('nome', 'Espécie', speciesSortField, speciesSortDirection, setSpeciesSortField, setSpeciesSortDirection, 'left')}
                      {renderSortableHeader('individuos', 'Nº Indivíduos', speciesSortField, speciesSortDirection, setSpeciesSortField, setSpeciesSortDirection, 'center')}
                      {renderSortableHeader('volume', 'Volume Total (m³)', speciesSortField, speciesSortDirection, setSpeciesSortField, setSpeciesSortDirection, 'right')}
                      {renderSortableHeader('volumeHa', 'Vol. por ha (m³/ha)', speciesSortField, speciesSortDirection, setSpeciesSortField, setSpeciesSortDirection, 'right')}
                      {renderSortableHeader('areaBasal', 'Área Basal (m²)', speciesSortField, speciesSortDirection, setSpeciesSortField, setSpeciesSortDirection, 'right')}
                      {renderSortableHeader('frequencia', 'Freq. Relativa (FR%)', speciesSortField, speciesSortDirection, setSpeciesSortField, setSpeciesSortDirection, 'right')}
                      {renderSortableHeader('dominancia', 'Dom. Relativa (DR%)', speciesSortField, speciesSortDirection, setSpeciesSortField, setSpeciesSortDirection, 'right')}
                      {renderSortableHeader('participacao', 'Part. Vol. (%)', speciesSortField, speciesSortDirection, setSpeciesSortField, setSpeciesSortDirection, 'right')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEspecies.map((sp, idx) => (
                      <tr key={sp.nome || idx} style={{ borderBottom: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)') }}>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#0f172a' : '#fff', fontWeight: 'bold', fontStyle: 'italic' }}>{sp.nome}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'center' }}>{sp.numIndividuos}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{sp.volumeTotal.toFixed(3)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{sp.volumeHa.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{sp.basalArea.toFixed(4)}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{sp.frequenciaRelativa.toFixed(2)}%</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#334155' : 'var(--text-main)', textAlign: 'right' }}>{sp.dominanciaRelativa.toFixed(2)}%</td>
                        <td style={{ padding: '12px 8px', fontSize: '12.5px', color: isLight ? '#16a34a' : 'var(--primary-hover)', fontWeight: 'bold', textAlign: 'right' }}>{sp.participacaoVolume.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recharts Bar Charts for Species */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                
                {/* Volume Chart */}
                <div className="glass-card" style={{ padding: '24px', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                  <h3 style={{ marginBottom: '18px', color: colorVolume, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume por Espécie (Top 10)</h3>
                  <div style={{ height: '280px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={top10VolumeSpecies} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="spVolGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colorVolume} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={colorVolume} stopOpacity={0.15}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="nome" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 9 }} />
                        <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 9 }} />
                        <Tooltip content={<CustomTooltip isLight={isLight} />} />
                        <Bar dataKey="volumeTotal" name="Volume (m³)" fill="url(#spVolGrad)" stroke={colorVolume} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Abundance Chart */}
                <div className="glass-card" style={{ padding: '24px', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                  <h3 style={{ marginBottom: '18px', color: colorEspecie, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Abundância por Espécie (Top 10)</h3>
                  <div style={{ height: '280px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={top10IndividuosSpecies} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="spIndGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colorEspecie} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={colorEspecie} stopOpacity={0.15}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="nome" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 9 }} />
                        <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 9 }} />
                        <Tooltip content={<CustomTooltip isLight={isLight} />} />
                        <Bar dataKey="numIndividuos" name="Indivíduos" fill="url(#spIndGrad)" stroke={colorEspecie} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Basal Area Chart */}
                <div className="glass-card" style={{ padding: '24px', background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px' }}>
                  <h3 style={{ marginBottom: '18px', color: colorBasal, fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Área Basal por Espécie (Top 10)</h3>
                  <div style={{ height: '280px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={top10BasalAreaSpecies} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="spBasalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colorBasal} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={colorBasal} stopOpacity={0.15}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="nome" stroke={axisStroke} tick={{ fill: tickFill, fontSize: 9 }} />
                        <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 9 }} />
                        <Tooltip content={<CustomTooltip isLight={isLight} />} />
                        <Bar dataKey="basalArea" name="Área Basal (m²)" fill="url(#spBasalGrad)" stroke={colorBasal} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
