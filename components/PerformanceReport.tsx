import React, { useState, useMemo, useCallback } from 'react';
import { useFinancialCalculations } from '../utils/calculations';
import { calculatePortfolioSnapshot, daysBetween, calculateCumulativeArbitragePnl } from '../utils/financials';
import type { Investment, Transaction, ArbitrageOperation } from '../types';
import { Currency } from '../types';
import { exportMultiSheetExcel } from '../utils/export';
import type { ExportColumn } from '../utils/export';
import HelpTooltip from './HelpTooltip';
import { formatNumberForExport } from '../utils/formatting';

// --- Helper Functions & Types ---

const formatUSD = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatARS = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface DetailedReportRow {
    instrumento: string;
    contraparte: string;
    moneda: string;
    valorInicialUSD: number;
    flujosNetosUSD: number;
    valorFinalUSD: number;
    resultadoInstrumentoUSD: number;
    resultadoCoberturasUSD: number;
    resultadoNetoFinalUSD: number;
    resultadoInstrumentoARS: number;
    resultadoCoberturasARS: number;
    resultadoNetoFinalARS: number;
    twrr: number;
}

interface KpiData {
    valorInicialTotalUSD: number;
    flujosNetosTotalUSD: number;
    valorFinalTotalUSD: number;
    resultadoNetoTotalUSD: number;
}

const KpiCard: React.FC<{ title: string; value: string; colorClass?: string }> = ({ title, value, colorClass = 'text-gray-800 dark:text-gray-100' }) => (
    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg shadow-sm border dark:border-gray-700 text-center">
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300">{title}</h4>
        <p className={`text-2xl font-bold mt-2 ${colorClass}`}>{value}</p>
    </div>
);


