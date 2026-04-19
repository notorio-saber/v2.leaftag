export type ColumnType = 'text' | 'number' | 'textarea';

export interface InventoryColumn {
  id: string;
  nome: string;
  tipo: ColumnType;
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

export interface Inventory {
  id: number;
  nome: string;
  local: string;
  areaParcela: number;
  fatorExpansao: number;
  dataInicio: string;
  ultimaColeta: string;
  status: string;
  colunas: InventoryColumn[];
  dados: IndividualData[];
  template: string;
}
