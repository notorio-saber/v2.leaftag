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
