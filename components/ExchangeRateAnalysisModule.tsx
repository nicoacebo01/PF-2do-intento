import React, { useState, useMemo } from 'react';
import type { DailyExchangeRate, FutureExchangeRateSnapshot } from '../types';

interface ExchangeRateAnalysisModuleProps {
    exchangeRates: DailyExchangeRate[];
    futureRateHistory: FutureExchangeRateSnapshot[];
}

const calculateTNA = (spotRate: number, futureRate: number, spotDate: Date, futureDate: Date): number | null => {
    if (spotRate <= 0) return null;
    const daysDiff = (futureDate.getTime() - spotDate.getTime()) / (1000 * 3600 * 24);
    if (daysDiff <= 0) return null;
    return (((futureRate / spotRate) - 1) / daysDiff) * 365 * 100;
};

const ExchangeRateAnalysisModule: React.FC<ExchangeRateAnalysisModuleProps> = ({ exchangeRates, futureRateHistory }) => {
    const today = new Date().toISOString().split('T')[0];
    const [referenceDate, setReferenceDate] = useState(today);
    const [comparisonDate, setComparisonDate] = useState('');
    
    const analysisData = useMemo(() => {
        const refDateObj = new Date(referenceDate + 'T00:00:00'); // Use UTC interpretation
        
        const refSpotRate = [...exchangeRates]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .find(r => new Date(r.date + 'T00:00:00') <= refDateObj)?.rate;

        const refSnapshot = [...futureRateHistory]
            .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime())
            .find(s => s.snapshotDate <= referenceDate);
        
        if (!refSpotRate || !refSnapshot) return [];

        const compDateObj = comparisonDate ? new Date(comparisonDate + 'T00:00:00') : null;
        
        const compSpotRate = compDateObj ? [...exchangeRates]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .find(r => new Date(r.date + 'T00:00:00') <= compDateObj)?.rate : null;

        const compSnapshot = comparisonDate ? [...futureRateHistory]
            .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime())
            .find(s => s.snapshotDate <= comparisonDate) : null;

        return refSnapshot.rates.map(refFutureRate => {
            const refFutureDateObj = new Date(refFutureRate.date + 'T00:00:00');
            const refTNA = calculateTNA(refSpotRate, refFutureRate.rate, refDateObj, refFutureDateObj);

            let compTNA: number | null = null;
            if (compSnapshot && compSpotRate && compDateObj) {
                const compFutureRate = compSnapshot.rates.find(r => r.date === refFutureRate.date);
                if (compFutureRate) {
                    compTNA = calculateTNA(compSpotRate, compFutureRate.rate, compDateObj, refFutureDateObj);
                }
            }

            return {
                futureDate: refFutureRate.date,
                futureRate: refFutureRate.rate,
                refTNA,
                compTNA,
                tnaDiff: (refTNA !== null && compTNA !== null) ? refTNA - compTNA : null,
            };
        }).sort((a, b) => new Date(a.futureDate).getTime() - new Date(b.futureDate).getTime());

    }, [referenceDate, comparisonDate, exchangeRates, futureRateHistory]);
    
    const refSpotRateForDisplay = useMemo(() => {
        const refDateObj = new Date(referenceDate + 'T00:00:00');
        return [...exchangeRates]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .find(r => new Date(r.date + 'T00:00:00') <= refDateObj)?.rate;
    }, [referenceDate, exchangeRates]);

    const commonInputClass = "w-full border border-gray-300 rounded-md py-2 px-3 bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600";

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">Análisis Histórico de Curvas de Tipo de Cambio</h1>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                        <label htmlFor="reference-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha de Referencia</label>
                        <input type="date" id="reference-date" value={referenceDate} onChange={e => setReferenceDate(e.target.value)} max={today} className={commonInputClass}/>
                        {refSpotRateForDisplay !== undefined ? <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Spot: <span className="font-bold text-primary dark:text-accent">${refSpotRateForDisplay.toLocaleString('es-AR')}</span></p> : <p className="text-sm text-gray-500 mt-2">Sin spot para la fecha.</p>}
                    </div>
                     <div>
                        <label htmlFor="comparison-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comparar con Fecha (Opcional)</label>
                        <input type="date" id="comparison-date" value={comparisonDate} onChange={e => setComparisonDate(e.target.value)} max={referenceDate} className={commonInputClass}/>
                    </div>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Vencimiento Futuro</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">TC Futuro</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">TNA Implícita (Ref.)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">TNA Implícita (Comp.)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Diferencia TNA (p.p.)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {analysisData.length > 0 ? analysisData.map(row => (
                            <tr key={row.futureDate} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">{new Date(row.futureDate + 'T00:00:00').toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-800 dark:text-gray-200">${row.futureRate.toLocaleString('es-AR')}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-primary dark:text-accent">{row.refTNA !== null ? `${row.refTNA.toFixed(2)}%` : '-'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">{row.compTNA !== null ? `${row.compTNA.toFixed(2)}%` : '-'}</td>
                                <td className={`px-4 py-3 whitespace-nowrap text-right font-bold ${row.tnaDiff === null ? 'text-gray-600 dark:text-gray-400' : row.tnaDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{row.tnaDiff !== null ? `${row.tnaDiff.toFixed(2)} p.p.` : '-'}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={5} className="text-center py-8 text-gray-500 dark:text-gray-400">No se encontraron datos de curva de futuros para la fecha de referencia seleccionada.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ExchangeRateAnalysisModule;