
import React, { useMemo, useState } from 'react';
import { Cell, PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useFinancialCalculations } from '../utils/calculations';
import { getTodayArgentinaDate, calculateFinancialsForDate } from '../utils/financials';
import { Currency } from '../types';
import type { AppSettings } from '../types';
import HelpTooltip from './HelpTooltip';
import MaturitiesWaterfallChart from './MaturitiesWaterfallChart';
import LiquidityGapChart from './LiquidityGapChart';
import HistoricalEvolutionChart from './HistoricalEvolutionChart';
import { useAppContext } from '../App';
import { ArrowsUpDownIcon } from './Icons';

const KpiCard: React.FC<{ 
    title: string; 
    value: string; 
    baseValue?: string;
    helpText: string; 
    colorClass?: string; 
    isStressed?: boolean 
}> = ({ title, value, baseValue, helpText, colorClass = 'text-gray-800 dark:text-gray-100', isStressed }) => (
    <div className={`p-4 rounded-lg shadow-sm border transition-all duration-300 ${isStressed ? 'bg-primary/5 border-primary/30 dark:bg-accent-dm/5 dark:border-accent-dm/30' : 'bg-white dark:bg-gray-800 dark:border-gray-700'}`}>
        <h3 className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
            {title} <HelpTooltip text={helpText} />
        </h3>
        <div className="mt-2">
            {baseValue && isStressed ? (
                <div className="flex flex-col">
                    <p className="text-xs text-gray-400 line-through">{baseValue}</p>
                    <p className={`text-xl lg:text-2xl font-bold ${colorClass}`}>{value}</p>
                </div>
            ) : (
                <p className={`text-xl lg:text-2xl font-bold ${colorClass}`}>{value}</p>
            )}
        </div>
        {isStressed && <div className="mt-1 inline-block px-1.5 py-0.5 bg-primary/10 dark:bg-accent-dm/10 text-[9px] font-black text-primary dark:text-accent-dm rounded">ESC. SIMULADO</div>}
    </div>
);

const Widget: React.FC<{title: string, children: React.ReactNode, className?: string}> = ({title, children, className=""}) => (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 ${className}`}>
        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-4">{title}</h3>
        {children}
    </div>
);

const PIE_PALETTE = ['#047857', '#10b981', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#84cc16', '#0891b2', '#f43f5e', '#64748b'];

const BreakdownPieChart: React.FC<{ data: { name: string, value: number }[], appSettings: AppSettings }> = ({ data, appSettings }) => {
    const isDarkMode = appSettings.theme === 'dark';
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500">Sin datos</div>;
    }
    return (
        <ResponsiveContainer width="100%" height={220}>
            <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {data.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_PALETTE[index % PIE_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `USD ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', color: isDarkMode ? '#9ca3af' : '#4b5563' }} />
            </PieChart>
        </ResponsiveContainer>
    );
};

const GlobalDashboard: React.FC = () => {
    const { state } = useAppContext();
    const { exchangeRates, marketPriceHistory } = state;
    const { companyDebts, investmentGroups, banks, latestRate, appSettings, companyDebtCalculations, companyInvestments, companyGrainCollections } = useFinancialCalculations();
    const today = useMemo(() => getTodayArgentinaDate(), []);

    const [fxShift, setFxShift] = useState(0); 
    const isStressed = fxShift !== 0;
    const effectiveRate = useMemo(() => latestRate * (1 + fxShift / 100), [latestRate, fxShift]);

    // Función de cálculo reutilizable para ambos escenarios
    const calculateStats = (rate: number) => {
        let totalDebtStockUSD = 0;
        companyDebts.forEach(debt => {
            const calcs = companyDebtCalculations.get(debt.id);
            if (!calcs) return;
            const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
            const accruedInterestNative = calcs.financials.accruedInterest;
            totalDebtStockUSD += (debt.currency === Currency.USD) ? (principalNative + accruedInterestNative) : (principalNative + accruedInterestNative) / rate;
        });

        const totalInvestmentValueUSD = investmentGroups.reduce((sum, group) => {
            return sum + group.holdings.reduce((hSum, h) => {
                const valUSD = h.currency === Currency.USD ? h.marketValue : h.marketValue / rate;
                return hSum + valUSD;
            }, 0);
        }, 0);

        const totalCreditLimitUSD = banks.reduce((sum, bank) => {
            return sum + bank.creditLines.reduce((bankSum, line) => {
                return bankSum + (line.currency === Currency.USD ? line.amount : line.amount / rate);
            }, 0);
        }, 0);

        const totalUsedCreditUSD = companyDebts.reduce((sum, debt) => {
             const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
             return sum + (debt.currency === Currency.USD ? principalNative : principalNative / rate);
        }, 0);

        return {
            netPosition: totalInvestmentValueUSD - totalDebtStockUSD,
            totalDebtUSD: totalDebtStockUSD,
            totalInvestmentUSD: totalInvestmentValueUSD,
            availableCredit: totalCreditLimitUSD - totalUsedCreditUSD,
        };
    };

    const baseStats = useMemo(() => calculateStats(latestRate), [latestRate, companyDebts, investmentGroups, banks, companyDebtCalculations]);
    const stressedStats = useMemo(() => isStressed ? calculateStats(effectiveRate) : baseStats, [isStressed, effectiveRate, companyDebts, investmentGroups, banks, companyDebtCalculations, baseStats]);

    const waterfallData = useMemo(() => {
        const data: any[] = [{ month: 'Posición Neta Actual', cumulativeNet: stressedStats.netPosition, debt: 0, investment: 0, net: 0, inflow: 0, outflow: 0 }];
        let runningBalance = stressedStats.netPosition;

        for (let i = 0; i < 6; i++) {
            const targetMonth = new Date(today);
            targetMonth.setUTCMonth(today.getUTCMonth() + i);
            const monthKey = `${targetMonth.getUTCFullYear()}-${String(targetMonth.getUTCMonth() + 1).padStart(2, '0')}`;
            
            // Outflows (Deuda)
            let debtMaturities = 0;
            companyDebts.forEach(d => {
                if (d.dueDate.startsWith(monthKey)) {
                    const financials = companyDebtCalculations.get(d.id)?.financials;
                    if (financials) {
                        debtMaturities -= d.currency === Currency.USD ? financials.totalToRepay : financials.totalToRepay / effectiveRate;
                    }
                }
            });
            
            // Inflows (Inversiones + Granos)
            let investmentMaturities = 0;
            investmentGroups.flatMap(g => g.holdings).forEach(h => {
                if (h.maturityDate?.startsWith(monthKey)) {
                    investmentMaturities += h.currency === Currency.USD ? h.marketValue : h.marketValue / effectiveRate; 
                }
            });

            let grainInflows = 0;
            companyGrainCollections.forEach(c => {
                if (c.status === 'matched' && (c.actualCollectionDate || c.dueDate).startsWith(monthKey)) {
                    const netARS = c.finalNetAmount ?? (c.grossAmount * (1 - c.tentativeDeductionPercentage/100));
                    grainInflows += netARS / effectiveRate;
                }
            });
            
            const totalInflow = investmentMaturities + grainInflows;
            const totalOutflow = Math.abs(debtMaturities);
            const netFlow = totalInflow - totalOutflow;
            runningBalance += netFlow;
            
            data.push({
                month: monthKey,
                inflow: totalInflow,
                outflow: totalOutflow,
                net: netFlow,
                cumulativeNet: runningBalance
            });
        }
        return data;
    }, [stressedStats.netPosition, companyDebts, investmentGroups, companyGrainCollections, companyDebtCalculations, effectiveRate, today]);
    
    const debtBreakdownData = useMemo(() => {
        const byType: Record<string, number> = {};
        companyDebts.forEach(debt => {
            const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
            const debtStockUSD = debt.currency === Currency.USD ? principalNative : principalNative / effectiveRate;
            byType[debt.type] = (byType[debt.type] || 0) + debtStockUSD;
        });
        return Object.entries(byType).map(([name, value]) => ({ name, value }));
    }, [companyDebts, effectiveRate]);

    const historicalData = useMemo(() => {
        const data: any[] = [];
        const rangeInDays = 90;
        for (let i = rangeInDays; i >= 0; i--) {
            const date = new Date(today);
            date.setUTCDate(today.getUTCDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const rateForDay = [...exchangeRates].sort((a,b) => b.date.localeCompare(a.date)).find(r => r.date <= dateStr)?.rate || latestRate;
            
            let hDebt = 0;
            companyDebts.forEach(debt => {
                if (debt.originationDate <= dateStr && (debt.actualCancellationDate || debt.dueDate) > dateStr) {
                    const financials = calculateFinancialsForDate(debt, date, appSettings);
                    const val = (debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount) + financials.accruedInterest;
                    hDebt += debt.currency === Currency.USD ? val : val / rateForDay;
                }
            });

            let hInv = 0;
            companyInvestments.forEach(inv => {
                const totalQty = inv.transactions.filter(t => t.date <= dateStr).reduce((acc, t) => acc + (t.type === 'Compra' ? t.quantity : -t.quantity), 0);
                if (totalQty > 0) {
                    const price = marketPriceHistory.find(s => s.date <= dateStr)?.prices[inv.instrumentName.toLowerCase()] || 0;
                    const val = totalQty * price;
                    hInv += inv.currency === Currency.USD ? val : val / rateForDay;
                }
            });

            data.push({ date: dateStr, "Deuda Total": hDebt, "Inversiones Totales": hInv, "Posición Neta": hInv - hDebt });
        }
        return data;
    }, [companyDebts, companyInvestments, exchangeRates, marketPriceHistory, appSettings, latestRate, today]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700">
          <div>
            <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Panel de Control Estratégico</h1>
            <p className="text-xs text-gray-500">Estado consolidado y simulación de escenarios de estrés.</p>
          </div>
          
          {/* Stress Test Control */}
          <div className="bg-primary/5 dark:bg-accent-dm/5 border border-primary/20 dark:border-accent-dm/20 p-2 px-4 rounded-xl flex items-center gap-6 w-full lg:w-auto">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 dark:bg-accent-dm/10 rounded-lg text-primary dark:text-accent-dm">
                    <ArrowsUpDownIcon className="w-5 h-5" />
                  </div>
                  <div>
                      <p className="text-[9px] uppercase font-black text-gray-400 leading-none">Stress Test CCL</p>
                      <p className="text-lg font-black text-primary dark:text-accent-dm">${effectiveRate.toLocaleString('es-AR', {minimumFractionDigits: 2})}</p>
                  </div>
              </div>
              <div className="flex-grow min-w-[150px]">
                  <input 
                    type="range" min="-20" max="100" step="5" value={fxShift} 
                    onChange={(e) => setFxShift(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[9px] font-bold text-gray-400 mt-1 uppercase">
                      <span>TC Actual</span>
                      <span className={isStressed ? 'text-primary dark:text-accent-dm scale-110' : ''}>{fxShift > 0 ? `+${fxShift}%` : `${fxShift}%`}</span>
                      <span>+100%</span>
                  </div>
              </div>
              {isStressed && (
                  <button onClick={() => setFxShift(0)} className="text-[10px] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1 rounded-md hover:bg-gray-50 font-black transition-all">RESET</button>
              )}
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
            title="Posición Neta" 
            value={`USD ${stressedStats.netPosition.toLocaleString('es-AR', {maximumFractionDigits:0})}`} 
            baseValue={isStressed ? `USD ${baseStats.netPosition.toLocaleString('es-AR', {maximumFractionDigits:0})}` : undefined}
            isStressed={isStressed}
            helpText="Muestra la solvencia neta de la empresa. En modo Stress Test, recalcula las deudas e inversiones en pesos al nuevo tipo de cambio simulado." 
            colorClass={stressedStats.netPosition >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} 
        />
        <KpiCard 
            title="Deuda Stock (USD)" 
            value={`USD ${stressedStats.totalDebtUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}`} 
            baseValue={isStressed ? `USD ${baseStats.totalDebtUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}` : undefined}
            isStressed={isStressed}
            helpText="Capital total adeudado más intereses acumulados. La devaluación reduce el peso de la deuda en pesos cuando se mide en USD." 
        />
        <KpiCard 
            title="Inversiones (USD)" 
            value={`USD ${stressedStats.totalInvestmentUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}`} 
            baseValue={isStressed ? `USD ${baseStats.totalInvestmentUSD.toLocaleString('es-AR', {maximumFractionDigits:0})}` : undefined}
            isStressed={isStressed}
            helpText="Valor de mercado de la cartera. Si tiene bonos en pesos, una devaluación licuará su valor en dólares." 
        />
        <KpiCard 
            title="Crédito Disponible" 
            value={`USD ${stressedStats.availableCredit.toLocaleString('es-AR', {maximumFractionDigits:0})}`} 
            baseValue={isStressed ? `USD ${baseStats.availableCredit.toLocaleString('es-AR', {maximumFractionDigits:0})}` : undefined}
            isStressed={isStressed}
            helpText="Poder de fuego financiero restante. Incluye líneas bancarias no utilizadas." 
            colorClass="text-blue-600 dark:text-blue-400"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Widget title="Análisis de Brechas (Income vs Expense)" className="lg:col-span-8">
             <LiquidityGapChart data={waterfallData.filter(d => d.month !== 'Posición Neta Actual')} appSettings={appSettings} />
          </Widget>
          <Widget title="Estructura de Pasivos" className="lg:col-span-4">
             <BreakdownPieChart data={debtBreakdownData} appSettings={appSettings} />
          </Widget>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Widget title="Evolución Histórica (90 días)">
             <HistoricalEvolutionChart data={historicalData} appSettings={appSettings} />
          </Widget>
          <Widget title="Proyección de Solvencia (Caja Acumulada)">
             <MaturitiesWaterfallChart data={waterfallData} appSettings={appSettings} />
          </Widget>
      </div>
    </div>
  );
};

export default GlobalDashboard;
