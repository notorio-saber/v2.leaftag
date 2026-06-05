export type ColumnType = 'text' | 'number' | 'textarea' | 'photo' | 'select';

export interface InventoryColumn {
  id: string;
  nome: string;
  tipo: ColumnType;
  opcoes?: string[]; // Opções pré-configuradas para colunas do tipo 'select'
}

export interface StemData {
  id: string;
  cap?: number;
  altura?: number;
  alturaProcessada?: number;
  alturaMedidaOuEstimada?: 'medida' | 'estimada';
  volumeProcessado?: number;
}

export interface IndividualData {
  id: string;
  numeroIndividuo: number;
  timestamp: string;
  multipleStems: boolean;
  stems?: StemData[];
  // Novos campos de processamento profissional
  alturaUtilizada?: number;
  alturaMedidaOuEstimada?: 'medida' | 'estimada';
  volumeCalculado?: number;
  modeloUtilizado?: string;
  // Novos campos do módulo de cubagem
  modoColeta?: 'relativa' | 'seccional';
  metodoCalculo?: 'smalian' | 'huber' | 'newton';
  volumeTotal?: number;
  volumePorSecao?: { secao: number; volume: number }[];
  dataCalculo?: string;
  [key: string]: any; 
}

export interface HeightModel {
  id: string;
  nome: string;
  especie: string;
  regiao: string;
  tipoModelo: 'linear' | 'logaritmico' | 'curtis' | 'henriksen' | 'trorey' | 'personalizado';
  coeficientes: {
    beta0: number;
    beta1: number;
    beta2?: number;
    beta3?: number;
    expressaoCustom?: string;
  };
  fonteBibliografica?: string;
  observacoes?: string;
  criadoEm: string;
}

export interface VolumeModel {
  id: string;
  nome: string;
  especie: string;
  regiao: string;
  tipoModelo: 'fator_forma' | 'schumacher_hall' | 'spurr' | 'stoate' | 'husch' | 'personalizado';
  coeficientes: {
    beta0: number;
    beta1?: number;
    beta2?: number;
    beta3?: number;
    expressaoCustom?: string;
  };
  fonteBibliografica?: string;
  observacoes?: string;
  criadoEm: string;
}

export interface FieldWork {
  id: string;
  nome: string;
  local: string;
  dataInicio: string;
  status: string;
  googleSheetsUrl?: string;
}

export interface Talhao {
  id: string;
  fieldWorkId: string;
  nome: string;
  observacoes?: string;
  area?: number;
}

export interface Stratum {
  id: string;
  fieldWorkId: string;
  nome: string;
  area: number;
  descricao?: string;
}

export interface Inventory {
  id: number;
  fieldWorkId: string;
  talhaoId?: string;
  stratumId?: string;
  nome: string;
  areaParcela: number;
  fatorExpansao: number;
  dataInicio: string;
  ultimaColeta: string;
  status: string;
  colunas: InventoryColumn[];
  dados: IndividualData[];
  template: string;
  formatoParcela?: string;
  coordenadas?: string;
  observacoes?: string;
  modoColeta?: 'relativa' | 'seccional';
  metodoCalculo?: 'smalian' | 'huber' | 'newton';
}

export interface ModelSnapshot {
  id: string;
  nome: string;
  especie: string;
  regiao: string;
  tipoModelo: string;
  coeficientes: {
    beta0: number;
    beta1?: number;
    beta2?: number;
    beta3?: number;
    expressaoCustom?: string;
  };
  fonteBibliografica?: string;
  observacoes?: string;
  unidadeDap: string;
  unidadeAltura: string;
  unidadeVolume: string;
  formula: string;
}

export interface ParcelaSnapshot {
  parcelaId: number;
  nome: string;
  talhaoId?: string;
  stratumId?: string;
  areaParcela: number;
  fatorExpansao: number;
  volumeTotal: number;
  volumePorHa: number;
  areaBasalPorHa: number;
  densidadePorHa: number;
  numeroArvores: number;
}

export interface TalhaoConsolidation {
  talhaoId: string;
  nome: string;
  areaTalhao: number;
  parcelasUtilizadas: number;
  arvoresUtilizadas: number;
  volumeMedioHa: number;
  volumeTotalEstimado: number;
  areaBasalMediaHa: number;
  densidadeMediaHa: number;
  dapMedio: number;
  alturaMedia: number;
}

export interface StratumConsolidation {
  stratumId: string;
  nome: string;
  areaEstrato: number;
  parcelasUtilizadas: number;
  arvoresUtilizadas: number;
  volumeMedioHa: number;
  volumeTotalEstimado: number;
  areaBasalMediaHa: number;
  densidadeMediaHa: number;
  dapMedio: number;
  alturaMedia: number;
}

export interface TrabalhoConsolidation {
  areaTotal: number;
  areaAmostrada: number;
  numeroTalhoes: number;
  numeroEstratos: number;
  numeroParcelas: number;
  numeroArvores: number;
  volumeMedioHa: number;
  volumeTotalEstimado: number;
  areaBasalMediaHa: number;
  densidadeMedia: number;
  dapMedio: number;
  alturaMedia: number;
}

export interface InventoryProcessing {
  id: string;
  fieldWorkId: string;
  nomeProcessamento: string;
  dataProcessamento: string;
  
  heightModelSnapshot?: ModelSnapshot | null;
  volumeModelSnapshot?: ModelSnapshot | null;
  
  consolidationMode: 'talhao' | 'stratum' | 'auto';
  effectiveConsolidationMode: 'talhao' | 'stratum';
  
  numeroParcelas: number;
  areaAmostrada: number;
  volumeTotalEstimado: number;
  volumeMedioHa: number;
  areaBasalMediaHa: number;
  dapMedio: number;
  alturaMedia: number;
  
  warnings: string[];
  parcelasIgnoradas: string[];
  arvoresIgnoradas: number;
  arvoresSemDAP: number;
  arvoresSemAltura: number;
  arvoresSemVolume: number;
  
  status: string;
  createdAt: string;
  createdBy: string;
  
  parcelas: ParcelaSnapshot[];
  talhoes: TalhaoConsolidation[];
  strata: StratumConsolidation[];
  trabalho: TrabalhoConsolidation;
}

