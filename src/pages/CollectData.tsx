import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { getCurrentPosition } from '../utils/gpsOperations';

export const CollectData = () => {
  const navigate = useNavigate();
  const { currentInventory, saveInventory, setCurrentInventory } = useInventory();
  
  if (!currentInventory) {
    navigate('/');
    return null;
  }

  const columns = currentInventory.colunas;
  const currentIdx = currentInventory.dados.length + 1;
  
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<any>({});
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [multiStems, setMultiStems] = useState(false);
  const [stems, setStems] = useState([{ id: Date.now().toString(), cap: '', altura: '' }]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on step change
  useEffect(() => {
    if (inputRef.current && !isGpsLoading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [stepIndex, isGpsLoading]);

  const currentCol = columns[stepIndex];

  const handleInputChange = (val: string) => {
    setFormData((prev: any) => ({ ...prev, [currentCol.id]: val }));
  };

  const getGps = async () => {
    setIsGpsLoading(true);
    try {
      const pos = await getCurrentPosition();
      setFormData((prev: any) => ({ ...prev, [currentCol.id]: `${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}` }));
    } catch (e: any) {
      if (e.message.includes('Permissão')) {
        alert('Permissão de localização negada. Por favor, permita o acesso ao GPS no navegador para coletar coordenadas.');
      } else {
        alert(e.message || 'Erro ao obter GPS.');
      }
    }
    setIsGpsLoading(false);
  };

  const getNextStepIndex = (currentIndex: number): number => {
    let nextIdx = currentIndex + 1;
    while (nextIdx < columns.length) {
      const nextCol = columns[nextIdx];
      // Skip height columns if multi-stems already tracks it
      if (multiStems && ['cap', 'dap', 'hc', 'ht'].includes(nextCol.id)) {
        nextIdx++;
      } else {
        break;
      }
    }
    return nextIdx;
  };

  const handleNext = () => {
    const nextIdx = getNextStepIndex(stepIndex);
    if (nextIdx < columns.length) {
      setStepIndex(nextIdx);
    } else {
      saveIndividual();
    }
  };

  const getPrevStepIndex = (currentIndex: number): number => {
    let prevIdx = currentIndex - 1;
    while (prevIdx >= 0) {
      const prevCol = columns[prevIdx];
      if (multiStems && ['cap', 'dap', 'hc', 'ht'].includes(prevCol.id)) {
        // Only return to 'cap' or 'dap' if it was the origin
        if (prevCol.id === 'cap' || prevCol.id === 'dap') return prevIdx;
        prevIdx--;
      } else {
        break;
      }
    }
    return prevIdx;
  };

  const handlePrev = () => {
    const prevIdx = getPrevStepIndex(stepIndex);
    if (prevIdx >= 0) {
      setStepIndex(prevIdx);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNext();
    }
  };

  const saveIndividual = () => {
    const freshInv = JSON.parse(JSON.stringify(currentInventory)); 
    
    const newIndividual = {
      id: Date.now().toString(),
      numeroIndividuo: currentIdx,
      timestamp: new Date().toLocaleString('pt-BR'),
      multipleStems: multiStems,
      ...(multiStems && { stems: stems.map(s => ({id: s.id, cap: parseFloat(s.cap||'0'), altura: parseFloat(s.altura||'0')})) }),
      ...formData
    };
    
    freshInv.dados.push(newIndividual);
    freshInv.ultimaColeta = new Date().toLocaleDateString('pt-BR');
    
    setCurrentInventory(freshInv);
    saveInventory(freshInv);
    
    // reset entire wizard
    setFormData({});
    setMultiStems(false);
    setStems([{ id: Date.now().toString(), cap: '', altura: '' }]);
    setStepIndex(0);
  };

  const isLastStep = getNextStepIndex(stepIndex) >= columns.length;

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      {/* Wizard Header */}
      <div className="app-header" style={{ marginBottom: '16px' }}>
        <div>
          <h2 style={{ color: 'var(--primary-color)' }}>{currentInventory.nome}</h2>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Coleta em Andamento • Indivíduo #{currentIdx}</span>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: '10px' }} onClick={() => navigate(`/fieldwork/${currentInventory.fieldWorkId}`)}>Pausar</button>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', marginBottom: '32px' }}>
        <div style={{ width: `${((stepIndex + 1) / columns.length) * 100}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.3s ease' }}></div>
      </div>

      {/* Wizard Step Card */}
      <div className="glass-card" style={{ marginBottom: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}>Passo {stepIndex + 1} de {columns.length}</span>
          <h1 style={{ fontSize: '32px', margin: '8px 0', color: 'white' }}>{currentCol.nome}</h1>
        </div>

        <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
          {currentCol.id === 'coordenadas' ? (
            <div style={{ textAlign: 'center' }}>
              <input 
                className="input-field" 
                readOnly 
                value={formData[currentCol.id] || ''} 
                style={{ textAlign: 'center', fontSize: '20px' }}
                placeholder="Ex: -23.456, -49.321"
              />
              <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={getGps} disabled={isGpsLoading}>
                {isGpsLoading ? 'OBTENDO SINAL GPS...' : '📍 CAPTURAR COORDENADAS'}
              </button>
            </div>
          ) : currentCol.tipo === 'textarea' ? (
            <textarea 
              className="input-field"
              autoFocus
              value={formData[currentCol.id] || ''} 
              onChange={e => handleInputChange(e.target.value)} 
              style={{ minHeight: '120px', resize: 'vertical' }}
              placeholder={`Digite ${currentCol.nome}...`}
            />
          ) : (
            <input 
              type={currentCol.tipo === 'number' ? 'number' : 'text'} 
              className="input-field" 
              ref={inputRef}
              value={formData[currentCol.id] || ''} 
              onChange={e => handleInputChange(e.target.value)} 
              onKeyDown={handleKeyDown}
              style={{ textAlign: 'center', fontSize: '32px', padding: '16px 0', borderBottomWidth: '2px' }}
              placeholder={currentCol.tipo === 'number' ? '0.0' : `Digitar...`}
            />
          )}

          {/* Árvore Bifurcada Intercept (Aparece junto com o CAP ou DAP principal) */}
          {(currentCol.id === 'cap' || currentCol.id === 'dap') && (
            <div style={{ marginTop: '24px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setMultiStems(!multiStems)}
                style={{ background: multiStems ? 'var(--primary-glow)' : 'transparent', borderStyle: 'dashed' }}
              >
                {multiStems ? '✔️ Bifurcada Ativa (Múltiplos fustes)' : '🌳 Árvore é Bifurcada?'}
              </button>
              
              {multiStems && (
                <div style={{ marginTop: '24px', background: 'rgba(0,0,0,0.5)', padding: '16px', borderLeft: '2px solid var(--primary-color)' }}>
                  <h4 style={{ marginBottom: '16px', color: 'var(--primary-color)', fontSize: '14px' }}>RAMIFICAÇÕES</h4>
                  {stems.map((stem, i) => (
                    <div key={stem.id} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input type="number" className="input-field" placeholder="CAP" value={stem.cap} onChange={e => {
                        const s = [...stems]; s[i].cap = e.target.value; setStems(s);
                      }} style={{ marginBottom: 0, fontSize: '16px', padding: '8px 0', textAlign: 'center' }} />
                      <input type="number" className="input-field" placeholder="Alt(m)" value={stem.altura} onChange={e => {
                        const s = [...stems]; s[i].altura = e.target.value; setStems(s);
                      }} style={{ marginBottom: 0, fontSize: '16px', padding: '8px 0', textAlign: 'center' }} />
                      
                      {stems.length > 1 && (
                        <button className="btn btn-secondary" style={{ width: '48px', padding: 0 }} onClick={() => setStems(stems.filter(x => x.id !== stem.id))}>✕</button>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-secondary" style={{ marginTop: '8px', borderStyle: 'dashed' }} onClick={() => setStems([...stems, { id: Date.now().toString(), cap: '', altura: '' }])}>
                    + Adicionar Fuste
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <button 
          className="btn btn-secondary" 
          style={{ width: '30%' }} 
          disabled={stepIndex === 0} 
          onClick={handlePrev}
        >
          Anterior
        </button>
        <button 
          className="btn btn-primary" 
          style={{ width: '70%', fontSize: '14px' }} 
          onClick={handleNext}
        >
          {isLastStep ? '💾 Salvar Indivíduo' : 'Próximo >>'}
        </button>
      </div>
    </div>
  );
};
