import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import * as XLSX from 'xlsx';
import { calculateBasalArea, calculateVolume } from '../utils/forestryCalculations';

export const InventoryDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { inventories, deleteInventory, setCurrentInventory, fieldWorks, saveInventory } = useInventory();
  
  const inventory = inventories.find(i => i.id.toString() === id);
  const fieldwork = fieldWorks.find(f => f.id === inventory?.fieldWorkId);
  
  const [fatorForma, setFatorForma] = useState('0.7');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [selectedCalcs, setSelectedCalcs] = useState({
    areaBasal: true,
    volume: true,
    dapEquivalente: false,
    fustes: false
  });

  // Estado para edição
  const [editingInd, setEditingInd] = useState<any>(null);

  if (!inventory) {
    return <div style={{ color: 'white', padding: '20px' }}>Inventário não encontrado.</div>;
  }

  const handleExportRaw = () => {
    const data = inventory.dados.map(ind => {
      let baseData: any = {
        'Número': ind.numeroIndividuo,
        'Data / Hora': ind.timestamp,
      };
      
      inventory.colunas.forEach(col => {
        baseData[col.nome] = ind[col.id] || '';
      });

      if (ind.multipleStems && ind.stems) {
         ind.stems.forEach((stem: any, i: number) => {
           baseData[`Fuste_${i+1}_CAP`] = stem.cap;
           baseData[`Fuste_${i+1}_Altura`] = stem.altura;
         });
      }
      return baseData;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados Brutos");
    XLSX.writeFile(workbook, `${inventory.nome.replace(/\s+/g, '_')}_brutos.xlsx`);
  };

  const handleExportProcessed = () => {
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
            const capNum = parseFloat(stem.cap || '0');
            const g = calculateBasalArea(capNum);
            baseData[`Fuste_${i+1}_AreaBasal`] = g.toFixed(4);
            areaBasalTotal += g;
            if(capNum > (maxCap||0)) maxCap = capNum;
            if(parseFloat(stem.altura||'0') > (maxHt||0)) maxHt = parseFloat(stem.altura);
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Processados");
    XLSX.writeFile(workbook, `${inventory.nome.replace(/\s+/g, '_')}_processados.xlsx`);
    setShowExportOptions(false);
  };

  const handleSaveEdit = () => {
    const freshInv = JSON.parse(JSON.stringify(inventory));
    const targetIdx = freshInv.dados.findIndex((d: any) => d.id === editingInd.id);
    if (targetIdx >= 0) {
      freshInv.dados[targetIdx] = editingInd;
      saveInventory(freshInv);
      setEditingInd(null);
    }
  };

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      <div className="app-header">
        <div>
          <h2 style={{ color: 'var(--primary-color)' }}>{inventory.nome}</h2>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{fieldwork?.nome || 'Trabalho Desconhecido'} • {inventory.areaParcela} m²</span>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => navigate(`/fieldwork/${inventory.fieldWorkId}`)}>Voltar</button>
      </div>

      <div className="glass-card" style={{ marginBottom: '16px' }}>
        <h3 style={{ marginBottom: '16px' }}>📥 Exportar Dados (Excel)</h3>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ flex: '1 1 200px' }} onClick={handleExportRaw}>
            📄 Exportar Dados Brutos
          </button>
          <button className="btn btn-primary" style={{ flex: '1 1 200px' }} onClick={() => setShowExportOptions(!showExportOptions)}>
            ⚙️ Exportar Processados
          </button>
        </div>

        {showExportOptions && (
          <div style={{ marginTop: 16, background: '#e0e0e0', padding: 16, borderRadius: 8, color: '#333' }}>
            <label className="input-label" style={{ color: '#333' }}>Fator de Forma (cálculos avançados)</label>
            <input 
              type="number" step="0.01" 
              className="input-field" 
              style={{ background: 'white', color: 'black' }}
              value={fatorForma} 
              onChange={e => setFatorForma(e.target.value)} 
            />

            <h4 style={{ marginBottom: 8, color: '#333' }}>Escolha os cálculos associados:</h4>
            <label style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedCalcs.areaBasal} onChange={e => setSelectedCalcs(c => ({...c, areaBasal: e.target.checked}))} /> Área Basal
            </label>
            <label style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedCalcs.volume} onChange={e => setSelectedCalcs(c => ({...c, volume: e.target.checked}))} /> Volume Estimado
            </label>
            <label style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedCalcs.dapEquivalente} onChange={e => setSelectedCalcs(c => ({...c, dapEquivalente: e.target.checked}))} /> DAP Equivalente
            </label>
            <label style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedCalcs.fustes} onChange={e => setSelectedCalcs(c => ({...c, fustes: e.target.checked}))} /> Detalhar Fustes Exclusivos
            </label>
            
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleExportProcessed} style={{ background: '#2196f3' }}>Confirmar e Baixar</button>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: '16px', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>📋 Dados Coletados ({inventory.dados.length})</h3>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '6px 12px', fontSize: 14 }} onClick={() => { setCurrentInventory(inventory); navigate('/collect'); }}>
            + Continuar Coletando
          </button>
        </div>
        
        <div style={{ overflowX: 'auto', padding: '16px' }}>
          {inventory.dados.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nenhum dado coletado nesta parcela ainda.</p>
          ) : (
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px', borderBottom: '2px solid #555' }}>Nº</th>
                  {inventory.colunas.map(col => (
                    <th key={col.id} style={{ padding: '8px', borderBottom: '2px solid #555' }}>{col.nome}</th>
                  ))}
                  <th style={{ padding: '8px', borderBottom: '2px solid #555' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {inventory.dados.map((ind: any) => (
                  <tr key={ind.id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '12px 8px' }}>{ind.numeroIndividuo}</td>
                    {inventory.colunas.map(col => (
                      <td key={col.id} style={{ padding: '12px 8px' }}>
                         {col.id === 'coordenadas' ? ind[col.id]?.substring(0, 15) + '...' : ind[col.id]}
                         {ind.multipleStems && ['cap', 'hc', 'ht'].includes(col.id) ? `[Múltiplos: ${ind.stems?.length}]` : ''}
                      </td>
                    ))}
                    <td style={{ padding: '12px 8px' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 12px', width: 'auto' }} onClick={() => setEditingInd(JSON.parse(JSON.stringify(ind)))}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button className="btn btn-danger" style={{ opacity: 0.8 }} onClick={() => {
          if(window.confirm('Tem certeza em excluir definitivamente?')) {
            deleteInventory(inventory.id);
            navigate(`/fieldwork/${inventory.fieldWorkId}`);
          }
        }}>
          ⚠️ Excluir Parcela
        </button>
      </div>

      {editingInd && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '20px', overflowY: 'auto' }}>
           <div className="glass-card" style={{ width: '100%', maxWidth: '600px', marginTop: '20px', marginBottom: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3>Edição: Indivíduo #{editingInd.numeroIndividuo}</h3>
                <button onClick={() => setEditingInd(null)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: 20 }}>✕</button>
              </div>

              {inventory.colunas.map(col => {
                if (editingInd.multipleStems && ['cap', 'hc', 'ht'].includes(col.id)) return null;

                return (
                  <div key={col.id} style={{ marginBottom: 12 }}>
                    <label className="input-label">{col.nome}</label>
                    <input 
                      type={col.tipo === 'number' ? 'number' : 'text'} 
                      className="input-field" 
                      value={editingInd[col.id] || ''} 
                      onChange={e => setEditingInd({...editingInd, [col.id]: e.target.value})} 
                    />
                  </div>
                );
              })}

              {editingInd.multipleStems && editingInd.stems && (
                <div style={{ background: '#252b28', padding: 12, borderRadius: 8, marginTop: 16 }}>
                  <h4>Fustes de Ramificação</h4>
                  {editingInd.stems.map((stem: any, i: number) => (
                    <div key={stem.id} style={{ display: 'flex', gap: 8, marginBottom: 8, marginTop: 8 }}>
                      <input type="number" className="input-field" placeholder="CAP" value={stem.cap} onChange={e => {
                        const s = [...editingInd.stems]; s[i].cap = e.target.value; setEditingInd({...editingInd, stems: s});
                      }} style={{ marginBottom: 0 }} />
                      <input type="number" className="input-field" placeholder="Alt" value={stem.altura} onChange={e => {
                        const s = [...editingInd.stems]; s[i].altura = e.target.value; setEditingInd({...editingInd, stems: s});
                      }} style={{ marginBottom: 0 }} />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button className="btn btn-secondary" onClick={() => setEditingInd(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveEdit}>💾 Salvar Alterações</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
