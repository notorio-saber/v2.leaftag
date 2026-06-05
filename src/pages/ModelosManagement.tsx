import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import type { HeightModel, VolumeModel } from '../types';

export const ModelosManagement: React.FC = () => {
  const navigate = useNavigate();
  const {
    heightModels,
    volumeModels,
    createHeightModel,
    deleteHeightModel,
    createVolumeModel,
    deleteVolumeModel
  } = useInventory();

  // Abas: 'height' ou 'volume'
  const [activeTab, setActiveTab] = useState<'height' | 'volume'>('height');

  // Filtros e Busca
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEspecie, setFilterEspecie] = useState('');
  const [filterRegiao, setFilterRegiao] = useState('');

  // Modais de Criação/Edição/Duplicação
  const [showModal, setShowModal] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  
  // Estado do formulário genérico
  const [formNome, setFormNome] = useState('');
  const [formEspecie, setFormEspecie] = useState('');
  const [formRegiao, setFormRegiao] = useState('');
  const [formFonte, setFormFonte] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  
  // Coeficientes e Tipo
  const [heightType, setHeightType] = useState<HeightModel['tipoModelo']>('linear');
  const [volumeType, setVolumeType] = useState<VolumeModel['tipoModelo']>('schumacher_hall');
  
  const [beta0, setBeta0] = useState('');
  const [beta1, setBeta1] = useState('');
  const [beta2, setBeta2] = useState('');
  const [beta3, setBeta3] = useState('');
  const [customExpression, setCustomExpression] = useState('');

  // Espécies e Regiões únicas para preencher filtros
  const uniqueSpecies = activeTab === 'height'
    ? Array.from(new Set(heightModels.map(m => m.especie).filter(Boolean)))
    : Array.from(new Set(volumeModels.map(m => m.especie).filter(Boolean)));

  const uniqueRegions = activeTab === 'height'
    ? Array.from(new Set(heightModels.map(m => m.regiao).filter(Boolean)))
    : Array.from(new Set(volumeModels.map(m => m.regiao).filter(Boolean)));

  // Filtragem dos Modelos
  const filteredHeightModels = heightModels.filter(model => {
    const matchesSearch = 
      model.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.especie.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.regiao.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (model.tipoModelo && model.tipoModelo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesEspecie = !filterEspecie || model.especie === filterEspecie;
    const matchesRegiao = !filterRegiao || model.regiao === filterRegiao;
    return matchesSearch && matchesEspecie && matchesRegiao;
  });

  const filteredVolumeModels = volumeModels.filter(model => {
    const matchesSearch = 
      model.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.especie.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.regiao.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (model.tipoModelo && model.tipoModelo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesEspecie = !filterEspecie || model.especie === filterEspecie;
    const matchesRegiao = !filterRegiao || model.regiao === filterRegiao;
    return matchesSearch && matchesEspecie && matchesRegiao;
  });

  // Limpa formulário
  const resetForm = () => {
    setFormNome('');
    setFormEspecie('');
    setFormRegiao('');
    setFormFonte('');
    setFormObservacoes('');
    setBeta0('');
    setBeta1('');
    setBeta2('');
    setBeta3('');
    setCustomExpression('');
    setEditingModelId(null);
  };

  // Abre formulário para novo
  const handleNewModel = () => {
    resetForm();
    if (activeTab === 'height') {
      setHeightType('linear');
    } else {
      setVolumeType('schumacher_hall');
    }
    setShowModal(true);
  };

  // Abre formulário para edição
  const handleEditModel = (model: HeightModel | VolumeModel) => {
    resetForm();
    setEditingModelId(model.id);
    setFormNome(model.nome);
    setFormEspecie(model.especie);
    setFormRegiao(model.regiao);
    setFormFonte(model.fonteBibliografica || '');
    setFormObservacoes(model.observacoes || '');
    
    setBeta0(model.coeficientes.beta0.toString());
    if (model.coeficientes.beta1 !== undefined) setBeta1(model.coeficientes.beta1.toString());
    if (model.coeficientes.beta2 !== undefined) setBeta2(model.coeficientes.beta2.toString());
    if (model.coeficientes.beta3 !== undefined) setBeta3(model.coeficientes.beta3.toString());
    if (model.coeficientes.expressaoCustom) setCustomExpression(model.coeficientes.expressaoCustom);

    if (activeTab === 'height') {
      setHeightType((model as HeightModel).tipoModelo);
    } else {
      setVolumeType((model as VolumeModel).tipoModelo);
    }
    setShowModal(true);
  };

  // Duplicar modelo
  const handleDuplicateModel = (model: HeightModel | VolumeModel) => {
    resetForm();
    setFormNome(`${model.nome} (Cópia)`);
    setFormEspecie(model.especie);
    setFormRegiao(model.regiao);
    setFormFonte(model.fonteBibliografica || '');
    setFormObservacoes(model.observacoes || '');
    
    setBeta0(model.coeficientes.beta0.toString());
    if (model.coeficientes.beta1 !== undefined) setBeta1(model.coeficientes.beta1.toString());
    if (model.coeficientes.beta2 !== undefined) setBeta2(model.coeficientes.beta2.toString());
    if (model.coeficientes.beta3 !== undefined) setBeta3(model.coeficientes.beta3.toString());
    if (model.coeficientes.expressaoCustom) setCustomExpression(model.coeficientes.expressaoCustom);

    if (activeTab === 'height') {
      setHeightType((model as HeightModel).tipoModelo);
    } else {
      setVolumeType((model as VolumeModel).tipoModelo);
    }
    setShowModal(true);
  };

  // Excluir modelo
  const handleDeleteModel = async (id: string) => {
    if (!confirm('Deseja realmente excluir este modelo?')) return;
    try {
      if (activeTab === 'height') {
        await deleteHeightModel(id);
      } else {
        await deleteVolumeModel(id);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao excluir modelo.');
    }
  };

  // Validar expressão personalizada
  const validateCustomExpr = (expr: string, isVolume: boolean) => {
    try {
      const vars = isVolume 
        ? { DAP: 20, H: 15, beta0: 1, beta1: 1, beta2: 1, beta3: 1 } 
        : { DAP: 20, beta0: 1, beta1: 1, beta2: 1, beta3: 1 };
      
      const fn = new Function(...Object.keys(vars), `return ${expr}`);
      const res = fn(...Object.values(vars));
      if (isNaN(res)) {
        return 'A expressão é válida sintaticamente, mas resultou em um valor indefinido (NaN). Verifique os termos.';
      }
      return null;
    } catch (err: any) {
      return `Erro de sintaxe na expressão: ${err.message}`;
    }
  };

  // Salvar modelo
  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formNome.trim() || !formEspecie.trim() || !formRegiao.trim()) {
      return alert('Preencha Nome, Espécie e Região.');
    }

    const b0Val = parseFloat(beta0);
    if (isNaN(b0Val)) return alert('Beta 0 deve ser um número válido.');

    const b1Val = parseFloat(beta1);
    const b2Val = parseFloat(beta2);
    const b3Val = parseFloat(beta3);

    const baseCoeffs: any = { beta0: b0Val };
    
    // Validar de acordo com o tipo
    if (activeTab === 'height') {
      if (heightType !== 'personalizado') {
        if (isNaN(b1Val)) return alert('Beta 1 deve ser um número válido.');
        baseCoeffs.beta1 = b1Val;

        if (heightType === 'trorey') {
          if (isNaN(b2Val)) return alert('Beta 2 deve ser um número válido.');
          baseCoeffs.beta2 = b2Val;
        }
      } else {
        // Personalizado
        if (!customExpression.trim()) return alert('Preencha a expressão personalizada.');
        const err = validateCustomExpr(customExpression, false);
        if (err) return alert(err);

        baseCoeffs.expressaoCustom = customExpression.trim();
        if (!isNaN(b1Val)) baseCoeffs.beta1 = b1Val;
        if (!isNaN(b2Val)) baseCoeffs.beta2 = b2Val;
        if (!isNaN(b3Val)) baseCoeffs.beta3 = b3Val;
      }

      const modelToSave: HeightModel = {
        id: editingModelId || `hm-${Date.now()}`,
        nome: formNome.trim(),
        especie: formEspecie.trim(),
        regiao: formRegiao.trim(),
        tipoModelo: heightType,
        coeficientes: baseCoeffs,
        fonteBibliografica: formFonte.trim() || undefined,
        observacoes: formObservacoes.trim() || undefined,
        criadoEm: editingModelId 
          ? (heightModels.find(m => m.id === editingModelId)?.criadoEm || new Date().toISOString())
          : new Date().toISOString()
      };

      try {
        await createHeightModel(modelToSave);
        setShowModal(false);
        resetForm();
      } catch (e) {
        console.error(e);
        alert('Erro ao salvar modelo hipsométrico.');
      }

    } else {
      // Volume
      if (volumeType === 'fator_forma') {
        // Fator de forma só precisa do beta0 (fator)
      } else if (volumeType === 'schumacher_hall') {
        if (isNaN(b1Val) || isNaN(b2Val)) return alert('Beta 1 e Beta 2 devem ser números válidos.');
        baseCoeffs.beta1 = b1Val;
        baseCoeffs.beta2 = b2Val;
      } else if (volumeType === 'spurr') {
        if (isNaN(b1Val)) return alert('Beta 1 deve ser um número válido.');
        baseCoeffs.beta1 = b1Val;
      } else if (volumeType === 'stoate') {
        if (isNaN(b1Val) || isNaN(b2Val) || isNaN(b3Val)) {
          return alert('Beta 1, Beta 2 e Beta 3 devem ser números válidos.');
        }
        baseCoeffs.beta1 = b1Val;
        baseCoeffs.beta2 = b2Val;
        baseCoeffs.beta3 = b3Val;
      } else if (volumeType === 'husch') {
        if (isNaN(b1Val)) return alert('Beta 1 deve ser um número válido.');
        baseCoeffs.beta1 = b1Val;
      } else if (volumeType === 'personalizado') {
        if (!customExpression.trim()) return alert('Preencha a expressão personalizada.');
        const err = validateCustomExpr(customExpression, true);
        if (err) return alert(err);

        baseCoeffs.expressaoCustom = customExpression.trim();
        if (!isNaN(b1Val)) baseCoeffs.beta1 = b1Val;
        if (!isNaN(b2Val)) baseCoeffs.beta2 = b2Val;
        if (!isNaN(b3Val)) baseCoeffs.beta3 = b3Val;
      }

      const modelToSave: VolumeModel = {
        id: editingModelId || `vm-${Date.now()}`,
        nome: formNome.trim(),
        especie: formEspecie.trim(),
        regiao: formRegiao.trim(),
        tipoModelo: volumeType,
        coeficientes: baseCoeffs,
        fonteBibliografica: formFonte.trim() || undefined,
        observacoes: formObservacoes.trim() || undefined,
        criadoEm: editingModelId 
          ? (volumeModels.find(m => m.id === editingModelId)?.criadoEm || new Date().toISOString())
          : new Date().toISOString()
      };

      try {
        await createVolumeModel(modelToSave);
        setShowModal(false);
        resetForm();
      } catch (e) {
        console.error(e);
        alert('Erro ao salvar modelo volumétrico.');
      }
    }
  };

  // Helper para mostrar expressão matemática do modelo
  const renderFormulaText = (tipo: string, coefs: any) => {
    switch (tipo) {
      case 'linear':
        return `H = ${coefs.beta0} + ${coefs.beta1} * DAP`;
      case 'logaritmico':
      case 'henriksen':
        return `H = ${coefs.beta0} + ${coefs.beta1} * ln(DAP)`;
      case 'curtis':
        return `H = exp(${coefs.beta0} + ${coefs.beta1} / DAP)`;
      case 'trorey':
        return `H = ${coefs.beta0} + ${coefs.beta1} * DAP + ${coefs.beta2} * DAP²`;
      case 'fator_forma':
        return `V = (π * DAP² / 40000) * H * ${coefs.beta0}`;
      case 'schumacher_hall':
        return `V = ${coefs.beta0} * DAP^(${coefs.beta1}) * H^(${coefs.beta2})`;
      case 'spurr':
        return `V = ${coefs.beta0} + ${coefs.beta1} * DAP² * H`;
      case 'stoate':
        return `V = ${coefs.beta0} + ${coefs.beta1} * DAP² + ${coefs.beta2} * DAP² * H + ${coefs.beta3} * H`;
      case 'husch':
        return `V = ${coefs.beta0} * DAP^(${coefs.beta1})`;
      case 'personalizado':
        return `Personalizado: ${coefs.expressaoCustom}`;
      default:
        return '';
    }
  };

  return (
    <div className="container" style={{ marginTop: '20px', paddingBottom: '40px' }}>
      {/* Header */}
      <div className="app-header">
        <div>
          <h2 style={{ color: 'var(--primary-hover)', fontSize: '22px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📐</span> Biblioteca de Modelos
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gerencie equações hipsométricas e volumétricas para cálculo de inventários.</span>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => navigate('/')}>
          Voltar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px', gap: '8px' }}>
        <button
          onClick={() => { setActiveTab('height'); resetForm(); }}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'height' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'height' ? 'var(--primary-hover)' : 'var(--text-muted)',
            padding: '12px 20px',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Hipsometria (Estimativa de Altura)
        </button>
        <button
          onClick={() => { setActiveTab('volume'); resetForm(); }}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'volume' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'volume' ? 'var(--primary-hover)' : 'var(--text-muted)',
            padding: '12px 20px',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Volume (Equações de Volume)
        </button>
      </div>

      {/* Filters & Add button */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', flex: 1, minWidth: '300px' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              className="input-field"
              style={{ marginBottom: 0, paddingLeft: '38px', borderRadius: '10px', fontSize: '14px', height: '40px' }}
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="14" height="14" 
              viewBox="0 0 24 24" 
              fill="none" stroke="var(--text-muted)" 
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>

          {/* Especie filter */}
          <select
            className="input-field"
            style={{ marginBottom: 0, width: 'auto', minWidth: '130px', borderRadius: '10px', fontSize: '13px', height: '40px', padding: '0 12px' }}
            value={filterEspecie}
            onChange={e => setFilterEspecie(e.target.value)}
          >
            <option value="">Todas Espécies</option>
            {uniqueSpecies.map(sp => (
              <option key={sp} value={sp}>{sp}</option>
            ))}
          </select>

          {/* Regiao filter */}
          <select
            className="input-field"
            style={{ marginBottom: 0, width: 'auto', minWidth: '130px', borderRadius: '10px', fontSize: '13px', height: '40px', padding: '0 12px' }}
            value={filterRegiao}
            onChange={e => setFilterRegiao(e.target.value)}
          >
            <option value="">Todas Regiões</option>
            {uniqueRegions.map(reg => (
              <option key={reg} value={reg}>{reg}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: 'auto', height: '40px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
          onClick={handleNewModel}
        >
          <span>+</span> Novo {activeTab === 'height' ? 'Modelo Hipsométrico' : 'Modelo Volumétrico'}
        </button>
      </div>

      {/* Grid of Models */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {activeTab === 'height' ? (
          filteredHeightModels.length === 0 ? (
            <div className="glass-card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Nenhum modelo hipsométrico encontrado.
            </div>
          ) : (
            filteredHeightModels.map(model => (
              <div key={model.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#fff' }}>{model.nome}</h3>
                    <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {model.tipoModelo}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--primary-hover)', background: 'rgba(46, 125, 50, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(46, 125, 50, 0.2)' }}>
                      🌲 {model.especie}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64b5f6', background: 'rgba(33, 150, 243, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(33, 150, 243, 0.2)' }}>
                      📍 {model.regiao}
                    </span>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', fontFamily: 'monospace', fontSize: '12px', color: '#e0e0e0', marginBottom: '12px', wordBreak: 'break-all' }}>
                    <strong>Fórmula:</strong>
                    <div style={{ marginTop: '4px', color: 'var(--primary-hover)', fontWeight: 'bold' }}>
                      {renderFormulaText(model.tipoModelo, model.coeficientes)}
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    <strong>Coeficientes:</strong>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span>β0: {model.coeficientes.beta0}</span>
                      {model.coeficientes.beta1 !== undefined && <span>β1: {model.coeficientes.beta1}</span>}
                      {model.coeficientes.beta2 !== undefined && <span>β2: {model.coeficientes.beta2}</span>}
                      {model.coeficientes.beta3 !== undefined && <span>β3: {model.coeficientes.beta3}</span>}
                    </div>
                  </div>

                  {model.fonteBibliografica && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <strong>Fonte:</strong> {model.fonteBibliografica}
                    </div>
                  )}

                  {model.observacoes && (
                    <div style={{ fontSize: '11.5px', color: '#888', fontStyle: 'italic' }}>
                      "{model.observacoes}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '18px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', flex: 1 }} onClick={() => handleEditModel(model)}>
                    Editar
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', flex: 1 }} onClick={() => handleDuplicateModel(model)}>
                    Duplicar
                  </button>
                  <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', width: 'auto', background: 'rgba(239, 35, 60, 0.12)', border: '1px solid rgba(239, 35, 60, 0.35)', color: '#ff4d6d' }} onClick={() => handleDeleteModel(model.id)}>
                    Excluir
                  </button>
                </div>
              </div>
            ))
          )
        ) : (
          filteredVolumeModels.length === 0 ? (
            <div className="glass-card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Nenhum modelo volumétrico encontrado.
            </div>
          ) : (
            filteredVolumeModels.map(model => (
              <div key={model.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#fff' }}>{model.nome}</h3>
                    <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {model.tipoModelo.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--primary-hover)', background: 'rgba(46, 125, 50, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(46, 125, 50, 0.2)' }}>
                      🌲 {model.especie}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64b5f6', background: 'rgba(33, 150, 243, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(33, 150, 243, 0.2)' }}>
                      📍 {model.regiao}
                    </span>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', fontFamily: 'monospace', fontSize: '12px', color: '#e0e0e0', marginBottom: '12px', wordBreak: 'break-all' }}>
                    <strong>Fórmula:</strong>
                    <div style={{ marginTop: '4px', color: 'var(--primary-hover)', fontWeight: 'bold' }}>
                      {renderFormulaText(model.tipoModelo, model.coeficientes)}
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    <strong>Coeficientes:</strong>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span>β0: {model.coeficientes.beta0}</span>
                      {model.coeficientes.beta1 !== undefined && <span>β1: {model.coeficientes.beta1}</span>}
                      {model.coeficientes.beta2 !== undefined && <span>β2: {model.coeficientes.beta2}</span>}
                      {model.coeficientes.beta3 !== undefined && <span>β3: {model.coeficientes.beta3}</span>}
                    </div>
                  </div>

                  {model.fonteBibliografica && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <strong>Fonte:</strong> {model.fonteBibliografica}
                    </div>
                  )}

                  {model.observacoes && (
                    <div style={{ fontSize: '11.5px', color: '#888', fontStyle: 'italic' }}>
                      "{model.observacoes}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '18px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', flex: 1 }} onClick={() => handleEditModel(model)}>
                    Editar
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', flex: 1 }} onClick={() => handleDuplicateModel(model)}>
                    Duplicar
                  </button>
                  <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', width: 'auto', background: 'rgba(239, 35, 60, 0.12)', border: '1px solid rgba(239, 35, 60, 0.35)', color: '#ff4d6d' }} onClick={() => handleDeleteModel(model.id)}>
                    Excluir
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Model Creation/Editing Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(6px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800', marginBottom: '16px' }}>
              {editingModelId ? 'Editar Modelo' : 'Novo Modelo'} {activeTab === 'height' ? 'Hipsométrico' : 'Volumétrico'}
            </h3>
            
            <form onSubmit={handleSaveModel} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Nome do Modelo *</label>
                <input type="text" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: Curtis Regional Pinus 2026" value={formNome} onChange={e => setFormNome(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Espécie *</label>
                  <input type="text" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: Pinus taeda" value={formEspecie} onChange={e => setFormEspecie(e.target.value)} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Região *</label>
                  <input type="text" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: Planalto Serrano" value={formRegiao} onChange={e => setFormRegiao(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="input-label">Tipo de Equação *</label>
                {activeTab === 'height' ? (
                  <select
                    className="input-field"
                    style={{ marginBottom: 0, marginTop: '4px' }}
                    value={heightType}
                    onChange={e => setHeightType(e.target.value as any)}
                  >
                    <option value="linear">Linear (H = β0 + β1 * DAP)</option>
                    <option value="logaritmico">Logarítmico (H = β0 + β1 * ln(DAP))</option>
                    <option value="curtis">Curtis (H = exp(β0 + β1 / DAP))</option>
                    <option value="henriksen">Henriksen (H = β0 + β1 * ln(DAP))</option>
                    <option value="trorey">Trorey (H = β0 + β1 * DAP + β2 * DAP²)</option>
                    <option value="personalizado">Personalizado (Expressão Matemática JS)</option>
                  </select>
                ) : (
                  <select
                    className="input-field"
                    style={{ marginBottom: 0, marginTop: '4px' }}
                    value={volumeType}
                    onChange={e => setVolumeType(e.target.value as any)}
                  >
                    <option value="fator_forma">Fator de Forma (V = g * H * ff)</option>
                    <option value="schumacher_hall">Schumacher-Hall (V = β0 * DAP^β1 * H^β2)</option>
                    <option value="spurr">Spurr (V = β0 + β1 * DAP² * H)</option>
                    <option value="stoate">Stoate (V = β0 + β1 * DAP² + β2 * DAP² * H + β3 * H)</option>
                    <option value="husch">Husch (V = β0 * DAP^β1)</option>
                    <option value="personalizado">Personalizado (Expressão Matemática JS)</option>
                  </select>
                )}
              </div>

              {/* Dynamic Coefficients */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '12px' }}>
                  Parâmetros e Coeficientes
                </span>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {/* β0 is always required */}
                  <div style={{ minWidth: '100px', flex: 1 }}>
                    <label className="input-label">β0 *</label>
                    <input type="number" step="any" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: -2.314" value={beta0} onChange={e => setBeta0(e.target.value)} required />
                  </div>

                  {/* β1 requirement */}
                  {((activeTab === 'height' && heightType !== 'personalizado') || 
                    (activeTab === 'volume' && volumeType !== 'fator_forma' && volumeType !== 'personalizado')) && (
                    <div style={{ minWidth: '100px', flex: 1 }}>
                      <label className="input-label">β1 *</label>
                      <input type="number" step="any" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: 1.879" value={beta1} onChange={e => setBeta1(e.target.value)} required />
                    </div>
                  )}

                  {/* Optional β1 for Custom */}
                  {((activeTab === 'height' && heightType === 'personalizado') || 
                    (activeTab === 'volume' && volumeType === 'personalizado')) && (
                    <div style={{ minWidth: '100px', flex: 1 }}>
                      <label className="input-label">β1 (Opcional)</label>
                      <input type="number" step="any" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: 1.8" value={beta1} onChange={e => setBeta1(e.target.value)} />
                    </div>
                  )}

                  {/* β2 requirement */}
                  {((activeTab === 'height' && heightType === 'trorey') || 
                    (activeTab === 'volume' && (volumeType === 'schumacher_hall' || volumeType === 'stoate'))) && (
                    <div style={{ minWidth: '100px', flex: 1 }}>
                      <label className="input-label">β2 *</label>
                      <input type="number" step="any" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: 0.982" value={beta2} onChange={e => setBeta2(e.target.value)} required />
                    </div>
                  )}

                  {/* Optional β2 for Custom */}
                  {((activeTab === 'height' && heightType === 'personalizado') || 
                    (activeTab === 'volume' && volumeType === 'personalizado')) && (
                    <div style={{ minWidth: '100px', flex: 1 }}>
                      <label className="input-label">β2 (Opcional)</label>
                      <input type="number" step="any" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: 0.9" value={beta2} onChange={e => setBeta2(e.target.value)} />
                    </div>
                  )}

                  {/* β3 requirement */}
                  {(activeTab === 'volume' && volumeType === 'stoate') && (
                    <div style={{ minWidth: '100px', flex: 1 }}>
                      <label className="input-label">β3 *</label>
                      <input type="number" step="any" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: -0.054" value={beta3} onChange={e => setBeta3(e.target.value)} required />
                    </div>
                  )}

                  {/* Optional β3 for Custom */}
                  {((activeTab === 'height' && heightType === 'personalizado') || 
                    (activeTab === 'volume' && volumeType === 'personalizado')) && (
                    <div style={{ minWidth: '100px', flex: 1 }}>
                      <label className="input-label">β3 (Opcional)</label>
                      <input type="number" step="any" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: -0.05" value={beta3} onChange={e => setBeta3(e.target.value)} />
                    </div>
                  )}
                </div>

                {/* Custom Expression input */}
                {((activeTab === 'height' && heightType === 'personalizado') || 
                  (activeTab === 'volume' && volumeType === 'personalizado')) && (
                  <div style={{ marginTop: '16px' }}>
                    <label className="input-label">Expressão JavaScript Customizada *</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      style={{ marginBottom: 0, marginTop: '4px', fontFamily: 'monospace' }} 
                      placeholder={activeTab === 'height' 
                        ? 'Ex: beta0 + beta1 * Math.log(DAP)' 
                        : 'Ex: beta0 * Math.pow(DAP, beta1) * Math.pow(H, beta2)'} 
                      value={customExpression} 
                      onChange={e => setCustomExpression(e.target.value)} 
                      required 
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px', lineHeight: '1.4' }}>
                      Variáveis disponíveis: <strong style={{ color: '#fff' }}>DAP</strong> (em cm){activeTab === 'volume' && <>, <strong style={{ color: '#fff' }}>H</strong> (em metros)</>}, <strong style={{ color: '#fff' }}>beta0</strong>, <strong style={{ color: '#fff' }}>beta1</strong>, <strong style={{ color: '#fff' }}>beta2</strong>, <strong style={{ color: '#fff' }}>beta3</strong>.
                      <br/>
                      Use funções como <code style={{ color: '#ffb74d' }}>Math.log(x)</code> (para logaritmo natural), <code style={{ color: '#ffb74d' }}>Math.exp(x)</code>, <code style={{ color: '#ffb74d' }}>Math.pow(x, y)</code>.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="input-label">Fonte Bibliográfica (Opcional)</label>
                <input type="text" className="input-field" style={{ marginBottom: 0, marginTop: '4px' }} placeholder="Ex: Schumacher & Hall (1933)" value={formFonte} onChange={e => setFormFonte(e.target.value)} />
              </div>

              <div>
                <label className="input-label">Observações (Opcional)</label>
                <textarea className="input-field" rows={2} style={{ marginBottom: 0, marginTop: '4px', resize: 'vertical' }} placeholder="Ex: Aplicar a parcelas de primeiro ciclo" value={formObservacoes} onChange={e => setFormObservacoes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
