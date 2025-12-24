import React, { useMemo } from 'react';
import type { Debt } from '../types';
import { Currency } from '../types';
import { useFinancialCalculations } from '../utils/calculations';
import HelpTooltip from './HelpTooltip';
import { getTodayArgentinaDate } from '../utils/financials';
import { formatPercentageForDisplay } from '../utils/formatting';
import { useAppContext } from '../App';

const KpiCard: React.FC<{ title: string; value: string; subValue?: string; helpText: string, colorClass?: string }> = ({ title, value, subValue, helpText, colorClass = 'text-gray-800 dark:text-gray-100' }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
            {title}
            <HelpTooltip text={helpText} />
        </h3>
        <p className={`text-2xl font-bold mt-2 ${colorClass}`}>{value}</p>
        {subValue && <p className="text-xs text-gray-500 dark:text-gray-400">{subValue}</p>}
    </div>
);

interface SummaryDashboardProps {
    debts: Debt[];
}

const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ debts }) => {
    const { companyDebtCalculations, banks, latestRate } = useFinancialCalculations();
    const { state } = useAppContext();
    const { viewMode, selectedCompanyId, selectedConsolidatedCompanyIds } = state;

    const summaryData = useMemo(() => {
        const companyIds = new Set(viewMode === 'individual' ? (selectedCompanyId ? [selectedCompanyId] : []) : selectedConsolidatedCompanyIds);
        let totalDebtStockUSD = 0;
        let totalWeightedCftNumerator = 0;
        let totalPrincipalUSD = 0;
        let nextMaturity = { date: 'N/A', amount: 0, name: '' };
        
        const today = getTodayArgentinaDate();

        debts.forEach(debt => {
            const calcs = companyDebtCalculations.get(debt.id);
            if (!calcs) return;

            const { financials, usdAnalysis } = calcs;
            const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
            const debtStockUSD = debt.currency === Currency.USD ? principalNative : principalNative / latestRate;
            const principalForRateWeightingUSD = debt.currency === Currency.USD ? principalNative : principalNative / debt.exchangeRateAtOrigination;
            let cftInUsd: number | null = null;
            if (debt.currency === Currency.USD) cftInUsd = financials.cft;
            else if (usdAnalysis?.usd_cft) cftInUsd = usdAnalysis.usd_cft;

            totalDebtStockUSD += debtStockUSD + (debt.currency === Currency.USD ? financials.accruedInterest : financials.accruedInterest / latestRate);

            if (cftInUsd !== null && isFinite(cftInUsd) && principalForRateWeightingUSD > 0) {
                totalWeightedCftNumerator += cftInUsd * principalForRateWeightingUSD;
                totalPrincipalUSD += principalForRateWeightingUSD;
            }
            
            const dueDate = new Date(debt.dueDate + "T00:00:00Z");
            if (dueDate >= today) {
                if (nextMaturity.date === 'N/A' || dueDate < new Date(nextMaturity.date)) {
                    nextMaturity = { date: debt.dueDate, amount: debtStockUSD, name: debt.type };
                }
            }
        });

        const totalCreditLimitUSD = banks.reduce((sum, bank) => {
            const bankLimit = bank.creditLines
                .filter(line => companyIds.has(line.companyId))
                .reduce((bankSum, line) => {
                    return bankSum + (line.currency === Currency.USD ? line.amount : line.amount / latestRate);
                }, 0);
            return sum + bankLimit;
        }, 0);

        const totalUsedCreditUSD = debts.reduce((sum, debt) => {
             const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
             return sum + (debt.currency === Currency.USD ? principalNative : principalNative / latestRate);
        }, 0);

        return {
            totalDebtStockUSD,
            overallWeightedCft: totalPrincipalUSD > 0 ? totalWeightedCftNumerator / totalPrincipalUSD : 0,
            availableCredit: totalCreditLimitUSD - totalUsedCreditUSD,
            nextMaturity
        };
    }, [debts, companyDebtCalculations, banks, latestRate, viewMode, selectedCompanyId, selectedConsolidatedCompanyIds]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
                title="Deuda Total Devengada"
                value={`USD ${summaryData.totalDebtStockUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                helpText="Capital total adeudado más intereses acumulados hasta hoy, valorizado en USD."
                colorClass="text-red-600 dark:text-red-400"
            />
            <KpiCard
                title="CFT Ponderada"
                value={formatPercentageForDisplay(summaryData.overallWeightedCft)}
                helpText="Costo Financiero Total promedio de la cartera de deudas, ponderada por el monto de cada operación."
                colorClass="text-blue-600 dark:text-blue-400"
            />
            <KpiCard
                title="Crédito Disponible"
                value={`USD ${summaryData.availableCredit.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                helpText="Suma de todas las líneas de crédito menos la deuda utilizada. Indica la capacidad de endeudamiento inmediato."
                colorClass="text-green-600 dark:text-green-400"
            />
             <KpiCard
                title="Próximo Vencimiento Relevante"
                value={new Date(summaryData.nextMaturity.date + "T00:00:00Z").toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                subValue={`${summaryData.nextMaturity.name} - USD ${summaryData.nextMaturity.amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                helpText="Muestra la fecha, tipo y monto del próximo vencimiento de deuda."
            />
        </div>
    );
};

export default SummaryDashboard;