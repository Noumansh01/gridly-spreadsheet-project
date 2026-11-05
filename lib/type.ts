export type CellMap = Record<string, string>;

export type SheetData = {
  id: string;
  name: string;
  rows: number;
  columns: number;
  cells: CellMap;
};

export type Workbook = {
  sheets: SheetData[];
};

export type SaveStatus = "saved" | "saving" | "failed";

export type Selection = {
  anchorRow: number;
  anchorCol: number;
  row: number;
  col: number;
};
