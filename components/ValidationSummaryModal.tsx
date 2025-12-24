// This is a new file: components/ValidationSummaryModal.tsx
import React from 'react';
import type { Debt, Investment, ArbitrageOperation } from '../types';
import { XIcon } from './Icons';

interface ValidationError {
  row: number;
  sheet: string;
  message: string;
}

export interface ValidationResult {
  debts: Debt[];
  investments: Investment[];
  arbitrages: ArbitrageOperation[];
  errors: ValidationError[];
}

interface ValidationSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (validData: { debts: Debt[], investments: Investment[], arbitrages: ArbitrageOperation[] }) => void;
  result: ValidationResult | null;
}

const ValidationSummaryModal: React.FC<ValidationSummaryModalProps> = ({ isOpen, onClose, onConfirm, result }) => {
  if (!isOpen || !result) return null;

  const { debts, investments, arbitrages, errors } = result;

  const handleConfirm = () => {
    onConfirm({ debts, investments, arbitrages });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Resumen de Importación</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"><XIcon /></button>
        </div>
        <div className="p-6 flex-grow overflow-y-auto space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Datos Válidos Encontrados</h3>
            <p className="text-green-600 dark:text-green-400 mt-2">{debts.length} Deudas serán importadas.</p>
            <p className="text-green-600 dark:text-green-400">{investments.length} Carteras de Inversión (con sus transacciones) serán importadas.</p>
            <p className="text-green-600 dark:text-green-400">{arbitrages.length} Operaciones de Arbitraje serán importadas.</p>
          </div>
          {errors.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-500">{errors.length} Filas con Errores (serán ignoradas)</h3>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md max-h-48 overflow-y-auto">
                {errors.slice(0, 10).map((err, i) => (
                  <li key={i}>
                    <span className="font-semibold">Fila {err.row} ({err.sheet}):</span> {err.message}
                  </li>
                ))}
                 {errors.length > 10 && <li>...y {errors.length - 10} más errores.</li>}
              </ul>
            </div>
          )}
          {errors.length === 0 && debts.length === 0 && investments.length === 0 && arbitrages.length === 0 ? (
             <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-md">
                No se encontraron datos válidos para importar en el archivo.
            </div>
          ) : errors.length === 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md">
                  ¡Excelente! No se encontraron errores en el archivo.
              </div>
          )}

          <p className="pt-4 border-t dark:border-gray-600 text-gray-800 dark:text-gray-200">
            ¿Desea continuar e importar los datos válidos?
          </p>
        </div>
        <div className="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 gap-4">
            <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 dark:text-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 font-bold py-2 px-6 rounded-lg">Cancelar</button>
            <button 
              onClick={handleConfirm}
              disabled={debts.length === 0 && investments.length === 0 && arbitrages.length === 0}
              className="bg-primary hover:bg-secondary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Confirmar e Importar
            </button>
        </div>
      </div>
    </div>
  );
};

export default ValidationSummaryModal;