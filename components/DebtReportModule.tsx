import React, { useState, useMemo, useCallback } from 'react';
import { useFinancialCalculations } from '../utils/calculations';
import { daysBetween, calculateFinancialsForDate, getTodayArgentinaDate, calculateUsdAnalysisForDate } from '../utils/financials';
import type { Debt, Bank, Broker, DebtType, Cost, ArbitrageOperation, Company } from '../types';
import { Currency } from '../types';
import { DocumentChartBarIcon, ArrowUturnLeftIcon } from './Icons';
import { exportMultiSheetExcel } from '../utils/export';
import type { ExportColumn } from '../utils/export';
import FormattedNumberInput from './FormattedNumberInput';
import { formatPercentageForDisplay } from '../utils/formatting';

// --- Helper Functions ---

const safeFormatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return '-';
    // Dates are YYYY-MM-DD and should be treated as UTC to avoid timezone issues.
    const date = new Date(dateString + 'T00:00:00Z');
    // Manual format to ensure dd/mm/yyyy
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
};


const getCostValue = (cost: Cost | number | undefined, baseAmount: number): number => {
    if (!cost) return 0;
    if (typeof cost === 'number') {
        if (cost > 1000) return 0;
        return baseAmount * (cost / 100);
    }
    if (typeof cost === 'object' && cost !== null) {
        if ('id' in cost && 'companyId' in cost) return 0;
        const value = 'value' in cost ? (cost as any).value : 'amount' in cost ? (cost as any).amount : null;
        if (value === null) return 0;
        if ((cost as any).type === 'percentage') return baseAmount * ((cost as any).value / 100);
        return (cost as any).value || 0;
    }
    return 0;
};

const getAccruedPortion = (totalCostAmount: number, debtOriginationDate: string, debtTerminationDate: string, snapshotDate: Date): number => {
    const totalTerm = daysBetween(debtOriginationDate, debtTerminationDate);
    if (totalTerm <= 0) return 0;
    const elapsedTerm = daysBetween(debtOriginationDate, snapshotDate);
    if (elapsedTerm <= 0) return 0;
    if (elapsedTerm >= totalTerm) return totalCostAmount;
    return (totalCostAmount / totalTerm) * elapsedTerm;
};

// --- Report Data Interfaces ---
interface DetailedDebtCost {
    debtId: string;
    debtType: string;
    counterpartyName: string;
    amount: number;
    originationDate: string;
    dueDate: string;
    tna: number;
    currency: Currency;
    // ARS Breakdown
    accruedInterestARS: number;
    accruedCommissionARS: number;
    accruedStampsARS: number;
    accruedMarketRightsARS: number;
    subtotalCostsARS: number;
    // USD Breakdown
    accruedInterestUSD: number;
    accruedCommissionUSD: number;
    accruedStampsUSD: number;
    accruedMarketRightsUSD: number;
    subtotalCostsUSD: number;
    // Arbitrage
    arbitragePnlARS: number;
    arbitragePnlUSD: number;
    // Totals
    totalNetCostARS: number;
    totalNetCostUSD: number;
}

