import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
];

// Estado para colunas personalizadas
const getNewCustomCol = () => ({ id: '', nome: '', tipo: 'text', checked: true });

export const InventorySetup = () => {
  const navigate = useNavigate();
  const { setCurrentInventory, saveInventory } = useInventory();
  const [nome, setNome] = useState('');
  const [local, setLocal] = useState('');
  const [area, setArea] = useState('');
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
    return 'text';
  };

  const submitSetup = () => {
    if (!nome || !local || !area) {
      alert('Por favor, preencha Nome, Local e Área.');
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
      nome,
      local,
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
      <h2 style={{ color: 'var(--primary-color)' }}>Configurar Inventário</h2>
      <div className="glass-card" style={{ marginTop: '16px' }}>
        <label className="input-label">Nome do Inventário</label>
        <input className="input-field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Parcela 01" />

        <label className="input-label">Local / Fazenda</label>
        <input className="input-field" value={local} onChange={e => setLocal(e.target.value)} placeholder="Local" />

        <label className="input-label">Área da Parcela (m²)</label>
        <input type="number" className="input-field" value={area} onChange={e => setArea(e.target.value)} placeholder="0.0" />

        <h3 style={{ margin: '16px 0 8px', color: 'var(--primary-color)' }}>Modelo Padrão</h3>
        <select 
          className="input-field" 
          value={selectedTemplate} 
          onChange={e => applyTemplate(e.target.value)}
          style={{ appearance: 'none' }}
        >
          <option value="custom">Personalizado...</option>
          <option value="basico">Básico (Nome + CAP + DAP)</option>
          <option value="completo">Completo (Todos os campos)</option>
          <option value="rapido">Rápido (Essenciais)</option>
        </select>

        <h3 style={{ margin: '16px 0 8px', color: 'var(--primary-color)' }}>Colunas de Coleta</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {cols.map((col, i) => (
            <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={col.checked} 
                onChange={(e) => {
                  const newCols = [...cols];
                  newCols[i].checked = e.target.checked;
                  setCols(newCols);
                  setSelectedTemplate('custom');
                }} 
              />
              <span style={{ fontSize: '14px' }}>{col.nome}</span>
            </label>
          ))}
        </div>

        <h4 style={{ margin: '16px 0 8px', color: 'var(--primary-color)' }}>Colunas Personalizadas</h4>
        {customCols.map((col, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch', marginBottom: 12 }}>
            <input
              className="input-field"
              placeholder="ID"
              value={col.id}
              onChange={e => {
                const newCols = [...customCols];
                newCols[idx].id = e.target.value;
                setCustomCols(newCols);
              }}
            />
            <input
              className="input-field"
              placeholder="Nome da Coluna"
              value={col.nome}
              onChange={e => {
                const newCols = [...customCols];
                newCols[idx].nome = e.target.value;
                setCustomCols(newCols);
              }}
            />
            <select
              className="input-field"
              value={col.tipo}
              onChange={e => {
                const newCols = [...customCols];
                newCols[idx].tipo = e.target.value;
                setCustomCols(newCols);
              }}
            >
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="textarea">Texto Longo</option>
            </select>
            <button
              className="btn btn-danger"
              style={{ padding: '6px 0', marginTop: 4, width: '100%' }}
              onClick={() => {
                setCustomCols(cols => cols.filter((_, i) => i !== idx));
              }}
            >Remover</button>
          </div>
        ))}
        <button
          className="btn btn-secondary"
          style={{ marginTop: 8, marginBottom: 16 }}
          onClick={() => setCustomCols(cols => [...cols, getNewCustomCol()])}
        >+ Adicionar Coluna Personalizada</button>

        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>Cancelar</button>
          <button className="btn btn-primary" onClick={submitSetup}>Iniciar Coleta</button>
        </div>
      </div>
    </div>
  );
};
