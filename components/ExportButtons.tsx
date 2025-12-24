import React from 'react';
import { exportToExcel, exportToPdf } from '../utils/export';
import type { ExportColumn } from '../utils/export';

// Generic props for reusability
interface ExportButtonsProps<T> {
  data: T[];
  columns: ExportColumn<T>[];
  fileName: string;
  pdfTitle: string;
}

const ExportButtons = <T,>({ data, columns, fileName, pdfTitle }: ExportButtonsProps<T>) => {
  const handleExcelExport = () => {
    exportToExcel(data, columns, fileName);
  };
  
  const handlePdfExport = () => {
    exportToPdf(data, columns, fileName, pdfTitle);
  };

  if (!data || data.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleExcelExport} className="text-xs bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-md transition-colors">
        Exportar a Excel
      </button>
      <button onClick={handlePdfExport} className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md transition-colors">
        Exportar a PDF
      </button>
    </div>
  );
};

export default ExportButtons;
