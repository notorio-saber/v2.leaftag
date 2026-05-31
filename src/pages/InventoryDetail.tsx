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
  
  // Tipo de ordenação da visualização local
  const [sortType, setSortType] = useState<'original' | 'height' | 'thickness'>('original');

  // Auxiliar para obter a altura máxima do indivíduo (considera fustes se bifurcado)
  const getTreeMaxHeight = (ind: any) => {
    let maxHt = parseFloat(ind.ht || '0');
    if (isNaN(maxHt)) maxHt = 0;
    if (ind.multipleStems && ind.stems) {
      ind.stems.forEach((s: any) => {
        const h = parseFloat(s.altura || '0');
        if (!isNaN(h) && h > maxHt) maxHt = h;
      });
    }
    return maxHt;
  };

  // Auxiliar para obter o diâmetro/circunferência máxima do indivíduo (considera fustes se bifurcado)
  const getTreeMaxThickness = (ind: any) => {
    let maxCap = parseFloat(ind.cap || '0');
    if (isNaN(maxCap)) maxCap = 0;
    
    let maxDap = parseFloat(ind.dap || '0');
    if (isNaN(maxDap)) maxDap = 0;
    
    let thickness = Math.max(maxCap, maxDap * Math.PI);

    if (ind.multipleStems && ind.stems) {
      ind.stems.forEach((s: any) => {
        const c = parseFloat(s.cap || '0');
        if (!isNaN(c) && c > maxCap) maxCap = c;
      });
      thickness = maxCap;
    }
    return thickness;
  };

  // Retorna os dados ordenados para exibição sem alterar a ordem real do banco de dados
  const sortedDados = (() => {
    if (!inventory || !inventory.dados) return [];
    const dadosCopy = [...inventory.dados];
    if (sortType === 'height') {
      return dadosCopy.sort((a, b) => getTreeMaxHeight(b) - getTreeMaxHeight(a));
    }
    if (sortType === 'thickness') {
      return dadosCopy.sort((a, b) => getTreeMaxThickness(b) - getTreeMaxThickness(a));
    }
    return dadosCopy; // ordem original
  })();


  if (!inventory) {
    return (
      <div className="container" style={{ marginTop: '20px', textAlign: 'center' }}>
        <div className="glass-card">
          <h2>Parcela não encontrada</h2>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/')}>Voltar</button>
        </div>
      </div>
    );
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
        alert("Nenhuma foto encontrada para esta parcela no banco offline.");
        setIsZipping(false);
        return;
      }
      
      const zip = new JSZip();
      photos.forEach(photo => {
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
      alert("Erro ao extrair zip de fotos: " + err);
    }
    setIsZipping(false);
  };

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      {/* Breadcrumbs Navigation */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '18px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '0.5px' }}>
        <span style={{ cursor: 'pointer', textDecoration: 'none', transition: 'color 0.2s' }} className="hover:text-white" onClick={() => navigate('/')}>Trabalhos</span>
        <span>/</span>
        <span style={{ cursor: 'pointer', textDecoration: 'none', transition: 'color 0.2s' }} className="hover:text-white" onClick={() => navigate(`/fieldwork/${inventory.fieldWorkId}`)}>{fieldwork?.nome || 'Trabalho'}</span>
        <span>/</span>
        <span>{talhao ? talhao.nome : 'Sem Talhão'}</span>
        <span>/</span>
        <span style={{ color: 'var(--primary-hover)', fontWeight: 'bold' }}>{inventory.nome}</span>
      </div>

      {/* Header */}
      <div className="app-header">
        <div>
          <h2 style={{ color: 'var(--primary-hover)', fontSize: '24px', fontWeight: '800' }}>{inventory.nome}</h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Manejo: {fieldwork?.nome || 'Sem Projeto'} | Talhão: {talhao ? talhao.nome : 'Sem Talhão'} | Área: {inventory.areaParcela} m²
          </span>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => navigate(`/fieldwork/${inventory.fieldWorkId}`)}>
          Voltar
        </button>
      </div>

      {/* Data Export Options & Actions */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '800' }}>Exportações e Painel</h3>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button className="btn btn-secondary" style={{ flex: '1 1 180px' }} onClick={handleExportRaw}>
            Exportar Brutos
          </button>
          <button className="btn btn-primary" style={{ flex: '1 1 180px' }} onClick={() => setShowExportOptions(!showExportOptions)}>
            Processar e Baixar
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ flex: '1 1 180px', borderColor: '#2e7d32', color: '#a5d6a7', background: 'rgba(46, 125, 50, 0.08)' }} onClick={() => setShowDashboard(true)}>
            Dashboard Estatístico
          </button>
          <button className="btn btn-secondary" style={{ flex: '1 1 180px', borderColor: '#009688', color: '#80cbc4', background: 'rgba(0, 150, 136, 0.08)' }} onClick={handleDownloadPhotos} disabled={isZipping}>
            {isZipping ? "Gerando ZIP..." : "Galeria de Fotos (ZIP)"}
          </button>
        </div>

        {showExportOptions && (
          <div style={{ 
            marginTop: '20px', 
            background: 'rgba(0,0,0,0.3)', 
            padding: '20px', 
            borderRadius: '16px', 
            border: '1px solid rgba(255,255,255,0.06)' 
          }}>
            <label className="input-label">Fator de Forma Comercial (Cálculo Volumétrico)</label>
            <input 
              type="number" step="0.01" 
              className="input-field" 
              value={fatorForma} 
              onChange={e => setFatorForma(e.target.value)} 
            />

            <h4 style={{ marginBottom: '12px', fontSize: '13px', color: '#ffffff', textTransform: 'uppercase', fontWeight: 'bold' }}>Cálculos e Parâmetros:</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '13.5px' }}>
                <input type="checkbox" checked={selectedCalcs.areaBasal} onChange={e => setSelectedCalcs(c => ({...c, areaBasal: e.target.checked}))} style={{ accentColor: 'var(--primary-hover)' }} /> Área Basal (g)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '13.5px' }}>
                <input type="checkbox" checked={selectedCalcs.volume} onChange={e => setSelectedCalcs(c => ({...c, volume: e.target.checked}))} style={{ accentColor: 'var(--primary-hover)' }} /> Volume Estimado (v)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '13.5px' }}>
                <input type="checkbox" checked={selectedCalcs.dapEquivalente} onChange={e => setSelectedCalcs(c => ({...c, dapEquivalente: e.target.checked}))} style={{ accentColor: 'var(--primary-hover)' }} /> DAP Equivalente (d)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '13.5px' }}>
                <input type="checkbox" checked={selectedCalcs.fustes} onChange={e => setSelectedCalcs(c => ({...c, fustes: e.target.checked}))} style={{ accentColor: 'var(--primary-hover)' }} /> Detalhar Fustes Bifurcados
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={handleExportProcessed}>Confirmar e Exportar</button>
            </div>
          </div>
        )}
      </div>

      {/* Collected Data List */}
      <div className="glass-card" style={{ padding: 0 }}>
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid rgba(255,255,255,0.06)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '12px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Dados Coletados ({inventory.dados.length})</h3>
              {isSufficiencyReached && (
                <span style={{ 
                  background: 'rgba(46, 125, 50, 0.15)', 
                  border: '1px solid rgba(46, 125, 50, 0.45)', 
                  color: '#a5d6a7', 
                  padding: '4px 12px', 
                  borderRadius: '100px', 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  letterSpacing: '0.5px'
                }}>
                  Suficiência Atingida
                </span>
              )}
            </div>

            {/* Seletor de Ordenação Glassmórfico */}
            {inventory.dados.length > 0 && (
              <div style={{ 
                display: 'flex', 
                background: 'rgba(255, 255, 255, 0.03)', 
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px', 
                padding: '3px',
                gap: '4px',
                alignItems: 'center'
              }}>
                <button 
                  onClick={() => setSortType('original')} 
                  style={{
                    background: sortType === 'original' ? 'rgba(46, 125, 50, 0.18)' : 'transparent',
                    border: sortType === 'original' ? '1px solid rgba(46, 125, 50, 0.45)' : '1px solid transparent',
                    color: sortType === 'original' ? 'var(--primary-hover)' : 'var(--text-muted)',
                    fontSize: '10.5px',
                    fontWeight: 'bold',
                    padding: '5px 12px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Original
                </button>
                <button 
                  onClick={() => setSortType('height')} 
                  style={{
                    background: sortType === 'height' ? 'rgba(46, 125, 50, 0.18)' : 'transparent',
                    border: sortType === 'height' ? '1px solid rgba(46, 125, 50, 0.45)' : '1px solid transparent',
                    color: sortType === 'height' ? 'var(--primary-hover)' : 'var(--text-muted)',
                    fontSize: '10.5px',
                    fontWeight: 'bold',
                    padding: '5px 12px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Mais Altas ↓
                </button>
                <button 
                  onClick={() => setSortType('thickness')} 
                  style={{
                    background: sortType === 'thickness' ? 'rgba(46, 125, 50, 0.18)' : 'transparent',
                    border: sortType === 'thickness' ? '1px solid rgba(46, 125, 50, 0.45)' : '1px solid transparent',
                    color: sortType === 'thickness' ? 'var(--primary-hover)' : 'var(--text-muted)',
                    fontSize: '10.5px',
                    fontWeight: 'bold',
                    padding: '5px 12px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Mais Grossas ↓
                </button>
              </div>
            )}
          </div>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => { setCurrentInventory(inventory); navigate('/collect'); }}>
            + Coletar Árvores
          </button>
        </div>
        
        <div style={{ overflowX: 'auto', padding: '8px 16px 20px 16px' }}>
          {inventory.dados.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '24px 8px', fontSize: '14px' }}>Nenhum indivíduo coletado nesta parcela ainda.</p>
          ) : (
            <table style={{ width: '100%', minWidth: '600px' }}>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Nº</th>
                  {inventory.colunas.map(col => (
                    <th key={col.id}>{col.nome}</th>
                  ))}
                  <th style={{ width: '100px', textAlign: 'center' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {sortedDados.map((ind: any) => (
                  <tr key={ind.id}>
                    <td style={{ fontWeight: 'bold' }}>{ind.numeroIndividuo}</td>
                    {inventory.colunas.map(col => (
                      <td key={col.id}>
                         {col.id === 'coordenadas' ? ind[col.id]?.substring(0, 15) + '...' : ind[col.id]}
                         {ind.multipleStems && ['cap', 'hc', 'ht'].includes(col.id) ? ` [Bifurcado: ${ind.stems?.length}]` : ''}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', width: 'auto' }} onClick={() => setEditingInd(JSON.parse(JSON.stringify(ind)))}>
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

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
          <button className="btn btn-danger" style={{ maxWidth: '240px' }} onClick={() => {
            if(window.confirm('Tem certeza em excluir definitivamente a parcela e TODOS OS SEUS DADOS E FOTOS? Essa ação é vitalícia.')) {
              inventory.dados.forEach((d: any) => deletePhotosForIndividual(d.id));
              deleteInventory(inventory.id);
              navigate(`/fieldwork/${inventory.fieldWorkId}`);
            }
          }}>
            Excluir Parcela
          </button>
      </div>

      {/* Edit Modal (Rounded 24px) */}
      {editingInd && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', 
          zIndex: 1000, padding: '20px', overflowY: 'auto', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' 
        }}>
           <div className="glass-card" style={{ width: '100%', maxWidth: '540px', marginTop: '30px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Editar Indivíduo #{editingInd.numeroIndividuo}</h3>
                <button onClick={() => setEditingInd(null)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
              </div>

              {inventory.colunas.map(col => {
                if (editingInd.multipleStems && ['cap', 'hc', 'ht'].includes(col.id)) return null;

                return (
                  <div key={col.id} style={{ marginBottom: '14px' }}>
                    <label className="input-label">{col.nome}</label>
                    {col.tipo === 'select' ? (
                      <select
                        className="input-field"
                        style={{ 
                          marginBottom: 0, 
                          marginTop: '4px',
                          appearance: 'none',
                          background: 'rgba(0,0,0,0.25) url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e") no-repeat right 12px center',
                          backgroundSize: '16px'
                        }}
                        value={editingInd[col.id] || ''}
                        onChange={e => setEditingInd({...editingInd, [col.id]: e.target.value})}
                      >
                        <option value="" style={{ background: '#0a0f0d', color: 'var(--text-muted)' }}>-- Selecione --</option>
                        {(col.opcoes || []).map((o: string) => (
                          <option key={o} value={o} style={{ background: '#0a0f0d', color: '#fff' }}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type={col.tipo === 'number' ? 'number' : 'text'} 
                        className="input-field" 
                        style={{ marginBottom: 0, marginTop: '4px' }}
                        value={editingInd[col.id] || ''} 
                        onChange={e => setEditingInd({...editingInd, [col.id]: e.target.value})} 
                      />
                    )}
                  </div>
                );
              })}

              {editingInd.multipleStems && editingInd.stems && (
                <div style={{ 
                  background: 'rgba(0,0,0,0.25)', 
                  padding: '16px', 
                  borderRadius: '12px', 
                  marginTop: '16px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <h4 style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold' }}>Fustes de Ramificação</h4>
                  {editingInd.stems.map((stem: any, i: number) => (
                    <div key={stem.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', marginTop: '8px' }}>
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

              <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                <button className="btn btn-secondary" onClick={() => setEditingInd(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSaveEdit}>Salvar</button>
              </div>
           </div>
        </div>
      )}

      {showDashboard && <StatisticalDashboard inventories={[inventory]} onClose={() => setShowDashboard(false)} />}
    </div>
  );
};
