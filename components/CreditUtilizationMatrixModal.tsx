import React, { useState, useMemo } from 'react';
import CreditUtilizationMatrix from './CreditUtilizationMatrix';
import { XIcon } from './Icons';
import { useFinancialCalculations } from '../utils/calculations';
import { useAppContext } from '../App';
import CreditLineModal from './CreditLineModal';
import type { Bank } from '../types';

interface CreditUtilizationMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreditUtilizationMatrixModal: React.FC<CreditUtilizationMatrixModalProps> = ({ isOpen, onClose }) => {
  const { dispatch } = useAppContext();
  const { banks, debtTypes, currencies } = useFinancialCalculations();
  const [editingBankId, setEditingBankId] = useState<string | null>(null);

  const handleUpdateBank = (bank: Bank) => {
    dispatch({ type: 'SET_STATE', payload: { banks: banks.map(b => b.id === bank.id ? bank : b) }});
  };
  
  const editingBank = useMemo(() => {
    return banks.find(b => b.id === editingBankId) || null;
  }, [editingBankId, banks]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl m-4 h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Utilización de Líneas de Crédito (USD)</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
          </div>
          <div className="p-6 flex-grow overflow-y-auto">
            <CreditUtilizationMatrix onEditBank={setEditingBankId} />
          </div>
          <div className="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
            <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 font-bold py-2 px-4 rounded-lg">Cerrar</button>
          </div>
        </div>
      </div>
      {editingBank && (
        <CreditLineModal
          bank={editingBank}
          onClose={() => setEditingBankId(null)}
          onUpdateBank={handleUpdateBank}
          debtTypes={debtTypes.filter(dt => dt.category === 'bancaria')}
          currencies={currencies}
        />
      )}
    </>
  );
};

export default CreditUtilizationMatrixModal;
