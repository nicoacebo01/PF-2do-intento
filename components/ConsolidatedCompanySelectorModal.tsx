import React, { useState } from 'react';
import type { Company } from '../types';
import { XIcon } from './Icons';
import { useAppContext } from '../App';

interface ConsolidatedCompanySelectorModalProps {
  isOpen: boolean;
  allCompanies: Company[];
}

const ConsolidatedCompanySelectorModal: React.FC<ConsolidatedCompanySelectorModalProps> = ({
  isOpen,
  allCompanies,
}) => {
  const { state, dispatch } = useAppContext();
  const { selectedConsolidatedCompanyIds } = state;

  const onClose = () => dispatch({ type: 'SET_STATE', payload: { isConsolidatedSelectorOpen: false }});
  const onConfirm = (ids: string[]) => dispatch({ type: 'SET_STATE', payload: { selectedConsolidatedCompanyIds: ids }});

  const [currentSelection, setCurrentSelection] = useState<Set<string>>(new Set(selectedConsolidatedCompanyIds));

  const handleToggle = (companyId: string) => {
    setCurrentSelection(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(companyId)) {
        newSelection.delete(companyId);
      } else {
        newSelection.add(companyId);
      }
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    setCurrentSelection(new Set(allCompanies.map(c => c.id)));
  };

  const handleDeselectAll = () => {
    setCurrentSelection(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(currentSelection));
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg m-4 animate-fade-in-down max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Seleccionar Empresas para Consolidar</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
                <button onClick={handleSelectAll} className="text-sm text-primary hover:underline">Seleccionar Todas</button>
                <span className="text-gray-300">|</span>
                <button onClick={handleDeselectAll} className="text-sm text-primary hover:underline">Deseleccionar Todas</button>
            </div>
            <p className="text-sm text-gray-600">{currentSelection.size} de {allCompanies.length} seleccionadas</p>
          </div>
          <div className="space-y-3">
            {allCompanies.map(company => (
              <div key={company.id} className="relative flex items-start">
                <div className="flex h-6 items-center">
                  <input
                    id={`company-checkbox-${company.id}`}
                    type="checkbox"
                    checked={currentSelection.has(company.id)}
                    onChange={() => handleToggle(company.id)}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="ml-3 text-sm leading-6">
                  <label htmlFor={`company-checkbox-${company.id}`} className="font-medium text-gray-900 cursor-pointer">
                    {company.name}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end p-6 border-t bg-gray-50">
            <div className="flex gap-4">
                <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <button type="button" onClick={handleConfirm} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg">Aplicar Selección</button>
            </div>
        </div>
      </div>
       <style>{`
        @keyframes fade-in-down { 0% { opacity: 0; transform: translateY(-20px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ConsolidatedCompanySelectorModal;