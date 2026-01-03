/**
 * Core types for Accel's unified calculation engine
 */

export type CellAddress = {
  row: number;
  col: number;
  sheet?: string;
};

export type CellValue = number | string | boolean | null | CellValue[];

export type CellReference = {
  type: 'cell';
  address: CellAddress;
};

export type RangeReference = {
  type: 'range';
  start: CellAddress;
  end: CellAddress;
};

export type ASTNode =
  | { type: 'literal'; value: CellValue }
  | { type: 'cell'; ref: CellAddress }
  | { type: 'range'; start: CellAddress; end: CellAddress }
  | { type: 'function'; name: string; args: ASTNode[] }
  | { type: 'binary'; op: string; left: ASTNode; right: ASTNode }
  | { type: 'unary'; op: string; arg: ASTNode }
  | { type: 'variable'; name: string };

export interface Cell {
  address: CellAddress;
  formula?: string;
  ast?: ASTNode;
  value: CellValue;
  dependencies: Set<string>;
  dependents: Set<string>;
  isParameter?: boolean;
  parameterConfig?: ParameterConfig;
  format?: CellFormat;
}

export interface ParameterConfig {
  min: number;
  max: number;
  step: number;
  showSlider: boolean;
}

export interface CellFormat {
  decimals?: number;
  numberFormat?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontColor?: string;
  backgroundColor?: string;
}

export interface GraphDefinition {
  id: string;
  type: 'function' | 'parametric' | 'implicit' | 'scatter';
  formula: string;
  ast: ASTNode;
  color: string;
  visible: boolean;
  domain?: { min: number; max: number };
  range?: { min: number; max: number };
  cellBindings: Set<string>;
}

export interface Worksheet {
  name: string;
  cells: Map<string, Cell>;
  graphs: Map<string, GraphDefinition>;
  namedRanges: Map<string, RangeReference>;
}

export interface Workbook {
  sheets: Map<string, Worksheet>;
  activeSheet: string;
}
