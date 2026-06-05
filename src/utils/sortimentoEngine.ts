import type { SortimentRule, SortimentResult, SortimentToraResult, SortimentResumoProduto } from '../types';

interface Coord {
  h: number;
  d: number;
}

// Auxiliar para obter coordenadas ordenadas (altura e diâmetro) de uma árvore cubada
export const getTreeCoordinates = (tree: any, useSemCasca: boolean = false): Coord[] => {
  const coords: Coord[] = [];
  const hTotal = typeof tree.alturaTotal === 'number' ? tree.alturaTotal : parseFloat(tree.alturaTotal || '0');

  if (tree.modo === 'relativo' || tree.modoColeta === 'relativa') {
    const dados = tree.dadosRelativos || {};
    const casca = tree.cascaRelativos || {};
    const pontos = ['Base', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', 'Topo'];

    pontos.forEach(ponto => {
      if (dados[ponto] !== undefined) {
        const dcc = parseFloat(dados[ponto] || '0');
        if (dcc > 0) {
          let pct = 0;
          if (ponto === 'Base') pct = 0;
          else if (ponto === 'Topo') pct = 100;
          else pct = parseFloat(ponto.replace('%', ''));

          const h = (pct / 100) * hTotal;
          let d = dcc;

          if (useSemCasca && casca[ponto] !== undefined) {
            const e = parseFloat(casca[ponto] || '0');
            d = dcc - 2 * (e / 10);
          }

          coords.push({ h, d });
        }
      }
    });
  } else {
    // Modo Seccional
    let curH = 0;
    const secoes = tree.secoes || [];

    secoes.forEach((s: any) => {
      const comp = parseFloat(s.comprimento || '0');
      if (comp <= 0) return;

      let dIni = parseFloat(s.dInicial || '0');
      let dMed = parseFloat(s.dMedio || '0');
      let dFin = parseFloat(s.dFinal || '0');

      if (useSemCasca) {
        const eIni = parseFloat(s.eInicial || '0');
        const eMed = parseFloat(s.eMedio || '0');
        const eFin = parseFloat(s.eFinal || '0');

        if (dIni > 0) dIni = dIni - 2 * (eIni / 10);
        if (dMed > 0) dMed = dMed - 2 * (eMed / 10);
        if (dFin > 0) dFin = dFin - 2 * (eFin / 10);
      }

      if (dIni > 0) coords.push({ h: curH, d: dIni });
      if (dMed > 0) coords.push({ h: curH + comp / 2, d: dMed });
      if (dFin > 0) coords.push({ h: curH + comp, d: dFin });

      curH += comp;
    });
  }

  // Filtrar diâmetros válidos e remover duplicados por altura
  const validCoords = coords.filter(c => !isNaN(c.h) && !isNaN(c.d) && c.h >= 0 && c.d >= 0);
  validCoords.sort((a, b) => a.h - b.h);

  const uniqueCoords: Coord[] = [];
  validCoords.forEach(c => {
    const existing = uniqueCoords.find(uc => Math.abs(uc.h - c.h) < 0.001);
    if (!existing) {
      uniqueCoords.push(c);
    }
  });

  // Forçar ponto de topo igual a zero caso não exista na altura total
  if (hTotal > 0 && uniqueCoords.length > 0) {
    const lastCoord = uniqueCoords[uniqueCoords.length - 1];
    if (lastCoord.h < hTotal) {
      uniqueCoords.push({ h: hTotal, d: 0 });
    }
  }

  return uniqueCoords;
};

// Estima o diâmetro (cm) em qualquer altura (m) usando interpolação linear
export const getDiameterAtHeight = (tree: any, heightM: number, useSemCasca: boolean = false): number => {
  const coords = getTreeCoordinates(tree, useSemCasca);
  if (coords.length === 0) return 0;
  if (coords.length === 1) return coords[0].d;

  // Se a altura estiver abaixo do primeiro ponto medido (geralmente base)
  if (heightM <= coords[0].h) return coords[0].d;

  // Se a altura exceder o último ponto medido (geralmente topo da árvore)
  if (heightM >= coords[coords.length - 1].h) return 0;

  // Localizar os dois pontos entre os quais interpolar
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    if (heightM >= p0.h && heightM <= p1.h) {
      const divisor = p1.h - p0.h;
      if (divisor === 0) return p0.d;
      const fraction = (heightM - p0.h) / divisor;
      const d = p0.d + (p1.d - p0.d) * fraction;
      return d > 0 ? d : 0;
    }
  }

  return 0;
};

