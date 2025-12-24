import React from 'react';
import type { Investment, Transaction, Broker, Bank, InvestmentType, AppCurrency } from '../types';
import { Currency } from '../types';
import { XIcon } from './Icons';

interface InvestmentDetailModalProps {
  investment: Investment;
  transaction: Transaction;
  brokers: Broker[];
  banks: Bank[];
  investmentTypes: InvestmentType[];
  currencies: AppCurrency[];
  onClose: () => void;
}

const InvestmentDetailModal: React.FC<InvestmentDetailModalProps> = ({ investment, transaction, brokers, banks, investmentTypes, currencies, onClose }) => {
  // FIX: Get counterparty from the transaction, not the investment object.
  const getCounterpartyName = (tx: Transaction) => {
    if (tx.bankId) return banks.find(b => b.id === tx.bankId)?.name || 'N/D';
    if (tx.brokerId) return brokers.find(b => b.id === tx.brokerId)?.name || 'N/D';
    return 'N/A';
  };

  const getTypeName = (inv: Investment) => {
    return investmentTypes.find(it => it.id === inv.investmentTypeId)?.name || 'N/D';
  };

  const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}:</span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 text-right">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg m-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Detalle de Inversión Vinculada</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"><XIcon /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 border-b dark:border-gray-600 pb-1 mb-2">Instrumento</h3>
            <DetailItem label="Nombre" value={investment.instrumentName.toUpperCase()} />
            <DetailItem label="Tipo" value={getTypeName(investment)} />
            {/* FIX: Pass the transaction object to get the correct counterparty name. */}
            <DetailItem label="Contraparte" value={getCounterpartyName(transaction)} />
            <DetailItem label="Moneda" value={investment.currency} />
          </div>

          <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-200 border-b dark:border-gray-600 pb-1 mb-2">Transacción Vinculada</h3>
            <DetailItem label="Fecha" value={new Date(transaction.date + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' })} />
            <DetailItem label="Tipo" value={transaction.type} />
            <DetailItem label="Cantidad (Nominales)" value={transaction.quantity.toLocaleString('es-AR')} />
            <DetailItem label="Precio" value={transaction.price.toLocaleString('es-AR')} />
            {investment.currency === Currency.ARS && <DetailItem label="TC del Día" value={transaction.exchangeRate.toLocaleString('es-AR')} />}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-bold py-2 px-4 rounded-lg">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default InvestmentDetailModal;
