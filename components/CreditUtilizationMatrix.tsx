import React, { useMemo } from 'react';
import type { Bank, Debt, DebtType } from '../types';
import { Currency } from '../types';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { useAppContext } from '../App';
import { useFinancialCalculations, selectActiveAndExpiredDebts } from '../utils/calculations';
import { PencilIcon } from './Icons';

const formatUSD = (value: number) => {
    if (Math.abs(value) < 10000) {
        return `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    const millions = value / 1000000;
    return `USD ${millions.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}MM`;
}

type ExportData = {
    bankName: string;
    debtType: string;
    line: number;
    used: number;
    available: number;
};

interface CreditUtilizationMatrixProps {
  onEditBank: (bankId: string) => void;
}

const CreditUtilizationMatrix: React.FC<CreditUtilizationMatrixProps> = ({ onEditBank }) => {
  const { banks, debtTypes, companyDebts, latestRate } = useFinancialCalculations();
  const { state } = useAppContext();
  const { viewMode, selectedCompanyId, selectedConsolidatedCompanyIds } = state;

  const { activeDebts } = useMemo(() => selectActiveAndExpiredDebts(companyDebts), [companyDebts]);

  const { orderedDebtTypes, matrixData } = useMemo(() => {
    const companyIds = new Set(viewMode === 'individual' ? (selectedCompanyId ? [selectedCompanyId] : []) : selectedConsolidatedCompanyIds);
    const preferredOrder = ["Préstamo", "Tarjeta Rural", "Descuento de Cheques", "Leasing", "Pagaré Bursátil"];
    const ordered = [...debtTypes].sort((a, b) => {
      const indexA = preferredOrder.indexOf(a.name);
      const indexB = preferredOrder.indexOf(b.name);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    const matrix: Record<string, Record<string, { line: number; used: number; available: number }>> = {};
    
    banks.forEach(bank => {
      matrix[bank.id] = {};
      ordered.forEach(dt => {
        const linesForCell = bank.creditLines.filter(line => companyIds.has(line.companyId) && line.debtType === dt.name);
        const lineAmountUSD = linesForCell.reduce((sum, line) => {
          return sum + (line.currency === Currency.USD ? line.amount : line.amount / latestRate);
        }, 0);

        const debtsForCell = activeDebts.filter(d => d.bankId === bank.id && d.type === dt.name);
        const usedAmountUSD = debtsForCell.reduce((sum, debt) => {
          const principalAmount = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
          return sum + (debt.currency === Currency.USD ? principalAmount : principalAmount / latestRate);
        }, 0);

        matrix[bank.id][dt.name] = {
          line: lineAmountUSD,
          used: usedAmountUSD,
          available: lineAmountUSD - usedAmountUSD,
        };
      });
    });

    return { orderedDebtTypes: ordered, matrixData: matrix };
  }, [banks, activeDebts, debtTypes, latestRate, viewMode, selectedCompanyId, selectedConsolidatedCompanyIds]);

  const exportData = useMemo((): ExportData[] => {
    const flatData: ExportData[] = [];
    banks.forEach(bank => {
        orderedDebtTypes.forEach(dt => {
            const cell = matrixData[bank.id]?.[dt.name];
            if (cell && (cell.line > 0 || cell.used > 0)) {
                flatData.push({
                    bankName: bank.name,
                    debtType: dt.name,
                    ...cell
                });
            }
        });
    });
    return flatData;
  }, [banks, orderedDebtTypes, matrixData]);

  const exportColumns: ExportColumn<ExportData>[] = [
      { header: 'Banco', accessor: d => d.bankName },
      { header: 'Tipo de Deuda', accessor: d => d.debtType },
      { header: 'Línea (USD)', accessor: d => d.line },
      { header: 'Utilizado (USD)', accessor: d => d.used },
      { header: 'Disponible (USD)', accessor: d => d.available },
  ];

  if (banks.length === 0 || debtTypes.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400"><p>Se necesitan bancos y tipos de préstamo para generar la matriz.</p></div>
  }

  // Calculate totals
  const bankTotals = banks.map(bank => {
    return orderedDebtTypes.reduce((total, dt) => {
      const cell = matrixData[bank.id]?.[dt.name] || { line: 0, used: 0, available: 0 };
      total.line += cell.line;
      total.used += cell.used;
      total.available += cell.available;
      return total;
    }, { line: 0, used: 0, available: 0 });
  });

  const typeTotals = orderedDebtTypes.map(dt => {
      return banks.reduce((total, bank) => {
          const cell = matrixData[bank.id]?.[dt.name] || { line: 0, used: 0, available: 0 };
          total.line += cell.line;
          total.used += cell.used;
          total.available += cell.available;
          return total;
      }, { line: 0, used: 0, available: 0 });
  });
  
  const grandTotal = bankTotals.reduce((total, bankTotal) => {
      total.line += bankTotal.line;
      total.used += bankTotal.used;
      total.available += bankTotal.available;
      return total;
  }, { line: 0, used: 0, available: 0 });

  return (
    <>
    <div className="flex justify-end mb-4">
        <ExportButtons
            data={exportData}
            columns={exportColumns}
            fileName="matriz_utilizacion_credito"
            pdfTitle="Matriz de Utilización de Crédito"
        />
    </div>
    <div className="overflow-auto max-h-[600px]">
      <table className="min-w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
        <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-20">
          <tr>
            <th className="p-2 border border-gray-300 dark:border-gray-600 text-left font-semibold text-gray-700 dark:text-gray-200 sticky left-0 bg-gray-100 dark:bg-gray-700 z-30">Banco</th>
            <th className="p-2 border border-gray-300 dark:border-gray-600 text-center font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600" colSpan={3}>Total General</th>
            {orderedDebtTypes.map(dt => (
              <th key={dt.id} className="p-2 border border-gray-300 dark:border-gray-600 text-center font-semibold text-gray-700 dark:text-gray-200" colSpan={3}>{dt.name}</th>
            ))}
          </tr>
          <tr>
            <th className="p-1 border border-gray-300 dark:border-gray-600 sticky left-0 bg-gray-100 dark:bg-gray-700 z-30"></th>
            <React.Fragment>
                <th className="p-1 border border-gray-300 dark:border-gray-600 font-medium text-xs text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-600">Línea</th>
                <th className="p-1 border border-gray-300 dark:border-gray-600 font-medium text-xs text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-600">Utilizado</th>
                <th className="p-1 border border-gray-300 dark:border-gray-600 font-medium text-xs text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-600">Disp.</th>
            </React.Fragment>
            {orderedDebtTypes.map(dt => (
                <React.Fragment key={dt.id}>
                    <th className="p-1 border border-gray-300 dark:border-gray-600 font-medium text-xs text-gray-600 dark:text-gray-300">Línea</th>
                    <th className="p-1 border border-gray-300 dark:border-gray-600 font-medium text-xs text-gray-600 dark:text-gray-300">Utilizado</th>
                    <th className="p-1 border border-gray-300 dark:border-gray-600 font-medium text-xs text-gray-600 dark:text-gray-300">Disp.</th>
                </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800">
          {banks.map((bank, bankIndex) => (
            <tr key={bank.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="p-2 border border-gray-300 dark:border-gray-600 font-semibold sticky left-0 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 z-10 text-gray-900 dark:text-gray-100">
                <div className="flex justify-between items-center">
                  <span>{bank.name}</span>
                  {viewMode === 'individual' && (
                    <button onClick={() => onEditBank(bank.id)} className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50" title="Gestionar líneas de crédito">
                        <PencilIcon />
                    </button>
                  )}
                </div>
              </td>
              <td className="p-2 border border-gray-300 dark:border-gray-600 text-right bg-gray-100 dark:bg-gray-700 text-black dark:text-white font-bold">{formatUSD(bankTotals[bankIndex].line)}</td>
              <td className="p-2 border border-gray-300 dark:border-gray-600 text-right bg-gray-100 dark:bg-gray-700 text-black dark:text-white font-bold">{formatUSD(bankTotals[bankIndex].used)}</td>
              <td className={`p-2 border border-gray-300 dark:border-gray-600 text-right bg-gray-100 dark:bg-gray-700 font-bold ${bankTotals[bankIndex].available < 0 ? 'text-red-600 dark:text-red-500' : 'text-green-700 dark:text-green-400'}`}>{formatUSD(bankTotals[bankIndex].available)}</td>
              {orderedDebtTypes.map(dt => {
                  const cell = matrixData[bank.id]?.[dt.name] || {line: 0, used: 0, available: 0};
                  return (
                      <React.Fragment key={dt.id}>
                          <td className="p-2 border border-gray-300 dark:border-gray-600 text-right text-gray-500 dark:text-gray-400">{formatUSD(cell.line)}</td>
                          <td className="p-2 border border-gray-300 dark:border-gray-600 text-right text-gray-800 dark:text-gray-200 font-medium">{formatUSD(cell.used)}</td>
                          <td className={`p-2 border border-gray-300 dark:border-gray-600 text-right font-semibold ${cell.available < 0 ? 'text-red-600 dark:text-red-500' : 'text-green-700 dark:text-green-400'}`}>{formatUSD(cell.available)}</td>
                      </React.Fragment>
                  )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-200 dark:bg-gray-600 font-bold sticky bottom-0">
            <tr>
                <td className="p-2 border border-gray-300 dark:border-gray-600 sticky left-0 bg-gray-200 dark:bg-gray-600 z-10 text-black dark:text-white">Total General</td>
                <td className="p-2 border border-gray-300 dark:border-gray-600 text-right text-black dark:text-white">{formatUSD(grandTotal.line)}</td>
                <td className="p-2 border border-gray-300 dark:border-gray-600 text-right text-black dark:text-white">{formatUSD(grandTotal.used)}</td>
                <td className={`p-2 border border-gray-300 dark:border-gray-600 text-right ${grandTotal.available < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-800 dark:text-green-300'}`}>{formatUSD(grandTotal.available)}</td>
                {orderedDebtTypes.map((dt, typeIndex) => {
                  const total = typeTotals[typeIndex] || {line: 0, used: 0, available: 0};
                  return (
                      <React.Fragment key={dt.id}>
                          <td className="p-2 border border-gray-300 dark:border-gray-600 text-right text-black dark:text-white">{formatUSD(total.line)}</td>
                          <td className="p-2 border border-gray-300 dark:border-gray-600 text-right text-black dark:text-white">{formatUSD(total.used)}</td>
                          <td className={`p-2 border border-gray-300 dark:border-gray-600 text-right ${total.available < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-800 dark:text-green-300'}`}>{formatUSD(total.available)}</td>
                      </React.Fragment>
                  )
              })}
            </tr>
        </tfoot>
      </table>
    </div>
    </>
  );
};

export default CreditUtilizationMatrix;