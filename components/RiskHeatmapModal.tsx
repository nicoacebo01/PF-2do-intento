import React, { useMemo } from 'react';
import type { Debt, DebtType } from '../types';
import { Currency } from '../types';
import RiskHeatmap from './RiskHeatmap';
import { XIcon } from './Icons';
import { useFinancialCalculations } from '../utils/calculations';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';

interface RiskHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts: Debt[];
}

const RiskHeatmapModal: React.FC<RiskHeatmapModalProps> = ({ isOpen, onClose, debts }) => {
  const { banks, brokers, debtTypes, latestRate } = useFinancialCalculations();

  const heatmapData = useMemo(() => {
    if (debts.length === 0) {
        return { matrix: {}, counterparties: [], totalDebt: 0, debtTypesWithDebt: [] };
    }

    const matrix: Record<string, Record<string, number>> = {};
    let totalDebt = 0;
    const debtTypeSet = new Set<string>();

    const allCounterparties = [
        ...banks.map(b => ({ id: b.id, name: b.name, type: 'bank' })),
        ...brokers.map(b => ({ id: b.id, name: b.name, type: 'broker' }))
    ].sort((a,b) => a.name.localeCompare(b.name));

    allCounterparties.forEach(c => matrix[c.name] = {});

    debts.forEach(debt => {
        const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
        const debtUSD = debt.currency === Currency.USD ? principalNative : principalNative / latestRate;
        
        totalDebt += debtUSD;
        debtTypeSet.add(debt.type);

        const counterparty = debt.bankId 
            ? banks.find(b => b.id === debt.bankId) 
            : brokers.find(b => b.id === debt.brokerId);
        
        if (counterparty) {
            if (!matrix[counterparty.name]) matrix[counterparty.name] = {};
            matrix[counterparty.name][debt.type] = (matrix[counterparty.name][debt.type] || 0) + debtUSD;
        }
    });
    
    const counterpartiesWithDebt = allCounterparties.filter(c => 
        Object.values(matrix[c.name] || {}).some(v => v > 0)
    );

    const debtTypesWithDebt = debtTypes.filter(dt => debtTypeSet.has(dt.name));

    return { matrix, counterparties: counterpartiesWithDebt, totalDebt, debtTypesWithDebt };
  }, [debts, banks, brokers, latestRate, debtTypes]);

  const exportData = useMemo(() => {
    if (!heatmapData || heatmapData.totalDebt === 0) return [];
    
    const { matrix, counterparties, totalDebt, debtTypesWithDebt } = heatmapData;

    const flatData: { counterparty: string, debtType: string, amountUSD: number, percentage: number }[] = [];
    
    counterparties.forEach(c => {
        debtTypesWithDebt.forEach(dt => {
            const amount = matrix[c.name]?.[dt.name] || 0;
            if (amount > 0) {
                flatData.push({
                    counterparty: c.name,
                    debtType: dt.name,
                    amountUSD: amount,
                    percentage: (amount / totalDebt) * 100,
                });
            }
        });
    });
    
    return flatData;
  }, [heatmapData]);

  const exportColumns: ExportColumn<typeof exportData[0]>[] = [
      { header: 'Contraparte', accessor: d => d.counterparty },
      { header: 'Tipo de Deuda', accessor: d => d.debtType },
      { header: 'Monto (USD)', accessor: d => d.amountUSD },
      { header: 'Porcentaje Cartera (%)', accessor: d => d.percentage },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl m-4 h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Matriz de Riesgo de Contraparte</h2>
          <div className="flex items-center gap-4">
            <ExportButtons
              data={exportData}
              columns={exportColumns}
              fileName="matriz_riesgo_contraparte"
              pdfTitle="Matriz de Riesgo de Contraparte"
            />
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
          </div>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          <RiskHeatmap heatmapData={heatmapData} debtTypes={heatmapData.debtTypesWithDebt} />
        </div>
        <div className="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 font-bold py-2 px-4 rounded-lg">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default RiskHeatmapModal;