import { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import type { SortimentRule, SortimentResult, SortimentToraResult } from '../types';
import { simulateBucking, getTreeCoordinates } from '../utils/sortimentoEngine';
import * as XLSX from 'xlsx';

interface SortimentoTabProps {
  activeFw: any;
  inventories: any[];
  activeTalhoes: any[];
}

export const SortimentoTab = ({ activeFw, inventories, activeTalhoes }: SortimentoTabProps) => {
  const {
    sortimentRules,
    sortimentResults,
    saveSortimentRule,
    deleteSortimentRule,
    saveSortimentResult,
    deleteSortimentResult
  } = useInventory();

  // Abas internas: 'regras' | 'simular' | 'resultados' | 'resumo'
  const [subTab, setSubTab] = useState<'regras' | 'simular' | 'resultados' | 'resumo'>('regras');

  // Aba 1: Estados para criação/edição de regras
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<SortimentRule | null>(null);
  const [ruleNome, setRuleNome] = useState('');
  const [ruleDescricao, setRuleDescricao] = useState('');
  const [ruleComprimento, setRuleComprimento] = useState('');
  const [ruleDiamMin, setRuleDiamMin] = useState('');
  const [ruleDiamMax, setRuleDiamMax] = useState('');
  const [rulePreco, setRulePreco] = useState('');
  const [ruleCor, setRuleCor] = useState('#29b6f6');
  const [ruleAtivo, setRuleAtivo] = useState(true);

  // Aba 2: Estados para simulação
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  const [selectedTreeId, setSelectedTreeId] = useState<string>('');
  const [useSemCasca, setUseSemCasca] = useState(false);
  const [selectedTora, setSelectedTora] = useState<SortimentToraResult | null>(null);

  // Aba 3: Modal de visualização de resultados salvos
  const [viewingResult, setViewingResult] = useState<SortimentResult | null>(null);

  // Filtragem de sessões de cubagem e árvores
  const activeCubageSessions = useMemo(() => {
    if (!activeFw) return [];
    return inventories.filter(i => i.fieldWorkId === activeFw.id && i.template === 'cubagem');
  }, [inventories, activeFw]);

  const selectedSession = useMemo(() => {
    return activeCubageSessions.find(s => s.id === Number(selectedSessionId));
  }, [activeCubageSessions, selectedSessionId]);

  const activeTrees = useMemo(() => {
    if (!selectedSession) return [];
    return selectedSession.dados || [];
  }, [selectedSession]);

  const selectedTree = useMemo(() => {
    return activeTrees.find((t: any) => t.id === selectedTreeId);
  }, [activeTrees, selectedTreeId]);

  // Simulação reativa em tempo real (em memória para preview)
  const simulationPreview = useMemo(() => {
    if (!selectedTree || sortimentRules.length === 0) return null;
    const activeRules = sortimentRules.filter(r => r.ativo);
    if (activeRules.length === 0) return null;

    const hasSemCasca = selectedTree.volumeTotalSemCasca > 0 || 
                       (selectedTree.secoes && selectedTree.secoes.some((s: any) => parseFloat(s.eInicial || s.eMedio || s.eFinal) > 0)) ||
                       (selectedTree.cascaRelativos && Object.keys(selectedTree.cascaRelativos).length > 0);

    const actualUseSemCasca = useSemCasca && hasSemCasca;

    return simulateBucking(selectedTree, sortimentRules, actualUseSemCasca);
  }, [selectedTree, sortimentRules, useSemCasca]);

  // Resultados atrelados ao trabalho de campo ativo
  const activeResults = useMemo(() => {
    if (!activeFw) return [];
    return sortimentResults.filter(r => r.fieldWorkId === activeFw.id);
  }, [sortimentResults, activeFw]);

  // --- CRUD DE REGRAS ---
  const handleOpenNewRule = () => {
    setEditingRule(null);
    setRuleNome('');
    setRuleDescricao('');
    setRuleComprimento('');
    setRuleDiamMin('');
    setRuleDiamMax('');
    setRulePreco('');
    setRuleCor('#29b6f6');
    setRuleAtivo(true);
    setShowRuleModal(true);
  };

  const handleOpenEditRule = (rule: SortimentRule) => {
    setEditingRule(rule);
    setRuleNome(rule.nome);
    setRuleDescricao(rule.descricao || '');
    setRuleComprimento(rule.comprimentoToraM.toString());
    setRuleDiamMin(rule.diametroMinimoPontaFinaCm.toString());
    setRuleDiamMax(rule.diametroMaximoPontaFinaCm ? rule.diametroMaximoPontaFinaCm.toString() : '');
    setRulePreco(rule.precoPorM3 ? rule.precoPorM3.toString() : '');
    setRuleCor(rule.cor);
    setRuleAtivo(rule.ativo);
    setShowRuleModal(true);
  };

  const handleSaveRule = async () => {
    if (!ruleNome.trim()) return alert('Informe o nome do produto.');
    const comp = parseFloat(ruleComprimento);
    const dMin = parseFloat(ruleDiamMin);
    if (isNaN(comp) || comp <= 0) return alert('Comprimento da tora inválido.');
    if (isNaN(dMin) || dMin <= 0) return alert('Diâmetro mínimo inválido.');

    const dMax = ruleDiamMax.trim() ? parseFloat(ruleDiamMax) : undefined;
    const preco = rulePreco.trim() ? parseFloat(rulePreco) : undefined;

    const newRule: SortimentRule = {
      id: editingRule ? editingRule.id : `rule_${Date.now()}`,
      nome: ruleNome,
      descricao: ruleDescricao,
      comprimentoToraM: comp,
      diametroMinimoPontaFinaCm: dMin,
      diametroMaximoPontaFinaCm: dMax,
      prioridade: editingRule ? editingRule.prioridade : sortimentRules.length + 1,
      precoPorM3: preco,
      cor: ruleCor,
      ativo: ruleAtivo,
      createdAt: editingRule ? editingRule.createdAt : new Date().toISOString()
    };

    try {
      await saveSortimentRule(newRule);
      setShowRuleModal(false);
    } catch (e: any) {
      alert('Erro ao salvar regra: ' + e.message);
    }
  };

  const handleDuplicateRule = async (rule: SortimentRule) => {
    const newRule: SortimentRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      nome: `${rule.nome} (Cópia)`,
      prioridade: sortimentRules.length + 1,
      createdAt: new Date().toISOString()
    };
    try {
      await saveSortimentRule(newRule);
    } catch (e: any) {
      alert('Erro ao duplicar: ' + e.message);
    }
  };

  const handleMoveRule = async (rule: SortimentRule, direction: 'up' | 'down') => {
    const sorted = [...sortimentRules].sort((a, b) => a.prioridade - b.prioridade);
    const index = sorted.findIndex(r => r.id === rule.id);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const other = sorted[index - 1];
      const temp = rule.prioridade;
      rule.prioridade = other.prioridade;
      other.prioridade = temp;
      await saveSortimentRule(rule);
      await saveSortimentRule(other);
    } else if (direction === 'down' && index < sorted.length - 1) {
      const other = sorted[index + 1];
      const temp = rule.prioridade;
      rule.prioridade = other.prioridade;
      other.prioridade = temp;
      await saveSortimentRule(rule);
      await saveSortimentRule(other);
    }
  };

  // --- AÇÕES DE RESULTADOS ---
  const handleSaveSimulation = async () => {
    if (!simulationPreview) return;
    try {
      const payload: SortimentResult = {
        ...simulationPreview,
        fieldWorkId: activeFw.id,
        inventoryId: selectedSession ? selectedSession.id : 0
      };
      await saveSortimentResult(payload);
      alert('Resultado do sortimento persistido com sucesso!');
      setSubTab('resultados');
    } catch (e: any) {
      alert('Erro ao salvar simulação: ' + e.message);
    }
  };

  // --- CONSOLIDAÇÕES POR ESTRUTURA ---
  const talhoesSummary = useMemo(() => {
    if (activeResults.length === 0) return [];

    return activeTalhoes.map(t => {
      // Acha as sessões de cubagem que pertencem a esse talhão
      const tSessions = inventories.filter(i => i.talhaoId === t.id && i.template === 'cubagem');
      const tSessionIds = tSessions.map(s => s.id);
      
      // Filtra os resultados de sortimento dessas sessões
      const tResults = activeResults.filter(r => tSessionIds.includes(r.inventoryId));
      if (tResults.length === 0) return null;

      const totalVol = tResults.reduce((acc, curr) => acc + curr.volumeTotalArvore, 0);
      const totalSortido = tResults.reduce((acc, curr) => acc + curr.volumeSortidoTotal, 0);
      const totalResiduo = tResults.reduce((acc, curr) => acc + curr.volumeResiduo, 0);
      const totalValor = tResults.reduce((acc, curr) => acc + curr.valorTotalEstimado, 0);
      const avgRendimento = totalVol > 0 ? (totalSortido / totalVol) * 100 : 0;

      // Consolidar volumes por produto para este talhão
      const produtosVol: Record<string, number> = {};
      tResults.forEach(r => {
        r.resumoPorProduto.forEach(p => {
          produtosVol[p.produtoNome] = (produtosVol[p.produtoNome] || 0) + p.volumeM3;
        });
      });

      return {
        talhaoNome: t.nome,
        arvoresSimuladas: tResults.length,
        volumeTotal: totalVol,
        volumeSortido: totalSortido,
        volumeResiduo: totalResiduo,
        valorTotal: totalValor,
        rendimento: avgRendimento,
        produtosVol
      };
    }).filter(item => item !== null);
  }, [activeResults, activeTalhoes, inventories]);

  const trabalhoConsolidado = useMemo(() => {
    if (activeResults.length === 0) return null;

    const totalVol = activeResults.reduce((acc, curr) => acc + curr.volumeTotalArvore, 0);
    const totalSortido = activeResults.reduce((acc, curr) => acc + curr.volumeSortidoTotal, 0);
    const totalResiduo = activeResults.reduce((acc, curr) => acc + curr.volumeResiduo, 0);
    const totalValor = activeResults.reduce((acc, curr) => acc + curr.valorTotalEstimado, 0);
    const avgRendimento = totalVol > 0 ? (totalSortido / totalVol) * 100 : 0;

    const resumoProdutos: Record<string, { quantidadeToras: number; volumeM3: number; valorEstimado: number }> = {};
    activeResults.forEach(r => {
      r.resumoPorProduto.forEach(p => {
        if (!resumoProdutos[p.produtoNome]) {
          resumoProdutos[p.produtoNome] = { quantidadeToras: 0, volumeM3: 0, valorEstimado: 0 };
        }
        resumoProdutos[p.produtoNome].quantidadeToras += p.quantidadeToras;
        resumoProdutos[p.produtoNome].volumeM3 += p.volumeM3;
        resumoProdutos[p.produtoNome].valorEstimado += p.valorEstimado;
      });
    });

    return {
      arvoresSimuladas: activeResults.length,
      volumeTotal: totalVol,
      volumeSortido: totalSortido,
      volumeResiduo: totalResiduo,
      valorTotal: totalValor,
      rendimento: avgRendimento,
      produtos: Object.keys(resumoProdutos).map(name => ({
        produtoNome: name,
        quantidadeToras: resumoProdutos[name].quantidadeToras,
        volumeM3: resumoProdutos[name].volumeM3,
        valorEstimado: resumoProdutos[name].valorEstimado
      }))
    };
  }, [activeResults]);

  // --- EXPORTAÇÃO EXCEL XLSX ---
  const handleExportSortimentoXLSX = () => {
    if (activeResults.length === 0) {
      alert('Não existem resultados de sortimento salvos para exportar.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Resumo Geral
    const resumoGeralData = [
      { Métrica: "Trabalho de Campo", Valor: activeFw?.nome || "" },
      { Métrica: "Data da Exportação", Valor: new Date().toLocaleDateString('pt-BR') },
      { Métrica: "Total de Árvores Simuladas", Valor: trabalhoConsolidado?.arvoresSimuladas || 0 },
      { Métrica: "Volume Total Cubado (m³)", Valor: trabalhoConsolidado?.volumeTotal || 0 },
      { Métrica: "Volume Comercial Sortido (m³)", Valor: trabalhoConsolidado?.volumeSortido || 0 },
      { Métrica: "Volume Residual/Resíduo (m³)", Valor: trabalhoConsolidado?.volumeResiduo || 0 },
      { Métrica: "Rendimento Médio (%)", Valor: trabalhoConsolidado?.rendimento || 0 },
      { Métrica: "Valor Financeiro Total Estimado (R$)", Valor: trabalhoConsolidado?.valorTotal || 0 }
    ];
    const wsResumoGeral = XLSX.utils.json_to_sheet(resumoGeralData);

    // 2. Resumo por Produto
    const resumoProdutosData = (trabalhoConsolidado?.produtos || []).map(p => ({
      "Produto": p.produtoNome,
      "Qtd Toras": p.quantidadeToras,
      "Volume m³": p.volumeM3,
      "Preço Médio (R$/m³)": p.volumeM3 > 0 ? Number((p.valorEstimado / p.volumeM3).toFixed(2)) : 0,
      "Valor Estimado (R$)": p.valorEstimado
    }));
    const wsResumoProdutos = XLSX.utils.json_to_sheet(resumoProdutosData);

    // 3. Toras Detalhadas
    const torasDetalhadasData: any[] = [];
    activeResults.forEach(r => {
      r.toras.forEach(t => {
        torasDetalhadasData.push({
          "Árvore #": r.treeNumber,
          "Espécie": r.especie,
          "Tora Ordem": t.ordem,
          "Produto": t.produtoNome,
          "H Inicial (m)": t.alturaInicialM,
          "H Final (m)": t.alturaFinalM,
          "Comprimento (m)": t.comprimentoM,
          "D Inicial (cm)": t.diametroInicialCm,
          "D Final (cm)": t.diametroFinalCm,
          "Volume (m³)": t.volumeM3,
          "Valor Estimado (R$)": t.valorEstimado
        });
      });
    });
    const wsTorasDetalhadas = XLSX.utils.json_to_sheet(torasDetalhadasData);

    // 4. Árvores Cubadas
    const arvoresData = activeResults.map(r => ({
      "Árvore #": r.treeNumber,
      "Espécie": r.especie,
      "Modo Coleta": r.useSemCasca ? "Sem Casca" : "Com Casca",
      "Volume Total (m³)": r.volumeTotalArvore,
      "Volume Sortido (m³)": r.volumeSortidoTotal,
      "Volume Resíduo (m³)": r.volumeResiduo,
      "Aproveitamento (%)": r.volumeTotalArvore > 0 ? Number(((r.volumeSortidoTotal / r.volumeTotalArvore) * 100).toFixed(1)) : 0,
      "Valor Estimado (R$)": r.valorTotalEstimado,
      "Data Simulação": r.dataProcessamento
    }));
    const wsArvores = XLSX.utils.json_to_sheet(arvoresData);

    // 5. Regras Utilizadas
    const regrasData = sortimentRules.map(r => ({
      "Prioridade": r.prioridade,
      "Nome Produto": r.nome,
      "Comprimento (m)": r.comprimentoToraM,
      "D Mínimo Ponta Fina (cm)": r.diametroMinimoPontaFinaCm,
      "D Máximo Ponta Fina (cm)": r.diametroMaximoPontaFinaCm || "Sem limite",
      "Preço m³ (R$)": r.precoPorM3 || 0,
      "Status": r.ativo ? "Ativo" : "Inativo"
    }));
    const wsRegras = XLSX.utils.json_to_sheet(regrasData);

    XLSX.utils.book_append_sheet(wb, wsResumoGeral, "Resumo Geral");
    XLSX.utils.book_append_sheet(wb, wsResumoProdutos, "Resumo por Produto");
    XLSX.utils.book_append_sheet(wb, wsTorasDetalhadas, "Toras Detalhadas");
    XLSX.utils.book_append_sheet(wb, wsArvores, "Árvores Cubadas");
    XLSX.utils.book_append_sheet(wb, wsRegras, "Regras Utilizadas");

    XLSX.writeFile(wb, `Sortimento_${activeFw?.nome.replace(/\s+/g, '_')}.xlsx`);
  };

  // --- RENDERIZADORES DE AUXÍLIOS GRÁFICOS ---
  const renderTrunkVisualizer = (res: SortimentResult) => {
    if (!res || !res.volumeTotalArvore) return null;

    const totalH = res.volumeTotalArvore > 0 ? res.toras.reduce((acc, curr) => acc + curr.comprimentoM, 0) + (res.volumeResiduo > 0 ? (res.volumeTotalArvore - res.volumeSortidoTotal) : 0) : 10;
    const displayHeight = 300;

    return (
      <div style={{ padding: '20px', background: 'rgba(0,0,0,0.15)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h4 style={{ fontSize: '12.5px', textTransform: 'uppercase', color: 'var(--primary-hover)', fontWeight: 'bold', marginBottom: '16px' }}>Esquema do Tronco Sortido</h4>
        <div style={{ position: 'relative', width: '90px', height: `${displayHeight}px`, display: 'flex', flexDirection: 'column-reverse', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          
          {/* Toras empilhadas */}
          {res.toras.map(tora => {
            const hPct = (tora.comprimentoM / (res.volumeTotalArvore / 0.1 /* dummy proportion fallback */ || totalH || 15)) * displayHeight * 0.7; 
            const isSelected = selectedTora && selectedTora.id === tora.id;
            return (
              <div
                key={tora.id}
                onClick={() => setSelectedTora(tora)}
                style={{
                  height: `${Math.max(hPct, 30)}px`,
                  background: tora.produtoNome === 'Resíduo' ? '#ef5350' : (sortimentRules.find(r => r.id === tora.ruleId)?.cor || '#a1887f'),
                  border: isSelected ? '2.5px solid #fff' : '1px solid rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 0 10px #fff' : 'none'
                }}
                title={`${tora.produtoNome} (Tora #${tora.ordem})`}
              >
                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#000', textTransform: 'uppercase', textShadow: '0 0 2px rgba(255,255,255,0.8)' }}>
                  {tora.produtoNome.substring(0, 10)}
                </span>
              </div>
            );
          })}

          {/* Trecho residual */}
          {res.volumeResiduo > 0 && (
            <div
              style={{
                flex: 1,
                background: 'rgba(239, 83, 80, 0.45)',
                border: '1px dashed #ef5350',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default'
              }}
              title="Resíduo Florestal"
            >
              <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#fff', textTransform: 'uppercase' }}>
                Resíduo
              </span>
            </div>
          )}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Clique nas toras para ver detalhes</span>
      </div>
    );
  };

  const renderAfilamentoWithCuts = (tree: any, res: SortimentResult) => {
    if (!tree) return null;
    const coords = getTreeCoordinates(tree, res.useSemCasca);
    if (coords.length < 2) return null;

    const maxH = Math.max(...coords.map(c => c.h), 5);
    const maxD = Math.max(...coords.map(c => c.d), 10);

    const graphWidth = 260;
    const graphHeight = 350;
    const padding = 35;

    const getX = (d: number) => padding + (d / maxD) * (graphWidth - padding * 2);
    const getY = (h: number) => graphHeight - padding - (h / maxH) * (graphHeight - padding * 2);

    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${getX(c.d)} ${getY(c.h)}`).join(' ');

    return (
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ fontSize: '12.5px', textTransform: 'uppercase', color: 'var(--primary-hover)', fontWeight: 'bold', marginBottom: '16px' }}>Cortes e Perfil de Afilamento</h4>
        <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} style={{ width: '100%', maxWidth: '300px', margin: '0 auto', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Grade de fundo */}
          {[0, 0.25, 0.5, 0.75, 1].map(r => {
            const hVal = r * maxH;
            const dVal = r * maxD;
            const y = getY(hVal);
            const x = getX(dVal);
            return (
              <g key={r}>
                <line x1={padding} y1={y} x2={graphWidth - padding} y2={y} stroke="rgba(255,255,255,0.03)" strokeDasharray="3" />
                <text x={padding - 6} y={y + 3} fill="rgba(255,255,255,0.2)" fontSize="7px" textAnchor="end">{hVal.toFixed(1)}m</text>
                <line x1={x} y1={padding} x2={x} y2={graphHeight - padding} stroke="rgba(255,255,255,0.03)" strokeDasharray="3" />
                <text x={x} y={graphHeight - padding + 10} fill="rgba(255,255,255,0.2)" fontSize="7px" textAnchor="middle">{dVal.toFixed(0)}cm</text>
              </g>
            );
          })}

          <line x1={padding} y1={padding} x2={padding} y2={graphHeight - padding} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1={padding} y1={graphHeight - padding} x2={graphWidth - padding} y2={graphHeight - padding} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

          {/* Curva de Afilamento */}
          <path d={linePath} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="2" />
          <path d={linePath} fill="none" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px rgba(0,230,118,0.3))' }} />

          {/* Marcadores de cortes das toras */}
          {res.toras.map(tora => {
            const yEnd = getY(tora.alturaFinalM);
            return (
              <g key={tora.id}>
                {/* Linha horizontal tracejada do corte */}
                <line x1={padding} y1={yEnd} x2={graphWidth - padding} y2={yEnd} stroke={sortimentRules.find(r => r.id === tora.ruleId)?.cor || '#ff9100'} strokeWidth="1.2" strokeDasharray="4 2" />
                <circle cx={getX(tora.diametroFinalCm)} cy={yEnd} r="3" fill="#ff1744" />
              </g>
            );
          })}

          {/* Pontos de cubagem real */}
          {coords.map((c, i) => (
            <circle key={i} cx={getX(c.d)} cy={getY(c.h)} r="3" fill="#00b0ff" />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Sub-abas de Sortimento */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px' }}>
        {[
          { id: 'regras', label: '1. Regras de Produto' },
          { id: 'simular', label: '2. Simular Árvore' },
          { id: 'resultados', label: '3. Resultados Salvos' },
          { id: 'resumo', label: '4. Resumo por Trabalho' }
        ].map(tb => (
          <button
            key={tb.id}
            onClick={() => setSubTab(tb.id as any)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: subTab === tb.id ? '2px solid var(--primary-color)' : '2px solid transparent',
              color: subTab === tb.id ? 'var(--primary-hover)' : 'var(--text-muted)',
              padding: '10px 16px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13.5px'
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* --- ABA 1: REGRAS DE PRODUTO --- */}
      {subTab === 'regras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Especificação de Regras de Sortimento</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                Defina o portfólio de produtos comerciais e suas prioridades de encaixe ao longo do fuste.
              </p>
            </div>
            <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={handleOpenNewRule}>
              + Nova Regra
            </button>
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', width: '70px', textAlign: 'center' }}>Ordem</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'left' }}>Produto</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Comp. Tora</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>D. Mínimo PF</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>D. Máximo PF</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Preço / m³</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', width: '80px' }}>Cor</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', width: '80px' }}>Ativo</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', width: '240px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortimentRules.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhuma regra de sortimento cadastrada. Clique em "+ Nova Regra" acima para iniciar.
                    </td>
                  </tr>
                ) : (
                  sortimentRules.map((rule, idx) => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: rule.ativo ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 'bold', color: rule.ativo ? 'var(--primary-hover)' : 'var(--text-muted)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 'bold', color: rule.ativo ? '#fff' : 'var(--text-muted)' }}>{rule.nome}</div>
                        {rule.descricao && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{rule.descricao}</div>}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center', color: rule.ativo ? '#fff' : 'var(--text-muted)' }}>{rule.comprimentoToraM} m</td>
                      <td style={{ padding: '14px 20px', textAlign: 'center', color: rule.ativo ? '#fff' : 'var(--text-muted)' }}>{rule.diametroMinimoPontaFinaCm} cm</td>
                      <td style={{ padding: '14px 20px', textAlign: 'center', color: rule.ativo ? '#fff' : 'var(--text-muted)' }}>
                        {rule.diametroMaximoPontaFinaCm ? `${rule.diametroMaximoPontaFinaCm} cm` : 'Ilimitado'}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 'bold', color: rule.ativo ? '#81c784' : 'var(--text-muted)' }}>
                        {rule.precoPorM3 ? `R$ ${rule.precoPorM3.toFixed(2)}` : 'R$ 0,00'}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: rule.cor, margin: '0 auto', border: '1px solid rgba(255,255,255,0.2)' }}></div>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={rule.ativo}
                          onChange={async () => {
                            const updated = { ...rule, ativo: !rule.ativo };
                            await saveSortimentRule(updated);
                          }}
                          style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 8px', height: '26px', fontSize: '10px' }} onClick={() => handleMoveRule(rule, 'up')} disabled={idx === 0}>
                            ▲
                          </button>
                          <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 8px', height: '26px', fontSize: '10px' }} onClick={() => handleMoveRule(rule, 'down')} disabled={idx === sortimentRules.length - 1}>
                            ▼
                          </button>
                          <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 10px', height: '26px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleOpenEditRule(rule)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Editar
                          </button>
                          <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 10px', height: '26px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleDuplicateRule(rule)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            Copiar
                          </button>
                          <button className="btn btn-danger" style={{ width: 'auto', padding: '6px 10px', height: '26px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={async () => {
                            if (confirm(`Deseja realmente deletar a regra "${rule.nome}"?`)) {
                              await deleteSortimentRule(rule.id);
                            }
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ABA 2: SIMULAR ÁRVORE --- */}
      {subTab === 'simular' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Seletor de Sessão e Árvore */}
          <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div>
              <label className="input-label">1. Sessão de Cubagem</label>
              <select
                className="input-field"
                style={{ marginBottom: 0 }}
                value={selectedSessionId}
                onChange={e => {
                  setSelectedSessionId(e.target.value ? Number(e.target.value) : '');
                  setSelectedTreeId('');
                }}
              >
                <option value="">Selecione...</option>
                {activeCubageSessions.map(s => (
                  <option key={s.id} value={s.id}>{s.nome} ({s.ultimaColeta})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label">2. Árvore Cubada</label>
              <select
                className="input-field"
                style={{ marginBottom: 0 }}
                value={selectedTreeId}
                disabled={!selectedSessionId}
                onChange={e => {
                  setSelectedTreeId(e.target.value);
                  setSelectedTora(null);
                }}
              >
                <option value="">Selecione...</option>
                {activeTrees.map((t: any) => (
                  <option key={t.id} value={t.id}>Árvore #{t.numeroIndividuo} ({t.especie || 'Sem espécie'})</option>
                ))}
              </select>
            </div>

            {selectedTree && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '42px', paddingBottom: '10px' }}>
                <input
                  type="checkbox"
                  id="chkSemCasca"
                  checked={useSemCasca}
                  onChange={e => {
                    setUseSemCasca(e.target.checked);
                    setSelectedTora(null);
                  }}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="chkSemCasca" style={{ fontSize: '13.5px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                  Simular Sem Casca
                </label>
              </div>
            )}
          </div>

          {/* Avisos Importantes de Casca */}
          {selectedTree && useSemCasca && !(
            selectedTree.volumeTotalSemCasca > 0 || 
            (selectedTree.secoes && selectedTree.secoes.some((s: any) => parseFloat(s.eInicial || s.eMedio || s.eFinal) > 0)) ||
            (selectedTree.cascaRelativos && Object.keys(selectedTree.cascaRelativos).length > 0)
          ) && (
            <div style={{ padding: '12px 16px', background: 'rgba(255, 152, 0, 0.15)', border: '1px solid #ff9800', borderRadius: '12px', color: '#ffb74d', fontSize: '13px', lineHeight: '1.4', display: 'flex', alignItems: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <span>Esta árvore não possui medições ou estimativas de casca no fuste. O sortimento será calculado utilizando diâmetros <strong>com casca</strong>.</span>
            </div>
          )}

          {/* SIMULATION PREVIEW & UI VISUALIZERS */}
          {selectedTree && simulationPreview ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '20px' }}>
              
              {/* Resultados da Simulação (Esquerda) */}
              <div style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* KPIs da Simulação */}
                <div className="glass-card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary-hover)', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Resumo Econômico da Simulação
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Valor Total Estimado</span>
                      <h4 style={{ fontSize: '20px', fontWeight: '800', color: '#81c784', marginTop: '4px' }}>R$ {simulationPreview.valorTotalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Aproveitamento Útil</span>
                      <h4 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary-hover)', marginTop: '4px' }}>
                        {((simulationPreview.volumeSortidoTotal / simulationPreview.volumeTotalArvore) * 100 || 0).toFixed(1)}%
                      </h4>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Vol. Comercializado</span>
                      <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>{simulationPreview.volumeSortidoTotal.toFixed(4)} m³</h4>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Vol. Resíduo</span>
                      <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#ef5350', marginTop: '4px' }}>{simulationPreview.volumeResiduo.toFixed(4)} m³</h4>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button className="btn btn-primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={handleSaveSimulation}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                      Persistir Sortimento
                    </button>
                  </div>
                </div>

                {/* Resumo por Produto */}
                <div className="glass-card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary-hover)', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
                    Volume por Produto
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.1)' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)' }}>Produto</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>Toras</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>Volume (m³)</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>Valor (R$)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simulationPreview.resumoPorProduto.map((prod, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{prod.produtoNome}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{prod.quantidadeToras}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{prod.volumeM3.toFixed(4)} m³</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', color: '#81c784', fontWeight: 'bold' }}>R$ {prod.valorEstimado.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Desenho do Tronco (Centro) */}
              <div style={{ gridColumn: 'span 1' }}>
                {renderTrunkVisualizer(simulationPreview)}
                
                {/* Painel de Tora Selecionada */}
                {selectedTora && (
                  <div className="glass-card" style={{ marginTop: '12px', padding: '14px', border: '1px solid var(--primary-color)', background: 'rgba(0,230,118,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary-hover)', fontWeight: 'bold' }}>Tora #{selectedTora.ordem}</span>
                      <button onClick={() => setSelectedTora(null)} style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}>×</button>
                    </div>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#fff', margin: '0 0 8px 0' }}>{selectedTora.produtoNome}</h4>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-muted)' }}>
                      <span>Trecho: <strong>{selectedTora.alturaInicialM}m - {selectedTora.alturaFinalM}m</strong> ({selectedTora.comprimentoM}m)</span>
                      <span>Diâmetros: <strong>{selectedTora.diametroInicialCm}cm &rarr; {selectedTora.diametroFinalCm}cm</strong></span>
                      <span>Volume: <strong style={{ color: '#fff' }}>{selectedTora.volumeM3} m³</strong></span>
                      <span>Preço do produto: <strong>R$ {(selectedTora.volumeM3 > 0 ? selectedTora.valorEstimado / selectedTora.volumeM3 : 0).toFixed(2)} / m³</strong></span>
                      <span>Valor estimado: <strong style={{ color: '#81c784' }}>R$ {selectedTora.valorEstimado.toFixed(2)}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Perfil de Afilamento com Cortes (Direita) */}
              <div style={{ gridColumn: 'span 1' }}>
                {renderAfilamentoWithCuts(selectedTree, simulationPreview)}
              </div>

              {/* Logs do Processamento (Abaixo) */}
              <div style={{ gridColumn: 'span 3' }} className="glass-card">
                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '10px' }}>Logs do Bucking Florestal</h4>
                <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '12px 16px', maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', fontFamily: 'monospace', fontSize: '11.5px', color: '#bbb', lineHeight: '1.5' }}>
                  {simulationPreview.logs.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>

            </div>
          ) : selectedTree ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '16px' }}>
              Por favor, certifique-se de que existem regras de sortimento comerciais ativas na aba "1. Regras de Produto".
            </div>
          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '16px' }}>
              Selecione a Sessão de Cubagem e a Árvore acima para executar a simulação do sortimento florestal.
            </div>
          )}

        </div>
      )}

      {/* --- ABA 3: RESULTADOS SALVOS --- */}
      {subTab === 'resultados' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Histórico de Sortimentos Aplicados</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Visualize e gerencie os resultados de traçados que foram calculados e congelados na base de dados.
            </p>
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Árvore</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)' }}>Espécie</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Modo</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Vol. Total (m³)</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Vol. Útil (m³)</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Resíduo (m³)</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Aproveitamento</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Valor Estimado</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {activeResults.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhum resultado de sortimento simulado e salvo para este projeto.
                    </td>
                  </tr>
                ) : (
                  activeResults.map(res => (
                    <tr key={res.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 'bold' }}>#{res.treeNumber}</td>
                      <td style={{ padding: '14px 20px' }}>{res.especie}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {res.useSemCasca ? "Sem Casca" : "Com Casca"}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>{res.volumeTotalArvore.toFixed(4)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-hover)' }}>{res.volumeSortidoTotal.toFixed(4)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', color: '#ef5350' }}>{res.volumeResiduo.toFixed(4)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 'bold' }}>
                        {res.volumeTotalArvore > 0 ? ((res.volumeSortidoTotal / res.volumeTotalArvore) * 100).toFixed(1) : 0}%
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 'bold', color: '#81c784' }}>
                        R$ {res.valorTotalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px', height: '28px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => setViewingResult(res)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                            Detalhes
                          </button>
                          <button className="btn btn-danger" style={{ width: 'auto', padding: '6px 12px', height: '28px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={async () => {
                            if (confirm(`Deletar resultado de sortimento da Árvore #${res.treeNumber}?`)) {
                              await deleteSortimentResult(res.id);
                            }
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ABA 4: RESUMO POR TRABALHO & CONSOLIDAÇÃO --- */}
      {subTab === 'resumo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Consolidação de Sortimentos por Trabalho</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                Resumos agregados das simulações de árvores cubadas vinculadas ao projeto <strong>{activeFw?.nome}</strong>.
              </p>
            </div>
            {activeResults.length > 0 && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px', borderColor: '#4caf50', color: '#4caf50', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={handleExportSortimentoXLSX}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Exportar Planilha XLSX
                </button>
              </div>
            )}
          </div>

          {trabalhoConsolidado ? (
            <>
              {/* Trabalho Geral Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Valor Comercial Total</span>
                  <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#81c784' }}>
                    R$ {trabalhoConsolidado.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Acumulado das árvores cubadas sortidas</span>
                </div>

                <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Volume Comercial Sortido</span>
                  <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: 'var(--primary-hover)' }}>{trabalhoConsolidado.volumeSortido.toFixed(3)} m³</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rendimento de aproveitamento útil: <strong>{trabalhoConsolidado.rendimento.toFixed(1)}%</strong></span>
                </div>

                <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Volume Residual / Resíduo</span>
                  <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#ef5350' }}>{trabalhoConsolidado.volumeResiduo.toFixed(3)} m³</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Volume residual não aproveitado comercialmente</span>
                </div>

                <div className="glass-card" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', marginBottom: 0 }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Árvores Simuladas</span>
                  <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 0 0', color: '#00b0ff' }}>{trabalhoConsolidado.arvoresSimuladas} árvores</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Quantidade de cubagens sortidas no projeto</span>
                </div>
              </div>

              {/* Resumos de Produtos do Trabalho */}
              <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                  Resumo de Rendimento por Produto Comercial
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted)' }}>Produto</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Total de Toras Obtidas</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>Volume Acumulado (m³)</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>Participação Comercial</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>Valor Total Estimado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trabalhoConsolidado.produtos.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{p.produtoNome}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.quantidadeToras}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>{p.volumeM3.toFixed(4)} m³</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {trabalhoConsolidado.volumeSortido > 0 ? ((p.volumeM3 / trabalhoConsolidationVolTotalCalculatedFallback(trabalhoConsolidado.volumeTotal)) * 100).toFixed(1) : 0}%
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#81c784', fontWeight: 'bold' }}>
                            R$ {p.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumo Consolidado por Talhão */}
              {talhoesSummary.length > 0 && (
                <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary-hover)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
                    Consolidação de Sortimento por Talhão
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted)' }}>Talhão</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>Árvores</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>Volume Total (m³)</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>Volume Útil (m³)</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>Volume Resíduo (m³)</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>Rendimento</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>Valor Total Estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {talhoesSummary.map((t, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{t.talhaoNome}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>{t.arvoresSimuladas}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>{t.volumeTotal.toFixed(3)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-hover)' }}>{t.volumeSortido.toFixed(3)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef5350' }}>{t.volumeResiduo.toFixed(3)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>{t.rendimento.toFixed(1)}%</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#81c784', fontWeight: 'bold' }}>
                              R$ {t.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </>
          ) : (
            <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '16px' }}>
              Sem dados de sortimento consolidados. Execute a simulação e salve os resultados na aba "2. Simular Árvore".
            </div>
          )}

        </div>
      )}

      {/* --- MODAL DE CRIAÇÃO/EDIÇÃO DE REGRA --- */}
      {showRuleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', marginBottom: 0 }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary-hover)', margin: 0 }}>
              {editingRule ? 'Editar Regra de Produto' : 'Nova Regra de Produto'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '8px 0 20px 0', lineHeight: '1.4' }}>
              Defina as dimensões e parâmetros econômicos para a simulação do sortimento.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label className="input-label">Nome do Produto / Assunto comercial</label>
                <input type="text" className="input-field" style={{ marginBottom: 0 }} placeholder="Ex: Laminação, Serraria grossa, Celulose" value={ruleNome} onChange={e => setRuleNome(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Descrição</label>
                <textarea className="input-field" style={{ marginBottom: 0, height: '60px', resize: 'none' }} placeholder="Ex: Toras nobres destinadas à fabricação de compensados" value={ruleDescricao} onChange={e => setRuleDescricao(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="input-label">Comp. da Tora (m)</label>
                  <input type="number" step="0.1" className="input-field" style={{ marginBottom: 0 }} placeholder="Ex: 2.9" value={ruleComprimento} onChange={e => setRuleComprimento(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Preço por m³ (R$)</label>
                  <input type="number" step="1" className="input-field" style={{ marginBottom: 0 }} placeholder="Ex: 350" value={rulePreco} onChange={e => setRulePreco(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="input-label">D. Mínimo PF (cm)</label>
                  <input type="number" step="1" className="input-field" style={{ marginBottom: 0 }} placeholder="Ex: 18" value={ruleDiamMin} onChange={e => setRuleDiamMin(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">D. Máximo PF (cm) - Opcional</label>
                  <input type="number" step="1" className="input-field" style={{ marginBottom: 0 }} placeholder="Sem limite" value={ruleDiamMax} onChange={e => setRuleDiamMax(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Cor no Desenho do Tronco</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" className="input-field" style={{ marginBottom: 0, padding: 0, width: '40px', height: '36px', cursor: 'pointer' }} value={ruleCor} onChange={e => setRuleCor(e.target.value)} />
                    <input type="text" className="input-field" style={{ marginBottom: 0, fontFamily: 'monospace' }} value={ruleCor} onChange={e => setRuleCor(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '22px' }}>
                  <input type="checkbox" id="chkRuleAtivo" checked={ruleAtivo} onChange={e => setRuleAtivo(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <label htmlFor="chkRuleAtivo" style={{ fontSize: '13.5px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Regra Ativa</label>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowRuleModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveRule}>Salvar Produto</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE DETALHES DE RESULTADO SALVO --- */}
      {viewingResult && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10000, padding: '20px', overflowY: 'auto', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '850px', marginTop: '30px', marginBottom: '30px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold' }}>Resultado de Sortimento Salvo</span>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: '2px 0 0 0' }}>Árvore #{viewingResult.treeNumber} ({viewingResult.especie})</h3>
              </div>
              <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', height: '36px' }} onClick={() => { setViewingResult(null); setSelectedTora(null); }}>
                Fechar
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '20px' }}>
              {/* KPIs & Tabelas */}
              <div style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>Vol. Total: <strong style={{ color: '#fff' }}>{viewingResult.volumeTotalArvore.toFixed(4)} m³</strong></span>
                    <span>Vol. Comercial: <strong style={{ color: 'var(--primary-hover)' }}>{viewingResult.volumeSortidoTotal.toFixed(4)} m³</strong></span>
                    <span>Aproveitamento: <strong style={{ color: '#fff' }}>{viewingResult.volumeTotalArvore > 0 ? ((viewingResult.volumeSortidoTotal / viewingResult.volumeTotalArvore) * 100).toFixed(1) : 0}%</strong></span>
                    <span>Valor Estimado: <strong style={{ color: '#81c784' }}>R$ {viewingResult.valorTotalEstimado.toFixed(2)}</strong></span>
                  </div>
                </div>

                {/* Toras da Árvore */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>#</th>
                        <th style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>Produto</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>Trecho</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingResult.toras.map(tora => (
                        <tr key={tora.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold' }}>{tora.ordem}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{tora.produtoNome}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{tora.alturaInicialM}m-{tora.alturaFinalM}m</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{tora.volumeM3.toFixed(4)} m³</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tronco visualizer */}
              <div style={{ gridColumn: 'span 1' }}>
                {renderTrunkVisualizer(viewingResult)}
              </div>

              {/* Taper Profile */}
              <div style={{ gridColumn: 'span 1' }}>
                {(() => {
                  const matchingTree = activeTrees.find((t: any) => t.id === viewingResult.cubageTreeId);
                  if (matchingTree) {
                    return renderAfilamentoWithCuts(matchingTree, viewingResult);
                  }
                  return <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', paddingTop: '40px' }}>Perfil original indisponível</div>;
                })()}
              </div>

              {/* Logs */}
              <div style={{ gridColumn: 'span 3' }}>
                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '8px' }}>Logs do Bucking Florestal</h4>
                <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '10px 14px', maxHeight: '120px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', fontFamily: 'monospace', fontSize: '11px', color: '#bbb' }}>
                  {viewingResult.logs.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

// Fallbacks helper
const trabalhoConsolidationVolTotalCalculatedFallback = (volumeTotal: number): number => {
  return volumeTotal > 0 ? volumeTotal : 1.0;
};
