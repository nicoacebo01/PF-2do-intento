import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { Debt, Investment } from '../types';
import { Currency } from '../types';
import { calculateFinancialsForDate, daysBetween, getInterpolatedRate, getTodayArgentinaDate } from '../utils/financials';
import { useAppContext } from '../App';

interface NetPositionModuleProps {}

const PALETTE = ['#1e40af', '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#84cc16', '#0891b2', '#f43f5e', '#64748b'];

const BreakdownPieChart: React.FC<{ data: {name: string, value: number}[] }> = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">Sin datos</div>;
    }
    return (
        <ResponsiveContainer width="100%" height={200}>
            <PieChart>
                <Pie 
                  data={data} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={60} 
                  fill="#8884d8"
                  labelLine={false}
                  // FIX: Type the destructured props for the label renderer function to resolve TS errors.
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                    const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
                    const x = Number(cx) + radius * Math.cos(-midAngle * (Math.PI / 180));
                    const y = Number(cy) + radius * Math.sin(-midAngle * (Math.PI / 180));
                    if (percent < 0.05) return null; // Don't render label for small slices
                    return (
                        <text x={x} y={y} fill="#666" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12" className="dark:fill-gray-300">
                            {`${(percent * 100).toFixed(0)}%`}
                        </text>
                    );
                }}>
                    {data.map((entry, index) => <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => [`USD ${value.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`, 'Valor']} />
                <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '12px'}} />
            </PieChart>
        </ResponsiveContainer>
    );
};

