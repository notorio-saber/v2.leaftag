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
}

export interface IndividualData {
  id: string;
  numeroIndividuo: number;
  timestamp: string;
  multipleStems: boolean;
  stems?: StemData[];
  [key: string]: any; 
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
}
