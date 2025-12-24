import React, { useMemo, useCallback } from 'react';
import type { ArbitrageOperation, Bank, Broker, Company } from '../types';
import { XIcon, PencilIcon, TrashIcon, LinkIcon } from './Icons';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { useAppContext } from '../App';

const safeFormatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return '-';
    try {
        // Handles both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss.sssZ'
        const [year, month, day] = dateString.split('T')[0].split('-');
        if (!year || !month || !day) return dateString; // Fallback for unexpected formats
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    } catch {
        return dateString; // Fallback in case of parsing error
    }
};

interface ExpiredArbitrageModalProps {
    isOpen: boolean;
    onClose: () => void;
    allOperations: any[]; // ArbitrageOperation with pnl properties
    onStartEdit: (op: ArbitrageOperation) => void;
    onDelete: (id: string) => void;
    onShowLink: (op: ArbitrageOperation) => void;
    banks: Bank[];
    brokers: Broker[];
}

export const ExpiredArbitrageModal: React.FC<ExpiredArbitrageModalProps> = ({
    isOpen,
    onClose,
    allOperations,
    onStartEdit,
    onDelete,
    onShowLink,
    banks,
    brokers,
}) => {
    const { state } = useAppContext();
    const { viewMode, companies } = state;

    const getOperatorName = useCallback((op: ArbitrageOperation) => {
        if (op.bankId) return banks.find(b => b.id === op.bankId)?.name || 'N/D';
        if (op.brokerId) return brokers.find(b => b.id === op.brokerId)?.name || 'N/D';
        return 'N/A';
    }, [banks, brokers]);

    const getCompanyName = useCallback((op: any): string => {
        return companies.find((c: Company) => c.id === op.companyId)?.name || 'N/D';
    }, [companies]);

    const exportColumns: ExportColumn<any>[] = useMemo(() => {
        const columns: ExportColumn<any>[] = [
            { header: 'Instrumento', accessor: d => d.instrument },
            { header: 'Operador', accessor: d => getOperatorName(d) },
            { header: 'Posición', accessor: d => d.position },
            { header: 'Monto USD', accessor: d => d.usdAmount },
            { header: 'Vencimiento', accessor: d => safeFormatDate(d.arbitrageDate) },
            { header: 'TC Arbitraje', accessor: d => d.arbitrageRate },
            { header: 'Fecha Canc.', accessor: d => safeFormatDate(d.cancellationDate) ?? '' },
            { header: 'TC Canc.', accessor: d => d.cancellationRate ?? '' },
            { header: 'Res. (ARS)', accessor: d => d.pnl_ars ?? '' },
            { header: 'Res. (USD)', accessor: d => d.pnl_usd ?? '' },
        ];
        
        if (viewMode === 'consolidated') {
            columns.unshift({ header: 'Empresa', accessor: d => getCompanyName(d) });
        }
        
        return columns;

    }, [viewMode, companies, getOperatorName, getCompanyName]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl m-4 h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Archivo de Operaciones de Arbitraje</h2>
                     <div className="flex items-center gap-4">
                        <ExportButtons 
                            data={allOperations} 
                            columns={exportColumns}
                            fileName="arbitrajes_archivados"
                            pdfTitle="Archivo de Arbitrajes"
                        />
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"><XIcon /></button>
                    </div>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">
                    {allOperations.length > 0 ? (
                        <table className="min-w-full text-xs">
                            <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                    {viewMode === 'consolidated' && <th className="p-2 text-left">Empresa</th>}
                                    <th className="p-2 text-left">Instrumento</th>
                                    <th className="p-2 text-left">Operador</th>
                                    <th className="p-2 text-left">Posición</th>
                                    <th className="p-2 text-right">Monto USD</th>
                                    <th className="p-2 text-center">Vencimiento</th>
                                    <th className="p-2 text-right">TC Arbitraje</th>
                                    <th className="p-2 text-center">Fecha Canc.</th>
                                    <th className="p-2 text-right">TC Canc.</th>
                                    <th className="p-2 text-right">Res. (ARS)</th>
                                    <th className="p-2 text-right">Res. (USD)</th>
                                    <th className="p-2 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                {allOperations.map(op => (
                                    <tr key={op.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        {viewMode === 'consolidated' && <td className="p-2">{getCompanyName(op)}</td>}
                                        <td className="p-2">{op.instrument}</td>
                                        <td className="p-2">{getOperatorName(op)}</td>
                                        <td className={`p-2 font-bold ${op.position === 'Comprada' ? 'text-green-700' : 'text-red-700'}`}>{op.position}</td>
                                        <td className="p-2 text-right">{op.usdAmount.toLocaleString('es-AR')}</td>
                                        <td className="p-2 text-center">{safeFormatDate(op.arbitrageDate)}</td>
                                        <td className="p-2 text-right">{op.arbitrageRate.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                        <td className="p-2 text-center">{safeFormatDate(op.cancellationDate)}</td>
                                        <td className="p-2 text-right">{op.cancellationRate?.toLocaleString('es-AR', {minimumFractionDigits: 2}) ?? '-'}</td>
                                        <td className={`p-2 text-right font-bold ${op.pnl_ars >= 0 ? 'text-green-700' : 'text-red-700'}`}>{op.pnl_ars?.toLocaleString('es-AR', {style: 'currency', currency: 'ARS'}) ?? '-'}</td>
                                        <td className={`p-2 text-right font-bold ${op.pnl_usd >= 0 ? 'text-green-700' : 'text-red-700'}`}>{op.pnl_usd?.toLocaleString('es-AR', {style: 'currency', currency: 'USD'}) ?? '-'}</td>
                                        <td className="p-2">
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={() => onStartEdit(op)} className="text-blue-600" disabled={!!op.linkedDebtId || !!op.linkedTransactionId}><PencilIcon /></button>
                                                <button onClick={() => onDelete(op.id)} className="text-red-600" disabled={!!op.linkedDebtId || !!op.linkedTransactionId}><TrashIcon /></button>
                                                {(op.linkedDebtId || op.linkedTransactionId) && <button onClick={() => onShowLink(op)} className="text-gray-500"><LinkIcon /></button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="p-8 text-center text-gray-500">No hay operaciones en el archivo.</p>}
                </div>
                <div className="flex justify-end p-4 border-t dark:border-gray-700">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 font-bold py-2 px-4 rounded-lg">Cerrar</button>
                </div>
            </div>
        </div>
    );
};