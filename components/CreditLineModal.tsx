import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Bank, CreditLine, DebtType, AppCurrency } from '../types';
import { Currency } from '../types';
import { PlusCircleIcon, PencilIcon, XIcon, TrashIcon } from './Icons';
import FormattedNumberInput from './FormattedNumberInput';
import { useAppContext } from '../App';

interface CreditLineModalProps {
  bank: Bank;
  onClose: () => void;
  onUpdateBank: (bank: Bank) => void;
  debtTypes: DebtType[];
  currencies: AppCurrency[];
}

const CreditLineModal: React.FC<CreditLineModalProps> = ({ bank, onClose, onUpdateBank, debtTypes, currencies }) => {
  const { state } = useAppContext();
  const { selectedCompanyId } = state;
  const [debtType, setDebtType] = useState<string>(debtTypes[0]?.name || '');
  const [currency, setCurrency] = useState<Currency>(Currency.ARS);
  const [currencySubtypeId, setCurrencySubtypeId] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [editingLine, setEditingLine] = useState<CreditLine | null>(null);

  const isEditing = !!editingLine;
  
  const selectedDebtTypeDetails = useMemo(() => debtTypes.find(dt => dt.name === debtType), [debtType, debtTypes]);
  const selectedCurrencyDetails = useMemo(() => currencies.find(c => c.id === currency), [currency, currencies]);

  const relevantCreditLines = useMemo(() => {
    if (!selectedCompanyId) return [];
    return bank.creditLines.filter(line => line.companyId === selectedCompanyId);
  }, [bank.creditLines, selectedCompanyId]);

  const resetForm = useCallback(() => {
    setDebtType(debtTypes[0]?.name || '');
    setCurrency(Currency.ARS);
    setCurrencySubtypeId('');
    setAmount('');
    setEditingLine(null);
  }, [debtTypes]);

  useEffect(() => {
    if (debtTypes.length > 0 && !debtType) {
      setDebtType(debtTypes[0].name)
    }
  }, [debtTypes, debtType]);
  
  useEffect(() => {
    if (selectedDebtTypeDetails && !selectedDebtTypeDetails.allowedCurrencies.includes(currency)) {
      setCurrency(selectedDebtTypeDetails.allowedCurrencies[0] || Currency.ARS);
    }
  }, [debtType, currency, selectedDebtTypeDetails]);
  
  useEffect(() => {
    if (selectedCurrencyDetails && selectedCurrencyDetails.subtypes.length > 0) {
      if (!selectedCurrencyDetails.subtypes.find(st => st.id === currencySubtypeId)) {
        setCurrencySubtypeId(selectedCurrencyDetails.subtypes[0].id);
      }
    } else {
      setCurrencySubtypeId('');
    }
  }, [currency, selectedCurrencyDetails, currencySubtypeId]);


  const handleStartEdit = (line: CreditLine) => {
    setEditingLine(line);
    setDebtType(line.debtType);
    setCurrency(line.currency);
    setCurrencySubtypeId(line.currencySubtypeId || '');
    setAmount(line.amount);
  };

  const handleSaveLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !debtType) return;

    let updatedLines;
    if (isEditing && editingLine) {
      updatedLines = bank.creditLines.map(line =>
        line.id === editingLine.id
          ? { ...line, debtType, currency, currencySubtypeId: currencySubtypeId || undefined, amount: Number(amount) }
          : line
      );
    } else {
      if (!selectedCompanyId) {
        alert("No se ha seleccionado una empresa. No se puede guardar la línea de crédito.");
        return;
      }
      const newLine: CreditLine = {
        id: crypto.randomUUID(),
        companyId: selectedCompanyId,
        debtType,
        currency,
        currencySubtypeId: currencySubtypeId || undefined,
        amount: Number(amount),
      };
      updatedLines = [...bank.creditLines, newLine];
    }
    
    onUpdateBank({ ...bank, creditLines: updatedLines });
    resetForm();
  };
  
  const handleDeleteLine = (lineId: string) => {
      onUpdateBank({ ...bank, creditLines: bank.creditLines.filter(line => line.id !== lineId) });
  };

  const getSubtypeName = (line: CreditLine) => {
      if (!line.currencySubtypeId) return '';
      const c = currencies.find(curr => curr.id === line.currency);
      const st = c?.subtypes.find(sub => sub.id === line.currencySubtypeId);
      return st ? `(${st.name})` : '';
  };
  
  const commonSelectClass = "mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600";


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-3xl m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Gestionar Líneas de Crédito: {bank.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"><XIcon /></button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 border-b dark:border-gray-700 pb-2">{isEditing ? 'Editar Línea de Crédito' : 'Agregar Nueva Línea'}</h3>
                 <form onSubmit={handleSaveLine} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Deuda</label>
                        <select value={debtType} onChange={e => setDebtType(e.target.value)} className={commonSelectClass} required>
                            <option value="" disabled>Seleccione un tipo</option>
                            {debtTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Moneda</label>
                            <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={commonSelectClass}>
                                {(selectedDebtTypeDetails?.allowedCurrencies || Object.values(Currency)).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Monto Límite</label>
                            <FormattedNumberInput value={amount} onChange={setAmount} placeholder="500000" className="mt-1" required />
                        </div>
                    </div>
                    {selectedCurrencyDetails && selectedCurrencyDetails.subtypes.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subtipo</label>
                            <select value={currencySubtypeId} onChange={e => setCurrencySubtypeId(e.target.value)} className={commonSelectClass} required>
                                <option value="" disabled>Seleccione un subtipo</option>
                                {selectedCurrencyDetails.subtypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex items-center gap-2 pt-2">
                        <button type="submit" className="flex-grow flex justify-center items-center gap-2 bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">
                            {isEditing ? 'Guardar Cambios' : <><PlusCircleIcon /> Agregar</>}
                        </button>
                        {isEditing && (
                             <button type="button" onClick={resetForm} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-bold py-2 px-4 rounded-lg">
                                Cancelar
                             </button>
                        )}
                    </div>
                 </form>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 border-b dark:border-gray-700 pb-2">Líneas Activas</h3>
                {relevantCreditLines.length > 0 ? (
                    <ul className="space-y-2">
                       {relevantCreditLines.map(line => (
                           <li key={line.id} className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                               <div>
                                   <p className="font-semibold text-gray-800 dark:text-gray-200">{line.debtType} <span className="text-gray-600 dark:text-gray-400 text-sm">{getSubtypeName(line)}</span></p>
                                   <p className="text-sm text-gray-600 dark:text-gray-300">
                                       {line.currency === Currency.USD 
                                           ? `USD ${line.amount.toLocaleString('es-AR')}`
                                           : line.amount.toLocaleString('es-AR', { style: 'currency', currency: line.currency })}
                                   </p>
                               </div>
                               <div className="flex items-center gap-3">
                                   <button onClick={() => handleStartEdit(line)} className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"><PencilIcon /></button>
                                   <button onClick={() => handleDeleteLine(line.id)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"><TrashIcon /></button>
                               </div>
                           </li>
                       ))}
                    </ul>
                ) : <p className="text-gray-500 dark:text-gray-400 text-center mt-8">No hay líneas de crédito definidas para esta empresa.</p>}
            </div>
        </div>

        <div className="mt-6 pt-6 border-t dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Vencimiento General de Líneas</h3>
            <div>
                <label htmlFor="creditLinesDueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Fecha de Vencimiento de Referencia
                </label>
                <input
                type="date"
                id="creditLinesDueDate"
                value={bank.creditLinesDueDate || ''}
                onChange={(e) => onUpdateBank({ ...bank, creditLinesDueDate: e.target.value || undefined })}
                className="mt-1 block w-full max-w-xs border border-gray-300 rounded-md py-2 px-3 bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Esta fecha es de referencia para todas las líneas de crédito de este banco.
                </p>
            </div>
        </div>

        <div className="flex justify-end mt-8">
            <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-bold py-2 px-4 rounded-lg">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default CreditLineModal;