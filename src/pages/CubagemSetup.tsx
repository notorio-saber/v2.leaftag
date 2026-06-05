import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';

export const CubagemSetup = () => {
  const navigate = useNavigate();
  const { fieldWorkId, talhaoId } = useParams();
  const { saveInventory, setCurrentInventory, talhoes } = useInventory();

  // Filtra talões do trabalho correspondente
  const activeTalhoes = talhoes.filter(t => t.fieldWorkId === fieldWorkId);

  const [nome, setNome] = useState('');
  const [selectedTalhaoId, setSelectedTalhaoId] = useState(talhaoId || '');
  const [observacoes, setObservacoes] = useState('');
  const [modoColeta, setModoColeta] = useState<'relativa' | 'seccional' | ''>('');
  const [metodoCalculo, setMetodoCalculo] = useState<'smalian' | 'huber' | 'newton' | ''>('');
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (isStarting) return;
    if (!fieldWorkId) {
      alert('Erro: Trabalho de campo não identificado. Volte para a tela anterior.');
      return;
    }
    if (!nome.trim()) {
      alert('Por favor, insira um nome ou identificador para a sessão de cubagem.');
      return;
    }
    if (!modoColeta) {
      alert('Por favor, selecione o modo de coleta.');
      return;
    }
    if (!metodoCalculo) {
      alert('Por favor, selecione o método de cálculo.');
      return;
    }

    setIsStarting(true);
    const newCubage = {
      id: Date.now(),
      fieldWorkId,
      talhaoId: selectedTalhaoId || undefined,
      nome: nome.trim(),
      areaParcela: 0,
      fatorExpansao: 0,
      dataInicio: new Date().toLocaleDateString('pt-BR'),
      ultimaColeta: new Date().toLocaleDateString('pt-BR'),
      status: 'Novo',
      colunas: [], // Não usa colunas dinâmicas como inventário tradicional
      dados: [], // Array de CubagemIndividualData
      template: 'cubagem',
      observacoes: observacoes.trim() || undefined,
      modoColeta,
      metodoCalculo
    };

    try {
      await saveInventory(newCubage);
      setCurrentInventory(newCubage);
      navigate(`/cubagem/collect/${newCubage.id}`);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao iniciar a cubagem: ' + err.message);
      setIsStarting(false);
    }
  };

  return (
    <div className="container" style={{ marginTop: '20px', maxWidth: '480px' }}>
      {/* Header */}
      <div className="app-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: 'var(--primary-hover)', fontSize: '22px', fontWeight: '800' }}>Configurar Cubagem</h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Crie uma nova sessão de medição e cálculo de fuste.</span>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '8px' }}>
        <label className="input-label">Nome da Sessão de Cubagem</label>
        <input 
          className="input-field" 
          value={nome} 
          onChange={e => setNome(e.target.value)} 
          placeholder="Ex: Árvores Classe Diamétrica 20, Cubagem Parcela A" 
        />

        <label className="input-label" style={{ marginTop: '12px' }}>Talhão de Manejo (Opcional)</label>
        <select 
          className="input-field" 
          value={selectedTalhaoId} 
          onChange={e => setSelectedTalhaoId(e.target.value)}
          style={{ 
            appearance: 'none',
            background: 'rgba(0,0,0,0.25) url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e") no-repeat right 12px center',
            backgroundSize: '16px'
          }}
        >
          <option value="" style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>-- Sem Talhão --</option>
          {activeTalhoes.map(t => (
            <option key={t.id} value={t.id} style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>{t.nome}</option>
          ))}
        </select>

        <label className="input-label" style={{ marginTop: '12px' }}>Modo de Coleta (Obrigatório)</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button 
            type="button"
            className="btn"
            style={{ 
              flex: 1, 
              background: modoColeta === 'relativa' ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.02)',
              border: modoColeta === 'relativa' ? '1.5px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
              color: modoColeta === 'relativa' ? '#fff' : 'var(--text-muted)',
              fontWeight: 'bold',
              height: '38px',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
            onClick={() => setModoColeta('relativa')}
          >
            Relativa
          </button>
          <button 
            type="button"
            className="btn"
            style={{ 
              flex: 1, 
              background: modoColeta === 'seccional' ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.02)',
              border: modoColeta === 'seccional' ? '1.5px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
              color: modoColeta === 'seccional' ? '#fff' : 'var(--text-muted)',
              fontWeight: 'bold',
              height: '38px',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
            onClick={() => setModoColeta('seccional')}
          >
            Seccional
          </button>
        </div>

        <label className="input-label">Método de Cálculo (Obrigatório)</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button 
            type="button"
            className="btn"
            style={{ 
              flex: 1, 
              background: metodoCalculo === 'smalian' ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.02)',
              border: metodoCalculo === 'smalian' ? '1.5px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
              color: metodoCalculo === 'smalian' ? '#fff' : 'var(--text-muted)',
              fontWeight: 'bold',
              height: '38px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
            onClick={() => setMetodoCalculo('smalian')}
          >
            Smalian
          </button>
          <button 
            type="button"
            className="btn"
            style={{ 
              flex: 1, 
              background: metodoCalculo === 'huber' ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.02)',
              border: metodoCalculo === 'huber' ? '1.5px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
              color: metodoCalculo === 'huber' ? '#fff' : 'var(--text-muted)',
              fontWeight: 'bold',
              height: '38px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
            onClick={() => setMetodoCalculo('huber')}
          >
            Huber
          </button>
          <button 
            type="button"
            className="btn"
            style={{ 
              flex: 1, 
              background: metodoCalculo === 'newton' ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.02)',
              border: metodoCalculo === 'newton' ? '1.5px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
              color: metodoCalculo === 'newton' ? '#fff' : 'var(--text-muted)',
              fontWeight: 'bold',
              height: '38px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
            onClick={() => setMetodoCalculo('newton')}
          >
            Newton
          </button>
        </div>

        <label className="input-label">Observações (Opcional)</label>
        <textarea 
          className="input-field" 
          placeholder="Ex: Amostragem de Eucalyptus saligna com bifurcação..." 
          value={observacoes} 
          onChange={e => setObservacoes(e.target.value)}
          style={{ minHeight: '80px', fontFamily: 'inherit' }}
        />

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} disabled={isStarting}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleStart} disabled={isStarting}>
            {isStarting ? 'Iniciando...' : 'Iniciar Coleta'}
          </button>
        </div>
      </div>
    </div>
  );
};