const FinancialCostReport: React.FC = () => {
    const { companyDebts, exchangeRates, companyArbitrageOps, appSettings, banks, brokers } = useFinancialCalculations();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateReport = () => {
        if (!startDate || !endDate) {
            alert('Por favor, seleccione una fecha de inicio y de fin.');
            return;
        }
        setIsLoading(true);
        setReportData(null);

        const start = new Date(startDate + 'T00:00:00Z');
        const end = new Date(endDate + 'T00:00:00Z');
        const prevDayOfStart = new Date(start);
        prevDayOfStart.setUTCDate(start.getUTCDate() - 1);
        
        const spotRateStart = [...exchangeRates].sort((a, b) => b.date.localeCompare(a.date)).find(r => r.date <= prevDayOfStart.toISOString().split('T')[0])?.rate || 1;
        const spotRateEnd = [...exchangeRates].sort((a, b) => b.date.localeCompare(a.date)).find(r => r.date <= end.toISOString().split('T')[0])?.rate || 1;
        
        const getCounterpartyName = (d: Debt): string => {
            if (d.bankId) return banks.find(b => b.id === d.bankId)?.name || 'N/D';
            if (d.brokerId) return brokers.find(b => b.id === d.brokerId)?.name || 'N/D';
            return 'N/A';
        };

        const debtIds = new Set(companyDebts.map(d => d.id));
        const arbitragePnlByDebtId = new Map<string, { ars: number; usd: number }>();
        const includedArbitrageOps: any[] = [];

        companyArbitrageOps.forEach(op => {
            const closingDateStr = op.cancellationDate || op.arbitrageDate;
            if (op.linkedDebtId && debtIds.has(op.linkedDebtId) && closingDateStr >= startDate && closingDateStr <= endDate) {
                const spotOnClose = [...exchangeRates].sort((a,b) => b.date.localeCompare(a.date)).find(r => r.date <= closingDateStr)?.rate;
                if (!spotOnClose) return;

                const closingRate = op.cancellationRate || spotOnClose;
                const pnl_ars = (op.position === 'Vendida' ? op.arbitrageRate - closingRate : closingRate - op.arbitrageRate) * op.usdAmount;
                const pnl_usd = pnl_ars / spotOnClose;
                
                const currentPnl = arbitragePnlByDebtId.get(op.linkedDebtId) || { ars: 0, usd: 0 };
                arbitragePnlByDebtId.set(op.linkedDebtId, { ars: currentPnl.ars + pnl_ars, usd: currentPnl.usd + pnl_usd });
                includedArbitrageOps.push({ ...op, pnl_usd_calculated: pnl_usd, pnl_ars_calculated: pnl_ars });
            }
        });
        
        const detailedReportData: DetailedDebtCost[] = [];

        companyDebts.forEach(debt => {
            const originationDate = new Date(debt.originationDate + 'T00:00:00Z');
            const terminationDate = new Date((debt.actualCancellationDate || debt.dueDate) + 'T00:00:00Z');
            
            if (originationDate > end || terminationDate < start) return;

            const financialsStart = calculateFinancialsForDate(debt, prevDayOfStart, appSettings);
            const financialsEnd = calculateFinancialsForDate(debt, end, appSettings);
            
            const totalCommission = getCostValue(debt.commission, debt.amount);
            const totalStamps = getCostValue(debt.stamps, debt.amount);
            const totalMarketRights = getCostValue(debt.marketRights, debt.amount);
            
            const accruedCommissionStart = getAccruedPortion(totalCommission, debt.originationDate, debt.actualCancellationDate || debt.dueDate, prevDayOfStart);
            const accruedStampsStart = getAccruedPortion(totalStamps, debt.originationDate, debt.actualCancellationDate || debt.dueDate, prevDayOfStart);
            const accruedMarketRightsStart = getAccruedPortion(totalMarketRights, debt.originationDate, debt.actualCancellationDate || debt.dueDate, prevDayOfStart);

            const accruedCommissionEnd = getAccruedPortion(totalCommission, debt.originationDate, debt.actualCancellationDate || debt.dueDate, end);
            const accruedStampsEnd = getAccruedPortion(totalStamps, debt.originationDate, debt.actualCancellationDate || debt.dueDate, end);
            const accruedMarketRightsEnd = getAccruedPortion(totalMarketRights, debt.originationDate, debt.actualCancellationDate || debt.dueDate, end);

            let accruedInterestARS = 0, accruedCommissionARS = 0, accruedStampsARS = 0, accruedMarketRightsARS = 0;
            let accruedInterestUSD = 0, accruedCommissionUSD = 0, accruedStampsUSD = 0, accruedMarketRightsUSD = 0;

            if (debt.currency === Currency.USD) {
                accruedInterestUSD = -(financialsEnd.accruedInterest - financialsStart.accruedInterest);
                accruedCommissionUSD = -(accruedCommissionEnd - accruedCommissionStart);
                accruedStampsUSD = -(accruedStampsEnd - accruedStampsStart);
                accruedMarketRightsUSD = -(accruedMarketRightsEnd - accruedMarketRightsStart);
            } else { // ARS
                accruedInterestARS = -(financialsEnd.accruedInterest - financialsStart.accruedInterest);
                accruedCommissionARS = -(accruedCommissionEnd - accruedCommissionStart);
                accruedStampsARS = -(accruedStampsEnd - accruedStampsStart);
                accruedMarketRightsARS = -(accruedMarketRightsEnd - accruedMarketRightsStart);
                
                accruedInterestUSD = -((financialsEnd.accruedInterest / spotRateEnd) - (financialsStart.accruedInterest / spotRateStart));
                accruedCommissionUSD = -((accruedCommissionEnd / spotRateEnd) - (accruedCommissionStart / spotRateStart));
                accruedStampsUSD = -((accruedStampsEnd / spotRateEnd) - (accruedStampsStart / spotRateStart));
                accruedMarketRightsUSD = -((accruedMarketRightsEnd / spotRateEnd) - (accruedMarketRightsStart / spotRateStart));
            }

            const subtotalCostsARS = accruedInterestARS + accruedCommissionARS + accruedStampsARS + accruedMarketRightsARS;
            const subtotalCostsUSD = accruedInterestUSD + accruedCommissionUSD + accruedStampsUSD + accruedMarketRightsUSD;
            
            const arbitragePnl = arbitragePnlByDebtId.get(debt.id) || { ars: 0, usd: 0 };
            
            if (Math.abs(subtotalCostsUSD) > 0.01 || Math.abs(arbitragePnl.usd) > 0.01) {
                const detail: DetailedDebtCost = {
                    debtId: debt.id,
                    debtType: debt.type,
                    counterpartyName: getCounterpartyName(debt),
                    amount: debt.amount,
                    originationDate: debt.originationDate,
                    dueDate: debt.dueDate,
                    tna: debt.rate,
                    currency: debt.currency,
                    accruedInterestARS, accruedCommissionARS, accruedStampsARS, accruedMarketRightsARS,
                    subtotalCostsARS,
                    accruedInterestUSD, accruedCommissionUSD, accruedStampsUSD, accruedMarketRightsUSD,
                    subtotalCostsUSD,
                    arbitragePnlARS: arbitragePnl.ars,
                    arbitragePnlUSD: arbitragePnl.usd,
                    totalNetCostARS: subtotalCostsARS + arbitragePnl.ars,
                    totalNetCostUSD: subtotalCostsUSD + arbitragePnl.usd,
                };
                detailedReportData.push(detail);
            }
        });
        
        const totalCostsUSD = detailedReportData.reduce((sum, item) => sum + item.subtotalCostsUSD, 0);
        const totalArbitragePnlUSD = Array.from(arbitragePnlByDebtId.values()).reduce((sum, pnl) => sum + pnl.usd, 0);

        setReportData({
            totalCostsUSD,
            totalArbitragePnlUSD,
            netFinancialCostUSD: totalCostsUSD + totalArbitragePnlUSD,
            detailedReport: detailedReportData,
            arbitrageDetails: includedArbitrageOps,
        });
        setIsLoading(false);
    };

    const handleExport = () => {
        if (!reportData) return;
        const { detailedReport, totalCostsUSD, totalArbitragePnlUSD, netFinancialCostUSD, arbitrageDetails } = reportData;

        const summaryData = [
            { 'Concepto': 'Total Intereses y Costos Devengados (USD)', 'Monto': totalCostsUSD },
            { 'Concepto': 'Resultado por Coberturas de Deuda (USD)', 'Monto': totalArbitragePnlUSD },
            { 'Concepto': 'Costo Financiero Neto (USD)', 'Monto': netFinancialCostUSD },
        ];
        const summaryColumns: ExportColumn<any>[] = [
            { header: 'Concepto', accessor: d => d.Concepto },
            { header: 'Monto (USD)', accessor: d => d.Monto }
        ];

        const detailColumns: ExportColumn<DetailedDebtCost>[] = [
            { header: 'Tipo de Deuda', accessor: d => d.debtType },
            { header: 'Banco/Broker', accessor: d => d.counterpartyName },
            { header: 'Monto', accessor: d => d.amount },
            { header: 'Moneda', accessor: d => d.currency },
            { header: 'Fecha Otorgamiento', accessor: d => safeFormatDate(d.originationDate) },
            { header: 'Fecha Vencimiento', accessor: d => safeFormatDate(d.dueDate) },
            { header: 'TNA (%)', accessor: d => formatPercentageForDisplay(d.tna) },
            { header: 'Intereses (ARS)', accessor: d => d.accruedInterestARS },
            { header: 'Comisiones (ARS)', accessor: d => d.accruedCommissionARS },
            { header: 'Sellos (ARS)', accessor: d => d.accruedStampsARS },
            { header: 'Der. Mercado (ARS)', accessor: d => d.accruedMarketRightsARS },
            { header: 'Subtotal Costos (ARS)', accessor: d => d.subtotalCostsARS },
            { header: 'Resultado Arbitraje (ARS)', accessor: d => d.arbitragePnlARS },
            { header: 'Costo Neto Total (ARS)', accessor: d => d.totalNetCostARS },
            { header: 'Intereses (USD)', accessor: d => d.accruedInterestUSD },
            { header: 'Comisiones (USD)', accessor: d => d.accruedCommissionUSD },
            { header: 'Sellos (USD)', accessor: d => d.accruedStampsUSD },
            { header: 'Der. Mercado (USD)', accessor: d => d.accruedMarketRightsUSD },
            { header: 'Subtotal Costos (USD)', accessor: d => d.subtotalCostsUSD },
            { header: 'Resultado Arbitraje (USD)', accessor: d => d.arbitragePnlUSD },
            { header: 'Costo Neto Total (USD)', accessor: d => d.totalNetCostUSD },
        ];
        
        const arbitrageColumns: ExportColumn<any>[] = [
            { header: 'Instrumento', accessor: d => d.instrument },
            { header: 'Posición', accessor: d => d.position },
            { header: 'Monto USD', accessor: d => d.usdAmount },
            { header: 'Fecha Cierre', accessor: d => d.cancellationDate || d.arbitrageDate },
            { header: 'Resultado (ARS)', accessor: d => d.pnl_ars_calculated },
            { header: 'Resultado (USD)', accessor: d => d.pnl_usd_calculated },
        ];

        exportMultiSheetExcel({
            fileName: `Reporte_Costo_Financiero_${startDate}_a_${endDate}`,
            sheets: [
                { sheetName: 'Resumen', data: summaryData, columns: summaryColumns },
                { sheetName: 'Detalle por Deuda', data: detailedReport, columns: detailColumns },
                { sheetName: 'Detalle de Arbitrajes', data: arbitrageDetails, columns: arbitrageColumns }
            ]
        });
    };

    const KpiCard: React.FC<{ title: string; value: number; colorClass?: string }> = ({ title, value, colorClass }) => (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg shadow-sm border dark:border-gray-700 text-center">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300">{title}</h4>
            <p className={`text-2xl font-bold mt-2 ${colorClass}`}>
                {value.toLocaleString('es-AR', { style: 'currency', currency: 'USD' })}
            </p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Seleccionar Período del Reporte</h2>
                <div className="flex items-end gap-4">
                    <div className="flex-grow">
                        <label className="text-sm font-medium">Fecha de Inicio (inclusive)</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2" />
                    </div>
                    <div className="flex-grow">
                        <label className="text-sm font-medium">Fecha de Fin (inclusive)</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2" />
                    </div>
                    <button onClick={handleGenerateReport} disabled={isLoading} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400">
                        {isLoading ? 'Generando...' : 'Generar Reporte'}
                    </button>
                </div>
            </div>

            {reportData && (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Resultados del Período</h2>
                        <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md text-sm">Exportar a Excel</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <KpiCard title="Total Costos Devengados" value={reportData.totalCostsUSD} colorClass="text-red-600 dark:text-red-400" />
                        <KpiCard title="Resultado por Coberturas" value={reportData.totalArbitragePnlUSD} colorClass={reportData.totalArbitragePnlUSD >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} />
                        <KpiCard title="Costo Financiero Neto" value={reportData.netFinancialCostUSD} colorClass="text-blue-600 dark:text-blue-400" />
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">Resumen por Deuda</h3>
                        <div className="overflow-y-auto max-h-96">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b dark:border-gray-600">
                                        <th className="text-left py-1">Deuda</th>
                                        <th className="text-left py-1">Banco/Broker</th>
                                        <th className="text-right py-1">Monto</th>
                                        <th className="text-center py-1">Otorgamiento</th>
                                        <th className="text-center py-1">Vencimiento</th>
                                        <th className="text-right py-1">TNA</th>
                                        <th className="text-right py-1">Costos Dev. (USD)</th>
                                        <th className="text-right py-1">Res. Cobertura (USD)</th>
                                        <th className="text-right py-1">Costo Neto (USD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.detailedReport.map((item: DetailedDebtCost) => (
                                        <tr key={item.debtId} className="border-b dark:border-gray-700/50">
                                            <td className="py-1">{item.debtType}</td>
                                            <td className="py-1">{item.counterpartyName}</td>
                                            <td className="py-1 text-right">{item.amount.toLocaleString('es-AR', { style: 'currency', currency: item.currency })}</td>
                                            <td className="py-1 text-center">{safeFormatDate(item.originationDate)}</td>
                                            <td className="py-1 text-center">{safeFormatDate(item.dueDate)}</td>
                                            <td className="py-1 text-right">{formatPercentageForDisplay(item.tna)}</td>
                                            <td className="text-right py-1">{item.subtotalCostsUSD.toLocaleString('es-AR', { style: 'currency', currency: 'USD' })}</td>
                                            <td className={`text-right py-1 ${item.arbitragePnlUSD >= 0 ? 'text-green-600' : 'text-red-500'}`}>{item.arbitragePnlUSD.toLocaleString('es-AR', { style: 'currency', currency: 'USD' })}</td>
                                            <td className="text-right py-1 font-bold">{item.totalNetCostUSD.toLocaleString('es-AR', { style: 'currency', currency: 'USD' })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="font-bold bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                       <td colSpan={6} className="py-2 text-right">Totales</td>
                                       <td className="py-2 text-right">{reportData.totalCostsUSD.toLocaleString('es-AR', { style: 'currency', currency: 'USD' })}</td>
                                       <td className={`py-2 text-right ${reportData.totalArbitragePnlUSD >= 0 ? 'text-green-600' : 'text-red-500'}`}>{reportData.totalArbitragePnlUSD.toLocaleString('es-AR', { style: 'currency', currency: 'USD' })}</td>
                                       <td className="py-2 text-right">{reportData.netFinancialCostUSD.toLocaleString('es-AR', { style: 'currency', currency: 'USD' })}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            <style>{`.animate-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
    );
};

const SnapshotReport: React.FC = () => {
    const { companyDebts, banks, brokers, debtTypes, exchangeRates, companyArbitrageOps, futureRateHistory, appSettings, companies, viewMode, selectedCompanyId, selectedConsolidatedCompanyIds, debts: allDebts } = useFinancialCalculations();
    const [snapshotDate, setSnapshotDate] = useState(() => getTodayArgentinaDate().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateReport = useCallback(() => {
        setIsLoading(true);
        
        const snapDate = new Date(snapshotDate + 'T00:00:00Z');
        const spotRate = [...exchangeRates].sort((a,b) => b.date.localeCompare(a.date)).find(r => r.date <= snapshotDate)?.rate || 1;
        const futureSnapshot = [...futureRateHistory].sort((a,b) => b.snapshotDate.localeCompare(a.snapshotDate)).find(s => s.snapshotDate <= snapshotDate);

        const activeDebts = companyDebts.filter(d => 
            d.originationDate <= snapshotDate && 
            (d.actualCancellationDate || d.dueDate) >= snapshotDate &&
            d.status !== 'cancelled'
        );

        const summary: any = { shortTerm: { ARS: {}, USD: {} }, longTerm: { ARS: {}, USD: {} } };
        const maturityMatrix: { [key: string]: { [period: string]: number } } = {};

        activeDebts.forEach(debt => {
            const termInDays = daysBetween(snapshotDate, debt.dueDate);
            const termCategory = termInDays <= 365 ? 'shortTerm' : 'longTerm';
            const counterpartyName = (debt.bankId ? banks.find(b => b.id === debt.bankId)?.name : brokers.find(b => b.id === debt.brokerId)?.name) || 'N/A';

            const principalDollarized = debt.currency === Currency.ARS ? debt.amount / spotRate : debt.amount;

            if (!summary[termCategory][debt.currency][debt.type]) {
                summary[termCategory][debt.currency][debt.type] = { amount: 0, weightedCftNumerator: 0, totalPrincipalForWeighting: 0 };
            }
            const group = summary[termCategory][debt.currency][debt.type];
            group.amount += principalDollarized;
            
            let period;
            const dueDate = new Date(debt.dueDate + 'T00:00:00Z');
            if (termCategory === 'shortTerm') {
                period = `${String(dueDate.getUTCFullYear()).slice(-2)}-${String(dueDate.getUTCMonth() + 1).padStart(2, '0')}`;
            } else {
                period = String(dueDate.getUTCFullYear());
            }

            if (!maturityMatrix[counterpartyName]) maturityMatrix[counterpartyName] = {};
            maturityMatrix[counterpartyName][period] = (maturityMatrix[counterpartyName][period] || 0) + principalDollarized;
        });
        
        setReportData({ summary, maturityMatrix });
        setIsLoading(false);
    }, [snapshotDate, companyDebts, banks, brokers, exchangeRates, futureRateHistory, appSettings, companyArbitrageOps]);

    const handleExport = useCallback(() => {
        if (isLoading) return;
        setIsLoading(true);

        const snapDate = new Date(snapshotDate + 'T00:00:00Z');
        const spotRate = [...exchangeRates].sort((a,b) => b.date.localeCompare(a.date)).find(r => r.date <= snapshotDate)?.rate || 1;
        const futureSnapshot = [...futureRateHistory].sort((a,b) => b.snapshotDate.localeCompare(a.snapshotDate)).find(s => s.snapshotDate <= snapshotDate);
        
        const allCompaniesToProcess = viewMode === 'consolidated' 
            ? companies.filter(c => selectedConsolidatedCompanyIds.includes(c.id)) 
            : companies.filter(c => c.id === selectedCompanyId);
        
        const getCounterpartyNameForExport = (d: Debt): string => {
            if (d.bankId) return banks.find(b => b.id === d.bankId)?.name || 'N/D';
            if (d.brokerId) return brokers.find(b => b.id === d.brokerId)?.name || 'N/D';
            return 'N/A';
        };
        
        let finalReportData: any[] = [];
        let detailSheetsForExport: { [key: string]: any[] } = {};

        allCompaniesToProcess.forEach((company, companyIndex) => {
            const companyDebts = allDebts.filter(d => d.companyId === company.id && d.originationDate <= snapshotDate && (d.actualCancellationDate || d.dueDate) >= snapshotDate && d.status !== 'cancelled');
            if (companyDebts.length === 0) return;

            companyDebts.forEach(debt => {
                 const counterpartyName = getCounterpartyNameForExport(debt);
                 const cftFinancials = calculateFinancialsForDate(debt, new Date(debt.dueDate), appSettings);
                if (!detailSheetsForExport[debt.type]) detailSheetsForExport[debt.type] = [];
                detailSheetsForExport[debt.type].push({
                    'Empresa': company.name, 'Banco/Broker': counterpartyName, 'Moneda': debt.currency,
                    'Fecha Otorgamiento': safeFormatDate(debt.originationDate), 'Fecha Vencimiento': safeFormatDate(debt.dueDate),
                    'Plazo (días)': daysBetween(debt.originationDate, debt.dueDate), 'Monto': debt.amount,
                    'TNA (%)': formatPercentageForDisplay(debt.rate), 'Sellos': getCostValue(debt.stamps, debt.amount),
                    'Comisiones': getCostValue(debt.commission, debt.amount), 'Derechos de Mercado': getCostValue(debt.marketRights, debt.amount),
                    'CFT (%)': formatPercentageForDisplay(cftFinancials.cft),
                });
            });

            const companyTotalUSD = companyDebts.reduce((sum, debt) => {
                const principal = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
                return sum + (debt.currency === 'ARS' ? principal / spotRate : principal);
            }, 0);

            const calculateSubtotal = (debts: Debt[]) => {
                let totalAmountUSD = 0, weightedCftNum = 0, weightedTasaUsdNum = 0, weightedCorreccionNum = 0, totalPrincipalForWeighting = 0, hasArsDebt = false;
                debts.forEach(debt => {
                    const principal = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
                    const principalUSD = debt.currency === 'ARS' ? principal / spotRate : principal;
                    totalAmountUSD += principalUSD;
                    const principalForWeighting = debt.currency === 'ARS' ? principal / debt.exchangeRateAtOrigination : principal;
                    totalPrincipalForWeighting += principalForWeighting;

                    const cftFinancials = calculateFinancialsForDate(debt, new Date(debt.dueDate), appSettings);
                    if (isFinite(cftFinancials.cft)) weightedCftNum += cftFinancials.cft * principalForWeighting;

                    const usdAnalysis = calculateUsdAnalysisForDate(debt, cftFinancials, futureSnapshot, appSettings, exchangeRates, companyArbitrageOps);
                    const tasaUSD = usdAnalysis?.usd_cft ?? (debt.currency === 'USD' ? cftFinancials.cft : null);
                    if (tasaUSD !== null && isFinite(tasaUSD)) weightedTasaUsdNum += tasaUSD * principalForWeighting;

                    if(debt.currency === 'ARS' && usdAnalysis?.projectedLoanDueDateRate && debt.exchangeRateAtOrigination > 0) {
                        hasArsDebt = true;
                        const term = daysBetween(debt.originationDate, debt.dueDate);
                        if (term > 0) {
                           const correccionTC = ((usdAnalysis.projectedLoanDueDateRate / debt.exchangeRateAtOrigination - 1) / term) * 365 * 100;
                           if(isFinite(correccionTC)) weightedCorreccionNum += correccionTC * principalForWeighting;
                        }
                    }
                });
                
                return {
                    'Importe expresado en US$': totalAmountUSD,
                    'Tasa en Moneda Original (%)': formatPercentageForDisplay(totalPrincipalForWeighting > 0 ? weightedCftNum / totalPrincipalForWeighting : 0),
                    'Corrección de Tipo de Cambio (%)': formatPercentageForDisplay(hasArsDebt && totalPrincipalForWeighting > 0 ? weightedCorreccionNum / totalPrincipalForWeighting : null),
                    'Tasa en US$ (%)': formatPercentageForDisplay(totalPrincipalForWeighting > 0 ? weightedTasaUsdNum / totalPrincipalForWeighting : 0),
                    '% sobre Deuda': formatPercentageForDisplay(companyTotalUSD > 0 ? (totalAmountUSD / companyTotalUSD) * 100 : 0),
                };
            };
            
            const companyTotalSubtotal = calculateSubtotal(companyDebts);
            companyTotalSubtotal['% sobre Deuda'] = '';
            companyTotalSubtotal['Corrección de Tipo de Cambio (%)'] = '';
            finalReportData.push({ 'Descripción': `TOTAL ${company.name}`, ...companyTotalSubtotal });
            finalReportData.push({});

            const groupedByTerm: { shortTerm: Debt[], longTerm: Debt[] } = { shortTerm: [], longTerm: [] };
            companyDebts.forEach(d => {
                const termInDays = daysBetween(snapshotDate, d.dueDate);
                if (termInDays <= 365) groupedByTerm.shortTerm.push(d); else groupedByTerm.longTerm.push(d);
            });
            
            (['shortTerm', 'longTerm'] as const).forEach((term, termIndex) => {
                const termDebts = groupedByTerm[term];
                if (termDebts.length === 0) return;
                finalReportData.push({ 'Descripción': `  TOTAL ${term === 'shortTerm' ? 'CORTO PLAZO' : 'LARGO PLAZO'}`, ...calculateSubtotal(termDebts) });
                finalReportData.push({});

                const groupedByCurrency: { ARS: Debt[], USD: Debt[] } = { ARS: [], USD: [] };
                termDebts.forEach(d => groupedByCurrency[d.currency].push(d));
                (['ARS', 'USD'] as const).forEach(currency => {
                    const currencyDebts = groupedByCurrency[currency];
                    if (currencyDebts.length === 0) return;
                    finalReportData.push({ 'Descripción': `    SUBTOTAL ${currency === 'ARS' ? 'Pesos' : 'Dólares'}`, ...calculateSubtotal(currencyDebts) });
                    
                    const groupedByType: { [key: string]: Debt[] } = {};
                    currencyDebts.forEach(d => { if (!groupedByType[d.type]) groupedByType[d.type] = []; groupedByType[d.type].push(d); });
                    Object.keys(groupedByType).sort().forEach(type => { finalReportData.push({ 'Descripción': `      ${type}`, ...calculateSubtotal(groupedByType[type]) }); });
                });
                if (termIndex < 1 && groupedByTerm['longTerm'].length > 0) finalReportData.push({});
            });
             if (companyIndex < allCompaniesToProcess.length - 1) finalReportData.push({});
        });
        
        const snapshotColumns: ExportColumn<any>[] = [
            { header: 'Descripción', accessor: d => d['Descripción'] }, { header: 'Importe expresado en US$', accessor: d => d['Importe expresado en US$'] }, { header: 'Tasa en Moneda Original (%)', accessor: d => d['Tasa en Moneda Original (%)'] },
            { header: 'Corrección de Tipo de Cambio (%)', accessor: d => d['Corrección de Tipo de Cambio (%)'] }, { header: 'Tasa en US$ (%)', accessor: d => d['Tasa en US$ (%)'] }, { header: '% sobre Deuda', accessor: d => d['% sobre Deuda'] },
        ];
        
        const detailSheets = Object.keys(detailSheetsForExport).sort().map(sheetName => {
            const sheetData = detailSheetsForExport[sheetName];
            let columns: ExportColumn<any>[];
            const baseColumns = ['Banco/Broker', 'Moneda', 'Fecha Otorgamiento', 'Fecha Vencimiento', 'Plazo (días)', 'Monto', 'TNA (%)', 'Sellos', 'Comisiones', 'Derechos de Mercado', 'CFT (%)'];
            if (viewMode === 'consolidated') {
                columns = [{ header: 'Empresa', accessor: (d: any) => d['Empresa'] }, ...baseColumns.map(key => ({ header: key, accessor: (d: any) => d[key] }))]
            } else {
                 columns = baseColumns.map(key => ({ header: key, accessor: (d: any) => d[key] }));
            }
            return { sheetName, data: sheetData, columns };
        });

        // --- Vencimientos Sheets Logic (NEW MATRIX FORMAT) ---
        const maturitySheets: { sheetName: string; data: any[]; columns: ExportColumn<any>[]; }[] = [];
        const generateMaturityMatrixData = (debtsToProcess: Debt[]) => {
            const activeDebts = debtsToProcess.filter(d => d.status !== 'cancelled' && new Date(d.dueDate + 'T00:00:00Z') >= snapDate);
            if (activeDebts.length === 0) return null;

            const counterparties = [...new Set(activeDebts.map(getCounterpartyNameForExport))].sort();
            
            const periodKeys = [...new Set(activeDebts.map(d => {
                const date = new Date(d.dueDate + 'T00:00:00Z');
                return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            }))].sort();

            const pivotData: { [counterparty: string]: { [period: string]: number } } = {};
            counterparties.forEach(c => pivotData[c] = {});

            activeDebts.forEach(debt => {
                const counterparty = getCounterpartyNameForExport(debt);
                const date = new Date(debt.dueDate + 'T00:00:00Z');
                const periodKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
                const amountUSD = debt.currency === Currency.USD ? debt.amount : debt.amount / spotRate;
                if (pivotData[counterparty]) {
                    pivotData[counterparty][periodKey] = (pivotData[counterparty][periodKey] || 0) + amountUSD;
                }
            });

            const dataForExport = counterparties.map(counterparty => {
                const row: { [key: string]: string | number } = { 'Contraparte': counterparty };
                periodKeys.forEach(period => { row[period] = pivotData[counterparty][period] || 0; });
                return row;
            });

            const columnsForExport: ExportColumn<any>[] = [
                { header: 'Contraparte', accessor: d => d['Contraparte'] },
                ...periodKeys.map(periodKey => {
                    const [year, month] = periodKey.split('-');
                    const headerDate = new Date(Number(year), Number(month) - 1);
                    const headerLabel = headerDate.toLocaleDateString('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(/\.$/, ''); // Remove trailing dot if present
                    return { header: headerLabel, accessor: (d: any) => d[periodKey] };
                })
            ];
            return { data: dataForExport, columns: columnsForExport };
        };

        const allActiveDebtsForMaturity = allDebts.filter(d =>
            ((viewMode === 'individual' && d.companyId === selectedCompanyId) ||
             (viewMode === 'consolidated' && selectedConsolidatedCompanyIds.includes(d.companyId))) &&
            d.status !== 'cancelled'
        );
        
        if (viewMode === 'consolidated') {
            const consolidatedMatrix = generateMaturityMatrixData(allActiveDebtsForMaturity);
            if (consolidatedMatrix) {
                maturitySheets.push({ sheetName: 'Vencimientos (Consolidado)', ...consolidatedMatrix });
            }
            allCompaniesToProcess.forEach(company => {
                const companyMatrix = generateMaturityMatrixData(allActiveDebtsForMaturity.filter(d => d.companyId === company.id));
                if (companyMatrix) {
                     maturitySheets.push({ sheetName: `Vto - ${company.name}`, ...companyMatrix });
                }
            });
        } else {
            const individualMatrix = generateMaturityMatrixData(allActiveDebtsForMaturity);
            if (individualMatrix) {
                 maturitySheets.push({ sheetName: 'Vencimientos', ...individualMatrix });
            }
        }
        
        exportMultiSheetExcel({
            fileName: `Reporte_Deuda_Snapshot_${snapshotDate}`,
            sheets: [ { sheetName: 'Snapshot Deuda', data: finalReportData, columns: snapshotColumns }, ...detailSheets, ...maturitySheets ]
        });

        setIsLoading(false);
    }, [isLoading, snapshotDate, exchangeRates, futureRateHistory, viewMode, companies, selectedConsolidatedCompanyIds, selectedCompanyId, allDebts, appSettings, companyArbitrageOps, banks, brokers]);
    
    // ... rest of the component (UI part) is unchanged and is kept for context
    const formatValue = (value: number) => value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatPercent = (value: number) => `${value.toFixed(2)}%`;

    const RenderSummaryTable: React.FC<{data: any, title: string}> = ({ data, title }) => {
        return (
            <div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">{title}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {Object.entries({ 'Pesos': data.ARS, 'Dólares': data.USD }).map(([currency, types]) => (
                        <div key={currency} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                            <h4 className="font-bold text-lg mb-2">{currency}</h4>
                            <table className="w-full text-sm">
                                <thead><tr className="border-b dark:border-gray-600"><th className="text-left py-1">Tipo</th><th className="text-right py-1">Monto (USD)</th><th className="text-right py-1">CFT Ponderado</th></tr></thead>
                                <tbody>
                                    {Object.entries(types as any).map(([type, group]: any) => (
                                        <tr key={type} className="border-b dark:border-gray-600/50">
                                            <td className="py-1">{type}</td>
                                            <td className="text-right py-1">{formatValue(group.amount)}</td>
                                            <td className="text-right py-1 font-semibold text-primary dark:text-accent-dm">{formatPercent(group.totalPrincipalForWeighting > 0 ? group.weightedCftNumerator / group.totalPrincipalForWeighting : 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </div>
        )
    };
    
     const RenderMaturityTable: React.FC<{data: any}> = ({data}) => {
        const periods = new Set<string>();
        Object.values(data).forEach((periodData: any) => Object.keys(periodData).forEach(p => periods.add(p)));
        const sortedPeriods = Array.from(periods).sort((a, b) => {
            const isYearA = a.length === 4; const isYearB = b.length === 4;
            if (isYearA && !isYearB) return 1; if (!isYearA && isYearB) return -1;
            return a.localeCompare(b);
        });

        return (
             <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-700"><tr className="border-b dark:border-gray-600">
                        <th className="p-2 text-left sticky left-0 bg-gray-100 dark:bg-gray-700">Contraparte</th>
                        {sortedPeriods.map(p => <th key={p} className="p-2 text-right">{p}</th>)}
                    </tr></thead>
                    <tbody>
                        {Object.entries(data).map(([counterparty, periodData]: any) => (
                            <tr key={counterparty} className="border-b dark:border-gray-600/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-2 sticky left-0 bg-white dark:bg-gray-800 font-semibold">{counterparty}</td>
                                {sortedPeriods.map(p => <td key={p} className="p-2 text-right">{periodData[p] ? formatValue(periodData[p]) : '-'}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        )
     };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Seleccionar Fecha del Reporte</h2>
                <div className="flex items-end gap-4">
                    <div className="flex-grow max-w-xs">
                        <label htmlFor="snapshot-date" className="text-sm font-medium">Fecha del Snapshot</label>
                        <input type="date" id="snapshot-date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)} max={getTodayArgentinaDate().toISOString().split('T')[0]} className="mt-1 block w-full border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 p-2" />
                    </div>
                    <button onClick={handleGenerateReport} disabled={isLoading} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400">
                        {isLoading ? 'Generando...' : 'Generar Vista Previa'}
                    </button>
                    <button onClick={handleExport} disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400">
                        Exportar a Excel
                    </button>
                    {reportData && <button onClick={() => setReportData(null)} className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm font-semibold py-2 px-4 rounded-lg"><ArrowUturnLeftIcon /> Limpiar</button>}
                </div>
            </div>

            {reportData && (
                 <div className="space-y-8 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                        <div className="flex justify-between items-center mb-4">
                             <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Vista Previa del Snapshot</h2>
                        </div>
                        <div className="space-y-6">
                           <RenderSummaryTable data={reportData.summary.shortTerm} title="Resumen Corto Plazo" />
                           <RenderSummaryTable data={reportData.summary.longTerm} title="Resumen Largo Plazo" />
                        </div>
                    </div>
                     <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">Cronograma de Vencimientos de Capital (USD)</h2>
                        <RenderMaturityTable data={reportData.maturityMatrix} />
                     </div>
                 </div>
            )}
        </div>
    );
};

const DebtReportModule: React.FC = () => {
    const [activeReport, setActiveReport] = useState<'snapshot' | 'cost'>('snapshot');
    
    const TabButton = (props: { view: 'snapshot' | 'cost', label: string }) => (
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
            <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">Reportes de Deuda</h1>
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                   <TabButton view="snapshot" label="Snapshot de Deuda" />
                   <TabButton view="cost" label="Reporte de Costo Financiero" />
                </nav>
            </div>
            
            {activeReport === 'snapshot' && <SnapshotReport />}
            {activeReport === 'cost' && <FinancialCostReport />}

        </div>
    );
};

export default DebtReportModule;