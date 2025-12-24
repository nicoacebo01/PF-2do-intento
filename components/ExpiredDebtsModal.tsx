import React, { useMemo, useCallback } from 'react';
import type { Debt } from '../types';
import { Currency as CurrencyEnum } from '../types';
import DebtList from './DebtList';
import { XIcon } from './Icons';
import { useAppContext } from '../App';
import { useFinancialCalculations } from '../utils/calculations';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { formatPercentageForDisplay } from '../utils/formatting';


interface ExpiredDebtsModalProps {
  debts: Debt[];
  onClose: () => void;
}

const ExpiredDebtsModal: React.FC<ExpiredDebtsModalProps> = ({
  debts,
  onClose,
}) => {
  const { state } = useAppContext();
  const { viewMode, companies } = state;
  const { banks, brokers, companyDebtCalculations } = useFinancialCalculations();

  const getCounterpartyName = useCallback((debt: Debt) => {
    if (debt.bankId) return banks.find(b => b.id === debt.bankId)?.name || 'N/D';
    if (debt.brokerId) return brokers.find(b => b.id === debt.brokerId)?.name || 'N/D';
    return 'N/A';
  }, [banks, brokers]);

  const getCftDisplay = useCallback((debt: Debt) => {
    const calcs = companyDebtCalculations.get(debt.id);
    if (!calcs) return null;
    return calcs.financials.cft;
  }, [companyDebtCalculations]);

  const getUsdCftDisplay = useCallback((debt: Debt) => {
    const calcs = companyDebtCalculations.get(debt.id);
    if (!calcs) return null;
    if (debt.currency === CurrencyEnum.USD) {
      return calcs.financials.cft;
    }
    return calcs.usdAnalysis?.usd_cft;
  }, [companyDebtCalculations]);

  const exportColumns: ExportColumn<Debt>[] = useMemo(() => {
    const columns: ExportColumn<Debt>[] = [
      { header: 'Tipo', accessor: d => d.type },
      { header: 'Contraparte', accessor: d => getCounterpartyName(d) },
      { header: 'Monto', accessor: d => d.amount.toLocaleString('es-AR') },
      { header: 'Moneda', accessor: d => d.currency },
      { header: 'Fecha Cancelación', accessor: d => {
          const date = d.actualCancellationDate || d.dueDate;
          if (!date) return '';
          const [year, month, day] = date.split('-');
          return `${day}-${month}-${year}`;
      }},
      { header: 'CFT (Moneda) %', accessor: d => formatPercentageForDisplay(getCftDisplay(d)) },
      { header: 'CFT (USD) %', accessor: d => formatPercentageForDisplay(getUsdCftDisplay(d)) },
    ];

    if (viewMode === 'consolidated') {
      columns.unshift({ header: 'Empresa', accessor: d => companies.find(c => c.id === d.companyId)?.name || 'N/D' });
    }
    
    return columns;
  }, [getCounterpartyName, getCftDisplay, getUsdCftDisplay, viewMode, companies]);


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl m-4 animate-fade-in-down max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Archivo de Deudas Vencidas</h2>
          <div className="flex items-center gap-4">
            <ExportButtons
              data={debts}
              columns={exportColumns}
              fileName="deudas_vencidas"
              pdfTitle="Archivo de Deudas Vencidas"
            />
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100">
              <XIcon />
            </button>
          </div>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          <DebtList
            debts={debts}
            isArchiveView={true}
          />
        </div>
        <div className="flex justify-end p-6 border-t dark:border-gray-700">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-bold py-2 px-4 rounded-lg">
            Cerrar
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in-down { 0% { opacity: 0; transform: translateY(-20px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ExpiredDebtsModal;