import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { getCurrentPosition } from '../utils/gpsOperations';
import { compressImage, savePhoto, getPhotosForInventory, deletePhotosForIndividual } from '../utils/photoStorage';
import { NumericKeyboardModal } from '../components/NumericKeyboardModal';
import { TextKeyboardModal } from '../components/TextKeyboardModal';

const PhotoThumbnails = ({ individualId, inventoryId }: { individualId: string; inventoryId: number }) => {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const allPhotos = await getPhotosForInventory(inventoryId);
        const myPhotos = allPhotos.filter(p => p.individualId === individualId);
        if (active) {
          setPhotoUrls(myPhotos.map(p => p.base64Data));
        }
      } catch (err) {
        console.error("Erro ao carregar miniaturas:", err);
      }
    };
    load();
    return () => { active = false; };
  }, [individualId, inventoryId]);

  if (photoUrls.length === 0) {
    return <span style={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', fontSize: '13px' }}>Sem fotos</span>;
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
      {photoUrls.map((url, i) => (
        <div key={i} style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <img src={url} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ))}
    </div>
  );
};

export const CollectData = () => {
  const navigate = useNavigate();
  const { currentInventory, saveInventory, setCurrentInventory } = useInventory();
  
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<any>({});
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [multiStems, setMultiStems] = useState(false);
  const [stems, setStems] = useState([{ id: Date.now().toString(), cap: '', altura: '' }]);

  // Previous individual review modal states
  const [showPrevIndModal, setShowPrevIndModal] = useState(false);
  const [editingPrevInd, setEditingPrevInd] = useState(false);
  const [tempPrevIndData, setTempPrevIndData] = useState<any>(null);
  const [reviewIndIndex, setReviewIndIndex] = useState<number | null>(null);

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

  // Função para salvar seleção de múltipla escolha e avançar suavemente no campo
  const selectOptionValue = (val: string) => {
    setFormData((prev: any) => ({ ...prev, [currentCol.id]: val }));
    setTimeout(() => {
      handleNext();
    }, 120);
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
    try {
      const prevIdx = getPrevStepIndex(stepIndex);
      if (prevIdx >= 0) {
        setStepIndex(prevIdx);
      } else if (stepIndex === 0) {
        if (currentInventory?.dados && currentInventory.dados.length > 0) {
          const targetIdx = currentInventory.dados.length - 1;
          const prevInd = currentInventory.dados[targetIdx];
          if (prevInd) {
            setReviewIndIndex(targetIdx);
            setTempPrevIndData(JSON.parse(JSON.stringify(prevInd)));
            setEditingPrevInd(false);
            setShowPrevIndModal(true);
          }
        } else {
          alert("Não há árvores coletadas anteriormente nesta parcela para revisar.");
        }
      }
    } catch (err) {
      console.error("Erro no handlePrev:", err);
    }
  };

  const handleSavePrevInd = async () => {
    try {
      if (!tempPrevIndData || reviewIndIndex === null) return;
      const freshInv = JSON.parse(JSON.stringify(currentInventory));
      if (freshInv?.dados) {
        freshInv.dados[reviewIndIndex] = tempPrevIndData;
        setCurrentInventory(freshInv);
        await saveInventory(freshInv);
      }
      setEditingPrevInd(false);
      alert("Alterações salvas com sucesso!");
    } catch (err) {
      console.error("Erro no handleSavePrevInd:", err);
    }
  };

  const handleDeletePrevInd = async () => {
    if (!tempPrevIndData || reviewIndIndex === null) return;
    
    const confirmDelete = window.confirm(
      `Tem certeza de que deseja excluir permanentemente a Árvore #${tempPrevIndData.numeroIndividuo} e todas as suas fotos?`
    );
    if (!confirmDelete) return;

    try {
      await deletePhotosForIndividual(tempPrevIndData.id);
      const freshInv = JSON.parse(JSON.stringify(currentInventory));
      if (freshInv?.dados) {
        freshInv.dados.splice(reviewIndIndex, 1);
        freshInv.dados.forEach((d: any, idx: number) => {
          d.numeroIndividuo = idx + 1;
        });
        setCurrentInventory(freshInv);
        await saveInventory(freshInv);
      }
      setShowPrevIndModal(false);
      setEditingPrevInd(false);
      setTempPrevIndData(null);
      setReviewIndIndex(null);
      alert("Árvore excluída com sucesso!");
    } catch (err) {
      console.error("Erro ao excluir árvore:", err);
      alert("Erro ao excluir árvore: " + err);
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
          marginTop: '6px', 
          padding: '10px 8px',
          paddingBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '96vh',
          justifyContent: 'space-between',
          gap: '8px',
          boxSizing: 'border-box',
          maxWidth: '480px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        {/* Wizard Header & Progress */}
        <div>
          <div className="app-header" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ color: '#ffffff', fontSize: '17px', fontWeight: '800', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{currentInventory.nome}</h2>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Coleta em Andamento</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{
                background: 'rgba(46, 125, 50, 0.15)',
                border: '1px solid rgba(46, 125, 50, 0.45)',
                borderRadius: '8px',
                padding: '5px 10px',
                color: 'var(--primary-hover)',
                fontWeight: '800',
                fontSize: '14.5px',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                boxShadow: '0 0 10px rgba(46, 125, 50, 0.2)',
                whiteSpace: 'nowrap'
              }}>
                Árvore #{currentIdx}
              </div>
              <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: '10px', height: '30px' }} onClick={() => navigate(`/fieldwork/${currentInventory.fieldWorkId}`)}>
                Pausar
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '100px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ width: `${((stepIndex + 1) / columns.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary-color) 0%, var(--primary-hover) 100%)', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>

        {/* Wizard Step Card (Rounded 24px, compact) */}
        <div 
          className="glass-card" 
          style={{ 
            flex: '0 0 auto', 
            margin: '0 0 8px 0', 
            padding: '18px 16px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            minHeight: '130px',
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
            ) : currentCol.tipo === 'select' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                  gap: '12px', 
                  width: '100%' 
                }}>
                  {(currentCol.opcoes || []).map((opt: string) => {
                    const isSelected = formData[currentCol.id] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => selectOptionValue(opt)}
                        style={{
                          background: isSelected ? 'rgba(46, 125, 50, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                          border: isSelected ? '1px solid var(--primary-hover)' : '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '16px',
                          color: isSelected ? '#ffffff' : 'var(--text-muted)',
                          padding: '16px 12px',
                          fontSize: '14px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isSelected ? '0 0 15px rgba(76, 175, 80, 0.15)' : 'none',
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                
                {formData[currentCol.id] && (
                  <button
                    onClick={() => setFormData((prev: any) => ({ ...prev, [currentCol.id]: '' }))}
                    style={{
                      background: 'rgba(239, 35, 60, 0.08)',
                      border: '1px solid rgba(239, 35, 60, 0.3)',
                      borderRadius: '12px',
                      color: '#ff8a80',
                      padding: '8px 16px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      marginTop: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Limpar Seleção
                  </button>
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
              style={{ width: '30%', padding: '12px 0', border: '1px solid rgba(46, 125, 50, 0.4)' }} 
              onClick={handlePrev}
            >
              Anterior •
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

      {/* Modal de Revisão do Indivíduo Anterior */}
      {showPrevIndModal && tempPrevIndData && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', 
          zIndex: 1000, padding: '20px', overflowY: 'auto', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' 
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', marginTop: '30px', marginBottom: '30px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                Revisar Árvore #{tempPrevIndData.numeroIndividuo}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  onClick={() => setEditingPrevInd(!editingPrevInd)}
                  style={{
                    background: editingPrevInd ? 'rgba(46, 125, 50, 0.25)' : 'transparent',
                    border: editingPrevInd ? '1px solid var(--primary-hover)' : '1px solid rgba(255, 255, 255, 0.15)',
                    color: editingPrevInd ? 'var(--primary-hover)' : 'white',
                    borderRadius: '8px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    padding: 0,
                    outline: 'none'
                  }}
                  title="Editar dados"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </button>
                <button 
                  onClick={handleDeletePrevInd}
                  style={{
                    background: 'rgba(239, 35, 60, 0.15)',
                    border: '1px solid rgba(239, 35, 60, 0.4)',
                    color: '#ff4d6d',
                    borderRadius: '8px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    padding: 0,
                    outline: 'none'
                  }}
                  title="Excluir árvore"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
                <button 
                  onClick={() => {
                    setShowPrevIndModal(false);
                    setEditingPrevInd(false);
                    setTempPrevIndData(null);
                    setReviewIndIndex(null);
                  }} 
                  style={{ 
                    background: 'transparent', 
                    color: 'rgba(255,255,255,0.6)', 
                    border: 'none', 
                    fontSize: '24px', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    padding: 0,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>

              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {columns.map(col => {
                if (tempPrevIndData.multipleStems && ['cap', 'hc', 'ht'].includes(col.id)) return null;

                const value = tempPrevIndData[col.id];
                
                return (
                  <div key={col.id}>
                    <label className="input-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{col.nome}</label>
                    {editingPrevInd ? (
                      col.tipo === 'photo' ? (
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '14px', color: 'var(--text-muted)' }}>
                          {value || 'Sem fotos'}
                        </div>
                      ) : col.tipo === 'select' ? (
                        <select
                          className="input-field"
                          style={{ 
                            marginBottom: 0, 
                            marginTop: '4px',
                            appearance: 'none',
                            background: 'rgba(0,0,0,0.25) url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e") no-repeat right 12px center',
                            backgroundSize: '16px'
                          }}
                          value={value || ''}
                          onChange={e => setTempPrevIndData({ ...tempPrevIndData, [col.id]: e.target.value })}
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
                          value={value || ''} 
                          onChange={e => setTempPrevIndData({ ...tempPrevIndData, [col.id]: e.target.value })} 
                        />
                      )
                    ) : (
                      <div style={{ 
                        padding: '12px 16px', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '15px',
                        color: '#ffffff',
                        wordBreak: 'break-all'
                      }}>
                        {col.tipo === 'photo' ? (
                          <PhotoThumbnails individualId={tempPrevIndData.id} inventoryId={currentInventory.id} />
                        ) : (
                          value || <span style={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Não preenchido</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Se a árvore anterior for bifurcada, exibe fustes */}
              {tempPrevIndData.multipleStems && tempPrevIndData.stems && (
                <div style={{ 
                  background: 'rgba(0,0,0,0.25)', 
                  padding: '16px', 
                  borderRadius: '12px', 
                  marginTop: '16px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <h4 style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold' }}>Fustes de Ramificação</h4>
                  {tempPrevIndData.stems.map((stem: any, i: number) => (
                    <div key={stem.id} style={{ marginBottom: '12px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fuste #{i + 1}</span>
                      {editingPrevInd ? (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <div style={{ flex: 1 }}>
                            <label className="input-label" style={{ fontSize: '9px' }}>CAP</label>
                            <input 
                              type="number" 
                              className="input-field" 
                              placeholder="CAP" 
                              value={stem.cap || ''} 
                              onChange={e => {
                                const s = [...tempPrevIndData.stems]; 
                                s[i].cap = e.target.value; 
                                setTempPrevIndData({ ...tempPrevIndData, stems: s });
                              }} 
                              style={{ marginBottom: 0 }} 
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="input-label" style={{ fontSize: '9px' }}>Altura (m)</label>
                            <input 
                              type="number" 
                              className="input-field" 
                              placeholder="Alt" 
                              value={stem.altura || ''} 
                              onChange={e => {
                                const s = [...tempPrevIndData.stems]; 
                                s[i].altura = e.target.value; 
                                setTempPrevIndData({ ...tempPrevIndData, stems: s });
                              }} 
                              style={{ marginBottom: 0 }} 
                            />
                          </div>
                        </div>
                      ) : (
                        <div style={{ 
                          display: 'flex', 
                          gap: '12px', 
                          marginTop: '4px',
                          padding: '8px 12px', 
                          background: 'rgba(255, 255, 255, 0.01)', 
                          borderRadius: '8px', 
                          border: '1px solid rgba(255,255,255,0.03)',
                          fontSize: '14px' 
                        }}>
                          <div><strong style={{ color: 'var(--text-muted)' }}>CAP:</strong> {stem.cap?.toString().replace('.', ',') || '-'}</div>
                          <div><strong style={{ color: 'var(--text-muted)' }}>Altura:</strong> {stem.altura?.toString().replace('.', ',') || '-'}m</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Navegação entre indivíduos anteriores */}
            {reviewIndIndex !== null && currentInventory?.dados && currentInventory.dados.length > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginTop: '20px',
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px'
              }}>
                <button
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '8px 12px', fontSize: '10.5px', height: '32px' }}
                  disabled={reviewIndIndex === 0}
                  onClick={() => {
                    const newIdx = reviewIndIndex - 1;
                    setReviewIndIndex(newIdx);
                    setTempPrevIndData(JSON.parse(JSON.stringify(currentInventory.dados[newIdx])));
                    setEditingPrevInd(false);
                  }}
                >
                  &larr; Anterior
                </button>
                
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                  {reviewIndIndex + 1} de {currentInventory.dados.length}
                </span>

                <button
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '8px 12px', fontSize: '10.5px', height: '32px' }}
                  disabled={reviewIndIndex === currentInventory.dados.length - 1}
                  onClick={() => {
                    const newIdx = reviewIndIndex + 1;
                    setReviewIndIndex(newIdx);
                    setTempPrevIndData(JSON.parse(JSON.stringify(currentInventory.dados[newIdx])));
                    setEditingPrevInd(false);
                  }}
                >
                  Próximo &rarr;
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowPrevIndModal(false);
                  setEditingPrevInd(false);
                  setTempPrevIndData(null);
                  setReviewIndIndex(null);
                }}
              >
                Fechar
              </button>
              {editingPrevInd && (
                <button className="btn btn-primary" onClick={handleSavePrevInd}>
                  Salvar
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
};

