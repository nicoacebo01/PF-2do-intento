// Declare global variables from scripts included in index.html
declare const XLSX: any;
declare const jspdf: any;

// Define a flexible column structure for exporting
export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

// --- NEW: STYLING LOGIC FOR EXCEL EXPORTS ---

// Helper to parse numbers that might be formatted as strings (e.g., "1.234,56")
const parseFormattedNumber = (value: string): number | '' => {
    const strValue = String(value);
    if (value === '' || value === null || value === undefined || value === '-') return '';
    
    // If the string contains a percentage sign, treat it as a literal string by not parsing it.
    if (strValue.includes('%')) {
        return '';
    }
    // Do not parse date-like strings (dd-mm-yyyy or dd-mm-yyyy)
    if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(strValue)) {
        return '';
    }
    const parsableValue = strValue.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(parsableValue);
    return isNaN(num) ? '' : num;
};

// Style definitions
const headerStyle = {
    fill: { fgColor: { rgb: "1E40AF" } }, // dark blue
    font: { color: { rgb: "FFFFFF" }, bold: true },
    alignment: { horizontal: "center", vertical: "center" }
};
const totalRowStyle = {
    fill: { fgColor: { rgb: "4B5563" } }, // dark grey
    font: { color: { rgb: "FFFFFF" }, bold: true }
};
const subtotalRowStyle = {
    fill: { fgColor: { rgb: "6B7280" } }, // medium grey
    font: { color: { rgb: "FFFFFF" }, bold: true }
};
const defaultCellStyle = {
    font: { color: { rgb: "000000" } }
};
const zebraCellStyle = {
    fill: { fgColor: { rgb: "F3F4F6" } }, // light grey
    font: { color: { rgb: "000000" } }
};
// Standard number formats. Excel will localize the decimal/thousand separators.
const numberFormat = "0.00"; 
const integerFormat = "0";

/**
 * Creates a fully styled worksheet from data and column definitions.
 * @param data The array of data objects.
 * @param columns The column definitions.
 * @returns A worksheet object compatible with the XLSX library.
 */
function createStyledSheet<T>(data: T[], columns: ExportColumn<T>[]) {
    const styledData: any[][] = [];
    const colWidths: { wch: number }[] = [];

    // 1. Process Headers
    const headerRow = columns.map((col, idx) => {
        colWidths[idx] = { wch: col.header.length + 4 }; // Initial width + padding
        return { v: col.header, s: headerStyle };
    });
    styledData.push(headerRow);

    // 2. Process Data Rows
    data.forEach((row, rowIndex) => {
        const isZebra = rowIndex % 2 === 1;
        const rowData: any[] = [];
        
        let isTotalRow = false;
        let isSubtotalRow = false;

        columns.forEach((col, colIndex) => {
            let value = col.accessor(row);
            
            if (colIndex === 0 && typeof value === 'string') {
                const lowerValue = value.toLowerCase();
                if (lowerValue.startsWith('total')) isTotalRow = true;
                else if (lowerValue.startsWith('subtotal')) isSubtotalRow = true;
            }
            
            const cell: any = { v: value };
            let cellStyle: any = isZebra ? { ...zebraCellStyle } : { ...defaultCellStyle };
            
            if (isTotalRow) cellStyle = { ...totalRowStyle };
            else if (isSubtotalRow) cellStyle = { ...subtotalRowStyle };

            if (typeof value === 'number') {
                cell.t = 'n';
                cellStyle.numFmt = Number.isInteger(value) ? integerFormat : numberFormat;
            } else if (typeof value === 'string') {
                const numValue = parseFormattedNumber(value);
                if (typeof numValue === 'number') {
                    cell.v = numValue;
                    cell.t = 'n';
                    cellStyle.numFmt = Number.isInteger(numValue) ? integerFormat : numberFormat;
                }
            }
            
            cell.s = cellStyle;
            rowData.push(cell);
            
            const cellLength = value !== null && value !== undefined ? String(value).length : 0;
            if (colWidths[colIndex].wch < cellLength + 2) {
                colWidths[colIndex].wch = cellLength + 2;
            }
        });
        styledData.push(rowData);
    });
    
    // 3. Build the worksheet object from the styled data structure.
    // This is the correct way to handle cell objects with styles.
    const ws: { [key: string]: any } = {};
    const range = { s: { c: 0, r: 0 }, e: { c: columns.length - 1, r: data.length } };

    styledData.forEach((row, R) => {
        row.forEach((cell, C) => {
            const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
            ws[cellRef] = cell;
        });
    });

    ws['!ref'] = XLSX.utils.encode_range(range);
    
    // 4. Apply worksheet-level properties.
    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w.wch, 60) }));
    ws['!view'] = { showGridLines: false };
    ws['!freeze'] = { ySplit: 1 };

    return ws;
}


