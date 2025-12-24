import React from 'react';
import type { DebtType } from '../types';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { formatPercentageForDisplay } from '../utils/formatting';

interface HistoricalDebtLogProps {
  logData: any[];
  debtTypes: DebtType[];
}

const HistoricalDebtLog: React.FC<HistoricalDebtLogProps> = ({ logData, debtTypes }) => {
  if (logData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No hay datos históricos suficientes para generar el registro.</p>
        <p className="text-sm">Asegúrese de tener deudas y tipos de cambio registrados.</p>
      </div>
    );
  }

  const formatUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const exportColumns: ExportColumn<typeof logData[0]>[] = [
    { header: 'Fecha', accessor: (d) => d.date },
    { header: 'Stock Total (USD)', accessor: (d) => d.totalDebtStockUSD },
    { header: 'CFT Prom. Total (%)', accessor: (d) => d.overallWeightedCft },
    ...debtTypes.flatMap(dt => [
        { header: `${dt.name} - Stock (USD)`, accessor: (d: any) => d[dt.name]?.stock || 0 },
        { header: `${dt.name} - CFT Prom. (%)`, accessor: (d: any) => d[dt.name]?.weightedCft || 0 }
    ])
  ];
  
  return (
    <div>
        <div className="flex justify-end mb-4">
            <ExportButtons 
                data={logData}
                columns={exportColumns}
                fileName="registro_historico_deuda"
                pdfTitle="Registro Histórico de Deuda"
            />
        </div>
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-[600px]">
        <table className="min-w-full text-sm border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
                <th className="p-2 border-b border-r dark:border-gray-600 text-left font-semibold text-gray-700 dark:text-gray-200 sticky left-0 bg-gray-100 dark:bg-gray-700" rowSpan={2}>Fecha</th>
                <th className="p-2 border-b border-r dark:border-gray-600 text-center font-semibold text-gray-700 dark:text-gray-200" colSpan={2}>Total General</th>
                {debtTypes.map(dt => (
                <th key={dt.id} className="p-2 border-b border-r dark:border-gray-600 text-center font-semibold text-gray-700 dark:text-gray-200" colSpan={2}>{dt.name}</th>
                ))}
            </tr>
            <tr>
                <th className="p-1 border-b border-r dark:border-gray-600 font-medium text-xs text-gray-600 dark:text-gray-300">Stock (USD)</th>
                <th className="p-1 border-b border-r dark:border-gray-600 font-medium text-xs text-gray-600 dark:text-gray-300">CFT Prom.</th>
                {debtTypes.map(dt => (
                <React.Fragment key={`${dt.id}-sub`}>
                    <th className="p-1 border-b border-r dark:border-gray-600 font-medium text-xs text-gray-600 dark:text-gray-300">Stock (USD)</th>
                    <th className="p-1 border-b border-r dark:border-gray-600 font-medium text-xs text-gray-600 dark:text-gray-300">CFT Prom.</th>
                </React.Fragment>
                ))}
            </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800">
            {logData.map(logEntry => (
                <tr key={logEntry.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="p-2 border-b border-r dark:border-gray-600 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {new Date(logEntry.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                </td>
                <td className="p-2 border-b border-r dark:border-gray-600 text-right text-gray-900 dark:text-gray-100 font-semibold">{formatUSD(logEntry.totalDebtStockUSD)}</td>
                <td className="p-2 border-b border-r dark:border-gray-600 text-right text-blue-800 dark:text-blue-400 font-semibold">{formatPercentageForDisplay(logEntry.overallWeightedCft)}</td>
                {debtTypes.map(dt => {
                    const typeData = logEntry[dt.name] || { stock: 0, weightedCft: 0 };
                    return (
                        <React.Fragment key={`${dt.id}-data`}>
                            <td className="p-2 border-b border-r dark:border-gray-600 text-right text-gray-700 dark:text-gray-300">{typeData.stock > 0 ? formatUSD(typeData.stock) : '-'}</td>
                            <td className="p-2 border-b border-r dark:border-gray-600 text-right text-gray-600 dark:text-gray-400">{typeData.stock > 0 ? formatPercentageForDisplay(typeData.weightedCft) : '-'}</td>
                        </React.Fragment>
                    )
                })}
                </tr>
            ))}
            </tbody>
        </table>
        </div>
    </div>
  );
};

export default HistoricalDebtLog;