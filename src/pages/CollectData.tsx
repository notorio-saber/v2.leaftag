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
          height: 1.15em;
          background-color: var(--primary-hover);
          margin-left: 4px;
          animation: blink 1s step-end infinite;
          vertical-align: middle;
        }
      `}</style>

      <div 
        className="container" 
        style={{ 
          marginTop: '10px', 
          paddingBottom: '20px',
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
          <div className="app-header" style={{ marginBottom: '12px' }}>
            <div>
              <h2 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800' }}>{currentInventory.nome}</h2>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Coleta em Andamento • Árvore #{currentIdx}</span>
            </div>
            <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '10px' }} onClick={() => navigate(`/fieldwork/${currentInventory.fieldWorkId}`)}>
              Pausar
            </button>
          </div>

          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '100px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ width: `${((stepIndex + 1) / columns.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary-color) 0%, var(--primary-hover) 100%)', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>

        {/* Wizard Step Card (Rounded 24px) */}
        <div 
          className="glass-card" 
          style={{ 
            flex: 1, 
            margin: '0 0 12px 0', 
            padding: '24px 20px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            minHeight: '180px',
            borderRadius: '24px'
          }}
        >
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>Campo {stepIndex + 1} de {columns.length}</span>
            <h1 style={{ fontSize: '22px', margin: '6px 0', color: '#ffffff', fontWeight: '800' }}>{currentCol.nome}</h1>
          </div>

          <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
            {currentCol.id === 'coordenadas' ? (
              <div style={{ textAlign: 'center' }}>
                <input 
                  className="input-field" 
                  readOnly 
                  value={formData[currentCol.id] || ''} 
                  style={{ textAlign: 'center', fontSize: '17px', background: 'rgba(0,0,0,0.3)', borderStyle: 'solid' }}
                  placeholder="Aguardando captura..."
                />
                <button className="btn btn-secondary" style={{ marginTop: '8px' }} onClick={getGps} disabled={isGpsLoading}>
                  {isGpsLoading ? 'Obtendo sinal GPS...' : 'Capturar Coordenadas GPS'}
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
                  background: isTextActive ? 'rgba(46, 125, 50, 0.04)' : 'rgba(0,0,0,0.2)',
                  border: isTextActive ? '1px solid var(--primary-hover)' : '1px dashed rgba(255,255,255,0.12)',
                  boxShadow: isTextActive ? '0 0 15px rgba(76, 175, 80, 0.15)' : 'none',
                  padding: '16px',
                  fontSize: '15px',
                  color: formData[currentCol.id] ? '#ffffff' : 'var(--text-muted)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  minHeight: '90px',
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
                  formData[currentCol.id] || 'Tocar para digitar as observações...'
                )}
              </div>
            ) : currentCol.tipo === 'photo' ? (
              <div style={{ textAlign: 'center' }}>
                <label className="btn btn-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px', cursor: 'pointer' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Tirar Foto da Árvore (Máx 3)</span>
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
                  <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {formData[currentCol.id].map((file: File, idx: number) => (
                      <div key={idx} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <img src={URL.createObjectURL(file)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button 
                          onClick={() => removeFile(idx)}
                          style={{ 
                            position: 'absolute', 
                            top: 0, 
                            right: 0, 
                            background: 'var(--danger-color)', 
                            color: 'white', 
                            border: 'none', 
                            width: '20px', 
                            height: '20px', 
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ×
                        </button>
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
                  background: isNumActive ? 'rgba(46, 125, 50, 0.04)' : 'rgba(0,0,0,0.15)',
                  borderBottom: isNumActive ? '2px solid var(--primary-hover)' : '2px solid rgba(255,255,255,0.15)',
                  boxShadow: isNumActive ? '0 4px 15px rgba(76, 175, 80, 0.15)' : 'none',
                  padding: '10px 0',
                  fontSize: '30px',
                  fontWeight: '800',
                  color: formData[currentCol.id] ? 'var(--primary-hover)' : 'var(--text-muted)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: '0px',
                  minHeight: '52px',
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
                  background: isTextActive ? 'rgba(46, 125, 50, 0.04)' : 'rgba(0,0,0,0.15)',
                  borderBottom: isTextActive ? '2px solid var(--primary-hover)' : '2px solid rgba(255,255,255,0.15)',
                  boxShadow: isTextActive ? '0 4px 15px rgba(76, 175, 80, 0.15)' : 'none',
                  padding: '10px 0',
                  fontSize: '22px',
                  fontWeight: '700',
                  color: formData[currentCol.id] ? 'var(--primary-hover)' : 'var(--text-muted)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: '0px',
                  minHeight: '50px',
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

            {/* Árvore Bifurcada Intercept (CAP ou DAP principal) */}
            {(currentCol.id === 'cap' || currentCol.id === 'dap') && (
              <div style={{ marginTop: '20px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setMultiStems(!multiStems)}
                  style={{ 
                    background: multiStems ? 'rgba(46, 125, 50, 0.15)' : 'transparent', 
                    borderStyle: 'dashed', 
                    borderColor: multiStems ? 'var(--primary-hover)' : 'rgba(255,255,255,0.15)',
                    padding: '10px' 
                  }}
                >
                  {multiStems ? 'Bifurcação Ativada (Múltiplos fustes)' : 'Árvore é bifurcada?'}
                </button>
                
                {multiStems && (
                  <div style={{ 
                    marginTop: '16px', 
                    background: 'rgba(0,0,0,0.25)', 
                    padding: '16px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderLeft: '3px solid var(--primary-color)' 
                  }}>
                    <h4 style={{ marginBottom: '12px', color: 'var(--primary-hover)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Medições de Fustes</h4>
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
                              fontSize: '14.5px',
                              fontFamily: "'Inter', sans-serif",
                              textAlign: 'center',
                              cursor: 'pointer',
                              minHeight: '36px',
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
                              fontSize: '14.5px',
                              fontFamily: "'Inter', sans-serif",
                              textAlign: 'center',
                              cursor: 'pointer',
                              minHeight: '36px',
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
                              stem.altura ? stem.altura.toString().replace('.', ',') : <span style={{ color: 'rgba(255,255,255,0.15)' }}>Altura (m)</span>
                            )}
                          </div>
                          
                          {stems.length > 1 && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ width: '36px', padding: 0, height: '32px', minHeight: '32px', flexShrink: 0, borderRadius: '8px' }} 
                              onClick={() => setStems(stems.filter(x => x.id !== stem.id))}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button className="btn btn-secondary" style={{ marginTop: '10px', borderStyle: 'dashed', padding: '8px' }} onClick={() => setStems([...stems, { id: Date.now().toString(), cap: '', altura: '' }])}>
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
              style={{ width: '30%', padding: '12px 0' }} 
              disabled={stepIndex === 0} 
              onClick={handlePrev}
            >
              Anterior
            </button>
            <button 
              className="btn btn-primary" 
              style={{ width: '70%', padding: '12px 0', fontSize: '12px' }} 
              onClick={handleNext}
            >
              {isLastStep ? 'Salvar Árvore' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
