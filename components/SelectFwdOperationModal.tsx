// This is a new file: components/SelectFwdOperationModal.tsx
import React, { useState } from 'react';
import type { ArbitrageOperation, BusinessUnit } from '../types';
import { XIcon } from './Icons';
import { useAppContext } from '../App';

interface SelectFwdOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateOperations: ArbitrageOperation[];
  businessUnits: BusinessUnit[];
}

const SelectFwdOperationModal: React.FC<SelectFwdOperationModalProps> = ({ isOpen, onClose, candidateOperations, businessUnits }) => {
  const { dispatch } = useAppContext();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    if (selectedIds.size > 0) {
      dispatch({ type: 'ADD_FWD_OPERATIONS', payload: Array.from(selectedIds) });
    }
    onClose();
  };

  if (!isOpen) return null;

  const getBusinessUnitName = (id?: string) => {
    if (!id) return 'N/A';
    return businessUnits.find(bu => bu.id === id)?.name || 'N/D';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl m-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Seleccionar Operaciones para FWD Pesificados</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          {candidateOperations.length > 0 ? (
            <div className="space-y-2">
              {candidateOperations.map(op => (
                <div key={op.id} className="flex items-center gap-4 p-3 border rounded-md dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(op.id)}
                    onChange={() => handleToggle(op.id)}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-grow grid grid-cols-5 gap-2 text-sm">
                    <div><span className="font-semibold">{op.instrument} {op.position}</span></div>
                    <div><span className="text-gray-500 dark:text-gray-400">Monto:</span> {op.usdAmount.toLocaleString('es-AR')} USD</div>
                    <div><span className="text-gray-500 dark:text-gray-400">Vto:</span> {new Date(op.arbitrageDate + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' })}</div>
                    <div><span className="text-gray-500 dark:text-gray-400">TC:</span> {op.arbitrageRate.toLocaleString('es-AR')}</div>
                    <div><span className="text-gray-500 dark:text-gray-400">U.N.:</span> {getBusinessUnitName(op.businessUnitId)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No hay nuevas operaciones de arbitraje elegibles para agregar.</p>
          )}
        </div>
        <div className="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 gap-4">
          <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-lg">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="bg-primary hover:bg-secondary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400"
          >
            Agregar Seleccionadas ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectFwdOperationModal;
