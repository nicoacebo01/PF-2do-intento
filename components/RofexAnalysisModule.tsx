import React, { useState, useMemo } from 'react';
import type { DailyExchangeRate, FutureExchangeRateSnapshot, AppSettings } from '../types';
import ExportButtons from './ExportButtons';
import type { ExportColumn } from '../utils/export';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatPercentageForDisplay } from '../utils/formatting';


interface RofexAnalysisModuleProps {
    exchangeRates: DailyExchangeRate[];
    futureRateHistory: FutureExchangeRateSnapshot[];
    appSettings: AppSettings;
}

const calculateTNA = (spotRate: number, futureRate: number, spotDate: Date, futureDate: Date): number | null => {
    if (spotRate <= 0) return null;
    const daysDiff = (futureDate.getTime() - spotDate.getTime()) / (1000 * 3600 * 24);
    if (daysDiff <= 0) return null;
    return (((futureRate / spotRate) - 1) / daysDiff) * 365 * 100;
};

const RofexAnalysisModule: React.FC<RofexAnalysisModuleProps> = ({ exchangeRates, futureRateHistory, appSettings }) => {
    const today = new Date().toISOString().split('T')[0];
    const [referenceDate, setReferenceDate] = useState(today);
    const [comparisonDate, setComparisonDate] = useState('');
    
    const analysisData = useMemo(() => {
        const refDateObj = new Date(referenceDate + 'T00:00:00');
        
        const refSpotRate = [...exchangeRates]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .find(r => new Date(r.date + 'T00:00:00') <= refDateObj)?.rate;

        const refSnapshot = [...futureRateHistory]
            .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime())
            .find(s => s.snapshotDate <= referenceDate);
        
        if (!refSpotRate || !refSnapshot) return [];
        
        const sortedRefRates = [...refSnapshot.rates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const compDateObj = comparisonDate ? new Date(comparisonDate + 'T00:00:00') : null;
        
        const compSpotRate = compDateObj ? [...exchangeRates]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .find(r => new Date(r.date + 'T00:00:00') <= compDateObj)?.rate : null;

        const compSnapshot = comparisonDate ? [...futureRateHistory]
            .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime())
            .find(s => s.snapshotDate <= comparisonDate) : null;
        
        const sortedCompRates = compSnapshot ? [...compSnapshot.rates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : [];

        // Match by ordinal position
        return sortedRefRates.map((refFutureRate, index) => {
            const refFutureDateObj = new Date(refFutureRate.date + 'T00:00:00');
            const refTNA = calculateTNA(refSpotRate, refFutureRate.rate, refDateObj, refFutureDateObj);

            let compTNA: number | null = null;
            let compFutureRateData: { date: string, rate: number} | undefined;

            if (compSnapshot && compSpotRate && compDateObj && index < sortedCompRates.length) {
                compFutureRateData = sortedCompRates[index];
                const compFutureDateObj = new Date(compFutureRateData.date + 'T00:00:00');
                compTNA = calculateTNA(compSpotRate, compFutureRateData.rate, compDateObj, compFutureDateObj);
            }

            return {
                futureDate: refFutureRate.date,
                futureRate: refFutureRate.rate,
                refTNA,
                compFutureDate: compFutureRateData?.date,
                compFutureRate: compFutureRateData?.rate,
                compTNA,
                tnaDiff: (refTNA !== null && compTNA !== null) ? refTNA - compTNA : null,
            };
        });

    }, [referenceDate, comparisonDate, exchangeRates, futureRateHistory]);
    
    const chartData = useMemo(() => {
        return analysisData.map(d => ({
            futureDate: d.futureDate,
            refTNA: d.refTNA,
            compTNA: d.compTNA,
        })).filter(d => d.refTNA !== null);
    }, [analysisData]);

    const refSpotRateForDisplay = useMemo(() => {
        const refDateObj = new Date(referenceDate + 'T00:00:00');
        return [...exchangeRates]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .find(r => new Date(r.date + 'T00:00:00') <= refDateObj)?.rate;
    }, [referenceDate, exchangeRates]);

    const compSpotRateForDisplay = useMemo(() => {
        if (!comparisonDate) return null;
        const compDateObj = new Date(comparisonDate + 'T00:00:00');
        return [...exchangeRates]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .find(r => new Date(r.date + 'T00:00:00') <= compDateObj)?.rate;
    }, [comparisonDate, exchangeRates]);

    const exportColumns: ExportColumn<typeof analysisData[0]>[] = [
        { header: 'Vencimiento (Ref.)', accessor: (d) => d.futureDate },
        { header: 'TC Futuro (Ref.)', accessor: (d) => d.futureRate },
        { header: 'TNA Implícita (Ref.) (%)', accessor: (d) => d.refTNA ?? '' },
        { header: 'Vencimiento (Comp.)', accessor: (d) => d.compFutureDate ?? '' },
        { header: 'TC Futuro (Comp.)', accessor: (d) => d.compFutureRate ?? '' },
        { header: 'TNA Implícita (Comp.) (%)', accessor: (d) => d.compTNA ?? '' },
        { header: 'Diferencia TNA (p.p.)', accessor: (d) => d.tnaDiff ?? '' },
    ];
    
    const commonInputClass = "w-full border border-gray-300 rounded-md py-2 px-3 bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600";
    
    const isDarkMode = appSettings.theme === 'dark';
    const tooltipStyle = {
        backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        border: `1px solid ${isDarkMode ? '#4b5563' : '#ccc'}`,
        color: isDarkMode ? '#f3f4f6' : '#374151',
        borderRadius: '0.5rem'
    };
    const axisColor = isDarkMode ? '#9ca3af' : '#6b7280';

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">ROFEX - Análisis de Tasas Implícitas</h1>
            
            {chartData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4">Visualización de Curvas de TNA Implícita</h2>
                    <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer>
                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
                                <XAxis 
                                    dataKey="futureDate" 
                                    tickFormatter={(dateStr) => new Date(dateStr + 'T00:00:00Z').toLocaleDateString('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' })}
                                    tick={{ fill: axisColor }}
                                />
                                <YAxis 
                                    tickFormatter={(value) => `${value.toLocaleString('es-AR', {maximumFractionDigits: 0})}%`}
                                    tick={{ fill: axisColor }}
                                    domain={['dataMin - 5', 'dataMax + 5']}
                                />
                                <Tooltip 
                                    formatter={(value: number) => formatPercentageForDisplay(value)}
                                    labelFormatter={(label) => `Vencimiento: ${new Date(label + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' })}`}
                                    contentStyle={tooltipStyle}
                                />
                                <Legend wrapperStyle={{ color: axisColor }} />
                                <Line type="monotone" dataKey="refTNA" name={`Referencia (${new Date(referenceDate + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC'})})`} stroke="#1e40af" strokeWidth={2} activeDot={{ r: 8 }} connectNulls />
                                {comparisonDate && (
                                    <Line type="monotone" dataKey="compTNA" name={`Comparación (${new Date(comparisonDate + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC'})})`} stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" connectNulls />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="flex flex-wrap justify-between items-end gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div>
                            <label htmlFor="reference-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha de Referencia</label>
                            <input type="date" id="reference-date" value={referenceDate} onChange={e => setReferenceDate(e.target.value)} max={today} className={commonInputClass}/>
                            {refSpotRateForDisplay !== undefined ? <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Spot: <span className="font-bold text-primary dark:text-accent">${refSpotRateForDisplay.toLocaleString('es-AR')}</span></p> : <p className="text-sm text-gray-500 mt-2">Sin spot para la fecha.</p>}
                        </div>
                        <div>
                            <label htmlFor="comparison-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comparar con Fecha (Opcional)</label>
                            <input type="date" id="comparison-date" value={comparisonDate} onChange={e => setComparisonDate(e.target.value)} max={referenceDate} className={commonInputClass}/>
                            {comparisonDate && (compSpotRateForDisplay !== null && compSpotRateForDisplay !== undefined ? <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Spot: <span className="font-bold text-primary dark:text-accent-dm">${compSpotRateForDisplay.toLocaleString('es-AR')}</span></p> : <p className="text-sm text-gray-500 mt-2">Sin spot para la fecha.</p>)}
                        </div>
                    </div>
                    <ExportButtons
                        data={analysisData}
                        columns={exportColumns}
                        fileName={`analisis_implicitas_${referenceDate}`}
                        pdfTitle={`Análisis de Tasas Implícitas - ${referenceDate}`}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Vencimiento (Ref.)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">TC Futuro (Ref.)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">TNA Implícita (Ref.)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Vencimiento (Comp.)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">TC Futuro (Comp.)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">TNA Implícita (Comp.)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Diferencia TNA (p.p.)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {analysisData.length > 0 ? analysisData.map(row => (
                            <tr key={row.futureDate} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">{new Date(row.futureDate + 'T00:00:00').toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-800 dark:text-gray-200">${row.futureRate.toLocaleString('es-AR')}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-primary dark:text-accent-dm">{formatPercentageForDisplay(row.refTNA)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{row.compFutureDate ? new Date(row.compFutureDate + 'T00:00:00').toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">{row.compFutureRate ? `$${row.compFutureRate.toLocaleString('es-AR')}`: '-'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">{formatPercentageForDisplay(row.compTNA)}</td>
                                <td className={`px-4 py-3 whitespace-nowrap text-right font-bold ${row.tnaDiff === null ? 'text-gray-600 dark:text-gray-400' : row.tnaDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{row.tnaDiff !== null ? `${row.tnaDiff.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} p.p.` : '-'}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">No se encontraron datos de curva de futuros para la fecha de referencia seleccionada.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RofexAnalysisModule;