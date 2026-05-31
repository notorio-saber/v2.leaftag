import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import type { InventoryColumn, ColumnType } from '../types';

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
const getNewCustomCol = () => ({ id: '', nome: '', tipo: 'text', checked: true });

export const InventorySetup = () => {
  const navigate = useNavigate();
  const { fieldWorkId, talhaoId } = useParams();
  const { setCurrentInventory, saveInventory } = useInventory();
  const [nome, setNome] = useState('');
  const [area, setArea] = useState('');
  
  // Calculadora de área
  const [comprimento, setComprimento] = useState('');
  const [largura, setLargura] = useState('');
  const [showCalc, setShowCalc] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState('custom');

  const [cols, setCols] = useState(columnsBase);
  const [customCols, setCustomCols] = useState([getNewCustomCol()]);

  const applyTemplate = (tpl: string) => {
    setSelectedTemplate(tpl);
    const setChecked = (ids: string[]) => 
      setCols(prev => prev.map(c => ({...c, checked: ids.includes(c.id)})));
    
    if (tpl === 'basico') setChecked(['nomePopular', 'cap', 'dap']);
    else if (tpl === 'completo') setChecked(cols.map(c => c.id));
    else if (tpl === 'rapido') setChecked(['nomePopular', 'cap', 'observacoes']);
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
      alert('Por favor, preencha o Nome e a Área da Parcela.');
      return;
    }
    const finalCols: InventoryColumn[] = [
      ...cols.filter(c => c.checked).map(c => ({ id: c.id, nome: c.nome, tipo: getColType(c.id) })),
      ...customCols
        .filter(c => c.nome && c.id)
        .map(c => ({ id: c.id, nome: c.nome, tipo: c.tipo as ColumnType }))
    ];

    if (finalCols.length === 0) {
      alert('Selecione pelo menos uma coluna para coleta.');
      return;
    }

    const newInv = {
      id: Date.now(),
      fieldWorkId,
      talhaoId,
      nome,
      areaParcela: parseFloat(area) || 0,
      fatorExpansao: parseFloat(area) > 0 ? 10000 / parseFloat(area) : 1,
      dataInicio: new Date().toLocaleDateString('pt-BR'),
      ultimaColeta: new Date().toLocaleDateString('pt-BR'),
      status: 'Novo',
      colunas: finalCols,
      dados: [],
      template: selectedTemplate
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
          <h2 style={{ color: 'var(--primary-hover)', fontSize: '22px', fontWeight: '800' }}>Configurar Parcela</h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Defina as colunas e os parâmetros da nova parcela florestal.</span>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '8px' }}>
        <label className="input-label">Nome ou Número da Parcela</label>
        <input className="input-field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Parcela 01, P-04" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className="input-label" style={{ marginBottom: 0 }}>Área da Parcela (m²)</label>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ padding: '4px 12px', fontSize: '10px', width: 'auto' }}
            onClick={() => setShowCalc(!showCalc)}
          >
            {showCalc ? 'Ocultar Calculadora' : 'Calcular por Comprimento x Largura'}
          </button>
        </div>
        
        {showCalc && (
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginTop: '8px', 
            marginBottom: '16px', 
            background: 'rgba(0,0,0,0.25)', 
            padding: '16px', 
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Comprimento (m)</label>
              <input type="number" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} value={comprimento} onChange={e => {
                setComprimento(e.target.value);
                const a = parseFloat(e.target.value) * parseFloat(largura || '0');
                if (a > 0) setArea(a.toString());
              }} placeholder="0.0" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Largura (m)</label>
              <input type="number" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} value={largura} onChange={e => {
                setLargura(e.target.value);
                const a = parseFloat(comprimento || '0') * parseFloat(e.target.value);
                if (a > 0) setArea(a.toString());
              }} placeholder="0.0" />
            </div>
          </div>
        )}

        <input type="number" className="input-field" value={area} onChange={e => setArea(e.target.value)} placeholder="Área em m² (Ex: 400)" />

        <h3 style={{ margin: '20px 0 10px', color: 'var(--primary-hover)', fontSize: '16px', fontWeight: '800' }}>Modelo de Parcela</h3>
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
          <option value="custom" style={{ background: '#0a0f0d', color: '#fff' }}>Personalizado...</option>
          <option value="basico" style={{ background: '#0a0f0d', color: '#fff' }}>Básico (Nome Popular + CAP + DAP)</option>
          <option value="completo" style={{ background: '#0a0f0d', color: '#fff' }}>Completo (Todos os campos padrões)</option>
          <option value="rapido" style={{ background: '#0a0f0d', color: '#fff' }}>Rápido (Campos essenciais de medição)</option>
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
                <option value="text" style={{ background: '#0a0f0d', color: '#fff' }}>Texto</option>
                <option value="number" style={{ background: '#0a0f0d', color: '#fff' }}>Número</option>
                <option value="textarea" style={{ background: '#0a0f0d', color: '#fff' }}>Longo</option>
                <option value="photo" style={{ background: '#0a0f0d', color: '#fff' }}>Foto (Câmera)</option>
              </select>
            </div>
            
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
