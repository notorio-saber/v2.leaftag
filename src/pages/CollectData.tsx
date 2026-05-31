import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { getCurrentPosition } from '../utils/gpsOperations';
import { compressImage, savePhoto } from '../utils/photoStorage';
import { NumericKeyboardModal } from '../components/NumericKeyboardModal';
import { TextKeyboardModal } from '../components/TextKeyboardModal';

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

  const [activeTextField, setActiveTextField] = useState<{
    title: string;
    value: string;
    onSave: (val: string) => void;
  } | null>(null);

  if (!currentInventory) {
    navigate('/');
    return null;
  }

  const columns = currentInventory.colunas;
  const currentIdx = currentInventory.dados.length + 1;
  const currentCol = columns[stepIndex];

  const isNumActive = activeNumField !== null && activeNumField.title === currentCol?.nome;
  const isTextActive = activeTextField !== null && activeTextField?.title === currentCol?.nome;

  // Auto-focus or open custom virtual keyboards based on type on step change
  useEffect(() => {
    if (currentCol) {
      if (currentCol.tipo === 'number') {
        setActiveTextField(null);
        setActiveNumField({
          title: currentCol.nome,
          value: formData[currentCol.id] || '',
          onSave: (val) => setFormData((prev: any) => ({ ...prev, [currentCol.id]: val }))
        });
      } else if (currentCol.tipo === 'text' || currentCol.tipo === 'textarea') {
        setActiveNumField(null);
        setActiveTextField({
          title: currentCol.nome,
          value: formData[currentCol.id] || '',
          onSave: (val) => setFormData((prev: any) => ({ ...prev, [currentCol.id]: val }))
        });
      } else {
        setActiveNumField(null);
        setActiveTextField(null);
      }
    }
  }, [stepIndex, isGpsLoading]);

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
    <>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .blinking-cursor {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background-color: var(--primary-hover);
          margin-left: 2px;
          animation: blink 1s step-end infinite;
          vertical-align: middle;
        }
      `}</style>

      <div 
        className="container" 
        style={{ 
          marginTop: '10px', 
          paddingBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '94vh',
          justifyContent: 'space-between',
          gap: '12px',
          boxSizing: 'border-box',
          maxWidth: '480px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        {/* Wizard Header & Progress */}
        <div>
          <div className="app-header" style={{ marginBottom: '10px' }}>
            <div>
              <h2 style={{ color: 'var(--primary-color)' }}>{currentInventory.nome}</h2>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Coleta em Andamento • Individuo #{currentIdx}</span>
            </div>
            <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '9px', borderRadius: '0px' }} onClick={() => navigate(`/fieldwork/${currentInventory.fieldWorkId}`)}>Pausar</button>
          </div>

          <div style={{ width: '100%', height: '3px', background: 'var(--border-color)', marginBottom: '12px' }}>
            <div style={{ width: `${((stepIndex + 1) / columns.length) * 100}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>

        {/* Wizard Step Card */}
        <div 
          className="glass-card" 
          style={{ 
            flex: 1, 
            margin: '0 0 8px 0', 
            padding: '20px 16px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            minHeight: '160px',
            borderRadius: '0px'
          }}
        >
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Passo {stepIndex + 1} de {columns.length}</span>
            <h1 style={{ fontSize: '24px', margin: '4px 0', color: 'white' }}>{currentCol.nome}</h1>
          </div>

          <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
            {currentCol.id === 'coordenadas' ? (
              <div style={{ textAlign: 'center' }}>
                <input 
                  className="input-field" 
                  readOnly 
                  value={formData[currentCol.id] || ''} 
                  style={{ textAlign: 'center', fontSize: '18px', borderRadius: '0px' }}
                  placeholder="Ex: -23.456, -49.321"
                />
                <button className="btn btn-secondary" style={{ marginTop: '12px', borderRadius: '0px' }} onClick={getGps} disabled={isGpsLoading}>
                  {isGpsLoading ? 'OBTENDO SINAL GPS...' : 'CAPTURAR COORDENADAS'}
                </button>
              </div>
            ) : currentCol.tipo === 'textarea' ? (
              <div 
                onClick={() => setActiveTextField({
                  title: currentCol.nome,
                  value: formData[currentCol.id] || '',
                  onSave: (val) => setFormData((prev: any) => ({ ...prev, [currentCol.id]: val }))
                })}
                style={{
                  background: isTextActive ? 'rgba(46, 125, 50, 0.05)' : 'rgba(255,255,255,0.02)',
                  border: isTextActive ? '1px solid var(--primary-hover)' : '1px dashed var(--border-color)',
                  boxShadow: isTextActive ? '0 0 12px rgba(76, 175, 80, 0.25)' : 'none',
                  padding: '20px',
                  fontSize: '16px',
                  color: formData[currentCol.id] ? 'white' : 'rgba(255,255,255,0.15)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '0px',
                  minHeight: '100px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  userSelect: 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                {isTextActive ? (
                  formData[currentCol.id] ? (
                    <>
                      {formData[currentCol.id]}
                      <span className="blinking-cursor" />
                    </>
                  ) : (
                    <span className="blinking-cursor" />
                  )
                ) : (
                  formData[currentCol.id] || 'Toque para digitar as observações...'
                )}
              </div>
            ) : currentCol.tipo === 'photo' ? (
              <div style={{ textAlign: 'center' }}>
                <label className="btn btn-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '24px', borderRadius: '0px' }}>
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
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {formData[currentCol.id].map((file: File, idx: number) => (
                      <div key={idx} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '0px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img src={URL.createObjectURL(file)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button 
                          onClick={() => removeFile(idx)}
                          style={{ position: 'absolute', top: 0, right: 0, background: 'var(--danger-color)', color: 'white', border: 'none', width: '20px', height: '20px', cursor: 'pointer' }}
                        >X</button>
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
                  background: isNumActive ? 'rgba(46, 125, 50, 0.05)' : 'rgba(255,255,255,0.02)',
                  borderBottom: isNumActive ? '2px solid var(--primary-hover)' : '2px solid var(--primary-color)',
                  boxShadow: isNumActive ? '0 4px 12px rgba(76, 175, 80, 0.15)' : 'none',
                  padding: '12px 0',
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: formData[currentCol.id] ? 'var(--primary-hover)' : 'rgba(255,255,255,0.15)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: '0px',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                {isNumActive ? (
                  formData[currentCol.id] ? (
                    <>
                      {formData[currentCol.id].toString().replace('.', ',')}
                      <span className="blinking-cursor" />
                    </>
                  ) : (
                    <span className="blinking-cursor" />
                  )
                ) : (
                  formData[currentCol.id]?.toString().replace('.', ',') || 'Tocar para digitar...'
                )}
              </div>
            ) : (
              <div 
                onClick={() => setActiveTextField({
                  title: currentCol.nome,
                  value: formData[currentCol.id] || '',
                  onSave: (val) => setFormData((prev: any) => ({ ...prev, [currentCol.id]: val }))
                })}
                style={{
                  background: isTextActive ? 'rgba(46, 125, 50, 0.05)' : 'rgba(255,255,255,0.02)',
                  borderBottom: isTextActive ? '2px solid var(--primary-hover)' : '2px solid var(--primary-color)',
                  boxShadow: isTextActive ? '0 4px 12px rgba(76, 175, 80, 0.15)' : 'none',
                  padding: '12px 0',
                  fontSize: '24px',
                  fontWeight: '600',
                  color: formData[currentCol.id] ? 'var(--primary-hover)' : 'rgba(255,255,255,0.15)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: '0px',
                  minHeight: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                {isTextActive ? (
                  formData[currentCol.id] ? (
                    <>
                      {formData[currentCol.id]}
                      <span className="blinking-cursor" />
                    </>
                  ) : (
                    <span className="blinking-cursor" />
                  )
                ) : (
                  formData[currentCol.id] || 'Tocar para digitar...'
                )}
              </div>
            )}

            {/* Árvore Bifurcada Intercept (Aparece junto com o CAP ou DAP principal) */}
            {(currentCol.id === 'cap' || currentCol.id === 'dap') && (
              <div style={{ marginTop: '20px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setMultiStems(!multiStems)}
                  style={{ background: multiStems ? 'var(--primary-glow)' : 'transparent', borderStyle: 'dashed', borderRadius: '0px', padding: '12px' }}
                >
                  {multiStems ? 'Bifurcada Ativa (Múltiplos fustes)' : 'Árvore é Bifurcada?'}
                </button>
                
                {multiStems && (
                  <div style={{ marginTop: '16px', background: 'rgba(0,0,0,0.5)', padding: '12px', borderLeft: '2px solid var(--primary-color)' }}>
                    <h4 style={{ marginBottom: '10px', color: 'var(--primary-color)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Ramificações</h4>
                    {stems.map((stem, i) => {
                      const isCapActive = activeNumField !== null && activeNumField.title === `CAP do Fuste #${i+1}`;
                      const isAltActive = activeNumField !== null && activeNumField.title === `Altura do Fuste #${i+1}`;
                      
                      return (
                        <div key={stem.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                          <div 
                            onClick={() => setActiveNumField({
                              title: `CAP do Fuste #${i+1}`,
                              value: stem.cap.toString(),
                              onSave: (val) => {
                                const s = [...stems];
                                s[i].cap = val;
                                setStems(s);
                              }
                            })}
                            style={{
                              flex: 1,
                              padding: '10px 0px',
                              background: isCapActive ? 'rgba(46, 125, 50, 0.05)' : 'transparent',
                              borderBottom: isCapActive ? '1px solid var(--primary-hover)' : '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'var(--text-main)',
                              fontSize: '15px',
                              fontFamily: "'Inter', sans-serif",
                              textAlign: 'center',
                              cursor: 'pointer',
                              minHeight: '40px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              userSelect: 'none',
                              borderRadius: '0px',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            {isCapActive ? (
                              stem.cap ? (
                                <>
                                  {stem.cap.toString().replace('.', ',')}
                                  <span className="blinking-cursor" />
                                </>
                              ) : (
                                <span className="blinking-cursor" />
                              )
                            ) : (
                              stem.cap ? stem.cap.toString().replace('.', ',') : <span style={{ color: 'rgba(255,255,255,0.15)' }}>CAP</span>
                            )}
                          </div>

                          <div 
                            onClick={() => setActiveNumField({
                              title: `Altura do Fuste #${i+1}`,
                              value: stem.altura.toString(),
                              onSave: (val) => {
                                const s = [...stems];
                                s[i].altura = val;
                                setStems(s);
                              }
                            })}
                            style={{
                              flex: 1,
                              padding: '10px 0px',
                              background: isAltActive ? 'rgba(46, 125, 50, 0.05)' : 'transparent',
                              borderBottom: isAltActive ? '1px solid var(--primary-hover)' : '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'var(--text-main)',
                              fontSize: '15px',
                              fontFamily: "'Inter', sans-serif",
                              textAlign: 'center',
                              cursor: 'pointer',
                              minHeight: '40px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              userSelect: 'none',
                              borderRadius: '0px',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            {isAltActive ? (
                              stem.altura ? (
                                <>
                                  {stem.altura.toString().replace('.', ',')}
                                  <span className="blinking-cursor" />
                                </>
                              ) : (
                                <span className="blinking-cursor" />
                              )
                            ) : (
                              stem.altura ? stem.altura.toString().replace('.', ',') : <span style={{ color: 'rgba(255,255,255,0.15)' }}>Alt(m)</span>
                            )}
                          </div>
                          
                          {stems.length > 1 && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ width: '40px', padding: 0, height: '36px', minHeight: '36px', flexShrink: 0, borderRadius: '0px' }} 
                              onClick={() => setStems(stems.filter(x => x.id !== stem.id))}
                            >
                              X
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button className="btn btn-secondary" style={{ marginTop: '8px', borderStyle: 'dashed', borderRadius: '0px', padding: '8px 12px' }} onClick={() => setStems([...stems, { id: Date.now().toString(), cap: '', altura: '' }])}>
                      + Adicionar Fuste
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Keyboard & Navigation Controls Stacked Inline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Inline Numeric Keyboard */}
          {activeNumField && (
            <NumericKeyboardModal
              value={activeNumField.value}
              onChange={(val) => {
                activeNumField.onSave(val);
                setActiveNumField(prev => prev ? { ...prev, value: val } : null);
              }}
              onConfirm={handleNext}
              onClose={() => {}}
            />
          )}

          {/* Inline Text Keyboard */}
          {activeTextField && (
            <TextKeyboardModal
              value={activeTextField.value}
              onChange={(val) => {
                activeTextField.onSave(val);
                setActiveTextField(prev => prev ? { ...prev, value: val } : null);
              }}
              onConfirm={handleNext}
              onClose={() => {}}
            />
          )}

          {/* Navigation Controls */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-secondary" 
              style={{ width: '30%', padding: '12px 0', borderRadius: '0px' }} 
              disabled={stepIndex === 0} 
              onClick={handlePrev}
            >
              Anterior
            </button>
            <button 
              className="btn btn-primary" 
              style={{ width: '70%', padding: '12px 0', fontSize: '13px', borderRadius: '0px' }} 
              onClick={handleNext}
            >
              {isLastStep ? 'Salvar Individuo' : 'Proximo'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
