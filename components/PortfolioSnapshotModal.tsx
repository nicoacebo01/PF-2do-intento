import React from 'react';
import type { ArbitrageOperation } from '../types';
import { XIcon } from './Icons';
import { exportMultiSheetExcel, exportMultiTablePdf } from '../utils/export';
import type { ExportColumn } from '../utils/export';


interface PortfolioSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  snapshotDate: string;
  realizedOps: { op: ArbitrageOperation & { pnl_ars?: number, pnl_usd?: number, rofexRate?: number }; pnlArs: number; pnlUsd: number }[];
  latentOps: { op: ArbitrageOperation & { pnl_ars?: number, pnl_usd?: number, rofexRate?: number }; pnlArs: number; pnlUsd: number }[];
  totals: { ars: number; usd: number };
  renderableColumns: any[];
}

const formatARS = (val: number) => val.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const formatUSD = (val: number) => `USD ${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safeFormatDate = (dateString: string | undefined | null) => {
  if (!dateString) return '-';
  const dateParts = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
  if (isNaN(date.getTime())) {
    return 'Fecha Inválida';
  }
  return date.toLocaleDateString('es-AR', { timeZone: 'UTC' });
};


const PortfolioSnapshotModal: React.FC<PortfolioSnapshotModalProps> = ({ isOpen, onClose, title, snapshotDate, realizedOps, latentOps, totals, renderableColumns }) => {
  if (!isOpen) return null;

  const handleExport = (format: 'excel' | 'pdf') => {
      const realizedData = realizedOps.map(({ op, pnlArs, pnlUsd }) => ({ ...op, pnl_ars: pnlArs, pnl_usd: pnlUsd }));
      const latentData = latentOps.map(({ op, pnlArs, pnlUsd }) => ({ ...op, pnl_ars: pnlArs, pnl_usd: pnlUsd }));

      const columns: ExportColumn<any>[] = renderableColumns.map(col => ({
          header: col.header,
          accessor: (d: any) => col.accessor(d) ?? '',
      }));

      const fileName = `snapshot_acumulado_${snapshotDate}`;
      const mainTitle = `Snapshot Acumulado al ${safeFormatDate(snapshotDate)}`;

      if (format === 'excel') {
          exportMultiSheetExcel({
              fileName,
              sheets: [
                  { sheetName: 'Resultados Realizados', data: realizedData, columns },
                  { sheetName: 'Resultados Latentes', data: latentData, columns },
              ]
          });
      } else {
          exportMultiTablePdf({
              fileName,
              mainTitle,
              tables: [
                  { title: 'Resultados Realizados', data: realizedData, columns },
                  { title: 'Resultados Latentes', data: latentData, columns },
              ]
          });
      }
  };

  const renderTable = (ops: { op: ArbitrageOperation & { pnl_ars?: number, pnl_usd?: number, rofexRate?: number, calculatedCustomData?: any }; pnlArs: number; pnlUsd: number }[]) => {
      
      const opsWithPnl = ops.map(({ op, pnlArs, pnlUsd }) => ({
          ...op,
          pnl_ars: pnlArs,
          pnl_usd: pnlUsd,
      }));

      return (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                {renderableColumns.map(col => (
                  <th key={col.key} className="p-2 text-left font-bold text-gray-700">{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {opsWithPnl.map(op => (
                  <tr key={op.id}>
                      {renderableColumns.map(col => col.render(op))}
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl m-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-500">Foto del portafolio al {safeFormatDate(snapshotDate)}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <button onClick={() => handleExport('excel')} className="text-xs bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-md transition-colors">
                    Exportar a Excel
                </button>
                <button onClick={() => handleExport('pdf')} className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md transition-colors">
                    Exportar a PDF
                </button>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
          </div>
        </div>
        <div className="p-6 flex-grow overflow-y-auto space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Resultados Realizados</h3>
            {realizedOps.length > 0 ? renderTable(realizedOps) : <p className="text-sm text-gray-500 text-center py-4">No hay operaciones realizadas en esta fecha.</p>}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Resultados Latentes</h3>
            {latentOps.length > 0 ? renderTable(latentOps) : <p className="text-sm text-gray-500 text-center py-4">No hay operaciones activas en esta fecha.</p>}
          </div>
        </div>
        <div className="p-6 border-t bg-gray-50 text-right">
            <p className="text-sm font-medium text-gray-600">Total Acumulado en esta Fecha</p>
            <p className={`text-xl font-bold ${totals.ars >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatARS(totals.ars)}</p>
            <p className={`text-md font-semibold ${totals.usd >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatUSD(totals.usd)}</p>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSnapshotModal;
