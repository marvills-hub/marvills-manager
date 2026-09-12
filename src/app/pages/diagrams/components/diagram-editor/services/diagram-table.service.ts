import { Injectable } from '@angular/core';
import {
  DiagramTableCell,
  DiagramTableData,
  DiagramTableRow,
} from '../../../../../core/models/diagram.model';
@Injectable({
  providedIn: 'root',
})
export class DiagramTableService {
  create(rows = 3, columns = 3, headerRow = true): DiagramTableData {
    return {
      columns,
      headerRow,
      rows: Array.from({ length: rows }, () => this.createRow(columns)),
    };
  }
  addRow(table: DiagramTableData): DiagramTableData {
    return {
      ...table,
      rows: [...table.rows, this.createRow(table.columns)],
    };
  }
  deleteRow(table: DiagramTableData, rowIndex: number): DiagramTableData {
    if (table.rows.length <= 1) return table;
    return {
      ...table,
      rows: table.rows.filter((_, index) => index !== rowIndex),
    };
  }
  addColumn(table: DiagramTableData): DiagramTableData {
    return {
      ...table,
      columns: table.columns + 1,
      rows: table.rows.map((row) => ({
        ...row,
        cells: [...row.cells, this.createCell()],
      })),
    };
  }
  deleteColumn(table: DiagramTableData, columnIndex: number): DiagramTableData {
    if (table.columns <= 1) return table;
    return {
      ...table,
      columns: table.columns - 1,
      rows: table.rows.map((row) => ({
        ...row,
        cells: row.cells.filter((_, index) => index !== columnIndex),
      })),
    };
  }
  updateCell(
    table: DiagramTableData,
    rowIndex: number,
    columnIndex: number,
    value: string,
  ): DiagramTableData {
    return {
      ...table,
      rows: table.rows.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? {
              ...row,
              cells: row.cells.map((cell, currentColumnIndex) =>
                currentColumnIndex === columnIndex
                  ? {
                      ...cell,
                      value,
                    }
                  : cell,
              ),
            }
          : row,
      ),
    };
  }
  toggleHeader(table: DiagramTableData): DiagramTableData {
    return {
      ...table,
      headerRow: !table.headerRow,
    };
  }
  normalize(table?: DiagramTableData | null): DiagramTableData {
    if (!table) return this.create();
    const columns = Math.max(1, table.columns || 1);
    const rows = table.rows?.length ? table.rows : [this.createRow(columns)];
    return {
      columns,
      headerRow: table.headerRow ?? true,
      rows: rows.map((row) => ({
        id: row.id || crypto.randomUUID(),
        cells: Array.from({ length: columns }, (_, index) => ({
          id: row.cells?.[index]?.id || crypto.randomUUID(),
          value: row.cells?.[index]?.value || '',
        })),
      })),
    };
  }
  private createRow(columns: number): DiagramTableRow {
    return {
      id: crypto.randomUUID(),
      cells: Array.from({ length: columns }, () => this.createCell()),
    };
  }
  private createCell(): DiagramTableCell {
    return {
      id: crypto.randomUUID(),
      value: '',
    };
  }
}
