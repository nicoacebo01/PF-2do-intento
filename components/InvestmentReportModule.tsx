import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useFinancialCalculations, generateInvestmentGroups } from '../utils/calculations';
import { daysBetween, calculatePortfolioSnapshot, getTodayArgentinaDate } from '../utils/financials';
import type { GroupedHolding, BrokerDetail, InvestmentGroup } from '../types';
import { Currency } from '../types';
import { exportMultiSheetExcel } from '../utils/export';
import type { ExportColumn } from '../utils/export';
import PerformanceReport from './PerformanceReport';
import HelpTooltip from './HelpTooltip';
import { formatNumberForExport, formatPercentageForExport } from '../utils/formatting';
import { formatPercentageForDisplay } from '../utils/formatting';

// --- Helper Functions ---
const formatUSD = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const KpiCard: React.FC<{ title: string; value: string; helpText: string, colorClass?: string }> = ({ title, value, helpText, colorClass = 'text-gray-800 dark:text-gray-100' }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
            {title}
            <HelpTooltip text={helpText} />
        </h3>
        <p className={`text-2xl font-bold mt-2 ${colorClass}`}>{value}</p>
    </div>
);

const SummaryTable: React.FC<{ title: string; data: any[]; totalValue: number }> = ({ title, data, totalValue }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">{title}</h3>
        <div className="overflow-auto max-h-64">
            <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
                    <tr>
                        <th className="p-2 text-left font-semibold text-gray-600 dark:text-gray-300">{data.length > 0 && Object.keys(data[0])[0]}</th>
                        <th className="p-2 text-right font-semibold text-gray-600 dark:text-gray-300">Valor Mercado (USD)</th>
                        <th className="p-2 text-right font-semibold text-gray-600 dark:text-gray-300">% Cartera</th>
                        <th className="p-2 text-right font-semibold text-gray-600 dark:text-gray-300">Resultado (USD)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data.map((row, index) => (
                        <tr key={index}>
                            <td className="p-2 font-medium">{row[Object.keys(row)[0]]}</td>
                            <td className="p-2 text-right">{formatUSD(row.marketValueUSD)}</td>
                            <td className="p-2 text-right">{totalValue > 0 ? formatPercentageForDisplay((row.marketValueUSD / totalValue) * 100) : '0,00%'}</td>
                            <td className={`p-2 text-right font-semibold ${row.totalPL_USD >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatUSD(row.totalPL_USD)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);


const SnapshotReport: React.FC = () => {
    const { 
        companyInvestments, 
        investmentTypes, 
        marketPriceHistory, 
        exchangeRates, 
        appSettings, 
        companyArbitrageOps, 
        brokers, 
        banks, 
        futureRateHistory 
    } = useFinancialCalculations();

    const [snapshotDate, setSnapshotDate] = useState(() => getTodayArgentinaDate().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState<{
        allHoldings: GroupedHolding[];
        kpiData: any;
        summaryByType: any[];
        summaryByCounterparty: any[];
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const handleGenerateReport = useCallback(() => {
        setIsLoading(true);
        // Use a timeout to allow the UI to update to the loading state before the heavy calculation
        setTimeout(() => {
            const { investmentGroups } = generateInvestmentGroups(
                new Date(snapshotDate + 'T00:00:00Z'),
                companyInvestments,
                investmentTypes,
                marketPriceHistory,
                exchangeRates,
                appSettings,
                companyArbitrageOps,
                brokers,
                banks,
                futureRateHistory
            );

            const allHoldings = investmentGroups.flatMap(g => g.holdings);
            
            const totalValue = allHoldings.reduce((sum, h) => sum + h.marketValueUSD, 0);
            const totalPL = allHoldings.reduce((sum, h) => sum + h.totalPL_USD + h.arbitragePL_USD, 0);
            const weightedTEANumerator = allHoldings.reduce((sum, h) => {
                if (isFinite(h.tea_total_USD) && h.marketValueUSD > 0) {
                    return sum + h.tea_total_USD * h.marketValueUSD;
                }
                return sum;
            }, 0);
            const weightedTEA = totalValue > 0 ? weightedTEANumerator / totalValue : 0;
            const kpiData = { totalValue, totalPL, weightedTEA };

            const byType = allHoldings.reduce((acc, h) => {
                const entry = acc.get(h.investmentTypeName) || { marketValueUSD: 0, totalPL_USD: 0 };
                entry.marketValueUSD += h.marketValueUSD;
                entry.totalPL_USD += h.totalPL_USD + h.arbitragePL_USD;
                acc.set(h.investmentTypeName, entry);
                return acc;
            }, new Map<string, { marketValueUSD: number; totalPL_USD: number }>());
            const summaryByType = Array.from(byType.entries()).map(([name, data]) => ({ 'Tipo de Instrumento': name, ...data }));

            const byCounterparty = allHoldings.reduce((acc, h) => {
                h.brokerDetails.forEach(bd => {
                    const name = bd.brokerName || bd.bankName || 'N/D';
                    const proratedMarketValue = h.marketValueUSD * (bd.totalQuantity / h.totalQuantity);
                    const unrealizedPL_USD = h.marketValueUSD - h.remainingCostBasisUSD;
                    const proratedUnrealizedPL_USD = h.totalQuantity > 0 ? unrealizedPL_USD * (bd.totalQuantity / h.totalQuantity) : 0;
                    const proratedArbitragePL_USD = h.totalQuantity > 0 ? h.arbitragePL_USD * (bd.totalQuantity / h.totalQuantity) : 0;
                    const totalPL_USD_for_broker = bd.realizedPL_USD + proratedUnrealizedPL_USD + proratedArbitragePL_USD;
                    const entry = acc.get(name) || { marketValueUSD: 0, totalPL_USD: 0 };
                    entry.marketValueUSD += proratedMarketValue;
                    entry.totalPL_USD += totalPL_USD_for_broker;
                    acc.set(name, entry);
                });
                return acc;
            }, new Map<string, { marketValueUSD: number; totalPL_USD: number }>());
            const summaryByCounterparty = Array.from(byCounterparty.entries()).map(([name, data]) => ({ 'Contraparte': name, ...data }));

            setReportData({ allHoldings, kpiData, summaryByType, summaryByCounterparty });
            setIsLoading(false);
        }, 0);
    }, [snapshotDate, companyInvestments, investmentTypes, marketPriceHistory, exchangeRates, appSettings, companyArbitrageOps, brokers, banks, futureRateHistory]);

    useEffect(() => {
        handleGenerateReport();
    }, [companyInvestments]); // Re-generate if underlying data changes (e.g., company switch)

    const handleExport = useCallback(() => {
        if (!reportData) return;
        const { kpiData, summaryByType, summaryByCounterparty, allHoldings } = reportData;

        const kpiSheetData = [
            { Concepto: 'Valor Total de la Cartera (USD)', Valor: formatNumberForExport(kpiData.totalValue) },
            { Concepto: 'Resultado Total (G/P en USD)', Valor: formatNumberForExport(kpiData.totalPL) },
            { Concepto: 'TEA Ponderada de la Cartera (%)', Valor: formatPercentageForExport(kpiData.weightedTEA) },
        ];
        const kpiColumns: ExportColumn<any>[] = [{header: 'Concepto', accessor: d => d.Concepto}, {header: 'Valor', accessor: d => d.Valor}];

        const summaryTypeColumns: ExportColumn<any>[] = [
            {header: 'Tipo de Instrumento', accessor: d => d['Tipo de Instrumento']}, 
            {header: 'Valor Mercado (USD)', accessor: d => formatNumberForExport(d.marketValueUSD)}, 
            {header: '% Cartera', accessor: d => formatPercentageForExport(kpiData.totalValue > 0 ? (d.marketValueUSD / kpiData.totalValue) * 100 : 0)}, 
            {header: 'Resultado (USD)', accessor: d => formatNumberForExport(d.totalPL_USD)}
        ];
        const summaryCounterpartyColumns: ExportColumn<any>[] = [
            {header: 'Contraparte', accessor: d => d.Contraparte}, 
            {header: 'Valor Mercado (USD)', accessor: d => formatNumberForExport(d.marketValueUSD)}, 
            {header: '% Cartera', accessor: d => formatPercentageForExport(kpiData.totalValue > 0 ? (d.marketValueUSD / kpiData.totalValue) * 100 : 0)}, 
            {header: 'Resultado (USD)', accessor: d => formatNumberForExport(d.totalPL_USD)}
        ];

        const detailSheetData = allHoldings.flatMap(h => 
            h.brokerDetails.map(bd => {
                const proratedMarketValueUSD = h.totalQuantity > 0 ? h.marketValueUSD * (bd.totalQuantity / h.totalQuantity) : 0;
                
                const unrealizedPL_USD = h.marketValueUSD - h.remainingCostBasisUSD;
                const proratedUnrealizedPL_USD = h.totalQuantity > 0 ? unrealizedPL_USD * (bd.totalQuantity / h.totalQuantity) : 0;
                const totalPL_Instrumento_USD = bd.realizedPL_USD + proratedUnrealizedPL_USD;

                const proratedArbitragePL_USD = h.totalQuantity > 0 ? h.arbitragePL_USD * (bd.totalQuantity / h.totalQuantity) : 0;

                const proratedTotalPL_Native = h.totalQuantity > 0 ? h.totalPL_Native * (bd.totalQuantity / h.totalQuantity) : 0;
                const proratedArbitragePL_Native = h.totalQuantity > 0 ? h.arbitragePL_Native * (bd.totalQuantity / h.totalQuantity) : 0;


                return {
                    'Instrumento': h.instrumentName,
                    'Contraparte': bd.brokerName || bd.bankName || 'N/D',
                    'Moneda': h.currency,
                    'Tenencia Actual': formatNumberForExport(bd.totalQuantity),
                    'Valor de Mercado (USD)': formatNumberForExport(proratedMarketValueUSD),
                    'Resultado Instrumento (USD)': formatNumberForExport(totalPL_Instrumento_USD),
                    'Resultado Cobertura (USD)': formatNumberForExport(proratedArbitragePL_USD),
                    'Resultado Neto Final (USD)': formatNumberForExport(totalPL_Instrumento_USD + proratedArbitragePL_USD),
                    'Resultado Instrumento (ARS)': formatNumberForExport(h.currency === Currency.ARS ? proratedTotalPL_Native : 0),
                    'Resultado Cobertura (ARS)': formatNumberForExport(h.currency === Currency.ARS ? proratedArbitragePL_Native : 0),
                    'Resultado Neto Final (ARS)': formatNumberForExport(h.currency === Currency.ARS ? proratedTotalPL_Native + proratedArbitragePL_Native : 0),
                    'TEA Total (%)': formatPercentageForExport(h.tea_total_USD),
                }
            })
        );
        const detailColumns: ExportColumn<any>[] = [
            { header: 'Instrumento', accessor: d => d.Instrumento },
            { header: 'Contraparte', accessor: d => d.Contraparte },
            { header: 'Moneda', accessor: d => d.Moneda },
            { header: 'Tenencia Actual', accessor: d => d['Tenencia Actual'] },
            { header: 'Valor de Mercado (USD)', accessor: d => d['Valor de Mercado (USD)'] },
            { header: 'Resultado Instrumento (USD)', accessor: d => d['Resultado Instrumento (USD)'] },
            { header: 'Resultado Cobertura (USD)', accessor: d => d['Resultado Cobertura (USD)'] },
            { header: 'Resultado Neto Final (USD)', accessor: d => d['Resultado Neto Final (USD)'] },
            { header: 'Resultado Instrumento (ARS)', accessor: d => d['Resultado Instrumento (ARS)'] },
            { header: 'Resultado Cobertura (ARS)', accessor: d => d['Resultado Cobertura (ARS)'] },
            { header: 'Resultado Neto Final (ARS)', accessor: d => d['Resultado Neto Final (ARS)'] },
            { header: 'TEA Total (%)', accessor: d => d['TEA Total (%)'] },
        ];

        exportMultiSheetExcel({
            fileName: `snapshot_cartera_inversiones_${snapshotDate}`,
            sheets: [
                { sheetName: 'Rendimiento Detallado', data: detailSheetData, columns: detailColumns },
                { sheetName: 'Resumen por Tipo', data: summaryByType, columns: summaryTypeColumns },
                { sheetName: 'Resumen por Contraparte', data: summaryByCounterparty, columns: summaryCounterpartyColumns },
                { sheetName: 'KPIs', data: kpiSheetData, columns: kpiColumns },
            ]
        });
    }, [reportData, snapshotDate]);

    return (
        <div className="space-y-6">
            <div className="flex items-end gap-4">
                <div>
                    <label htmlFor="snapshot-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha del Snapshot</label>
                    <input
                        type="date"
                        id="snapshot-date"
                        value={snapshotDate}
                        onChange={e => setSnapshotDate(e.target.value)}
                        max={getTodayArgentinaDate().toISOString().split('T')[0]}
                        className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2"
                    />
                </div>
                <button onClick={handleGenerateReport} disabled={isLoading} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400">
                    {isLoading ? 'Generando...' : 'Generar Reporte'}
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Calculando snapshot histórico...</p>
                </div>
            ) : !reportData ? (
                 <div className="text-center py-12 text-gray-500 dark:text-gray-400">Seleccione una fecha y genere el reporte.</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <KpiCard title="Valor Total de la Cartera" value={formatUSD(reportData.kpiData.totalValue)} helpText="Valor de mercado de todas las inversiones en cartera para la fecha seleccionada." />
                        <KpiCard title="Resultado Total (G/P)" value={formatUSD(reportData.kpiData.totalPL)} colorClass={reportData.kpiData.totalPL >= 0 ? 'text-green-600' : 'text-red-600'} helpText="Ganancia o pérdida total acumulada de la cartera, incluyendo resultados realizados y no realizados, y el efecto de las coberturas." />
                        <KpiCard title="TEA Ponderada" value={formatPercentageForDisplay(reportData.kpiData.weightedTEA)} colorClass={reportData.kpiData.weightedTEA >= 0 ? 'text-green-600' : 'text-red-600'} helpText="Tasa Efectiva Anual promedio de la cartera, ponderada por el valor de mercado de cada instrumento." />
                        <div className="flex items-center justify-center">
                            <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-md text-sm w-full">Exportar a Excel</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SummaryTable title="Resumen por Tipo de Instrumento" data={reportData.summaryByType} totalValue={reportData.kpiData.totalValue} />
                        <SummaryTable title="Resumen por Contraparte" data={reportData.summaryByCounterparty} totalValue={reportData.kpiData.totalValue} />
                    </div>
                </>
            )}
        </div>
    );
};


const InvestmentReportModule: React.FC = () => {
    const [activeReport, setActiveReport] = useState<'snapshot' | 'performance'>('snapshot');
    
    const TabButton = (props: { view: 'snapshot' | 'performance', label: string }) => (
         <button
            onClick={() => setActiveReport(props.view)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeReport === props.view
                ? 'border-primary text-primary dark:border-accent-dm dark:text-accent-dm'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
            {props.label}
        </button>
    );

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">Reportes de Inversión</h1>
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                   <TabButton view="snapshot" label="Snapshot de Cartera" />
                   <TabButton view="performance" label="Reporte de Rendimiento" />
                </nav>
            </div>
            
            {activeReport === 'snapshot' && <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md"><SnapshotReport /></div>}
            {activeReport === 'performance' && <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md"><PerformanceReport /></div>}
        </div>
    );
};

export default InvestmentReportModule;