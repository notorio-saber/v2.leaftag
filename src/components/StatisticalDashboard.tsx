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

          {/* Modelos Florestais Utilizados (Processamento Profissional) */}
          {stats.isProcessed && (
            <div className="glass-card" style={{
              padding: '20px',
              borderRadius: '20px',
              border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(46, 125, 50, 0.25)',
              background: isLight ? '#ffffff' : 'linear-gradient(135deg, rgba(46, 125, 50, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '24px',
              justifyContent: 'space-between'
            }}>
              <div style={{ flex: '1 1 200px' }}>
                <span style={{ fontSize: '11px', color: isLight ? '#16a34a' : 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                  Modelo Hipsométrico (Altura)
                </span>
                <span style={{ fontSize: '15px', color: isLight ? '#0f172a' : '#fff', fontWeight: 'bold' }}>
                  {stats.hModelName}
                </span>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <span style={{ fontSize: '11px', color: isLight ? '#16a34a' : 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                  Modelo Volumétrico (Volume)
                </span>
                <span style={{ fontSize: '15px', color: isLight ? '#0f172a' : '#fff', fontWeight: 'bold' }}>
                  {stats.vModelName}
                </span>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <span style={{ fontSize: '11px', color: isLight ? '#16a34a' : 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                  Alturas Amostradas
                </span>
                <div style={{ display: 'flex', gap: '16px', fontSize: '14px', fontWeight: 'bold', color: isLight ? '#1e293b' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                      <path d="m9 12 2 2 4-4"/>
                    </svg>
                    Medidas: <span style={{ marginLeft: '4px', color: isLight ? '#16a34a' : '#a5d6a7' }}>{stats.measuredHtCount}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                      <path d="M3 3v18h18" />
                      <path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                    Estimadas: <span style={{ marginLeft: '4px', color: isLight ? '#d97706' : '#ffb74d' }}>{stats.estimatedHtCount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                          <stop offset="5%" stopColor={colorVolume} stopOpacity={isLight ? 0.75 : 0.8}/>
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
                          <stop offset="5%" stopColor={colorBasal} stopOpacity={isLight ? 0.75 : 0.8}/>
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

             {/* Species Chart (Expands dynamically to span full width where helpful) */}
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
        </div>
      </div>
    </div>
  );
};
