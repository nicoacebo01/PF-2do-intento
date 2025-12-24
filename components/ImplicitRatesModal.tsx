import React, { useMemo } from 'react';
import type { DailyExchangeRate, FutureExchangeRateSnapshot } from '../types';
import { XIcon } from './Icons';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { formatPercentageForDisplay } from '../utils/formatting';

interface ImplicitRatesModalProps {
    exchangeRates: DailyExchangeRate[];
    futureRateHistory: FutureExchangeRateSnapshot[];
    onClose: () => void;
}

const calculateTNA = (spotRate: number, futureRate: number, spotDate: Date, futureDate: Date): number | null => {
    if (spotRate <= 0) return null;
    const daysDiff = (futureDate.getTime() - spotDate.getTime()) / (1000 * 3600 * 24);
    if (daysDiff <= 0) return null;
    return (((futureRate / spotRate) - 1) / daysDiff) * 365 * 100;
};

const ImplicitRatesModal: React.FC<ImplicitRatesModalProps> = ({ exchangeRates, futureRateHistory, onClose }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const data = useMemo(() => {
        const spotRate = [...exchangeRates]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .find(r => new Date(r.date + 'T00:00:00') <= today)?.rate;

        const snapshot = [...futureRateHistory]
            .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime())
            .find(s => s.snapshotDate <= todayStr);
        
        if (!spotRate || !snapshot) return { rates: [], spotRate: null };

        const rates = snapshot.rates.map(futureRate => {
            const futureDateObj = new Date(futureRate.date + 'T00:00:00');
            const tna = calculateTNA(spotRate, futureRate.rate, today, futureDateObj);
            return {
                futureDate: futureRate.date,
                futureRate: futureRate.rate,
                tna,
            };
        }).sort((a, b) => new Date(a.futureDate).getTime() - new Date(b.futureDate).getTime());
        
        return { rates, spotRate };
    }, [exchangeRates, futureRateHistory, todayStr, today]);

    const exportColumns: ExportColumn<typeof data.rates[0]>[] = [
      { header: 'Vencimiento', accessor: (d) => d.futureDate },
      { header: 'TC Futuro', accessor: (d) => d.futureRate },
      { header: 'TNA Implícita (%)', accessor: (d) => d.tna ?? '' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl m-4 animate-fade-in-down max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Tasas Implícitas del Día</h2>
                        {data.spotRate && <p className="text-sm text-gray-500">Spot de referencia: ${data.spotRate.toLocaleString('es-AR')}</p>}
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">
                    {data.rates.length > 0 ? (
                        <>
                            <div className="flex justify-end mb-4">
                                <ExportButtons 
                                    data={data.rates}
                                    columns={exportColumns}
                                    fileName={`tasas_implicitas_${todayStr}`}
                                    pdfTitle={`Tasas Implícitas - ${todayStr}`}
                                />
                            </div>
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">TC Futuro</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">TNA Implícita</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {data.rates.map(row => (
                                        <tr key={row.futureDate} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">{new Date(row.futureDate + 'T00:00:00').toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-800">${row.futureRate.toLocaleString('es-AR')}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-primary dark:text-accent-dm">{formatPercentageForDisplay(row.tna)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    ) : (
                        <p className="text-center py-8 text-gray-500">No se encontraron datos de curva de futuros para el día de hoy.</p>
                    )}
                </div>
                <div className="flex justify-end p-6 border-t">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">Cerrar</button>
                </div>
            </div>
            <style>{`
                @keyframes fade-in-down { 0% { opacity: 0; transform: translateY(-20px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ImplicitRatesModal;