export function calculateDapFromCap(cap: number): number {
  if (!cap) return 0;
  return cap / Math.PI;
}

export function calculateBasalArea(cap: number, isDap = false): number {
  let d = isDap ? cap : calculateDapFromCap(cap);
  d = d / 100; // converter cm para metros para cálculo correto da área
  return (Math.PI * Math.pow(d, 2)) / 4;
}

export function calculateVolume(basalArea: number, height: number, formFactor: number = 0.7): number {
  if (!basalArea || !height) return 0;
  return basalArea * height * formFactor;
}

export function parseCoordinates(coordsString: string): { latitude: number, longitude: number } | null {
  if (!coordsString) return null;
  const parts = coordsString.split(',');
  if (parts.length !== 2) return null;
  return {
    latitude: parseFloat(parts[0].trim()),
    longitude: parseFloat(parts[1].trim())
  };
}

/**
 * Calcula o Índice de Shannon-Weaver (H')
 * @param speciesCounts Dicionário com a contagem de indivíduos por espécie
 * @returns O valor do índice H'
 */
export function calculateShannonIndex(speciesCounts: Record<string, number>): number {
  const total = Object.values(speciesCounts).reduce((acc, count) => acc + count, 0);
  if (total === 0) return 0;

  let h = 0;
  for (const count of Object.values(speciesCounts)) {
    if (count > 0) {
      const p = count / total;
      h -= p * Math.log(p);
    }
  }
  return h;
}

/**
 * Calcula o Índice de Simpson (D) e sua recíproca (1-D) ou inverso (1/D)
 * Vamos retornar o "1 - D" sendo o Índice de Diversidade de Simpson (onde 1 é diversidade máxima)
 * @param speciesCounts Dicionário com a contagem de indivíduos por espécie
 * @returns O valor do índice 1-D
 */
export function calculateSimpsonIndex(speciesCounts: Record<string, number>): number {
  const total = Object.values(speciesCounts).reduce((acc, count) => acc + count, 0);
  if (total <= 1) return 0; // cannot calculate properly if N <= 1

  let sumPi2 = 0;
  for (const count of Object.values(speciesCounts)) {
    if (count > 0) {
      const p = count / total;
      sumPi2 += p * p;
    }
  }
  return 1 - sumPi2; // Índice de Diversidade de Simpson
}

/**
 * Calcula a Equitabilidade de Pielou (J')
 * @param shannonIndex O valor calculado do índice de Shannon (H')
 * @param speciesCount Número total de espécies diferentes (S)
 * @returns O valor da equitabilidade (J') de 0 a 1
 */
export function calculatePielouIndex(shannonIndex: number, speciesCount: number): number {
  if (speciesCount <= 1 || shannonIndex === 0) return 0;
  return shannonIndex / Math.log(speciesCount);
}

// Helper para obter DAP a partir de cap ou dap
export function getDapOfTreeOrStem(item: any): number {
  if (item.dap !== undefined && item.dap !== null && item.dap !== '') {
    const dVal = parseFloat(item.dap);
    if (!isNaN(dVal)) return dVal;
  }
  if (item.cap !== undefined && item.cap !== null && item.cap !== '') {
    const cVal = parseFloat(item.cap);
    if (!isNaN(cVal)) return cVal / Math.PI;
  }
  return 0;
}

// Helper para limpar resultados de cálculo
export function cleanResult(val: number): number {
  if (isNaN(val) || !isFinite(val)) return 0;
  return Math.max(0, val);
}

// Avalia modelo hipsométrico (retorna H em metros)
export function evaluateHeightModel(model: any, dap: number): number {
  if (dap <= 0) return 0;
  const { beta0, beta1, beta2, expressaoCustom } = model.coeficientes;
  
  switch (model.tipoModelo) {
    case 'linear':
      return beta0 + beta1 * dap;
    case 'logaritmico':
    case 'henriksen':
      return beta0 + beta1 * Math.log(dap);
    case 'curtis':
      return Math.exp(beta0 + beta1 / dap);
    case 'trorey':
      return beta0 + beta1 * dap + (beta2 || 0) * Math.pow(dap, 2);
    case 'personalizado':
      if (!expressaoCustom) return 0;
      try {
        const vars = {
          DAP: dap,
          beta0: beta0,
          beta1: beta1 || 0,
          beta2: beta2 || 0,
          beta3: model.coeficientes.beta3 || 0
        };
        const fn = new Function(...Object.keys(vars), `return ${expressaoCustom}`);
        return fn(...Object.values(vars));
      } catch (err) {
        console.error('Erro ao avaliar modelo hipsométrico personalizado:', err);
        return 0;
      }
    default:
      return 0;
  }
}

// Avalia modelo volumétrico (retorna V em m³)
export function evaluateVolumeModel(model: any, dap: number, h: number): number {
  if (dap <= 0) return 0;
  const { beta0, beta1, beta2, beta3, expressaoCustom } = model.coeficientes;

  switch (model.tipoModelo) {
    case 'fator_forma':
      const g = (Math.PI * Math.pow(dap / 100, 2)) / 4;
      return g * h * beta0;
    case 'schumacher_hall':
      if (h <= 0) return 0;
      return beta0 * Math.pow(dap, beta1 || 0) * Math.pow(h, beta2 || 0);
    case 'spurr':
      return beta0 + (beta1 || 0) * Math.pow(dap, 2) * h;
    case 'stoate':
      return beta0 + (beta1 || 0) * Math.pow(dap, 2) + (beta2 || 0) * Math.pow(dap, 2) * h + (beta3 || 0) * h;
    case 'husch':
      return beta0 * Math.pow(dap, beta1 || 0);
    case 'personalizado':
      if (!expressaoCustom) return 0;
      try {
        const vars = {
          DAP: dap,
          H: h,
          beta0: beta0,
          beta1: beta1 || 0,
          beta2: beta2 || 0,
          beta3: beta3 || 0
        };
        const fn = new Function(...Object.keys(vars), `return ${expressaoCustom}`);
        return fn(...Object.values(vars));
      } catch (err) {
        console.error('Erro ao avaliar modelo volumétrico personalizado:', err);
        return 0;
      }
    default:
      return 0;
  }
}
