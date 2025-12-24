import React, { useMemo } from 'react';
import type { GroupedHolding, Company } from '../types';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { formatDateForExport, formatNumberForExport, formatPercentageForExport } from '../utils/formatting';
import { formatPercentageForDisplay } from '../utils/formatting';

interface InvestmentSummaryTableProps {
  holdings: GroupedHolding[];
  totalMarketValueUSD: number;
  viewMode: 'individual' | 'consolidated';
  companies: Company[];
}

const InvestmentSummaryTable: React.FC<InvestmentSummaryTableProps> = ({ holdings, totalMarketValueUSD, viewMode, companies }) => {

  if (holdings.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">Resumen de Cartera por Liquidez</h2>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No hay datos de inversión para mostrar.</p>
        </div>
      </div>
    );
  }

  const formatUSD = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const safeFormatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'Líquida';
    const date = new Date(dateString + 'T00:00:00Z');
    return date.toLocaleDateString('es-AR', { timeZone: 'UTC' });
  };
  
  const exportColumns: ExportColumn<GroupedHolding>[] = useMemo(() => {
    const columns: ExportColumn<GroupedHolding>[] = [
        { header: 'Instrumento', accessor: d => d.instrumentName },
        { header: 'Valor de Mercado (USD)', accessor: d => formatNumberForExport(d.marketValueUSD) },
        { header: 'Resultado (USD)', accessor: d => formatNumberForExport(d.totalPL_USD + d.arbitragePL_USD) },
        { header: 'TNA (%)', accessor: d => formatPercentageForExport(d.tea_total_USD) },
        { header: 'Vencimiento', accessor: d => formatDateForExport(d.maturityDate) },
    ];

    if (viewMode === 'consolidated') {
        columns.unshift({ header: 'Empresa', accessor: d => companies.find(c => c.id === d.companyId)?.name || 'N/D' });
    }
    return columns;
  }, [viewMode, companies]);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">Resumen de Cartera por Liquidez</h2>
        <ExportButtons
            data={holdings}
            columns={exportColumns}
            fileName="resumen_cartera_liquidez"
            pdfTitle="Resumen de Cartera por Liquidez"
        />
      </div>
      <div className="overflow-x-auto max-h-96">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
            <tr>
              {viewMode === 'consolidated' && (
                <th className="p-2 text-left font-semibold text-gray-600 dark:text-gray-300">Empresa</th>
              )}
              <th className="p-2 text-left font-semibold text-gray-600 dark:text-gray-300">Instrumento</th>
              <th className="p-2 text-right font-semibold text-gray-600 dark:text-gray-300">Valor de Mercado (USD)</th>
              <th className="p-2 text-right font-semibold text-gray-600 dark:text-gray-300">Resultado (USD)</th>
              <th className="p-2 text-right font-semibold text-gray-600 dark:text-gray-300">TNA (%)</th>
              <th className="p-2 text-center font-semibold text-gray-600 dark:text-gray-300">Vencimiento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {holdings.map(holding => {
              const totalResultUSD = holding.totalPL_USD + holding.arbitragePL_USD;
              return (
                <tr key={holding.instrumentId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  {viewMode === 'consolidated' && (
                    <td className="p-2 font-medium text-gray-800 dark:text-gray-200">
                      {companies.find(c => c.id === holding.companyId)?.name || 'N/D'}
                    </td>
                  )}
                  <td className="p-2 font-medium">{holding.instrumentName}</td>
                  <td className="p-2 text-right font-semibold text-gray-800 dark:text-gray-200">
                    {formatUSD(holding.marketValueUSD)}
                  </td>
                  <td className={`p-2 text-right font-semibold ${totalResultUSD >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-500'}`}>
                    {formatUSD(totalResultUSD)}
                  </td>
                  <td className={`p-2 text-right font-semibold ${holding.tea_total_USD >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-500'}`}>
                    {formatPercentageForDisplay(holding.tea_total_USD)}
                  </td>
                  <td className="p-2 text-center">
                    {safeFormatDate(holding.maturityDate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
              <td className="p-2 font-bold text-right" colSpan={viewMode === 'consolidated' ? 2 : 1}>Total</td>
              <td className="p-2 text-right font-bold text-primary dark:text-accent-dm">
                {formatUSD(totalMarketValueUSD)}
              </td>
              <td colSpan={3} className="p-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default InvestmentSummaryTable;