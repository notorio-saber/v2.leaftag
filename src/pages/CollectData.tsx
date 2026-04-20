import { useState } from 'react';
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

  const currentIdx = currentInventory.dados.length + 1;
  const [formData, setFormData] = useState<any>({});
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [multiStems, setMultiStems] = useState(false);
  const [stems, setStems] = useState([{ id: Date.now().toString(), cap: '', altura: '' }]);

  const handleInputChange = (id: string, val: string) => {
    setFormData((prev: any) => ({ ...prev, [id]: val }));
  };

  const getGps = async () => {
    setIsGpsLoading(true);
    try {
      const pos = await getCurrentPosition();
      setFormData((prev: any) => ({ ...prev, coordenadas: `${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}` }));
    } catch (e: any) {
      if (e.message.includes('Permissão')) {
        alert('Permissão de localização negada. Por favor, permita o acesso ao GPS no navegador para coletar coordenadas.');
      } else if (e.message.includes('indisponível')) {
        alert('Localização indisponível. Tente novamente em um local aberto ou verifique o GPS do dispositivo.');
      } else if (e.message.includes('Tempo limite')) {
        alert('Tempo limite ao tentar obter localização. Tente novamente.');
      } else {
        alert(e.message);
      }
    }
    setIsGpsLoading(false);
  };

  const saveIndividual = () => {
    // Para que o React e o Firebase detectem a mudança de fato (sem mutar estado atual diretamente):
    const freshInv = JSON.parse(JSON.stringify(currentInventory)); // Deep copy para evitar mutação do reference array
    
    const newIndividual = {
      id: Date.now().toString(),
      numeroIndividuo: currentIdx,
      timestamp: new Date().toLocaleString('pt-BR'),
      multipleStems: multiStems,
      ...(multiStems && { stems: stems.map(s => ({id: s.id, cap: parseFloat(s.cap), altura: parseFloat(s.altura)})) }),
      ...formData
    };
    
    freshInv.dados.push(newIndividual);
    freshInv.ultimaColeta = new Date().toLocaleDateString('pt-BR');
    
    setCurrentInventory(freshInv);
    saveInventory(freshInv);
    
    // reset
    setFormData({});
    setMultiStems(false);
    setStems([{ id: Date.now().toString(), cap: '', altura: '' }]);
  };

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      <div className="app-header">
        <div>
          <h2 style={{ color: 'var(--primary-color)' }}>{currentInventory.nome}</h2>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Membro Atual: #{currentIdx}</span>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '16px' }}>
        {currentInventory.colunas.map(col => {
          if (multiStems && ['cap', 'hc', 'ht'].includes(col.id)) return null;

          return (
            <div key={col.id} style={{ marginBottom: '16px' }}>
              <label className="input-label">{col.nome}</label>
              {col.id === 'coordenadas' ? (
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      className="input-field" 
                      readOnly 
                      value={formData[col.id] || ''} 
                      style={{ marginBottom: 0, flex: 1 }} 
                    />
                    <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={getGps} disabled={isGpsLoading}>
                      {isGpsLoading ? '...' : 'GPS'}
                    </button>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Para coletar coordenadas, permita o acesso ao GPS quando solicitado pelo navegador.
                  </span>
                </div>
              ) : col.tipo === 'textarea' ? (
                <textarea 
                  className="input-field" 
                  value={formData[col.id] || ''} 
                  onChange={e => handleInputChange(col.id, e.target.value)} 
                />
              ) : (
                <input 
                  type={col.tipo} 
                  className="input-field" 
                  value={formData[col.id] || ''} 
                  onChange={e => handleInputChange(col.id, e.target.value)} 
                />
              )}
            </div>
          );
        })}

        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '24px', cursor: 'pointer', padding: '12px', background: '#252b28', borderRadius: '12px', border: '1px solid var(--primary-color)' }}>
          <input type="checkbox" checked={multiStems} onChange={e => setMultiStems(e.target.checked)} />
          <div>
            <div style={{ fontWeight: 'bold' }}>🌳 Múltiplos Fustes</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Coletar CAP e Altura independentes.</div>
          </div>
        </label>

        {multiStems && (
          <div style={{ marginTop: '16px', background: 'var(--bg-color)', padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ marginBottom: '12px' }}>📏 Fustes</h4>
            {stems.map((stem, i) => (
              <div key={stem.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input type="number" className="input-field" placeholder="CAP" value={stem.cap} onChange={e => {
                  const s = [...stems]; s[i].cap = e.target.value; setStems(s);
                }} style={{ marginBottom: 0 }} />
                <input type="number" className="input-field" placeholder="Alt" value={stem.altura} onChange={e => {
                  const s = [...stems]; s[i].altura = e.target.value; setStems(s);
                }} style={{ marginBottom: 0 }} />
                {stems.length > 1 && (
                  <button className="btn btn-secondary" style={{ width: '48px', padding: 0 }} onClick={() => setStems(stems.filter(x => x.id !== stem.id))}>✕</button>
                )}
              </div>
            ))}
            <button className="btn btn-secondary" style={{ marginTop: '8px' }} onClick={() => setStems([...stems, { id: Date.now().toString(), cap: '', altura: '' }])}>
              + Fuste
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <button className="btn btn-secondary" onClick={() => navigate(`/fieldwork/${currentInventory.fieldWorkId}`)}>Voltar / Pausar</button>
        <button className="btn btn-primary" onClick={saveIndividual}>Salvar {`&`} Próximo</button>
      </div>
    </div>
  );
};
