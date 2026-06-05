import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { NumericKeyboardModal } from '../components/NumericKeyboardModal';

interface CubageTree {
  id: string;
  numeroIndividuo: number;
  especie: string;
  modo: 'relativo' | 'seccional';
  alturaTotal?: number;
  status: 'Novo' | 'Em Andamento' | 'Concluído';
  timestamp: string;
  metodoCalculo: 'smalian' | 'huber' | 'newton';
  
  // Modo Relativo
  dadosRelativos: {
    [ponto: string]: string; // diâmetro em string para digitação
  };

  // Modo Seccional
  secoes: {
    id: string;
    comprimento: string;
    dInicial?: string;
    dMedio?: string;
    dFinal?: string;
    volume: number;
  }[];
  volumeTotal: number;
  volumePorSecao?: { secao: number; volume: number }[];
  dataCalculo?: string;
}

const PONTOS_RELATIVOS = [
  'Base', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', 'Topo'
];

export const CubagemCollect = () => {
  const { inventoryId } = useParams();
  const navigate = useNavigate();
  const { inventories, saveInventory, setCurrentInventory } = useInventory();

  // Encontra a sessão de cubagem atual
  const session = inventories.find(i => i.id === Number(inventoryId));

  const [trees, setTrees] = useState<CubageTree[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string>('');
  const [showTreeModal, setShowTreeModal] = useState(false);
  const [newTreeEspecie, setNewTreeEspecie] = useState('Eucalyptus');

  // Estado da árvore ativa sendo editada
  const [especie, setEspecie] = useState('');
  const [alturaTotal, setAlturaTotal] = useState('');
  const [modo, setModo] = useState<'relativo' | 'seccional'>('relativo');
  const [metodoCalculo, setMetodoCalculo] = useState<'smalian' | 'huber' | 'newton'>('smalian');

  // Controle de ponto selecionado no Modo Relativo
  const [selectedPonto, setSelectedPonto] = useState<string>('Base');

  // Controle de seção selecionada / sendo adicionada no Modo Seccional
  const [secComprimento, setSecComprimento] = useState('');
  const [secDInicial, setSecDInicial] = useState('');
  const [secDMedio, setSecDMedio] = useState('');
  const [secDFinal, setSecDFinal] = useState('');
  const [activeSecId, setActiveSecId] = useState<string | null>(null);

  // Campo ativo para o teclado numérico
  // Ex: { type: 'relative', point: '10%' } ou { type: 'sectional', field: 'dInicial' } ou { type: 'height' }
  const [activeField, setActiveField] = useState<{
    type: 'relative' | 'sectional' | 'height' | 'spec_height';
    point?: string;
    field?: 'comprimento' | 'dInicial' | 'dMedio' | 'dFinal';
  } | null>(null);

  const [tab, setTab] = useState<'coleta' | 'tabela' | 'afilamento'>('coleta');
  const [showSummaryId, setShowSummaryId] = useState<string | null>(null);

  // Carrega árvores da sessão do Firestore/Context
  useEffect(() => {
    if (session) {
      const loadedTrees = (session.dados as any[]).map(tree => ({
        id: tree.id,
        numeroIndividuo: tree.numeroIndividuo,
        especie: tree.especie || '',
        modo: tree.modo || 'relativo',
        alturaTotal: tree.alturaTotal,
        status: tree.status || 'Novo',
        timestamp: tree.timestamp,
        metodoCalculo: tree.metodoCalculo || 'smalian',
        dadosRelativos: tree.dadosRelativos || {},
        secoes: tree.secoes || [],
        volumeTotal: tree.volumeTotal || 0,
        volumePorSecao: tree.volumePorSecao || [],
        dataCalculo: tree.dataCalculo || '',
      }));
      setTrees(loadedTrees);

      if (loadedTrees.length > 0 && !activeTreeId) {
        setActiveTreeId(loadedTrees[0].id);
      }
    }
  }, [session]);

  // Sincroniza campos da árvore ativa quando ela muda
  const activeTree = trees.find(t => t.id === activeTreeId);

  useEffect(() => {
    if (activeTree) {
      setEspecie(activeTree.especie);
      setAlturaTotal(activeTree.alturaTotal ? activeTree.alturaTotal.toString() : '');
      setModo(activeTree.modo);
      setMetodoCalculo(activeTree.metodoCalculo);
      setActiveField(null);

      if (activeTree.modo === 'relativo') {
        // Seleciona a primeira pendente ou Base por padrão
        const pendente = PONTOS_RELATIVOS.find(p => !activeTree.dadosRelativos[p]);
        setSelectedPonto(pendente || 'Base');
      } else {
        // Reseta campos da seção
        setSecComprimento('');
        setSecDInicial('');
        setSecDMedio('');
        setSecDFinal('');
        setActiveSecId(null);
      }
    }
  }, [activeTreeId]);

  if (!session) {
    return (
      <div className="container" style={{ marginTop: '20px', textAlign: 'center' }}>
        <div className="glass-card">
          <h2>Sessão de Cubagem não encontrada</h2>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Voltar</button>
        </div>
      </div>
    );
  }

  // Atalho para salvar alterações no banco
  const persistSession = async (updatedTrees: CubageTree[]) => {
    const updatedDados = updatedTrees.map(t => {
      let vol = t.volumeTotal || 0;
      if (t.status !== 'Concluído') {
        const { volumeTotal } = computeDetailedVolume(t);
        vol = volumeTotal;
      }

      return {
        id: t.id,
        numeroIndividuo: t.numeroIndividuo,
        especie: t.especie,
        modo: t.modo,
        alturaTotal: t.alturaTotal,
        status: t.status,
        timestamp: t.timestamp,
        metodoCalculo: t.metodoCalculo,
        dadosRelativos: t.dadosRelativos,
        secoes: t.secoes,
        volumeTotal: vol,
        volumePorSecao: t.volumePorSecao || [],
        dataCalculo: t.dataCalculo || '',
        multipleStems: false
      };
    });

    const updatedSession = {
      ...session,
      dados: updatedDados,
      status: updatedDados.every(d => d.status === 'Concluído') ? 'Concluído' : 'Em Andamento',
      ultimaColeta: new Date().toLocaleDateString('pt-BR')
    };

    setCurrentInventory(updatedSession);
    await saveInventory(updatedSession);
  };

  // Funções de Cálculo Matemático de Volumes
  const calculateSectionVolume = (
    method: 'smalian' | 'huber' | 'newton',
    L: number,
    dIni: number,
    dMed: number,
    dFin: number
  ): number => {
    if (L <= 0) return 0;

    const area = (d: number) => (Math.PI * Math.pow(d, 2)) / 40000;

    if (method === 'smalian') {
      return ((area(dIni) + area(dFin)) / 2) * L;
    } else if (method === 'huber') {
      return area(dMed) * L;
    } else if (method === 'newton') {
      return ((area(dIni) + 4 * area(dMed) + area(dFin)) / 6) * L;
    }
    return 0;
  };

  const computeDetailedVolume = (tree: CubageTree): { volumeTotal: number; volumePorSecao: { secao: number; volume: number }[] } => {
    const volumePorSecao: { secao: number; volume: number }[] = [];
    let volumeTotal = 0;
    const method = tree.metodoCalculo || 'smalian';

    if (tree.modo === 'relativo') {
      const h = tree.alturaTotal || 0;
      const L = h * 0.1; // 10 seções de 10%
      
      for (let i = 0; i < PONTOS_RELATIVOS.length - 1; i++) {
        const p1 = PONTOS_RELATIVOS[i];
        const p2 = PONTOS_RELATIVOS[i + 1];
        const d1 = parseFloat(tree.dadosRelativos[p1] || '0');
        const d2 = parseFloat(tree.dadosRelativos[p2] || '0');
        
        let vol = 0;
        if (d1 > 0 && d2 > 0) {
          vol = calculateSectionVolume(method, L, d1, (d1 + d2) / 2, d2);
        }
        
        volumePorSecao.push({
          secao: i + 1,
          volume: parseFloat(vol.toFixed(6))
        });
        volumeTotal += vol;
      }
    } else {
      // Modo Seccional
      tree.secoes.forEach((sec, idx) => {
        const L = parseFloat(sec.comprimento || '0');
        const dIni = parseFloat(sec.dInicial || '0');
        const dMed = parseFloat(sec.dMedio || '0');
        const dFin = parseFloat(sec.dFinal || '0');
        
        const vol = calculateSectionVolume(method, L, dIni, dMed, dFin);
        volumePorSecao.push({
          secao: idx + 1,
          volume: parseFloat(vol.toFixed(6))
        });
        volumeTotal += vol;
      });
    }
    
    return {
      volumeTotal: parseFloat(volumeTotal.toFixed(6)),
      volumePorSecao
    };
  };

  const validateTreeForConclusion = (tree: CubageTree): string | null => {
    if (!tree.alturaTotal || tree.alturaTotal <= 0) {
      return 'A altura total da árvore deve ser informada e maior que zero.';
    }
    
    if (tree.modo === 'relativo') {
      for (const p of PONTOS_RELATIVOS) {
        const d = parseFloat(tree.dadosRelativos[p] || '0');
        if (isNaN(d) || d <= 0) {
          return `O diâmetro no ponto ${p} deve ser informado e maior que zero.`;
        }
      }
    } else {
      if (!tree.secoes || tree.secoes.length === 0) {
        return 'Adicione pelo menos uma seção para concluir a cubagem.';
      }
      for (let i = 0; i < tree.secoes.length; i++) {
        const sec = tree.secoes[i];
        const L = parseFloat(sec.comprimento || '0');
        if (isNaN(L) || L <= 0) {
          return `A seção ${i + 1} possui comprimento inválido.`;
        }
        const dIni = parseFloat(sec.dInicial || '0');
        const dMed = parseFloat(sec.dMedio || '0');
        const dFin = parseFloat(sec.dFinal || '0');
        
        if (tree.metodoCalculo === 'smalian') {
          if (isNaN(dIni) || dIni <= 0 || isNaN(dFin) || dFin <= 0) {
            return `A seção ${i + 1} exige diâmetros inicial e final válidos para o método Smalian.`;
          }
        } else if (tree.metodoCalculo === 'huber') {
          if (isNaN(dMed) || dMed <= 0) {
            return `A seção ${i + 1} exige diâmetro médio válido para o método Huber.`;
          }
        } else if (tree.metodoCalculo === 'newton') {
          if (isNaN(dIni) || dIni <= 0 || isNaN(dMed) || dMed <= 0 || isNaN(dFin) || dFin <= 0) {
            return `A seção ${i + 1} exige diâmetros inicial, médio e final válidos para o método Newton.`;
          }
        }
      }
    }
    return null;
  };

  // Manipulação de Árvores
  const handleCreateTree = async () => {
    const nextNum = trees.length + 1;
    const finalModo = session?.modoColeta === 'relativa' ? 'relativo' : 'seccional';
    const finalMetodo = session?.metodoCalculo || 'smalian';

    const newTree: CubageTree = {
      id: Date.now().toString(),
      numeroIndividuo: nextNum,
      especie: newTreeEspecie.trim() || 'Eucalyptus',
      modo: finalModo,
      status: 'Novo',
      timestamp: new Date().toLocaleString('pt-BR'),
      metodoCalculo: finalMetodo,
      dadosRelativos: {},
      secoes: [],
      volumeTotal: 0,
      volumePorSecao: [],
      dataCalculo: ''
    };

    const updated = [...trees, newTree];
    setTrees(updated);
    setActiveTreeId(newTree.id);
    setShowTreeModal(false);
    await persistSession(updated);
  };

  const handleUpdateTreeMeta = async (field: 'especie' | 'alturaTotal' | 'metodoCalculo' | 'modo', value: any) => {
    if (!activeTree) return;

    const updated = trees.map(t => {
      if (t.id === activeTree.id) {
        return {
          ...t,
          [field]: value
        };
      }
      return t;
    });

    setTrees(updated);
    await persistSession(updated);
  };

  const handleConcluirCubagem = async () => {
    if (!activeTree) return;
    
    const err = validateTreeForConclusion(activeTree);
    if (err) {
      alert(err);
      return;
    }
    
    const { volumeTotal, volumePorSecao } = computeDetailedVolume(activeTree);
    const dataCalculo = new Date().toLocaleDateString('pt-BR');
    
    const updated = trees.map(t => {
      if (t.id === activeTree.id) {
        return {
          ...t,
          status: 'Concluído' as const,
          volumeTotal,
          volumePorSecao,
          dataCalculo
        };
      }
      return t;
    });
    
    setTrees(updated);
    await persistSession(updated);
    setShowSummaryId(activeTree.id);
  };

  // Modo Relativo: Inserção de diâmetro
  const handleRelativeValueChange = async (val: string) => {
    if (!activeTree) return;

    const updated = trees.map(t => {
      if (t.id === activeTree.id) {
        const nextRel = { ...t.dadosRelativos, [selectedPonto]: val };
        return {
          ...t,
          dadosRelativos: nextRel
        };
      }
      return t;
    });

    setTrees(updated);
    await persistSession(updated);
  };

  // Modo Seccional: Gerenciamento de Seções
  const handleSaveSection = async () => {
    if (!activeTree) return;

    const L = parseFloat(secComprimento);
    const dIni = parseFloat(secDInicial || '0');
    const dMed = parseFloat(secDMedio || '0');
    const dFin = parseFloat(secDFinal || '0');

    if (isNaN(L) || L <= 0) {
      alert('Por favor, insira um comprimento válido.');
      return;
    }

    if (metodoCalculo === 'smalian' && (dIni <= 0 || dFin <= 0)) {
      alert('Smalian exige diâmetro inicial e final maiores que zero.');
      return;
    }
    if (metodoCalculo === 'huber' && dMed <= 0) {
      alert('Huber exige diâmetro médio maior que zero.');
      return;
    }
    if (metodoCalculo === 'newton' && (dIni <= 0 || dMed <= 0 || dFin <= 0)) {
      alert('Newton exige diâmetros inicial, médio e final maiores que zero.');
      return;
    }

    const vol = calculateSectionVolume(metodoCalculo, L, dIni, dMed, dFin);

    const updated = trees.map(t => {
      if (t.id === activeTree.id) {
        let nextSecoes = [...t.secoes];
        if (activeSecId) {
          // Editando seção existente
          nextSecoes = nextSecoes.map(s => {
            if (s.id === activeSecId) {
              return {
                id: s.id,
                comprimento: secComprimento,
                dInicial: secDInicial || undefined,
                dMedio: secDMedio || undefined,
                dFinal: secDFinal || undefined,
                volume: vol
              };
            }
            return s;
          });
        } else {
          // Adicionando nova seção
          nextSecoes.push({
            id: Date.now().toString(),
            comprimento: secComprimento,
            dInicial: secDInicial || undefined,
            dMedio: secDMedio || undefined,
            dFinal: secDFinal || undefined,
            volume: vol
          });
        }
        return { ...t, secoes: nextSecoes };
      }
      return t;
    });

    setTrees(updated);
    // Resetar campos
    setSecComprimento('');
    setSecDInicial('');
    setSecDMedio('');
    setSecDFinal('');
    setActiveSecId(null);
    setActiveField(null);
    await persistSession(updated);
  };

  const handleEditSection = (sec: any) => {
    setActiveSecId(sec.id);
    setSecComprimento(sec.comprimento || '');
    setSecDInicial(sec.dInicial || '');
    setSecDMedio(sec.dMedio || '');
    setSecDFinal(sec.dFinal || '');
    setActiveField({ type: 'sectional', field: 'comprimento' });
  };

  const handleDeleteSection = async (secId: string) => {
    if (!activeTree) return;
    if (!confirm('Deseja realmente remover esta seção?')) return;

    const updated = trees.map(t => {
      if (t.id === activeTree.id) {
        return {
          ...t,
          secoes: t.secoes.filter(s => s.id !== secId)
        };
      }
      return t;
    });

    setTrees(updated);
    await persistSession(updated);
  };

  // Teclado Numérico - Trata digitação
  const getKeyboardValue = () => {
    if (!activeField) return '';
    if (activeField.type === 'relative') {
      return activeTree?.dadosRelativos[activeField.point || ''] || '';
    } else if (activeField.type === 'sectional') {
      if (activeField.field === 'comprimento') return secComprimento;
      if (activeField.field === 'dInicial') return secDInicial;
      if (activeField.field === 'dMedio') return secDMedio;
      if (activeField.field === 'dFinal') return secDFinal;
    } else if (activeField.type === 'height') {
      return alturaTotal;
    } else if (activeField.type === 'spec_height') {
      return alturaTotal;
    }
    return '';
  };

  const handleKeyboardChange = (val: string) => {
    if (!activeField) return;
    if (activeField.type === 'relative') {
      handleRelativeValueChange(val);
    } else if (activeField.type === 'sectional') {
      if (activeField.field === 'comprimento') setSecComprimento(val);
      if (activeField.field === 'dInicial') setSecDInicial(val);
      if (activeField.field === 'dMedio') setSecDMedio(val);
      if (activeField.field === 'dFinal') setSecDFinal(val);
    } else if (activeField.type === 'height' || activeField.type === 'spec_height') {
      setAlturaTotal(val);
      handleUpdateTreeMeta('alturaTotal', parseFloat(val) || undefined);
    }
  };

  const handleKeyboardConfirm = () => {
    if (!activeField) return;
    
    if (activeField.type === 'relative') {
      // Avança para o próximo ponto automático
      const idx = PONTOS_RELATIVOS.indexOf(selectedPonto);
      if (idx < PONTOS_RELATIVOS.length - 1) {
        const nextP = PONTOS_RELATIVOS[idx + 1];
        setSelectedPonto(nextP);
        setActiveField({ type: 'relative', point: nextP });
      } else {
        setActiveField(null);
      }
    } else if (activeField.type === 'sectional') {
      // Avança para os campos seguintes da seção dependendo do método
      if (activeField.field === 'comprimento') {
        if (metodoCalculo === 'huber') {
          setActiveField({ type: 'sectional', field: 'dMedio' });
        } else {
          setActiveField({ type: 'sectional', field: 'dInicial' });
        }
      } else if (activeField.field === 'dInicial') {
        if (metodoCalculo === 'newton') {
          setActiveField({ type: 'sectional', field: 'dMedio' });
        } else {
          setActiveField({ type: 'sectional', field: 'dFinal' });
        }
      } else if (activeField.field === 'dMedio') {
        if (metodoCalculo === 'newton') {
          setActiveField({ type: 'sectional', field: 'dFinal' });
        } else {
          setActiveField(null);
        }
      } else if (activeField.field === 'dFinal') {
        // Último campo, fecha ou salva
        setActiveField(null);
      }
    } else {
      setActiveField(null);
    }
  };

  // Desenho SVG do Tronco
  const renderTrunkSvg = () => {
    if (!activeTree) return null;

    if (modo === 'relativo') {
      // Desenha tronco relativo
      return (
        <svg viewBox="0 0 160 480" style={{ width: '100%', height: '400px', display: 'block' }}>
          <defs>
            <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1b3f20" />
              <stop offset="50%" stopColor="#2e7d32" />
              <stop offset="100%" stopColor="#122c15" />
            </linearGradient>
            <linearGradient id="glowingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00e676" />
              <stop offset="50%" stopColor="#b9f6ca" />
              <stop offset="100%" stopColor="#00b0ff" />
            </linearGradient>
          </defs>

          {/* Tronco de Background (Base cinza escura de referência) */}
          <path d="M 50 450 L 60 50 L 100 50 L 110 450 Z" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* Tronco verde indicando preenchimento conforme progresso */}
          {PONTOS_RELATIVOS.map((p, i) => {
            if (i === 0) return null;
            const prevP = PONTOS_RELATIVOS[i - 1];
            const hasPrev = parseFloat(activeTree.dadosRelativos[prevP] || '0') > 0;
            const hasCurr = parseFloat(activeTree.dadosRelativos[p] || '0') > 0;
            
            const y1 = 450 - (i - 1) * 40;
            const y2 = 450 - i * 40;
            const xLeft1 = 50 + (i - 1) * 1;
            const xLeft2 = 50 + i * 1;
            const xRight1 = 110 - (i - 1) * 1;
            const xRight2 = 110 - i * 1;

            const isFilled = hasPrev && hasCurr;
            const isHighlighted = selectedPonto === p || selectedPonto === prevP;

            return (
              <path
                key={i}
                d={`M ${xLeft1} ${y1} L ${xLeft2} ${y2} L ${xRight2} ${y2} L ${xRight1} ${y1} Z`}
                fill={isFilled ? 'url(#trunkGrad)' : 'rgba(255,255,255,0.02)'}
                stroke={isHighlighted ? '#00e676' : 'transparent'}
                strokeWidth={isHighlighted ? 2 : 0}
                style={{ transition: 'all 0.3s ease' }}
              />
            );
          })}

          {/* Pontos de Medição luminosos */}
          {PONTOS_RELATIVOS.map((p, i) => {
            const y = 450 - i * 40;
            const x = 80;
            const isCompleted = parseFloat(activeTree.dadosRelativos[p] || '0') > 0;
            const isSelected = selectedPonto === p;

            return (
              <g 
                key={p} 
                onClick={() => {
                  setSelectedPonto(p);
                  setActiveField({ type: 'relative', point: p });
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow externo se selecionado */}
                {isSelected && (
                  <circle cx={x} cy={y} r="12" fill="rgba(0, 230, 118, 0.25)" className="pulse-animation" />
                )}
                {/* Ponto principal */}
                <circle 
                  cx={x} 
                  cy={y} 
                  r={isSelected ? '7' : '5'} 
                  fill={isCompleted ? '#00e676' : 'rgba(255,255,255,0.15)'}
                  stroke={isSelected ? '#ffffff' : 'rgba(0,0,0,0.5)'}
                  strokeWidth="1.5"
                  style={{ transition: 'all 0.2s ease' }}
                />
                {/* Texto da percentagem ao lado */}
                <text 
                  x={x + 14} 
                  y={y + 4} 
                  fill={isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)'} 
                  fontSize="9.5px" 
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  fontFamily="'Plus Jakarta Sans', sans-serif"
                >
                  {p} {activeTree.dadosRelativos[p] ? `(${activeTree.dadosRelativos[p]} cm)` : ''}
                </text>
              </g>
            );
          })}
        </svg>
      );
    } else {
      // Modo Seccional
      let currentHeight = 0;
      const stack = activeTree.secoes.map(s => {
        const comp = parseFloat(s.comprimento || '0');
        const startH = currentHeight;
        currentHeight += comp;
        return {
          ...s,
          startH,
          endH: currentHeight
        };
      });

      const totalH = Math.max(currentHeight, 10);

      return (
        <svg viewBox="0 0 160 480" style={{ width: '100%', height: '400px', display: 'block' }}>
          <defs>
            <linearGradient id="secGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1b5e20" />
              <stop offset="50%" stopColor="#388e3c" />
              <stop offset="100%" stopColor="#1b5e20" />
            </linearGradient>
          </defs>

          {/* Fundo do Fuste de Referência */}
          <path d="M 50 450 L 65 50 L 95 50 L 110 450 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />

          {/* Renderiza as seções empilhadas */}
          {stack.map((s, idx) => {
            const y1 = 450 - (s.startH / totalH) * 400;
            const y2 = 450 - (s.endH / totalH) * 400;
            
            // interpola largura
            const w1 = 110 - (s.startH / totalH) * 30;
            const w2 = 110 - (s.endH / totalH) * 30;

            const xLeft1 = 80 - w1 / 2;
            const xRight1 = 80 + w1 / 2;
            const xLeft2 = 80 - w2 / 2;
            const xRight2 = 80 + w2 / 2;

            const isEditing = activeSecId === s.id;

            return (
              <g 
                key={s.id} 
                onClick={() => handleEditSection(s)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={`M ${xLeft1} ${y1} L ${xLeft2} ${y2} L ${xRight2} ${y2} L ${xRight1} ${y1} Z`}
                  fill="url(#secGrad)"
                  stroke={isEditing ? '#00e676' : 'rgba(0, 0, 0, 0.4)'}
                  strokeWidth={isEditing ? 2 : 1}
                  style={{ transition: 'all 0.3s ease' }}
                />
                {/* Texto da Seção */}
                <text 
                  x="80" 
                  y={(y1 + y2) / 2 + 3} 
                  textAnchor="middle" 
                  fill="#ffffff" 
                  fontSize="8.5px" 
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                >
                  S{idx + 1} ({s.comprimento}m)
                </text>
              </g>
            );
          })}
        </svg>
      );
    }
  };

  // Desenho SVG do Perfil de Afilamento
  const renderTaperGraph = () => {
    if (!activeTree) return null;

    let coords: { h: number; d: number }[] = [];

    if (modo === 'relativo') {
      const hTotal = activeTree.alturaTotal || 10;
      PONTOS_RELATIVOS.forEach((p, idx) => {
        const val = parseFloat(activeTree.dadosRelativos[p] || '0');
        if (val > 0) {
          const pct = idx * 10; // 0%, 10%, etc.
          coords.push({
            h: (pct / 100) * hTotal,
            d: val
          });
        }
      });
    } else {
      // Seccional
      let curH = 0;
      activeTree.secoes.forEach(s => {
        const comp = parseFloat(s.comprimento || '0');
        const dIni = parseFloat(s.dInicial || s.dMedio || '0');
        const dFin = parseFloat(s.dFinal || s.dMedio || '0');
        if (dIni > 0) {
          coords.push({ h: curH, d: dIni });
        }
        curH += comp;
        if (dFin > 0) {
          coords.push({ h: curH, d: dFin });
        }
      });
    }

    if (coords.length < 2) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
          Colete pelo menos 2 diâmetros para gerar a curva de afilamento real.
        </div>
      );
    }

    // Ordena por altura
    coords.sort((a, b) => a.h - b.h);

    const maxH = Math.max(...coords.map(c => c.h), 5);
    const maxD = Math.max(...coords.map(c => c.d), 10);

    const graphWidth = 260;
    const graphHeight = 350;
    const padding = 35;

    // Converte coordenadas reais para coordenadas SVG
    const getX = (d: number) => padding + (d / maxD) * (graphWidth - padding * 2);
    const getY = (h: number) => graphHeight - padding - (h / maxH) * (graphHeight - padding * 2);

    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${getX(c.d)} ${getY(c.h)}`).join(' ');

    return (
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: '13.5px', color: 'var(--primary-hover)', fontWeight: 'bold', marginBottom: '12px' }}>Curva de Afilamento (Altura x Diâmetro)</h3>
        <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ width: '100%', maxWidth: '320px', margin: '0 auto', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Grade de fundo */}
          {[0, 0.25, 0.5, 0.75, 1].map(r => {
            const hVal = r * maxH;
            const dVal = r * maxD;
            const y = getY(hVal);
            const x = getX(dVal);
            return (
              <g key={r}>
                {/* Linhas horizontais (Altura) */}
                <line x1={padding} y1={y} x2={graphWidth - padding} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
                <text x={padding - 8} y={y + 3} fill="rgba(255,255,255,0.3)" fontSize="8px" textAnchor="end">{hVal.toFixed(1)} m</text>
                
                {/* Linhas verticais (Diâmetro) */}
                <line x1={x} y1={padding} x2={x} y2={graphHeight - padding} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
                <text x={x} y={graphHeight - padding + 12} fill="rgba(255,255,255,0.3)" fontSize="8px" textAnchor="middle">{dVal.toFixed(0)} cm</text>
              </g>
            );
          })}

          {/* Eixos */}
          <line x1={padding} y1={padding} x2={padding} y2={graphHeight - padding} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1={padding} y1={graphHeight - padding} x2={graphWidth - padding} y2={graphHeight - padding} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

          {/* Linha de Afilamento Real */}
          <path d={linePath} fill="none" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(0,230,118,0.4))' }} />

          {/* Pontos plotados */}
          {coords.map((c, i) => (
            <circle key={i} cx={getX(c.d)} cy={getY(c.h)} r="4" fill="#00b0ff" stroke="#ffffff" strokeWidth="1" />
          ))}
        </svg>
      </div>
    );
  };

  // Cálculo de Progresso
  const totalMedicoes = modo === 'relativo' ? PONTOS_RELATIVOS.length : (activeTree?.secoes.length || 0);
  const concluidasMedicoes = modo === 'relativo' 
    ? PONTOS_RELATIVOS.filter(p => parseFloat(activeTree?.dadosRelativos[p] || '0') > 0).length
    : (activeTree?.secoes.length || 0); // seccional conclui por item inserido completo

  const pctProgresso = totalMedicoes > 0 ? (concluidasMedicoes / totalMedicoes) * 100 : 0;

  return (
    <div className="container" style={{ marginTop: '10px', maxWidth: '850px', padding: '10px' }}>
      
      {/* Header */}
      <div className="app-header" style={{ marginBottom: '12px', flexWrap: 'nowrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.nome}</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Módulo de Cubagem Florestal • LeafTag</span>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ width: 'auto', padding: '8px 16px', height: '36px' }}
          onClick={() => navigate(`/fieldwork/${session.fieldWorkId}`)}
        >
          Sair
        </button>
      </div>

      {/* Seletor de Árvore */}
      <div className="glass-card" style={{ padding: '16px', marginBottom: '12px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>Árvore:</span>
            <select
              className="input-field"
              style={{ width: 'auto', marginBottom: 0, padding: '6px 28px 6px 12px', fontSize: '14px', height: '36px',
                appearance: 'none',
                background: 'rgba(255,255,255,0.05) url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e") no-repeat right 8px center',
                backgroundSize: '12px',
                borderColor: 'rgba(255,255,255,0.1)'
              }}
              value={activeTreeId}
              onChange={e => setActiveTreeId(e.target.value)}
            >
              {trees.map(t => (
                <option key={t.id} value={t.id} style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}>
                  #{t.numeroIndividuo} - {t.especie || 'Sem Espécie'}
                </option>
              ))}
            </select>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: 'auto', padding: '6px 14px', fontSize: '10.5px', height: '36px' }}
            onClick={() => setShowTreeModal(true)}
          >
            + Nova Árvore
          </button>
        </div>
      </div>

      {activeTree ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Metadata Card (Espécie, Altura, Modo) */}
          <div className="glass-card" style={{ padding: '16px', borderRadius: '16px', marginBottom: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div>
                <label className="input-label">Espécie</label>
                <input 
                  className="input-field" 
                  style={{ marginBottom: 0, padding: '8px 12px', height: '38px', fontSize: '13.5px' }}
                  value={especie} 
                  onChange={e => {
                    setEspecie(e.target.value);
                    handleUpdateTreeMeta('especie', e.target.value);
                  }}
                  placeholder="Ex: E. grandis" 
                />
              </div>

              <div>
                <label className="input-label">Altura Total (m)</label>
                <div 
                  onClick={() => setActiveField({ type: 'height' })}
                  style={{
                    height: '38px',
                    borderRadius: '12px',
                    background: activeField?.type === 'height' ? 'rgba(46, 125, 50, 0.05)' : 'rgba(0,0,0,0.25)',
                    border: activeField?.type === 'height' ? '1px solid var(--primary-hover)' : '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    color: alturaTotal ? 'var(--primary-hover)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  {alturaTotal || 'Digite...'}
                </div>
              </div>

              <div>
                <label className="input-label">Modo / Método</label>
                <div style={{
                  height: '38px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontSize: '12px',
                  color: '#fff',
                  textTransform: 'capitalize',
                  fontWeight: 'bold'
                }}>
                  {modo === 'relativo' ? 'Relativo' : 'Seccional'} • {metodoCalculo}
                </div>
              </div>
            </div>
          </div>

          {/* Progresso Elegante */}
          <div className="glass-card" style={{ padding: '12px 16px', borderRadius: '16px', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Progresso Coleta
              </span>
              <span style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold' }}>
                {modo === 'relativo' 
                  ? `${concluidasMedicoes} de 11 pontos medidos`
                  : `${activeTree.secoes.length} seções empilhadas`
                }
              </span>
            </div>
            <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${modo === 'relativo' ? pctProgresso : 100}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, var(--primary-color) 0%, var(--primary-hover) 100%)',
                  boxShadow: '0 0 10px rgba(0, 230, 118, 0.4)',
                  transition: 'width 0.3s ease' 
                }} 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>Volume Estimado: <strong style={{ color: '#00e676' }}>{activeTree.volumeTotal.toFixed(4)} m³</strong></span>
              <span>Status: <strong style={{ color: activeTree.status === 'Concluído' ? '#00e676' : '#ff9800' }}>{activeTree.status}</strong></span>
            </div>
          </div>

          {/* Layout Principal Central */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            
            {/* Visual Tronco / Afilamento (Esquerda) */}
            <div className="glass-card" style={{ padding: '16px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
              {/* Tab Selector Visual */}
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '10px', width: '100%', maxWidth: '240px' }}>
                <button 
                  onClick={() => setTab('coleta')}
                  style={{ flex: 1, height: '28px', borderRadius: '8px', fontSize: '10.5px', fontWeight: 'bold', cursor: 'pointer', background: tab === 'coleta' ? 'var(--card-bg)' : 'transparent', color: '#fff', border: tab === 'coleta' ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                >
                  Tronco
                </button>
                <button 
                  onClick={() => setTab('afilamento')}
                  style={{ flex: 1, height: '28px', borderRadius: '8px', fontSize: '10.5px', fontWeight: 'bold', cursor: 'pointer', background: tab === 'afilamento' ? 'var(--card-bg)' : 'transparent', color: '#fff', border: tab === 'afilamento' ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                >
                  Afilamento
                </button>
              </div>

              {tab === 'coleta' ? (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {renderTrunkSvg()}
                </div>
              ) : (
                <div style={{ width: '100%' }}>
                  {renderTaperGraph()}
                </div>
              )}
            </div>

            {/* Inputs de Coleta & Keypad (Direita) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Coleta Relativa */}
              {modo === 'relativo' && (
                <div className="glass-card" style={{ padding: '16px', borderRadius: '20px', marginBottom: 0 }}>
                  <h3 style={{ fontSize: '13px', color: 'var(--primary-hover)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Medição por Ponto</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {PONTOS_RELATIVOS.map(p => {
                      const isSelected = selectedPonto === p;
                      const hasVal = parseFloat(activeTree.dadosRelativos[p] || '0') > 0;
                      return (
                        <button
                          key={p}
                          onClick={() => {
                            setSelectedPonto(p);
                            setActiveField({ type: 'relative', point: p });
                          }}
                          style={{
                            padding: '8px 10px', borderRadius: '10px', border: isSelected ? '1.5px solid #00e676' : '1px solid rgba(255,255,255,0.05)',
                            background: isSelected ? 'rgba(0,230,118,0.1)' : hasVal ? 'rgba(0, 230, 118, 0.03)' : 'rgba(255,255,255,0.01)',
                            color: isSelected ? '#ffffff' : hasVal ? '#00e676' : 'rgba(255,255,255,0.3)',
                            fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', flex: '1 1 50px'
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  {/* Campo de Entrada de Diâmetro */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Diâmetro do ponto: {selectedPonto}</span>
                    <div 
                      onClick={() => setActiveField({ type: 'relative', point: selectedPonto })}
                      style={{
                        fontSize: '28px', fontWeight: 'bold', color: activeTree.dadosRelativos[selectedPonto] ? 'var(--primary-hover)' : 'var(--text-muted)',
                        textAlign: 'center', padding: '8px 0', cursor: 'pointer', borderBottom: '2px solid rgba(255,255,255,0.1)', minHeight: '48px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {activeTree.dadosRelativos[selectedPonto] ? `${activeTree.dadosRelativos[selectedPonto].replace('.', ',')} cm` : 'Toque para digitar'}
                      {activeField?.type === 'relative' && activeField.point === selectedPonto && (
                        <span className="blinking-cursor" style={{ height: '24px', width: '2px', background: 'var(--primary-hover)', marginLeft: '6px' }} />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Coleta Seccional */}
              {modo === 'seccional' && (
                <div className="glass-card" style={{ padding: '16px', borderRadius: '20px', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '13.5px', color: 'var(--primary-hover)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                      {activeSecId ? 'Editar Seção' : 'Adicionar Seção'}
                    </h3>
                    
                    {/* Método de Cubagem */}
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 'bold',
                      color: 'var(--primary-hover)',
                      textTransform: 'capitalize',
                      background: 'rgba(0, 230, 118, 0.08)',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0, 230, 118, 0.15)'
                    }}>
                      {metodoCalculo}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {/* Comprimento */}
                    <div 
                      onClick={() => setActiveField({ type: 'sectional', field: 'comprimento' })}
                      style={{
                        padding: '8px 10px', borderRadius: '10px', cursor: 'pointer',
                        background: activeField?.field === 'comprimento' ? 'rgba(46, 125, 50, 0.05)' : 'rgba(0,0,0,0.2)',
                        border: activeField?.field === 'comprimento' ? '1px solid var(--primary-hover)' : '1px solid rgba(255,255,255,0.05)'
                      }}
                    >
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Comprimento (m)</span>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px', minHeight: '22px' }}>
                        {secComprimento || <span style={{ color: 'rgba(255,255,255,0.15)' }}>Ex: 2.0</span>}
                      </div>
                    </div>

                    {/* D.Inicial (Opcional por Huber) */}
                    {(metodoCalculo === 'smalian' || metodoCalculo === 'newton') && (
                      <div 
                        onClick={() => setActiveField({ type: 'sectional', field: 'dInicial' })}
                        style={{
                          padding: '8px 10px', borderRadius: '10px', cursor: 'pointer',
                          background: activeField?.field === 'dInicial' ? 'rgba(46, 125, 50, 0.05)' : 'rgba(0,0,0,0.2)',
                          border: activeField?.field === 'dInicial' ? '1px solid var(--primary-hover)' : '1px solid rgba(255,255,255,0.05)'
                        }}
                      >
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>D. Inicial (cm)</span>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px', minHeight: '22px' }}>
                          {secDInicial || <span style={{ color: 'rgba(255,255,255,0.15)' }}>Ex: 30.0</span>}
                        </div>
                      </div>
                    )}

                    {/* D.Medio (Para Huber e Newton) */}
                    {(metodoCalculo === 'huber' || metodoCalculo === 'newton') && (
                      <div 
                        onClick={() => setActiveField({ type: 'sectional', field: 'dMedio' })}
                        style={{
                          padding: '8px 10px', borderRadius: '10px', cursor: 'pointer',
                          background: activeField?.field === 'dMedio' ? 'rgba(46, 125, 50, 0.05)' : 'rgba(0,0,0,0.2)',
                          border: activeField?.field === 'dMedio' ? '1px solid var(--primary-hover)' : '1px solid rgba(255,255,255,0.05)'
                        }}
                      >
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>D. Médio (cm)</span>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px', minHeight: '22px' }}>
                          {secDMedio || <span style={{ color: 'rgba(255,255,255,0.15)' }}>Ex: 28.0</span>}
                        </div>
                      </div>
                    )}

                    {/* D.Final (Opcional por Huber) */}
                    {(metodoCalculo === 'smalian' || metodoCalculo === 'newton') && (
                      <div 
                        onClick={() => setActiveField({ type: 'sectional', field: 'dFinal' })}
                        style={{
                          padding: '8px 10px', borderRadius: '10px', cursor: 'pointer',
                          background: activeField?.field === 'dFinal' ? 'rgba(46, 125, 50, 0.05)' : 'rgba(0,0,0,0.2)',
                          border: activeField?.field === 'dFinal' ? '1px solid var(--primary-hover)' : '1px solid rgba(255,255,255,0.05)'
                        }}
                      >
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>D. Final (cm)</span>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px', minHeight: '22px' }}>
                          {secDFinal || <span style={{ color: 'rgba(255,255,255,0.15)' }}>Ex: 26.0</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    {activeSecId && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ flex: 1, padding: '10px', height: '36px' }}
                        onClick={() => {
                          setSecComprimento('');
                          setSecDInicial('');
                          setSecDMedio('');
                          setSecDFinal('');
                          setActiveSecId(null);
                          setActiveField(null);
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 2, padding: '10px', height: '36px' }}
                      onClick={handleSaveSection}
                    >
                      {activeSecId ? 'Atualizar Seção' : '+ Salvar Seção'}
                    </button>
                  </div>
                </div>
              )}

              {/* Teclado Numérico Integrado */}
              {activeField && (
                <div className="glass-card" style={{ padding: '8px', borderRadius: '20px', marginBottom: 0, border: '1px solid rgba(0, 230, 118, 0.15)' }}>
                  <NumericKeyboardModal
                    value={getKeyboardValue()}
                    onChange={handleKeyboardChange}
                    onConfirm={handleKeyboardConfirm}
                    onClose={() => setActiveField(null)}
                  />
                </div>
              )}

              {/* Tabela de Medições da Árvore */}
              <div className="glass-card" style={{ padding: '16px', borderRadius: '20px', flex: 1, minHeight: '160px', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '13px', color: 'var(--primary-hover)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                  {modo === 'relativo' ? 'Pontos Coletados' : 'Tabela de Seções'}
                </h3>
                
                {modo === 'relativo' ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Ponto</th>
                        <th>Diâmetro</th>
                        <th>Altura (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PONTOS_RELATIVOS.map((p, idx) => {
                        const val = activeTree.dadosRelativos[p];
                        const alt = activeTree.alturaTotal ? ((idx * 10 / 100) * activeTree.alturaTotal).toFixed(2) : '-';
                        return (
                          <tr key={p} style={{ cursor: 'pointer', background: selectedPonto === p ? 'rgba(255,255,255,0.02)' : 'transparent' }} onClick={() => setSelectedPonto(p)}>
                            <td>{p}</td>
                            <td style={{ color: val ? '#00e676' : 'rgba(255,255,255,0.15)', fontWeight: 'bold' }}>{val ? `${val} cm` : 'Pendente'}</td>
                            <td>{alt}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div>
                    {activeTree.secoes.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                        Nenhuma seção adicionada ainda.
                      </p>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th>Seção</th>
                            <th>Compr.</th>
                            <th>Medições</th>
                            <th>Vol. (m³)</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTree.secoes.map((sec, idx) => {
                            const showD = metodoCalculo === 'huber' 
                              ? `D.M: ${sec.dMedio}`
                              : `D.I: ${sec.dInicial} -> D.F: ${sec.dFinal}`;
                            return (
                              <tr key={sec.id} style={{ background: activeSecId === sec.id ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                <td>S{idx + 1}</td>
                                <td>{sec.comprimento} m</td>
                                <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{showD}</td>
                                <td style={{ color: '#00e676', fontWeight: 'bold' }}>{sec.volume.toFixed(4)}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ width: 'auto', padding: '4px 8px', fontSize: '9px', height: '24px' }}
                                      onClick={() => handleEditSection(sec)}
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      className="btn btn-danger" 
                                      style={{ width: 'auto', padding: '4px 8px', fontSize: '9px', height: '24px' }}
                                      onClick={() => handleDeleteSection(sec.id)}
                                    >
                                      Excl
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Botão de Finalização da Árvore */}
            <div style={{ marginTop: '12px' }}>
              <button 
                className="btn btn-primary" 
                style={{ 
                  width: '100%', 
                  padding: '14px', 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #2e7d32 0%, #00e676 100%)',
                  borderColor: 'transparent',
                  borderRadius: '16px',
                  color: '#fff',
                  boxShadow: '0 4px 15px rgba(0, 230, 118, 0.2)',
                  cursor: 'pointer'
                }}
                onClick={handleConcluirCubagem}
              >
                Concluir Cubagem
              </button>
            </div>

          </div>

        </div>
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>Nenhuma árvore na sessão</h3>
          <p style={{ color: '#666', marginTop: '8px', marginBottom: '24px' }}>Crie sua primeira árvore de teste para iniciar.</p>
          <button className="btn btn-primary" style={{ maxWidth: '200px', margin: '0 auto' }} onClick={() => setShowTreeModal(true)}>
            + Criar Primeira Árvore
          </button>
        </div>
      )}

      {/* Modal Criar Árvore */}
      {showTreeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '380px', marginBottom: 0 }}>
            <h3 style={{ color: 'var(--primary-hover)', fontSize: '18px', fontWeight: '800' }}>Cubar Nova Árvore</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Inicie as medições em uma nova árvore no talhão.</p>
            
            <label className="input-label" style={{ marginTop: '16px' }}>Espécie / Nome Comercial</label>
            <input 
              className="input-field" 
              value={newTreeEspecie} 
              onChange={e => setNewTreeEspecie(e.target.value)} 
              placeholder="Ex: Eucalyptus grandis, Pinus elliottii" 
            />

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowTreeModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreateTree}>Iniciar Coleta</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resumo de Cubagem */}
      {showSummaryId && (() => {
        const sumTree = trees.find(t => t.id === showSummaryId);
        if (!sumTree) return null;
        return (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            zIndex: 1000, padding: '20px', backdropFilter: 'blur(8px)' 
          }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '440px', marginBottom: 0, padding: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800' }}>
                  Resumo da Cubagem
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Árvore finalizada e calculada com sucesso
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Árvore</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>#{sumTree.numeroIndividuo}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Método</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', textTransform: 'capitalize' }}>{sumTree.metodoCalculo}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', gridColumn: 'span 2', textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Volume Total</span>
                  <span style={{ fontSize: '26px', fontWeight: '800', color: '#00e676' }}>{sumTree.volumeTotal.toFixed(3).replace('.', ',')} m³</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Número de Seções</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{sumTree.volumePorSecao?.length || 0}</span>
                </div>
              </div>

              <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase' }}>Seção</th>
                      <th style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', textTransform: 'uppercase' }}>Volume (m³)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sumTree.volumePorSecao?.map(sec => (
                      <tr key={sec.secao} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Seção {sec.secao}</td>
                        <td style={{ padding: '8px 12px', fontSize: '12px', color: '#00e676', textAlign: 'right', fontWeight: 'bold' }}>
                          {sec.volume.toFixed(4).replace('.', ',')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', borderRadius: '12px', fontWeight: 'bold' }}
                onClick={() => setShowSummaryId(null)}
              >
                Salvar e Voltar
              </button>
            </div>
          </div>
        );
      })()}

      {/* Estilos locais de animação */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.3; }
          100% { transform: scale(1); opacity: 0.8; }
        }
        .pulse-animation {
          animation: pulse 2s infinite ease-in-out;
          transform-origin: center;
        }
      `}</style>
    </div>
  );
};
