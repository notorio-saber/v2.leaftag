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

export interface FieldWork {
  id: string;
  nome: string;
  local: string;
  dataInicio: string;
  status: string;
}

export interface Inventory {
  id: number;
  fieldWorkId: string;
  nome: string;
  areaParcela: number;
  fatorExpansao: number;
  dataInicio: string;
  ultimaColeta: string;
  status: string;
  colunas: InventoryColumn[];
  dados: IndividualData[];
  template: string;
}