// Executa a simulação do traçado (bucking) da árvore a partir da base
export const simulateBucking = (tree: any, activeRules: SortimentRule[], useSemCasca: boolean = false): SortimentResult => {
  const logs: string[] = [];
  const toras: SortimentToraResult[] = [];
  
  // Regras de sortimento ordenadas por prioridade ascendente (menor número = maior aproveitamento comercial)
  const rulesSnapshot = [...activeRules]
    .filter(r => r.ativo)
    .sort((a, b) => a.prioridade - b.prioridade);

  const hTotal = typeof tree.alturaTotal === 'number' ? tree.alturaTotal : parseFloat(tree.alturaTotal || '0');
  
  // Fallback para volume total da árvore
  const volTotalArvore = useSemCasca 
    ? (tree.volumeTotalSemCasca || tree.volumeTotal || 0) 
    : (tree.volumeTotal || 0);

  logs.push(`Iniciando simulação de sortimento para árvore #${tree.numeroIndividuo} (${tree.especie}). Altura total: ${hTotal} m. Volume total cubado: ${volTotalArvore.toFixed(4)} m³.`);
  logs.push(`Modo de sortimento: ${useSemCasca ? 'Sem Casca' : 'Com Casca'}.`);

  const coords = getTreeCoordinates(tree, useSemCasca);

  if (coords.length < 2 || hTotal <= 0) {
    logs.push("Erro: A árvore selecionada não possui pontos de cubagem suficientes ou altura total válida.");
    return {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fieldWorkId: tree.fieldWorkId || '',
      inventoryId: typeof tree.inventoryId === 'number' ? tree.inventoryId : parseInt(tree.inventoryId || '0'),
      cubageTreeId: tree.id,
      treeNumber: tree.numeroIndividuo,
      especie: tree.especie || '',
      dataProcessamento: new Date().toLocaleDateString('pt-BR'),
      rulesSnapshot: activeRules,
      logs,
      volumeTotalArvore: volTotalArvore,
      volumeSortidoTotal: 0,
      volumeResiduo: volTotalArvore,
      valorTotalEstimado: 0,
      toras: [],
      resumoPorProduto: [],
      useSemCasca
    };
  }

  let currentHeight = 0;
  let toraCount = 0;
  let volumeSortidoTotal = 0;
  let valorTotalEstimado = 0;

  logs.push(`Regras ativas para simulação: ${rulesSnapshot.map(r => `${r.nome} (Prioridade: ${r.prioridade}, L: ${r.comprimentoToraM}m, Dmin: ${r.diametroMinimoPontaFinaCm}cm)`).join(', ')}.`);

  let bucking = true;
  while (bucking && currentHeight < hTotal) {
    let matchedRule = false;

    for (const rule of rulesSnapshot) {
      const pontaFinaHeight = currentHeight + rule.comprimentoToraM;

      // 1. Verificar se há comprimento restante suficiente no fuste
      if (pontaFinaHeight > hTotal) {
        continue;
      }

      // 2. Obter diâmetro estimado na ponta fina (H final)
      const dPF = getDiameterAtHeight(tree, pontaFinaHeight, useSemCasca);

      // 3. Validar diâmetro mínimo da ponta fina
      if (dPF < rule.diametroMinimoPontaFinaCm) {
        continue;
      }

      // 4. Validar diâmetro máximo da ponta fina (opcional)
      if (rule.diametroMaximoPontaFinaCm !== undefined && rule.diametroMaximoPontaFinaCm > 0) {
        if (dPF > rule.diametroMaximoPontaFinaCm) {
          continue;
        }
      }

      // Se passou em todos os testes, aceita e realiza o corte da tora
      toraCount++;
      const dIni = getDiameterAtHeight(tree, currentHeight, useSemCasca);

      // Área basal (m²)
      const gIni = (Math.PI * Math.pow(dIni / 100, 2)) / 4;
      const gPF = (Math.PI * Math.pow(dPF / 100, 2)) / 4;
      // Volume Smalian (m³)
      const volumeTora = ((gIni + gPF) / 2) * rule.comprimentoToraM;
      const precoM3 = rule.precoPorM3 || 0;
      const valorTora = volumeTora * precoM3;

      toras.push({
        id: `tora_${toraCount}_${Date.now()}`,
        produtoNome: rule.nome,
        ruleId: rule.id,
        ordem: toraCount,
        alturaInicialM: Number(currentHeight.toFixed(2)),
        alturaFinalM: Number(pontaFinaHeight.toFixed(2)),
        comprimentoM: rule.comprimentoToraM,
        diametroInicialCm: Number(dIni.toFixed(2)),
        diametroFinalCm: Number(dPF.toFixed(2)),
        volumeM3: Number(volumeTora.toFixed(5)),
        valorEstimado: Number(valorTora.toFixed(2)),
        status: 'Aprovado'
      });

      logs.push(`Tora #${toraCount} [${rule.nome}]: de ${currentHeight.toFixed(2)}m até ${pontaFinaHeight.toFixed(2)}m (diâmetros: ${dIni.toFixed(1)}cm -> ${dPF.toFixed(1)}cm) | Vol: ${volumeTora.toFixed(4)} m³ | Preço: R$ ${precoM3}/m³ | Valor: R$ ${valorTora.toFixed(2)}.`);

      volumeSortidoTotal += volumeTora;
      valorTotalEstimado += valorTora;

      currentHeight = pontaFinaHeight;
      matchedRule = true;
      break; // Reinicia o loop de produtos com prioridade máxima para a nova altura
    }

    // Se em determinada altura nenhuma regra pôde ser aplicada, o traçado é encerrado e o resto vira resíduo
    if (!matchedRule) {
      bucking = false;
    }
  }

  // O trecho do fuste que sobrou até a altura total vira resíduo
  const compResiduo = hTotal - currentHeight;
  let volumeResiduo = 0;

  if (compResiduo > 0) {
    const dIniRes = getDiameterAtHeight(tree, currentHeight, useSemCasca);
    const gIniRes = (Math.PI * Math.pow(dIniRes / 100, 2)) / 4;
    // O diâmetro do topo extremo é sempre 0
    volumeResiduo = ((gIniRes + 0) / 2) * compResiduo;

    logs.push(`Trecho residual de topo [Resíduo]: de ${currentHeight.toFixed(2)}m até ${hTotal.toFixed(2)}m (comprimento: ${compResiduo.toFixed(2)}m) | Vol: ${volumeResiduo.toFixed(4)} m³.`);
  }

  // Agrega resumos consolidados por produto
  const resumoMap: Record<string, SortimentResumoProduto> = {};
  
  // Garantir que todos os produtos com regras ativas apareçam no resumo (mesmo com 0 toras)
  activeRules.forEach(rule => {
    if (rule.ativo) {
      resumoMap[rule.nome] = {
        produtoNome: rule.nome,
        quantidadeToras: 0,
        volumeM3: 0,
        valorEstimado: 0
      };
    }
  });

  toras.forEach(tora => {
    if (resumoMap[tora.produtoNome]) {
      resumoMap[tora.produtoNome].quantidadeToras++;
      resumoMap[tora.produtoNome].volumeM3 += tora.volumeM3;
      resumoMap[tora.produtoNome].valorEstimado += tora.valorEstimado;
    }
  });

  const resumoPorProduto = Object.values(resumoMap).map(res => ({
    produtoNome: res.produtoNome,
    quantidadeToras: res.quantidadeToras,
    volumeM3: Number(res.volumeM3.toFixed(5)),
    valorEstimado: Number(res.valorEstimado.toFixed(2))
  }));

  const rendimentoPercentual = ((volumeSortidoTotal / (volumeSortidoTotal + volumeResiduo)) * 100 || 0);
  logs.push(`Simulação concluída. Rendimento útil comercial: ${rendimentoPercentual.toFixed(1)}%. Valor financeiro total estimado: R$ ${valorTotalEstimado.toFixed(2)}.`);

  return {
    id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fieldWorkId: tree.fieldWorkId || '',
    inventoryId: typeof tree.inventoryId === 'number' ? tree.inventoryId : parseInt(tree.inventoryId || '0'),
    cubageTreeId: tree.id,
    treeNumber: tree.numeroIndividuo,
    especie: tree.especie || '',
    dataProcessamento: new Date().toLocaleDateString('pt-BR'),
    rulesSnapshot: activeRules,
    logs,
    volumeTotalArvore: Number((volumeSortidoTotal + volumeResiduo).toFixed(5)),
    volumeSortidoTotal: Number(volumeSortidoTotal.toFixed(5)),
    volumeResiduo: Number(volumeResiduo.toFixed(5)),
    valorTotalEstimado: Number(valorTotalEstimado.toFixed(2)),
    toras,
    resumoPorProduto,
    useSemCasca
  };
};
