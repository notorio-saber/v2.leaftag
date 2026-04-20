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
