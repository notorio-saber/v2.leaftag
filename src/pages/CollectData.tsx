import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { getCurrentPosition } from '../utils/gpsOperations';
import { compressImage, savePhoto } from '../utils/photoStorage';
import { NumericKeyboardModal } from '../components/NumericKeyboardModal';

export const CollectData = () => {
  const navigate = useNavigate();
  const { currentInventory, saveInventory, setCurrentInventory } = useInventory();
  
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<any>({});
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [multiStems, setMultiStems] = useState(false);
  const [stems, setStems] = useState([{ id: Date.now().toString(), cap: '', altura: '' }]);

  const [activeNumField, setActiveNumField] = useState<{
    title: string;
    value: string;
    onSave: (val: string) => void;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  if (!currentInventory) {
    navigate('/');
    return null;
  }

  const columns = currentInventory.colunas;
  const currentIdx = currentInventory.dados.length + 1;
  const currentCol = columns[stepIndex];

  // Auto-focus on step change, or open custom numeric keyboard if step is numeric
  useEffect(() => {
    if (currentCol && currentCol.tipo === 'number') {
      setActiveNumField({
        title: currentCol.nome,
        value: formData[currentCol.id] || '',
        onSave: (val) => setFormData((prev: any) => ({ ...prev, [currentCol.id]: val }))
      });
    } else {
      setActiveNumField(null);
      if (inputRef.current && !isGpsLoading) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [stepIndex, isGpsLoading]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Keep existing files if any, and append new ones up to 3
      const existing = formData[currentCol.id] || [];
      const incoming = Array.from(e.target.files);
      const combined = [...existing, ...incoming].slice(0, 3);
      setFormData((prev: any) => ({ ...prev, [currentCol.id]: combined }));
    }
  };

  const removeFile = (index: number) => {
    const existing = formData[currentCol.id] || [];
    const newFiles = existing.filter((_: any, i: number) => i !== index);
    setFormData((prev: any) => ({ ...prev, [currentCol.id]: newFiles }));
  };

  const saveIndividual = async () => {
    const freshInv = JSON.parse(JSON.stringify(currentInventory)); 
    const individualId = Date.now().toString();

    // Process photo fields securely in memory
    const processedFormData = { ...formData };
    
    for (const col of columns) {
      if (col.tipo === 'photo' && processedFormData[col.id]) {
        const files: File[] = processedFormData[col.id];
        const fileNames: string[] = [];
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileName = `Inv${currentInventory.id}_Ind${currentIdx}_${col.id}_${i+1}.jpg`;
          
          try {
            const base64Data = await compressImage(file, 1200, 0.6);
            await savePhoto({
              inventoryId: currentInventory.id,
              individualId: individualId,
              fileName,
              base64Data
            });
            fileNames.push(fileName);
          } catch (err) {
            console.error("Failed to compress/save photo", err);
          }
        }
        
        // Replace File array with string representation for DB
        processedFormData[col.id] = fileNames.join(', ');
      }
    }
    
    const newIndividual = {
      id: individualId,
      numeroIndividuo: currentIdx,
      timestamp: new Date().toLocaleString('pt-BR'),
      multipleStems: multiStems,
      ...(multiStems && { stems: stems.map(s => ({id: s.id, cap: parseFloat(s.cap||'0'), altura: parseFloat(s.altura||'0')})) }),
      ...processedFormData
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
          ) : currentCol.tipo === 'photo' ? (
            <div style={{ textAlign: 'center' }}>
              <label className="btn btn-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '32px' }}>
                <span style={{ fontSize: '24px' }}>📷</span>
                <span>Tirar Foto (Max 3)</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  multiple 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange}
                />
              </label>
              
              {formData[currentCol.id] && formData[currentCol.id].length > 0 && (
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {formData[currentCol.id].map((file: File, idx: number) => (
                    <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <img src={URL.createObjectURL(file)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        onClick={() => removeFile(idx)}
                        style={{ position: 'absolute', top: 0, right: 0, background: 'var(--danger-color)', color: 'white', border: 'none', width: '24px', height: '24px', cursor: 'pointer' }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : currentCol.tipo === 'number' ? (
            <div 
              onClick={() => setActiveNumField({
                title: currentCol.nome,
                value: formData[currentCol.id] || '',
                onSave: (val) => setFormData((prev: any) => ({ ...prev, [currentCol.id]: val }))
              })}
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '2px solid var(--primary-color)',
                padding: '16px 0',
                fontSize: '36px',
                fontWeight: 'bold',
                color: formData[currentCol.id] ? 'var(--primary-hover)' : 'rgba(255,255,255,0.15)',
                textAlign: 'center',
                cursor: 'pointer',
                borderRadius: '8px',
                minHeight: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none'
              }}
            >
              {formData[currentCol.id]?.toString().replace('.', ',') || 'Tocar para digitar...'}
            </div>
          ) : (
            <input 
              type="text" 
              className="input-field" 
              ref={inputRef}
              value={formData[currentCol.id] || ''} 
              onChange={e => handleInputChange(e.target.value)} 
              onKeyDown={handleKeyDown}
              style={{ textAlign: 'center', fontSize: '32px', padding: '16px 0', borderBottomWidth: '2px' }}
              placeholder={`Digitar...`}
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
                      <input 
                        type="text" 
                        readOnly
                        className="input-field" 
                        placeholder="CAP" 
                        value={stem.cap ? stem.cap.toString().replace('.', ',') : ''} 
                        onClick={() => setActiveNumField({
                          title: `CAP do Fuste #${i+1}`,
                          value: stem.cap.toString(),
                          onSave: (val) => {
                            const s = [...stems];
                            s[i].cap = val;
                            setStems(s);
                          }
                        })}
                        style={{ marginBottom: 0, fontSize: '16px', padding: '8px 0', textAlign: 'center', cursor: 'pointer' }} 
                      />
                      <input 
                        type="text" 
                        readOnly
                        className="input-field" 
                        placeholder="Alt(m)" 
                        value={stem.altura ? stem.altura.toString().replace('.', ',') : ''} 
                        onClick={() => setActiveNumField({
                          title: `Altura do Fuste #${i+1}`,
                          value: stem.altura.toString(),
                          onSave: (val) => {
                            const s = [...stems];
                            s[i].altura = val;
                            setStems(s);
                          }
                        })}
                        style={{ marginBottom: 0, fontSize: '16px', padding: '8px 0', textAlign: 'center', cursor: 'pointer' }} 
                      />
                      
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

      {activeNumField && (
        <NumericKeyboardModal
          title={activeNumField.title}
          initialValue={activeNumField.value}
          onConfirm={(val) => {
            activeNumField.onSave(val);
            setActiveNumField(null);
          }}
          onClose={() => setActiveNumField(null)}
        />
      )}
    </div>
  );
};
