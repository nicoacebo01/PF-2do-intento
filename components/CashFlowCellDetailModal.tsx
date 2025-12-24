// This is a new file: components/CashFlowCellDetailModal.tsx
import React from 'react';
import { XIcon } from './Icons';

interface DetailItem {
    description: string;
    amount: number;
    currency: string;
    date: string;
}

interface CashFlowCellDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: DetailItem[];
}

const formatCurrency = (amount: number, currency: string) => {
    return amount.toLocaleString('es-AR', { style: 'currency', currency });
};

const CashFlowCellDetailModal: React.FC<CashFlowCellDetailModalProps> = ({ isOpen, onClose, title, items }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"><XIcon /></button>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">
                    {items.length > 0 ? (
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                    <th className="p-2 text-left font-semibold text-gray-600 dark:text-gray-300">Descripción</th>
                                    <th className="p-2 text-right font-semibold text-gray-600 dark:text-gray-300">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {items.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="p-2">
                                            <div>{item.description}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.date + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC'})}</div>
                                        </td>
                                        <td className={`p-2 text-right font-semibold ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(item.amount, item.currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center text-gray-500 py-8">No hay operaciones de detalle para este concepto y período.</p>
                    )}
                </div>
                <div className="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200">Cerrar</button>
                </div>
            </div>
        </div>
    );
};

export default CashFlowCellDetailModal;