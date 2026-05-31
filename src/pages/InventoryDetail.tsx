import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { calculateBasalArea, calculateVolume } from '../utils/forestryCalculations';
import { getPhotosForInventory, deletePhotosForIndividual } from '../utils/photoStorage';
import { StatisticalDashboard } from '../components/StatisticalDashboard';

export const InventoryDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { inventories, deleteInventory, setCurrentInventory, fieldWorks, saveInventory, talhoes } = useInventory();
  
  const inventory = inventories.find(i => i.id.toString() === id);
  const fieldwork = fieldWorks.find(f => f.id === inventory?.fieldWorkId);
  const talhao = talhoes.find(t => t.id === inventory?.talhaoId);
  
  const [fatorForma, setFatorForma] = useState('0.7');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [selectedCalcs, setSelectedCalcs] = useState({
    areaBasal: true,
    volume: true,
    dapEquivalente: false,
    fustes: false
  });
  const [isZipping, setIsZipping] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  // Sampling Sufficiency Logic (Assíntota)
  const isSufficiencyReached = (() => {
    if (!inventory || inventory.dados.length < 30) return false;
    
    const N = inventory.dados.length;
    const threshold = Math.max(10, Math.floor(N * 0.2)); // Check at least last 10, or 20% of total
    const cutoffIndex = N - threshold;

    const oldSpecies = new Set<string>();
    const newWindowSpecies = new Set<string>();

    inventory.dados.forEach((ind: any, index: number) => {
      const sp = (ind.nomePopular || ind.nomeCientifico || 'Não Identificada').trim();
      if (index < cutoffIndex) {
        oldSpecies.add(sp);
      } else {
        newWindowSpecies.add(sp);
      }
    });

    // Check if any species in the new window is genuinely new
    for (const sp of newWindowSpecies) {
      if (!oldSpecies.has(sp)) {
        return false; // Found a new species recently, curve not stabilized
      }
    }
    
    return true; // No new species in the last X% of tree! Asymptote reached.
  })();

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

  const handleDownloadPhotos = async () => {
    setIsZipping(true);
    try {
      const photos = await getPhotosForInventory(inventory.id);
      if (photos.length === 0) {
        alert("Nenhuma foto encontrada para este inventário no banco offline.");
        setIsZipping(false);
        return;
      }
      
      const zip = new JSZip();
      photos.forEach(photo => {
        // extract base64 data without header (e.g. data:image/jpeg;base64,xxxx)
        const base64Data = photo.base64Data.split(',')[1];
        zip.file(photo.fileName, base64Data, { base64: true });
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Fotos_${inventory.nome.replace(/\s+/g, '_')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Erro ao extrair zip: " + err);
    }
    setIsZipping(false);
  };

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      {/* Breadcrumbs Navigation */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/')}>Trabalhos</span>
        <span>/</span>
        <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/fieldwork/${inventory.fieldWorkId}`)}>{fieldwork?.nome || 'Trabalho'}</span>
        <span>/</span>
        <span>{talhao ? talhao.nome : 'Sem Talhão'}</span>
        <span>/</span>
        <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{inventory.nome}</span>
      </div>

      <div className="app-header">
        <div>
          <h2 style={{ color: 'var(--primary-color)' }}>{inventory.nome}</h2>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            📍 {fieldwork?.nome || 'Trabalho Desconhecido'} ➔ 🌳 {talhao ? talhao.nome : 'Sem Talhão'} • 📐 {inventory.areaParcela} m²
          </span>
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
        
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ flex: '1 1 200px', borderColor: '#ffb74d', color: '#ffb74d' }} onClick={() => setShowDashboard(true)}>
            📊 Ver Dashboard da Parcela
          </button>
          <button className="btn btn-secondary" style={{ flex: '1 1 200px', borderColor: '#4fc3f7', color: '#4fc3f7' }} onClick={handleDownloadPhotos} disabled={isZipping}>
            {isZipping ? "⏳ Compactando Zíper..." : "🗃️ Baixar Galeria (ZIP)"}
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
        <div style={{ padding: '16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>📋 Dados Coletados ({inventory.dados.length})</h3>
            {isSufficiencyReached && (
              <span style={{ background: '#2e7d32', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                ✅ Suficiência Amostral (Assíntota)
              </span>
            )}
          </div>
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
          if(window.confirm('Tem certeza em excluir definitivamente a parcela e TODOS OS SEUS DADOS E FOTOS? Essa ação é vitalícia.')) {
            // Hard cascade deletion 
            inventory.dados.forEach((d: any) => deletePhotosForIndividual(d.id));
            deleteInventory(inventory.id);
            navigate(`/fieldwork/${inventory.fieldWorkId}`);
          }
        }}>
          ⚠️ Excluir Parcela (Irreversível)
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

      {showDashboard && <StatisticalDashboard inventories={[inventory]} onClose={() => setShowDashboard(false)} />}
    </div>
  );
};