/**
 * Exports an array of data to an Excel file with enhanced styling.
 * @param data The array of data objects.
 * @param columns The column definitions.
 * @param fileName The desired file name without extension.
 */
export const exportToExcel = <T,>(data: T[], columns: ExportColumn<T>[], fileName: string) => {
  try {
    const ws = createStyledSheet(data, columns);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    alert("Hubo un error al generar el archivo Excel. Verifique la consola para más detalles.");
  }
};

const formatForPdfDisplay = (value: any): string => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') {
        // es-AR uses . for thousands and , for decimals.
        return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    // Check for YYYY-MM-DD
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split('-');
        return `${d}/${m}/${y}`;
    }
    return String(value);
};

/**
 * Exports an array of data to a PDF file.
 * @param data The array of data objects.
 * @param columns The column definitions.
 * @param fileName The desired file name without extension.
 * @param title The title to be displayed at the top of the PDF.
 */
export const exportToPdf = <T,>(data: T[], columns: ExportColumn<T>[], fileName: string, title: string) => {
  try {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
    });
    
    doc.text(title, 14, 15);
    
    const head = [columns.map(c => c.header)];
    const body = data.map(row => columns.map(col => {
        const value = col.accessor(row);
        // Apply PDF-specific formatting
        return formatForPdfDisplay(value);
    }));
    
    doc.autoTable({
      head,
      body,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175] }, // primary color
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    
    doc.save(`${fileName}.pdf`);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    alert("Hubo un error al generar el archivo PDF. Verifique la consola para más detalles.");
  }
};

interface MultiSheetExcelExportParams {
  sheets: {
    sheetName: string;
    data: any[];
    columns: ExportColumn<any>[];
  }[];
  fileName: string;
}

export const exportMultiSheetExcel = (params: MultiSheetExcelExportParams) => {
  try {
    const { sheets, fileName } = params;
    const wb = XLSX.utils.book_new();
    sheets.forEach(({ sheetName, data, columns }) => {
      const ws = createStyledSheet(data, columns);
      XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Sheet names can't be longer than 31 chars
    });
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } catch (error) {
    console.error("Error exporting multi-sheet Excel:", error);
    alert("Hubo un error al generar el archivo Excel. Verifique la consola para más detalles.");
  }
};


interface MultiTablePdfExportParams<T> {
  tables: {
    title: string;
    data: T[];
    columns: ExportColumn<T>[];
  }[];
  fileName: string;
  mainTitle: string;
}

export const exportMultiTablePdf = <T,>(params: MultiTablePdfExportParams<T>) => {
    try {
        const { tables, fileName, mainTitle } = params;
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        
        doc.text(mainTitle, 14, 15);
        
        let startY = 25;

        tables.forEach(({ title, data, columns }) => {
            if (data.length > 0) {
                doc.setFontSize(12);
                doc.text(title, 14, startY);
                startY += 5;

                const head = [columns.map(c => c.header)];
                const body = data.map(row => columns.map(col => String(col.accessor(row) ?? '')));

                doc.autoTable({
                    head,
                    body,
                    startY,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [30, 64, 175] },
                });
                
                startY = doc.autoTable.previous.finalY + 15;
            }
        });

        doc.save(`${fileName}.pdf`);
    } catch (error) {
        console.error("Error exporting multi-table PDF:", error);
        alert("Hubo un error al generar el archivo PDF. Verifique la consola para más detalles.");
    }
};
