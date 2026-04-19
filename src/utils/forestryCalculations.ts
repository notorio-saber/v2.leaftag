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
