import React, { useState, useMemo, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import html2canvas from 'html2canvas';
import type { Inventory, IndividualData } from '../types';
import { calculateShannonIndex, calculateSimpsonIndex, calculatePielouIndex, calculateBasalArea, calculateVolume } from '../utils/forestryCalculations';

interface DashboardProps {
  inventories: Inventory[];
  onClose: () => void;
}

export const StatisticalDashboard: React.FC<DashboardProps> = ({ inventories, onClose }) => {
  const [classInterval, setClassInterval] = useState<number>(10);
  const [alturaInterval, setAlturaInterval] = useState<number>(5);
  const [fatorForma, setFatorForma] = useState<number>(0.7);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Aggregation Logic
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
      if (ind.ht) {
        maxHtObj = parseFloat(ind.ht.toString());
        if (!isNaN(maxHtObj) && maxHtObj > 0) {
          const htGroup = Math.floor(maxHtObj / alturaInterval) * alturaInterval;
          const htLabel = `${htGroup} - ${htGroup + alturaInterval}m`;
          distAltura[htLabel] = (distAltura[htLabel] || 0) + 1;
        }
      }

      // Stems / CAP
      let stemsProps: { dap: number, cap: number, ht: number }[] = [];
      if (ind.multipleStems && ind.stems) {
         ind.stems.forEach(s => {
           stemsProps.push({ 
             dap: processCapDap(s.cap, undefined), 
             cap: parseFloat((s.cap||'0').toString()), 
             ht: parseFloat((s.altura||'0').toString()) 
           });
         });
      } else {
         const mainDap = processCapDap(ind.cap, ind.dap);
         const ht = parseFloat((ind.ht||'0').toString());
         if (mainDap > 0) {
            stemsProps.push({ dap: mainDap, cap: ind.cap ? parseFloat(ind.cap.toString()) : mainDap*Math.PI, ht: ht });
         }
      }

      stemsProps.forEach(stem => {
         if (stem.dap > 0) {
           totalFustes++;
           const groupBase = Math.floor(stem.dap / classInterval) * classInterval;
           const diamLabel = `${groupBase} - ${groupBase + classInterval}cm`;
           
           distDiametric[diamLabel] = (distDiametric[diamLabel] || 0) + 1;

           // Calculate Metrics
           const g = calculateBasalArea(stem.cap);
           const v = calculateVolume(g, stem.ht || maxHtObj, fatorForma);
           
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
      speciesFinal 
    };
  }, [inventories, classInterval, alturaInterval, fatorForma]);

  const handleExportSnapshot = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(containerRef.current, { backgroundColor: '#1a1f1c', scale: 2 });
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

  const TopStatCard = ({ title, value, sub }: { title: string, value: string, sub: string }) => (
    <div style={{ flex: '1 1 120px', background: 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
      <div style={{ fontSize: '12px', color: 'gray', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: '4px 0' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--primary-color)' }}>{sub}</div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-color)', zIndex: 9999, display: 'flex', flexDirection: 'column',
      overflowX: 'hidden', maxWidth: '100vw'
    }}>
      <div style={{ padding: '16px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--primary-color)' }}>📊 Dashboard Analítico (Fitossociologia)</h2>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px' }} onClick={onClose}>✕ Fechar</button>
      </div>

      {/* Control Strip */}
      <div style={{ background: '#111513', padding: '12px 24px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #333' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
             <label style={{ fontSize: '12px', color: 'gray' }}>Fator de Forma Geral (v):</label>
             <input type="number" step="0.01" className="input-field" style={{ width: '70px', marginBottom: 0, textAlign: 'center', padding: '4px' }} value={fatorForma} onChange={e => setFatorForma(parseFloat(e.target.value) || 0.7)} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
             <label style={{ fontSize: '12px', color: 'gray' }}>Classe de DAP (cm):</label>
             <input type="number" className="input-field" style={{ width: '70px', marginBottom: 0, textAlign: 'center', padding: '4px' }} value={classInterval} onChange={e => setClassInterval(parseInt(e.target.value) || 10)} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
             <label style={{ fontSize: '12px', color: 'gray' }}>Classe de HT (m):</label>
             <input type="number" className="input-field" style={{ width: '70px', marginBottom: 0, textAlign: 'center', padding: '4px' }} value={alturaInterval} onChange={e => setAlturaInterval(parseInt(e.target.value) || 5)} />
          </div>
          <button className="btn btn-primary" style={{ width: 'auto', marginLeft: 'auto', padding: '8px 16px' }} onClick={handleExportSnapshot} disabled={isExporting}>
            📸 {isExporting ? 'Renderizando...' : 'Gerar Laudo (PNG)'}
          </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} ref={containerRef}>
        
        {/* Top High Level Stats */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
           <TopStatCard title="Amostragem Base" value={stats.totalFustes.toString()} sub={`${stats.totalInd} Indivíduos`} />
           <TopStatCard title="Especialização" value={stats.speciesCount.toString()} sub="Espécies Mapeadas" />
           <TopStatCard title="Volume Total (M³)" value={stats.totalV.toFixed(2)} sub="Biomassa Estimada" />
           <TopStatCard title="Área Basal (M²)" value={stats.totalG.toFixed(4)} sub="Basimetria" />
           <TopStatCard title="Shannon (H')" value={stats.shannon.toFixed(4)} sub="Índice de Diversidade" />
           <TopStatCard title="Simpson (1-D)" value={stats.simpson.toFixed(4)} sub="Riqueza Ecológica" />
           <TopStatCard title="Pielou (J')" value={stats.pielou.toFixed(4)} sub="Equitabilidade" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
           
           {/* Collector's Curve */}
           <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '16px', color: '#ffb74d' }}>Curva do Coletor (Suficiência Amostral)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.collectorCurveData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="ind" stroke="#ccc" tick={{ fill: '#aaa' }} label={{ value: "Nº Indivíduos Medidos", position: 'bottom', fill: '#888' }} />
                    <YAxis stroke="#ccc" tick={{ fill: '#aaa' }} label={{ value: "Novas Espécies", angle: -90, position: 'insideLeft', fill: '#888' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                    <Line type="monotone" dataKey="speciesCount" name="Espécies Descobertas" stroke="#ffb74d" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Diametric Chart */}
           <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '16px', color: '#4fc3f7' }}>Distribuição Diamétrica (Indivíduos por Classe)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.diametricFinal} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="name" stroke="#ccc" tick={{ fill: '#aaa' }} />
                    <YAxis stroke="#ccc" tick={{ fill: '#aaa' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                    <Bar dataKey="value" name="Árvores/Fustes" fill="#4fc3f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Volume Chart */}
           <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '16px', color: '#ba68c8' }}>Volume por Classe Diamétrica (m³)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.volumeFinal} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="name" stroke="#ccc" tick={{ fill: '#aaa' }} />
                    <YAxis stroke="#ccc" tick={{ fill: '#aaa' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                    <Bar dataKey="value" name="Volume (m³)" fill="#ba68c8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Basal Area Chart */}
           <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '16px', color: '#e57373' }}>Área Basal por Classe Diamétrica (m²)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.basalFinal} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="name" stroke="#ccc" tick={{ fill: '#aaa' }} />
                    <YAxis stroke="#ccc" tick={{ fill: '#aaa' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                    <Bar dataKey="value" name="Área Basal (m²)" fill="#e57373" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Height Chart */}
           <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '16px', color: '#aed581' }}>Distribuição de Alturas (m)</h3>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.alturaFinal} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="name" stroke="#ccc" tick={{ fill: '#aaa' }} />
                    <YAxis stroke="#ccc" tick={{ fill: '#aaa' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                    <Bar dataKey="value" name="Indivíduos" fill="#aed581" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Species Chart */}
           <div className="glass-card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
              <h3 style={{ marginBottom: '16px', color: 'var(--primary-color)' }}>Frequência de Espécies (Top 10)</h3>
              <div style={{ height: '400px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.speciesFinal} layout="vertical" margin={{ top: 10, right: 30, left: 120, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
                    <XAxis type="number" stroke="#ccc" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#ccc" width={110} tick={{ fill: '#aaa', fontSize: 12 }} interval={0} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                    <Bar dataKey="count" name="Indivíduos" radius={[0, 4, 4, 0]}>
                      {stats.speciesFinal.map((_, index) => (
                         <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--primary-color)' : '#1e5f38'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};
