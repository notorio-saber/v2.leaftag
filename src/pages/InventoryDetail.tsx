import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import * as XLSX from 'xlsx';
import { calculateBasalArea, calculateVolume } from '../utils/forestryCalculations';

export const InventoryDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { inventories, deleteInventory, setCurrentInventory } = useInventory();
  
  const inventory = inventories.find(i => i.id.toString() === id);
  const [fatorForma, setFatorForma] = useState('0.7');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [selectedCalcs, setSelectedCalcs] = useState({
    areaBasal: true,
    volume: true,
    dapEquivalente: false,
    fustes: false
  });

  if (!inventory) {
    return <div style={{ color: 'white', padding: '20px' }}>Inventário não encontrado.</div>;
  }

  const handleExportCustom = () => {
    const data = inventory.dados.map(ind => {
      let baseData: any = {
        'Número': ind.numeroIndividuo,
        'Data / Hora': ind.timestamp,
        ...ind,
      };

      delete baseData.stems;
      delete baseData.multipleStems;
      delete baseData.id;

      let maxCap = ind.cap;
      let maxHt = ind.ht;

      if (selectedCalcs.fustes && ind.multipleStems && ind.stems) {
        baseData['Qtd Fustes'] = ind.stems.length;
        let areaBasalTotal = 0;
        ind.stems.forEach((stem: any, i: number) => {
          baseData[`Fuste_${i+1}_CAP`] = stem.cap;
          baseData[`Fuste_${i+1}_Altura`] = stem.altura;
          if (selectedCalcs.areaBasal) {
            const g = calculateBasalArea(stem.cap);
            baseData[`Fuste_${i+1}_AreaBasal`] = g.toFixed(4);
            areaBasalTotal += g;
            if(stem.cap > (maxCap||0)) maxCap = stem.cap;
            if(stem.altura > (maxHt||0)) maxHt = stem.altura;
          }
        });
        if (selectedCalcs.areaBasal) baseData['Area_Basal_Total (m2)'] = areaBasalTotal.toFixed(4);
        if (selectedCalcs.volume) baseData['Volume_Total (m3)'] = calculateVolume(areaBasalTotal, maxHt, parseFloat(fatorForma)).toFixed(4);
      } else if (ind.cap) {
        if (selectedCalcs.areaBasal) {
          const g = calculateBasalArea(parseFloat(ind.cap));
          baseData['Area_Basal (m2)'] = g.toFixed(4);
          if (selectedCalcs.volume) baseData['Volume (m3)'] = calculateVolume(g, parseFloat(ind.ht || 0), parseFloat(fatorForma)).toFixed(4);
        }
      }
      if (selectedCalcs.dapEquivalente && maxCap) {
        baseData['DAP_Equivalente (cm)'] = (parseFloat(maxCap) / Math.PI).toFixed(2);
      }
      return baseData;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    XLSX.writeFile(workbook, `${inventory.nome.replace(/\s+/g, '_')}_export.xlsx`);
    setShowExportOptions(false);
  };

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      <div className="app-header">
        <div>
          <h2 style={{ color: 'var(--primary-color)' }}>{inventory.nome}</h2>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{inventory.local} • {inventory.areaParcela} m²</span>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '16px' }}>
        <h3 style={{ marginBottom: '16px' }}>⚙️ Opções de Exportação (Excel)</h3>
        
        <label className="input-label">Fator de Forma (para cálculos avançados)</label>
        <input 
          type="number" 
          step="0.01" 
          className="input-field" 
          value={fatorForma} 
          onChange={e => setFatorForma(e.target.value)} 
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
          <button className="btn btn-primary" onClick={() => setShowExportOptions(true)}>📊 Exportar Personalizado</button>
        </div>
        {showExportOptions && (
          <div style={{ marginTop: 16, background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
            <h4 style={{ marginBottom: 8 }}>Escolha os cálculos para exportar:</h4>
            <label style={{ display: 'block', marginBottom: 4 }}>
              <input type="checkbox" checked={selectedCalcs.areaBasal} onChange={e => setSelectedCalcs(c => ({...c, areaBasal: e.target.checked}))} /> Área Basal
            </label>
            <label style={{ display: 'block', marginBottom: 4 }}>
              <input type="checkbox" checked={selectedCalcs.volume} onChange={e => setSelectedCalcs(c => ({...c, volume: e.target.checked}))} /> Volume
            </label>
            <label style={{ display: 'block', marginBottom: 4 }}>
              <input type="checkbox" checked={selectedCalcs.dapEquivalente} onChange={e => setSelectedCalcs(c => ({...c, dapEquivalente: e.target.checked}))} /> DAP Equivalente
            </label>
            <label style={{ display: 'block', marginBottom: 4 }}>
              <input type="checkbox" checked={selectedCalcs.fustes} onChange={e => setSelectedCalcs(c => ({...c, fustes: e.target.checked}))} /> Detalhar Fustes
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={handleExportCustom}>Exportar</button>
              <button className="btn btn-secondary" onClick={() => setShowExportOptions(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>Voltar</button>
        <button 
          className="btn btn-primary" 
          style={{ background: '#2196f3' }} 
          onClick={() => {
            setCurrentInventory(inventory);
            navigate('/collect');
          }}
        >
          Continuar Coleta
        </button>
        <button 
          className="btn btn-danger" 
          onClick={() => {
            if(window.confirm('Tem certeza? Isso apagará todo este inventário.')) {
              deleteInventory(inventory.id);
              navigate('/');
            }
          }}
        >
          Excluir
        </button>
      </div>
    </div>
  );
};
