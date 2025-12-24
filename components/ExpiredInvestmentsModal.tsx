import React from 'react';
import type { GroupedHolding, Transaction, InvestmentGroup } from '../types';
import InvestmentList from './InvestmentList';
import { XIcon } from './Icons';

interface ExpiredInvestmentsModalProps {
  holdings: GroupedHolding[];
  onClose: () => void;
  onStartEdit: (investmentId: string, transaction: Transaction) => void;
  onDeleteTransaction: (investmentId: string, transactionId: string) => void;
}

const ExpiredInvestmentsModal: React.FC<ExpiredInvestmentsModalProps> = ({ holdings, onClose, onStartEdit, onDeleteTransaction }) => {
  const expiredGroups: InvestmentGroup[] = holdings.length > 0 ? [{
    groupName: "Archivo de Inversiones",
    holdings: holdings,
    totalMarketValueUSD: holdings.reduce((sum, h) => sum + h.marketValueUSD, 0)
  }] : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl m-4 animate-fade-in-down max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Archivo de Inversiones Vencidas</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <XIcon />
          </button>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          <InvestmentList
            groups={expiredGroups}
            onStartEdit={onStartEdit}
            onDeleteTransaction={onDeleteTransaction}
            isArchiveView={true}
          />
        </div>
        <div className="flex justify-end p-6 border-t">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">
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

export default ExpiredInvestmentsModal;