const NetPositionModule: React.FC<NetPositionModuleProps> = () => {
    const { state } = useAppContext();
    const { debts, investments, exchangeRates, arbitrageOperations, futureRateHistory, appSettings, marketPriceHistory, investmentTypes, banks, brokers } = state;

    const [selectedDate, setSelectedDate] = useState<string>(() => getTodayArgentinaDate().toISOString().split('T')[0]);
    const [debtBreakdownBy, setDebtBreakdownBy] = useState<'type' | 'currency' | 'counterparty'>('type');
    const [investmentBreakdownBy, setInvestmentBreakdownBy] = useState<'instrument' | 'type' | 'currency' | 'counterparty'>('instrument');
    
    const { totalDebtUSD, debtBreakdown } = useMemo(() => {
        const snapshotDate = new Date(selectedDate + 'T00:00:00Z');
        const rateForDay = [...exchangeRates].reverse().find(r => new Date(r.date) <= snapshotDate)?.rate || 1;
        
        const activeDebts = debts.filter(d => new Date(d.originationDate) <= snapshotDate && snapshotDate <= new Date(d.dueDate));

        const getDebtKey = (debt: Debt): string => {
            switch (debtBreakdownBy) {
                case 'currency': return debt.currency;
                case 'counterparty':
                    if (debt.bankId) return banks.find(b => b.id === debt.bankId)?.name || 'N/D';
                    if (debt.brokerId) return brokers.find(b => b.id === debt.brokerId)?.name || 'N/D';
                    return 'N/D';
                case 'type': default: return debt.type;
            }
        };

        let totalDebtUSD = 0;
        const breakdown: Record<string, number> = {};

        activeDebts.forEach(debt => {
            const financials = calculateFinancialsForDate(debt, snapshotDate, appSettings);
            const accruedValue = (debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount) + financials.accruedInterest;
            const valueUSD = debt.currency === Currency.USD 
                ? accruedValue
                : accruedValue / rateForDay;

            totalDebtUSD += valueUSD;
            const key = getDebtKey(debt);
            breakdown[key] = (breakdown[key] || 0) + valueUSD;
        });
        
        const sortedBreakdown = Object.entries(breakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({ name, value }));
        
        return { totalDebtUSD, debtBreakdown: sortedBreakdown };
    }, [debts, exchangeRates, appSettings, selectedDate, debtBreakdownBy, banks, brokers]);

    const { totalInvestmentUSD, investmentBreakdown } = useMemo(() => {
        const snapshotDate = new Date(selectedDate + 'T00:00:00Z');
        const latestRate = [...exchangeRates].reverse().find(r => new Date(r.date) <= snapshotDate)?.rate || 1;
        const priceSnapshot = [...marketPriceHistory].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).find(s => new Date(s.date) <= snapshotDate);
        const currentMarketPrices = priceSnapshot ? priceSnapshot.prices : {};

        let totalUSD = 0;
        const breakdown: Record<string, number> = {};

        investments.forEach(inv => {
            const transactions = inv.transactions.filter(t => new Date(t.date) <= snapshotDate);
            if (!transactions || transactions.length === 0) return;

            const totalQuantity = transactions.reduce((acc, t) => acc + (t.type === 'Compra' ? t.quantity : -t.quantity), 0);
            if (totalQuantity <= 0.00001) return;
            
            const purchaseTxs = transactions.filter(t => t.type === 'Compra');
            const isFixedRate = purchaseTxs.length > 0 && purchaseTxs.every(t => t.isFixedRate);
            let marketValueNative = 0;

            if (isFixedRate) {
                const quantityBoughtTotal = purchaseTxs.reduce((sum, t) => sum + t.quantity, 0);
                const totalCostBasisNative = purchaseTxs.reduce((sum, t) => sum + (t.quantity * t.price), 0);
                const avgBuyPriceTotalNative = quantityBoughtTotal > 0 ? totalCostBasisNative / quantityBoughtTotal : 0;
                const costBasisRemainingNative = totalQuantity * avgBuyPriceTotalNative;
    
                const totalAccruedInterestOnPurchases = purchaseTxs.reduce((total, t) => {
                    const tea = t.tea || 0;
                    const elapsedDays = daysBetween(t.date, snapshotDate);
                    const principal = t.quantity * t.price;
                    const accruedInterest = principal * (tea / 100 / appSettings.annualRateBasis) * Math.max(0, elapsedDays);
                    return total + accruedInterest;
                }, 0);
                
                const proportionRemaining = quantityBoughtTotal > 0 ? totalQuantity / quantityBoughtTotal : 0;
                const accruedInterestOnRemaining = totalAccruedInterestOnPurchases * proportionRemaining;
                
                marketValueNative = costBasisRemainingNative + accruedInterestOnRemaining;
            } else {
                const marketPrice = currentMarketPrices[inv.instrumentName.toLowerCase()] || 0;
                marketValueNative = totalQuantity * marketPrice;
            }

            const valueUSD = inv.currency === Currency.USD ? marketValueNative : marketValueNative / latestRate;
            totalUSD += valueUSD;
            
            let key = 'N/D';
            switch (investmentBreakdownBy) {
                case 'instrument': key = inv.instrumentName.toUpperCase(); break;
                case 'type': key = investmentTypes.find(it => it.id === inv.investmentTypeId)?.name || 'N/D'; break;
                case 'currency': key = inv.currency; break;
                case 'counterparty': key = inv.brokerId ? brokers.find(b => b.id === inv.brokerId)?.name || 'N/D' : banks.find(b => b.id === inv.bankId)?.name || 'N/D'; break;
            }
            breakdown[key] = (breakdown[key] || 0) + valueUSD;
        });

         const sortedBreakdown = Object.entries(breakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([name, value]) => ({ name, value }));

        return { totalInvestmentUSD: totalUSD, investmentBreakdown: sortedBreakdown };
    }, [investments, marketPriceHistory, exchangeRates, appSettings, investmentTypes, selectedDate, investmentBreakdownBy, banks, brokers]);

    const netPosition = totalInvestmentUSD - totalDebtUSD;
    
    const formatUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">Posición Financiera Neta</h1>
                 <div className="flex items-center gap-2">
                    <label htmlFor="snapshotDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">Ver Snapshot Histórico:</label>
                    <input 
                      type="date" 
                      id="snapshotDate" 
                      value={selectedDate} 
                      onChange={(e) => setSelectedDate(e.target.value)}
                      max={getTodayArgentinaDate().toISOString().split('T')[0]}
                      className="block border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                    />
                </div>
            </div>
            
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 flex flex-col">
                    <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 text-center">Deuda Total Devengada</h3>
                    <p className="text-3xl font-bold text-red-700 dark:text-red-500 mt-2 text-center">{formatUSD(totalDebtUSD)}</p>
                    <div className="mt-4 border-t dark:border-gray-700 pt-2">
                        <label htmlFor="debt-breakdown" className="text-xs font-medium text-gray-600 dark:text-gray-300">Desglosar por:</label>
                        <select id="debt-breakdown" value={debtBreakdownBy} onChange={e => setDebtBreakdownBy(e.target.value as any)} className="w-full text-xs mt-1 block border border-gray-300 rounded-md shadow-sm py-1 px-2 bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                            <option value="type">Tipo</option>
                            <option value="currency">Moneda</option>
                            <option value="counterparty">Contraparte</option>
                        </select>
                    </div>
                    <div className="flex-grow min-h-[200px]"><BreakdownPieChart data={debtBreakdown} /></div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 flex flex-col">
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 text-center">Cartera de Inversión</h3>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2 text-center">{formatUSD(totalInvestmentUSD)}</p>
                    <div className="mt-4 border-t dark:border-gray-700 pt-2">
                        <label htmlFor="inv-breakdown" className="text-xs font-medium text-gray-600 dark:text-gray-300">Desglosar por:</label>
                        <select id="inv-breakdown" value={investmentBreakdownBy} onChange={e => setInvestmentBreakdownBy(e.target.value as any)} className="w-full text-xs mt-1 block border border-gray-300 rounded-md shadow-sm py-1 px-2 bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                            <option value="instrument">Instrumento</option>
                            <option value="type">Tipo</option>
                            <option value="currency">Moneda</option>
                            <option value="counterparty">Contraparte</option>
                        </select>
                    </div>
                    <div className="flex-grow min-h-[200px]"><BreakdownPieChart data={investmentBreakdown} /></div>
                </div>
                
                <div className={`p-4 rounded-lg text-center border flex flex-col justify-center shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700`}>
                    <h3 className={`text-xl font-semibold ${netPosition >= 0 ? 'text-blue-800 dark:text-blue-300' : 'text-yellow-800 dark:text-yellow-300'}`}>Posición Neta</h3>
                    <p className={`text-4xl font-bold mt-2 ${netPosition >= 0 ? 'text-primary dark:text-accent-dm' : 'text-yellow-600 dark:text-yellow-400'}`}>{formatUSD(netPosition)}</p>
                </div>
            </div>
        </div>
    );
};

export default NetPositionModule;