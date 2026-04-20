import React, { useState, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import html2canvas from 'html2canvas';
import type { Inventory, IndividualData } from '../types';

interface DashboardProps {
  inventories: Inventory[];
  onClose: () => void;
}

export const StatisticalDashboard: React.FC<DashboardProps> = ({ inventories, onClose }) => {
  const [classInterval, setClassInterval] = useState<number>(10);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Aggregation Logic
  const { totalInd, diametricData, speciesData } = useMemo(() => {
    let allInd: IndividualData[] = [];
    inventories.forEach(inv => {
      allInd = allInd.concat(inv.dados);
    });

    // Species Count
    const spCount: Record<string, number> = {};
    let validDapCount = 0;
    
    // Dist classes dict
    const distParams: Record<string, number> = {};

    allInd.forEach(ind => {
      // species
      const spName = (ind.nomePopular || ind.nomeCientifico || 'Não Identificada').trim() || 'Não Identificada';
      spCount[spName] = (spCount[spName] || 0) + 1;

      // Handle Stems for CAP/DAP logic
      const processCapDap = (capStr?: string, dapStr?: string) => {
         let d = 0;
         if (dapStr) d = parseFloat(dapStr);
         else if (capStr) d = parseFloat(capStr) / Math.PI;
         return isNaN(d) ? 0 : d;
      };

      let stemsDaps: number[] = [];
      if (ind.multipleStems && ind.stems) {
         stemsDaps = ind.stems.map(s => processCapDap(s.cap, ''));
      } else {
         const mainDap = processCapDap(ind.cap as string, ind.dap as string);
         if (mainDap > 0) stemsDaps = [mainDap];
      }

      stemsDaps.forEach(d => {
         if (d > 0) {
           validDapCount++;
           const groupBase = Math.floor(d / classInterval) * classInterval;
           const groupLabel = `${groupBase} - ${groupBase + classInterval}`;
           distParams[groupLabel] = (distParams[groupLabel] || 0) + 1;
         }
      });
    });

    const diametricFinal = Object.keys(distParams)
      .sort((a,b) => parseInt(a) - parseInt(b))
      .map(k => ({ name: k, count: distParams[k] }));

    const speciesFinal = Object.keys(spCount)
      .map(k => ({ name: k, count: spCount[k] }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 10); // Top 10

    return { totalInd: allInd.length, diametricData: diametricFinal, speciesData: speciesFinal };
  }, [inventories, classInterval]);

  const handleExportSnapshot = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(containerRef.current, { backgroundColor: '#1a1f1c', scale: 2 });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laudo_Grafico_${Date.now()}.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar print dos gráficos.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-color)', zIndex: 9999, display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ padding: '16px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--primary-color)' }}>📊 Dashboard Analítico</h2>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px' }} onClick={onClose}>✕ Fechar</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} ref={containerRef}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
             <h3 style={{ fontSize: '20px' }}>Resumo Populacional</h3>
             <p style={{ color: 'var(--text-muted)' }}>Projetado com base em {totalInd} cadastros (Múltiplos fustes computados no diâmetro).</p>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '12px 24px', borderRadius: '8px' }}>
             <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Amplitude da Classe Diamétrica (cm):</label>
             <input 
               type="number" 
               className="input-field" 
               style={{ width: '80px', marginBottom: 0, textAlign: 'center' }} 
               value={classInterval} 
               onChange={e => {
                 const v = parseInt(e.target.value);
                 if (v > 0) setClassInterval(v);
               }} 
             />
          </div>

          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleExportSnapshot} disabled={isExporting}>
            📸 {isExporting ? 'Renderizando...' : 'Salvar Relatório como Imagem'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
           {/* Diametric Chart */}
           <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '16px', color: '#4fc3f7' }}>Distribuição Diamétrica (DAP, cm)</h3>
              {diametricData.length === 0 ? (
                <p style={{ color: 'gray' }}>Sem dados de CAP/DAP suficientes para gerar o gráfico.</p>
              ) : (
                <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={diametricData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="name" stroke="#ccc" tick={{ fill: '#aaa' }} />
                      <YAxis stroke="#ccc" tick={{ fill: '#aaa' }} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                      <Bar dataKey="count" name="Indivíduos / Fustes" fill="#4fc3f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
           </div>

           {/* Species Chart */}
           <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '16px', color: 'var(--primary-color)' }}>Frequência de Espécies (Top 10)</h3>
              {speciesData.length === 0 ? (
                <p style={{ color: 'gray' }}>Sem dados de espécie suficientes.</p>
              ) : (
                <div style={{ height: '350px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={speciesData} layout="vertical" margin={{ top: 10, right: 30, left: 100, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
                      <XAxis type="number" stroke="#ccc" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" stroke="#ccc" width={90} tick={{ fill: '#aaa', fontSize: 12 }} interval={0} />
                      <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                      <Bar dataKey="count" name="Indivíduos" radius={[0, 4, 4, 0]}>
                        {speciesData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--primary-color)' : '#66bb6a'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
