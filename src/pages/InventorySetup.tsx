import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import type { InventoryColumn, ColumnType } from '../types';
import { getCurrentPosition } from '../utils/gpsOperations';

const columnsBase = [
  { id: 'nomePopular', nome: 'Nome Popular', checked: true },
  { id: 'nomeCientifico', nome: 'Nome Científico', checked: false },
  { id: 'familia', nome: 'Família', checked: false },
  { id: 'cap', nome: 'CAP (cm)', checked: false },
  { id: 'dap', nome: 'DAP (cm)', checked: false },
  { id: 'hc', nome: 'Altura Comercial (m)', checked: false },
  { id: 'ht', nome: 'Altura Total (m)', checked: false },
  { id: 'coordenadas', nome: 'Coordenadas GPS', checked: false },
  { id: 'observacoes', nome: 'Observações', checked: false },
  { id: 'foto', nome: 'Fotos de Campo (Câmera)', checked: false }
];

// Estado para colunas personalizadas
const getNewCustomCol = () => ({ id: '', nome: '', tipo: 'text', checked: true, opcoes: '' });

export const InventorySetup = () => {
  const navigate = useNavigate();
  const { fieldWorkId, talhaoId } = useParams();
  const { setCurrentInventory, saveInventory, strata, inventories, fieldWorks } = useInventory();
  const currentFw = fieldWorks.find(f => f.id === fieldWorkId);
  const isCenso = currentFw?.modoInventario === 'censo';
  const activeStrata = strata.filter(s => s.fieldWorkId === fieldWorkId);
  
  // Find the last inventory in this fieldwork to inherit settings
  const lastInventory = useMemo(() => {
    const fwInvs = inventories.filter(i => i.fieldWorkId === fieldWorkId);
    if (fwInvs.length === 0) return null;
    return [...fwInvs].sort((a, b) => b.id - a.id)[0];
  }, [inventories, fieldWorkId]);

  const [nome, setNome] = useState('');
  const [area, setArea] = useState('');
  const [stratumId, setStratumId] = useState('');
  
  const [coordenadas, setCoordenadas] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Calculadora de área
  const [formatoParcela, setFormatoParcela] = useState<'retangular' | 'circular'>('retangular');
  const [comprimento, setComprimento] = useState('');
  const [largura, setLargura] = useState('');
  const [raio, setRaio] = useState('');
  const [showCalc, setShowCalc] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState('custom');

  const [cols, setCols] = useState(columnsBase);
  const [customCols, setCustomCols] = useState([getNewCustomCol()]);

  const [hasInitialized, setHasInitialized] = useState(false);

  // Inherit configuration from last inventory of the same fieldwork once loaded
  useEffect(() => {
    if (lastInventory && !hasInitialized) {
      if (isCenso) {
        setArea(lastInventory.areaParcela ? (lastInventory.areaParcela / 10000).toString() : '');
      } else {
        setArea(lastInventory.areaParcela?.toString() || '');
      }
      setStratumId(lastInventory.stratumId || '');
      setFormatoParcela((lastInventory.formatoParcela as 'retangular' | 'circular') || 'retangular');
      setSelectedTemplate(lastInventory.template || 'custom');
      
      setCols(columnsBase.map(col => ({
        ...col,
        checked: lastInventory.colunas.some(lc => lc.id === col.id)
      })));
      
      const custom = lastInventory.colunas
        .filter(lc => !columnsBase.some(cb => cb.id === lc.id))
        .map(lc => ({
          id: lc.id,
          nome: lc.nome,
          tipo: lc.tipo,
          checked: true,
          opcoes: lc.opcoes ? lc.opcoes.join(', ') : ''
        }));
      setCustomCols(custom.length > 0 ? custom : [getNewCustomCol()]);
      
      // Compute radius if circular and area is present
      if (lastInventory.formatoParcela === 'circular' && lastInventory.areaParcela) {
        const r = Math.sqrt(lastInventory.areaParcela / Math.PI);
        setRaio(r.toFixed(2));
      }

      setHasInitialized(true);
    }
  }, [lastInventory, hasInitialized]);

  const applyTemplate = (tpl: string) => {
    setSelectedTemplate(tpl);
    const setChecked = (ids: string[]) => 
      setCols(prev => prev.map(c => ({...c, checked: ids.includes(c.id)})));
    
    if (tpl === 'basico') setChecked(['nomePopular', 'cap', 'dap']);
    else if (tpl === 'completo') setChecked(cols.map(c => c.id));
    else if (tpl === 'rapido') setChecked(['nomePopular', 'cap', 'observacoes']);
  };

  const getGps = async () => {
    setIsGpsLoading(true);
    try {
      const pos = await getCurrentPosition();
      setCoordenadas(`${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`);
    } catch (e: any) {
      if (e.message.includes('Permissão')) {
        alert('Permissão de localização negada. Por favor, permita o acesso ao GPS no navegador para coletar coordenadas.');
      } else {
        alert(e.message || 'Erro ao obter GPS.');
      }
    }
    setIsGpsLoading(false);
  };

  const getColType = (id: string): ColumnType => {
    if (['cap', 'dap', 'hc', 'ht'].includes(id)) return 'number';
    if (id === 'observacoes') return 'textarea';
    if (id === 'foto') return 'photo';
    return 'text';
  };

  const submitSetup = () => {
    if (!fieldWorkId) {
      alert('Erro: Trabalho de campo não identificado. Volte para a tela inicial.');
      return;
    }
    if (!nome || !area) {
      alert(`Por favor, preencha o Nome e a Área ${isCenso ? 'do Censo' : 'da Parcela'}.`);
      return;
    }
    const finalCols: InventoryColumn[] = [
      ...cols.filter(c => c.checked).map(c => ({ id: c.id, nome: c.nome, tipo: getColType(c.id) })),
      ...customCols
        .filter(c => c.nome && c.id)
        .map(c => ({ 
          id: c.id, 
          nome: c.nome, 
          tipo: c.tipo as ColumnType,
          ...(c.tipo === 'select' && { opcoes: c.opcoes ? c.opcoes.split(',').map(o => o.trim()).filter(Boolean) : [] })
        }))
    ];

    if (finalCols.length === 0) {
      alert('Selecione pelo menos uma coluna para coleta.');
      return;
    }

    const newInv = {
      id: Date.now(),
      fieldWorkId,
      talhaoId,
      stratumId: stratumId || undefined,
      nome,
      formatoParcela: isCenso ? 'retangular' : formatoParcela,
      areaParcela: isCenso ? (parseFloat(area) || 0) * 10000 : (parseFloat(area) || 0),
      fatorExpansao: isCenso ? 1 : (parseFloat(area) > 0 ? 10000 / parseFloat(area) : 1),
      dataInicio: new Date().toLocaleDateString('pt-BR'),
      ultimaColeta: new Date().toLocaleDateString('pt-BR'),
      status: 'Novo',
      colunas: finalCols,
      dados: [],
      template: selectedTemplate,
      coordenadas: coordenadas.trim() || undefined,
      observacoes: observacoes.trim() || undefined
    };

    saveInventory(newInv);
    setCurrentInventory(newInv);
    navigate('/collect');
  };

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      {/* Header */}
      <div className="app-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: 'var(--primary-hover)', fontSize: '22px', fontWeight: '800' }}>{isCenso ? 'Configurar Área de Censo' : 'Configurar Parcela'}</h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{isCenso ? 'Defina as colunas e os parâmetros da sua área total de censo.' : 'Defina as colunas e os parâmetros da nova parcela florestal.'}</span>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '8px' }}>
        <label className="input-label">{isCenso ? 'Nome ou Identificador da Área' : 'Nome ou Número da Parcela'}</label>
        <input className="input-field" value={nome} onChange={e => setNome(e.target.value)} placeholder={isCenso ? "Ex: Área Total 1, Bloco A" : "Ex: Parcela 01, P-04"} />

        {activeStrata.length > 0 && (
          <>
            <label className="input-label" style={{ marginTop: '12px' }}>Estrato Florestal</label>
            <select 
              className="input-field" 
              value={stratumId} 
              onChange={e => setStratumId(e.target.value)}
              style={{ 
                appearance: 'none',
                background: 'rgba(0,0,0,0.25) url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e") no-repeat right 12px center',
                backgroundSize: '16px'
              }}
            >
              <option value="" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>-- Sem Estrato --</option>
              {activeStrata.map(s => (
                <option key={s.id} value={s.id} style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>{s.nome} ({s.area} ha)</option>
              ))}
            </select>
          </>
        )}

            </select>
          </>
        )}

        {!isCenso && (
          <>
            <label className="input-label" style={{ marginTop: '12px' }}>Formato da Parcela</label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setFormatoParcela('retangular');
                }}
                style={{
                  flex: 1,
                  background: formatoParcela === 'retangular' ? 'rgba(46, 125, 50, 0.2)' : 'rgba(255,255,255,0.02)',
                  border: formatoParcela === 'retangular' ? '1px solid var(--primary-hover)' : '1px solid rgba(255,255,255,0.1)',
                  color: formatoParcela === 'retangular' ? 'var(--primary-hover)' : 'white'
                }}
              >
                Retangular
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setFormatoParcela('circular');
                }}
                style={{
                  flex: 1,
                  background: formatoParcela === 'circular' ? 'rgba(46, 125, 50, 0.2)' : 'rgba(255,255,255,0.02)',
                  border: formatoParcela === 'circular' ? '1px solid var(--primary-hover)' : '1px solid rgba(255,255,255,0.1)',
                  color: formatoParcela === 'circular' ? 'var(--primary-hover)' : 'white'
                }}
              >
                Circular
              </button>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className="input-label" style={{ marginBottom: 0 }}>
            {isCenso ? 'Área Total Estimada (hectares)' : 'Área da Parcela (m²)'}
          </label>
          {!isCenso && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ padding: '4px 12px', fontSize: '10px', width: 'auto' }}
              onClick={() => setShowCalc(!showCalc)}
            >
              {showCalc ? 'Ocultar Calculadora' : 'Calcular Área'}
            </button>
          )}
        </div>
        
        {showCalc && (
          <div style={{ 
            marginTop: '8px', 
            marginBottom: '16px', 
            background: 'rgba(0,0,0,0.25)', 
            padding: '16px', 
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            {formatoParcela === 'retangular' ? (
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Comprimento (m)</label>
                  <input type="number" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} value={comprimento} onChange={e => {
                    setComprimento(e.target.value);
                    const a = parseFloat(e.target.value) * parseFloat(largura || '0');
                    if (a > 0) setArea(a.toFixed(2));
                  }} placeholder="0.0" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Largura (m)</label>
                  <input type="number" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} value={largura} onChange={e => {
                    setLargura(e.target.value);
                    const a = parseFloat(comprimento || '0') * parseFloat(e.target.value);
                    if (a > 0) setArea(a.toFixed(2));
                  }} placeholder="0.0" />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Raio (m)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    style={{ marginBottom: 0, marginTop: '4px' }} 
                    value={raio} 
                    onChange={e => {
                      const rVal = e.target.value;
                      setRaio(rVal);
                      const r = parseFloat(rVal);
                      if (r > 0) {
                        const a = Math.PI * Math.pow(r, 2);
                        setArea(a.toFixed(2));
                      } else {
                        setArea('');
                      }
                    }} 
                    placeholder="0.0" 
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold' }}>
                  <span>OU insira a Área abaixo para calcular o Raio</span>
                </div>
              </div>
            )}
          </div>
        )}

        <input 
          type="number" 
          className="input-field" 
          value={area} 
          onChange={e => {
            const aVal = e.target.value;
            setArea(aVal);
            if (!isCenso && formatoParcela === 'circular') {
              const a = parseFloat(aVal);
              if (a > 0) {
                const r = Math.sqrt(a / Math.PI);
                setRaio(r.toFixed(2));
              } else {
                setRaio('');
              }
            }
          }} 
          placeholder={isCenso ? "Área em ha (Ex: 15.5)" : "Área em m² (Ex: 400)"} 
        />

        <label className="input-label" style={{ marginTop: '12px' }}>Coordenadas GPS da {isCenso ? 'Área' : 'Parcela'} (Opcional)</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <input 
            className="input-field" 
            placeholder="Aguardando captura ou digite (Ex: -25.4, -49.2)" 
            value={coordenadas} 
            onChange={e => setCoordenadas(e.target.value)}
            style={{ marginBottom: 0 }}
          />
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ width: 'auto', padding: '12px 16px', height: '42px', fontSize: '11px', whiteSpace: 'nowrap' }} 
            onClick={getGps} 
            disabled={isGpsLoading}
          >
            {isGpsLoading ? 'Buscando...' : 'Obter GPS'}
          </button>
        </div>

        <label className="input-label">Observações da {isCenso ? 'Área' : 'Parcela'} (Opcional)</label>
        <textarea 
          className="input-field" 
          placeholder="Ex: Parcela próxima à estrada, relevo inclinado..." 
          value={observacoes} 
          onChange={e => setObservacoes(e.target.value)}
          style={{ minHeight: '80px', fontFamily: 'inherit' }}
        />

        <h3 style={{ margin: '20px 0 10px', color: 'var(--primary-hover)', fontSize: '16px', fontWeight: '800' }}>Modelo de {isCenso ? 'Dados' : 'Parcela'}</h3>
        <select 
          className="input-field" 
          value={selectedTemplate} 
          onChange={e => applyTemplate(e.target.value)}
          style={{ 
            appearance: 'none',
            background: 'rgba(0,0,0,0.25) url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e") no-repeat right 12px center',
            backgroundSize: '16px'
          }}
        >
          <option value="custom" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>Personalizado...</option>
          <option value="basico" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>Básico (Nome Popular + CAP + DAP)</option>
          <option value="completo" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>Completo (Todos os campos padrões)</option>
          <option value="rapido" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>Rápido (Campos essenciais de medição)</option>
        </select>

        <h3 style={{ margin: '24px 0 12px', color: 'var(--primary-hover)', fontSize: '16px', fontWeight: '800' }}>Colunas de Coleta Padrão</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          {cols.map((col, i) => (
            <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={col.checked} 
                onChange={(e) => {
                  const newCols = [...cols];
                  newCols[i].checked = e.target.checked;
                  setCols(newCols);
                  setSelectedTemplate('custom');
                }} 
                style={{ 
                  accentColor: 'var(--primary-hover)',
                  width: '16px',
                  height: '16px'
                }}
              />
              <span style={{ fontSize: '13.5px', color: col.checked ? '#ffffff' : 'var(--text-muted)', transition: 'color 0.2s' }}>{col.nome}</span>
            </label>
          ))}
        </div>

        <h3 style={{ margin: '28px 0 12px', color: 'var(--primary-hover)', fontSize: '16px', fontWeight: '800' }}>Colunas Personalizadas</h3>
        {customCols.map((col, idx) => (
          <div key={idx} style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px', 
            alignItems: 'center', 
            marginBottom: '14px',
            background: 'rgba(0,0,0,0.2)',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ flex: '1 1 100px', minWidth: '100px' }}>
              <label style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Identificador (Sem espaços)</label>
              <input
                className="input-field"
                style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px' }}
                placeholder="Ex: d_copa"
                value={col.id}
                onChange={e => {
                  const newCols = [...customCols];
                  newCols[idx].id = e.target.value.toLowerCase().replace(/\s+/g, '_');
                  setCustomCols(newCols);
                }}
              />
            </div>
            
            <div style={{ flex: '2 1 150px', minWidth: '150px' }}>
              <label style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Nome do Campo</label>
              <input
                className="input-field"
                style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px' }}
                placeholder="Ex: Diâmetro da Copa (m)"
                value={col.nome}
                onChange={e => {
                  const newCols = [...customCols];
                  newCols[idx].nome = e.target.value;
                  setCustomCols(newCols);
                }}
              />
            </div>

            <div style={{ flex: '1 1 110px', minWidth: '110px' }}>
              <label style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Tipo de Dado</label>
              <select
                className="input-field"
                style={{ 
                  marginBottom: 0, 
                  marginTop: '4px', 
                  fontSize: '13px',
                  appearance: 'none',
                  background: 'rgba(0,0,0,0.25) url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e") no-repeat right 8px center',
                  backgroundSize: '12px'
                }}
                value={col.tipo}
                onChange={e => {
                  const newCols = [...customCols];
                  newCols[idx].tipo = e.target.value;
                  setCustomCols(newCols);
                }}
              >
                <option value="text" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>Texto</option>
                <option value="number" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>Número</option>
                <option value="textarea" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>Longo</option>
                <option value="photo" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>Foto (Câmera)</option>
                <option value="select" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>Múltipla Escolha</option>
              </select>
            </div>

            {col.tipo === 'select' && (
              <div style={{ flex: '1 1 100%', marginTop: '8px' }}>
                <label style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Opções de Escolha (Separadas por vírgula)</label>
                <input
                  className="input-field"
                  style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px' }}
                  placeholder="Ex: Quebrada, Inclinada, Torta, Morta, Bifurcada"
                  value={col.opcoes || ''}
                  onChange={e => {
                    const newCols = [...customCols];
                    newCols[idx].opcoes = e.target.value;
                    setCustomCols(newCols);
                  }}
                />
              </div>
            )}
            
            <button
              className="btn btn-danger"
              style={{ flex: '1 1 100%', padding: '10px', marginTop: '8px' }}
              onClick={() => {
                setCustomCols(cols => cols.filter((_, i) => i !== idx));
              }}
            >
              Remover Campo
            </button>
          </div>
        ))}
        
        <button
          className="btn btn-secondary"
          style={{ marginTop: '8px', marginBottom: '24px', borderStyle: 'dashed' }}
          onClick={() => setCustomCols(cols => [...cols, getNewCustomCol()])}
        >
          + Adicionar Campo Personalizado
        </button>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button className="btn btn-primary" onClick={submitSetup}>Iniciar Coleta</button>
        </div>
      </div>
    </div>
  );
};
