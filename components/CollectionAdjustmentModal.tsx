// This is a new file: components/CollectionAdjustmentModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import type { CollectionAdjustment, GrainCollection, Bank } from '../types';
import { XIcon } from './Icons';
import FormattedNumberInput from './FormattedNumberInput';

interface CollectionAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (adjustments: { [key in CollectionAdjustment['type']]?: number }, bankId: string, collectionIds: string[]) => void;
  date: string;
  buyerName: string;
  totalAmount: number;
  bankBreakdown: { [bankId: string]: { name: string; amount: number } };
  initialAdjustments: CollectionAdjustment[];
  collections: GrainCollection[];
  banks: Bank[];
}

const adjustmentTypes: CollectionAdjustment['type'][] = ['Cheque', 'Compensa', 'Pase a Alyc', 'Ajuste'];

const CollectionAdjustmentModal: React.FC<CollectionAdjustmentModalProps> = ({ isOpen, onClose, onSave, date, buyerName, totalAmount, bankBreakdown, initialAdjustments, collections, banks }) => {
  
  const [adjustments, setAdjustments] = useState<{ [key in CollectionAdjustment['type']]?: number | '' }>({});
  
  const initialBankId = useMemo(() => {
    if (!collections || collections.length === 0) return '';
    const bankIds = new Set(collections.map(c => c.bankAccountId).filter(id => banks.some(b => b.id === id)));
    if (bankIds.size === 1) {
        return bankIds.values().next().value;
    }
    return '';
  }, [collections, banks]);
  
  const [selectedBankId, setSelectedBankId] = useState(initialBankId);

  useEffect(() => {
    const initialValues: { [key in CollectionAdjustment['type']]?: number | '' } = {};
    adjustmentTypes.forEach(type => {
      const adj = initialAdjustments.find(a => a.type === type);
      initialValues[type] = adj ? adj.amount : '';
    });
    setAdjustments(initialValues);
    setSelectedBankId(initialBankId);
  }, [initialAdjustments, initialBankId]);

  const initialBankTransferTotal = useMemo(() => {
    if (!bankBreakdown) return 0;
    // FIX: Add type assertion to resolve 'unknown' type error on `data`.
    return (Object.values(bankBreakdown) as { name: string; amount: number }[]).reduce((sum, data) => sum + data.amount, 0);
  }, [bankBreakdown]);

  const totalAdjusted = useMemo(() => {
    return adjustmentTypes.reduce((sum, type) => sum + (Number(adjustments[type]) || 0), 0);
  }, [adjustments]);
  
  const finalTransferAmount = initialBankTransferTotal - totalAdjusted;

  const adjustedBankBreakdown = useMemo(() => {
    if (initialBankTransferTotal === 0 || !bankBreakdown) return [];
    
    const ratio = finalTransferAmount / initialBankTransferTotal;
    
    // FIX: Add type assertion to resolve 'unknown' type error on `data`.
    return (Object.entries(bankBreakdown) as [string, { name: string; amount: number }][])
        .map(([bankId, data]) => ({
            id: bankId,
            name: data.name,
            amount: data.amount * ratio
        }))
        .filter(b => Math.abs(b.amount) > 0.01)
        .sort((a,b) => b.amount - a.amount);
  }, [finalTransferAmount, initialBankTransferTotal, bankBreakdown]);


  const handleSave = () => {
      const finalAdjustments: { [key in CollectionAdjustment['type']]?: number } = {};
      for (const type of adjustmentTypes) {
          const value = Number(adjustments[type] || 0);
          if (value) {
              finalAdjustments[type] = value;
          }
      }
      onSave(finalAdjustments, selectedBankId, collections.map(c => c.id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg m-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Desglose de Cobranza</h2>
            <p className="text-sm text-gray-500">
                {buyerName === '__DAILY_TOTAL__' ? 'Total del Día' : buyerName} - {new Date(date + 'T00:00:00Z').toLocaleDateString('es-AR')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-baseline p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <span className="font-semibold">Monto Total a Cobrar:</span>
            <span className="text-lg font-bold text-primary dark:text-accent-dm">{totalAmount.toLocaleString('es-AR', {style:'currency', currency:'ARS'})}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adjustmentTypes.map(type => (
              <div key={type}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{type}</label>
                <FormattedNumberInput
                  value={adjustments[type] ?? ''}
                  onChange={v => setAdjustments(prev => ({ ...prev, [type]: v }))}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
          
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-500/50 space-y-2">
            <div className="flex justify-between items-baseline">
                <span className="font-semibold">Total Transferencia Bancaria:</span>
                <span className={`text-lg font-bold ${finalTransferAmount < 0 ? 'text-red-500' : 'text-blue-800 dark:text-blue-300'}`}>
                    {finalTransferAmount.toLocaleString('es-AR', {style:'currency', currency:'ARS'})}
                </span>
            </div>

            {finalTransferAmount > 0 && (
                <div className="pt-2 border-t border-blue-200 dark:border-blue-500/50">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Asignar a Banco</label>
                    <select
                        value={selectedBankId}
                        onChange={e => setSelectedBankId(e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200"
                    >
                        <option value="">-- Seleccionar Banco --</option>
                        {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            )}

            {adjustedBankBreakdown.length > 0 && finalTransferAmount > 0 && (
                <div className="pt-2 border-t border-blue-200 dark:border-blue-500/50 text-xs space-y-1">
                    <p className="font-semibold">Desglose actual:</p>
                    {adjustedBankBreakdown.map(bank => (
                        <div key={bank.id} className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-300">{bank.name}</span>
                            <span className="font-medium text-blue-700 dark:text-blue-400">{bank.amount.toLocaleString('es-AR', {style:'currency', currency:'ARS'})}</span>
                        </div>
                    ))}
                </div>
            )}
          </div>
           {finalTransferAmount < 0 && <p className="text-xs text-red-500 text-center">Advertencia: El total de ajustes supera el monto a cobrar por transferencia.</p>}
        </div>
        
        <div className="flex justify-end gap-4 pt-6 mt-4 border-t dark:border-gray-700">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
          <button onClick={handleSave} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">Guardar Cambios</button>
        </div>
      </div>
    </div>
  );
};

export default CollectionAdjustmentModal;