const PerformanceReport: React.FC = () => {
    const { companyInvestments, marketPriceHistory, exchangeRates, investmentTypes, appSettings, companyArbitrageOps, brokers, banks, futureRateHistory } = useFinancialCalculations();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState<DetailedReportRow[] | null>(null);
    const [kpiData, setKpiData] = useState<KpiData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateReport = useCallback(() => {
        if (!startDate || !endDate) {
            alert('Por favor, seleccione una fecha de inicio y de fin.');
            return;
        }
        setIsLoading(true);
        setReportData(null);
        setKpiData(null);

        const start = new Date(startDate + 'T00:00:00Z');
        const end = new Date(endDate + 'T00:00:00Z');
        const prevDayOfStart = new Date(start);
        prevDayOfStart.setUTCDate(start.getUTCDate() - 1);

        const spotRateEnd = [...exchangeRates].sort((a,b) => b.date.localeCompare(a.date)).find(r => r.date <= end.toISOString().split('T')[0])?.rate || 1;
        
        const reportRows: DetailedReportRow[] = [];

        for (const inv of companyInvestments) {
            const transactionsByCounterparty = inv.transactions.reduce((acc, tx) => {
                const key = tx.brokerId ? `broker-${tx.brokerId}` : tx.bankId ? `bank-${tx.bankId}` : 'unknown';
                if (!acc.has(key)) acc.set(key, []);
                acc.get(key)!.push(tx);
                return acc;
            }, new Map<string, Transaction[]>());

            for (const [counterpartyKey, transactions] of transactionsByCounterparty.entries()) {
                const tempInvestment: Investment = { ...inv, transactions };

                const initialSnapshot = calculatePortfolioSnapshot(prevDayOfStart, [tempInvestment], marketPriceHistory, exchangeRates, investmentTypes, appSettings);
                const finalSnapshot = calculatePortfolioSnapshot(end, [tempInvestment], marketPriceHistory, exchangeRates, investmentTypes, appSettings);

                const valorInicialUSD = initialSnapshot.totalValueUSD;
                const valorFinalUSD = finalSnapshot.totalValueUSD;

                const flujosNetosUSD = transactions.reduce((sum, tx) => {
                    const txDate = new Date(tx.date + 'T00:00:00Z');
                    if (txDate >= start && txDate <= end) {
                        const value = tx.quantity * tx.price;
                        const valueUSD = inv.currency === Currency.USD ? value : (tx.exchangeRate > 0 ? value / tx.exchangeRate : 0);
                        return sum + (tx.type === 'Compra' ? valueUSD : -valueUSD);
                    }
                    return sum;
                }, 0);

                if (valorInicialUSD < 1e-6 && valorFinalUSD < 1e-6 && Math.abs(flujosNetosUSD) < 1e-6) continue;

                const resultadoInstrumentoUSD = valorFinalUSD - valorInicialUSD - flujosNetosUSD;
                
                // --- NEW ARBITRAGE CALCULATION LOGIC ---
                const { pnlArs: pnlArsEnd, pnlUsd: pnlUsdEnd } = calculateCumulativeArbitragePnl(
                    tempInvestment, end, companyArbitrageOps, exchangeRates, futureRateHistory
                );
                const { pnlArs: pnlArsStart, pnlUsd: pnlUsdStart } = calculateCumulativeArbitragePnl(
                    tempInvestment, prevDayOfStart, companyArbitrageOps, exchangeRates, futureRateHistory
                );
        
                const resultadoCoberturasARS = pnlArsEnd - pnlArsStart;
                const resultadoCoberturasUSD = pnlUsdEnd - pnlUsdStart;
                // --- END NEW LOGIC ---

                const contraparte = counterpartyKey.startsWith('broker-') ? brokers.find(b => b.id === counterpartyKey.split('-')[1])?.name : banks.find(b => b.id === counterpartyKey.split('-')[1])?.name;

                reportRows.push({
                    instrumento: inv.instrumentName,
                    contraparte: contraparte || 'N/D',
                    moneda: inv.currency,
                    valorInicialUSD,
                    flujosNetosUSD,
                    valorFinalUSD,
                    resultadoInstrumentoUSD,
                    resultadoCoberturasUSD,
                    resultadoNetoFinalUSD: resultadoInstrumentoUSD + resultadoCoberturasUSD,
                    resultadoInstrumentoARS: resultadoInstrumentoUSD * spotRateEnd, // Simplified proxy
                    resultadoCoberturasARS,
                    resultadoNetoFinalARS: (resultadoInstrumentoUSD * spotRateEnd) + resultadoCoberturasARS,
                    twrr: 0, // TWRR calculation is complex and deferred
                });
            }
        }

        const totals: KpiData = {
            valorInicialTotalUSD: reportRows.reduce((s, r) => s + r.valorInicialUSD, 0),
            flujosNetosTotalUSD: reportRows.reduce((s, r) => s + r.flujosNetosUSD, 0),
            valorFinalTotalUSD: reportRows.reduce((s, r) => s + r.valorFinalUSD, 0),
            resultadoNetoTotalUSD: reportRows.reduce((s, r) => s + r.resultadoNetoFinalUSD, 0)
        };
        
        setKpiData(totals);
        setReportData(reportRows);
        setIsLoading(false);

    }, [startDate, endDate, companyInvestments, marketPriceHistory, exchangeRates, investmentTypes, appSettings, companyArbitrageOps, brokers, banks, futureRateHistory]);
    
    const handleExport = useCallback(() => {
        if (!reportData || !kpiData) return;
        
        const summarySheetData = [
            { Concepto: 'Valor Inicial Total (USD)', Valor: formatNumberForExport(kpiData.valorInicialTotalUSD) },
            { Concepto: 'Flujos Netos del Período (USD)', Valor: formatNumberForExport(kpiData.flujosNetosTotalUSD) },
            { Concepto: 'Valor Final Total (USD)', Valor: formatNumberForExport(kpiData.valorFinalTotalUSD) },
            { Concepto: 'Resultado Neto Total del Período (USD)', Valor: formatNumberForExport(kpiData.resultadoNetoTotalUSD) },
        ];
        const summaryColumns: ExportColumn<any>[] = [{header: 'Concepto', accessor: d => d.Concepto}, {header: 'Valor', accessor: d => d.Valor}];

        const detailColumns: ExportColumn<DetailedReportRow>[] = [
            { header: 'Instrumento', accessor: d => d.instrumento }, { header: 'Contraparte', accessor: d => d.contraparte }, { header: 'Moneda', accessor: d => d.moneda },
            { header: 'Valor Inicial (USD)', accessor: d => formatNumberForExport(d.valorInicialUSD) }, { header: 'Flujos Netos (USD)', accessor: d => formatNumberForExport(d.flujosNetosUSD) }, { header: 'Valor Final (USD)', accessor: d => formatNumberForExport(d.valorFinalUSD) },
            { header: 'Res. Instrumento (USD)', accessor: d => formatNumberForExport(d.resultadoInstrumentoUSD) }, { header: 'Res. Cobertura (USD)', accessor: d => formatNumberForExport(d.resultadoCoberturasUSD) }, { header: 'Res. Neto Final (USD)', accessor: d => formatNumberForExport(d.resultadoNetoFinalUSD) },
            { header: 'Res. Instrumento (ARS)', accessor: d => formatNumberForExport(d.resultadoInstrumentoARS) }, { header: 'Res. Cobertura (ARS)', accessor: d => formatNumberForExport(d.resultadoCoberturasARS) }, { header: 'Res. Neto Final (ARS)', accessor: d => formatNumberForExport(d.resultadoNetoFinalARS) },
        ];

        exportMultiSheetExcel({
            fileName: `reporte_rendimiento_${startDate}_a_${endDate}`,
            sheets: [
                { sheetName: 'Resumen de Rendimiento', data: summarySheetData, columns: summaryColumns },
                { sheetName: 'Rendimiento Detallado', data: reportData, columns: detailColumns },
            ]
        });
    }, [reportData, kpiData, startDate, endDate]);

    return (
        <div className="space-y-6">
            <div className="flex items-end gap-4">
                <div>
                    <label className="text-sm font-medium">Fecha de Inicio (inclusive)</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2" />
                </div>
                <div>
                    <label className="text-sm font-medium">Fecha de Fin (inclusive)</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2" />
                </div>
                <button onClick={handleGenerateReport} disabled={isLoading} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400">
                    {isLoading ? 'Generando...' : 'Generar Reporte'}
                </button>
            </div>

            {isLoading && <div className="text-center py-8">Cargando...</div>}

            {reportData && kpiData && (
                 <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <KpiCard title="Valor Inicial Total" value={formatUSD(kpiData.valorInicialTotalUSD)} />
                        <KpiCard title="Flujos Netos" value={formatUSD(kpiData.flujosNetosTotalUSD)} colorClass={kpiData.flujosNetosTotalUSD >= 0 ? 'text-green-600' : 'text-red-600'} />
                        <KpiCard title="Valor Final Total" value={formatUSD(kpiData.valorFinalTotalUSD)} />
                        <KpiCard title="Resultado Neto Total" value={formatUSD(kpiData.resultadoNetoTotalUSD)} colorClass={kpiData.resultadoNetoTotalUSD >= 0 ? 'text-green-600' : 'text-red-600'} />
                    </div>

                    <div className="flex justify-end">
                        <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md text-sm">Exportar a Excel (Detallado)</button>
                    </div>
                    <div className="overflow-auto max-h-[60vh]">
                        <table className="min-w-full text-sm">
                            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
                                <tr>
                                    <th className="p-2 text-left">Instrumento</th>
                                    <th className="p-2 text-right align-middle">Valor Inicial</th>
                                    <th className="p-2 text-right align-middle">Flujos Netos</th>
                                    <th className="p-2 text-right align-middle">Valor Final</th>
                                    <th className="p-2 text-right">
                                        <div className="flex items-center justify-end gap-1">Res. Instrumento <HelpTooltip text="Ganancia/Pérdida por la tenencia del activo (Valor Final - Valor Inicial - Flujos)." /></div>
                                        <div className="flex items-center justify-end gap-1">Res. Cobertura <HelpTooltip text="Ganancia/Pérdida por las operaciones de arbitraje (ROFEX/NDF) vinculadas y cerradas en el período." /></div>
                                    </th>
                                    <th className="p-2 text-right align-middle">Resultado Neto Final</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {reportData.filter(r => Math.abs(r.valorInicialUSD) > 0.01 || Math.abs(r.valorFinalUSD) > 0.01 || Math.abs(r.flujosNetosUSD) > 0.01).map(row => (
                                    <tr key={`${row.instrumento}-${row.contraparte}`}>
                                        <td className="p-2 align-middle">{row.instrumento} {row.contraparte !== 'N/D' && <span className="text-xs text-gray-500">({row.contraparte})</span>}</td>
                                        <td className="p-2 text-right align-middle">{formatUSD(row.valorInicialUSD)}</td>
                                        <td className={`p-2 text-right align-middle ${row.flujosNetosUSD > 0 ? 'text-green-600' : row.flujosNetosUSD < 0 ? 'text-red-600' : ''}`}>{formatUSD(row.flujosNetosUSD)}</td>
                                        <td className="p-2 text-right align-middle">{formatUSD(row.valorFinalUSD)}</td>
                                        <td className="p-2 text-right align-top">
                                            <div className={`font-semibold ${row.resultadoInstrumentoUSD >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{formatUSD(row.resultadoInstrumentoUSD)}</div>
                                            <div className={`font-semibold ${row.resultadoCoberturasUSD >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>{formatUSD(row.resultadoCoberturasUSD)}</div>
                                        </td>
                                        <td className={`p-2 text-right font-bold align-middle ${row.resultadoNetoFinalUSD >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>{formatUSD(row.resultadoNetoFinalUSD)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="sticky bottom-0 bg-gray-200 dark:bg-gray-900 font-bold">
                                <tr>
                                    <td className="p-2">TOTAL</td>
                                    <td className="p-2 text-right">{formatUSD(kpiData.valorInicialTotalUSD)}</td>
                                    <td className="p-2 text-right">{formatUSD(kpiData.flujosNetosTotalUSD)}</td>
                                    <td className="p-2 text-right">{formatUSD(kpiData.valorFinalTotalUSD)}</td>
                                    <td className="p-2 text-right">
                                        <div>{formatUSD(reportData.reduce((s, r) => s + r.resultadoInstrumentoUSD, 0))}</div>
                                        <div>{formatUSD(reportData.reduce((s, r) => s + r.resultadoCoberturasUSD, 0))}</div>
                                    </td>
                                    <td className="p-2 text-right text-base">{formatUSD(kpiData.resultadoNetoTotalUSD)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                 </div>
            )}
        </div>
    );
};

export default PerformanceReport;