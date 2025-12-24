import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Debt, DebtType, DailyExchangeRate, FutureExchangeRate, Cost, ArbitrageOperation, AppSettings } from '../types';
import { Currency } from '../types';
import { getTodayArgentinaDate, calculateFinancialsForDate } from '../utils/financials';

interface MaturitiesChartProps {
  debts: Debt[];
  debtTypes: DebtType[];
  exchangeRates: DailyExchangeRate[];
  futureExchangeRates: FutureExchangeRate[];
  arbitrageOperations: ArbitrageOperation[];
  appSettings: AppSettings;
}

const PALETTE = ['#1e40af', '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#84cc16', '#0891b2', '#f43f5e', '#64748b'];

const calculateProjectedRate = (debt: Debt, futureRates: FutureExchangeRate[], arbitrageOperations: ArbitrageOperation[]) => {
    const loanDueDate = new Date(debt.dueDate);
    const referenceSpotRate = debt.exchangeRateAtOrigination;

    const linkedArbitrage = (debt.linkedArbitrageOpIds && arbitrageOperations)
        ? arbitrageOperations.find(op => debt.linkedArbitrageOpIds?.includes(op.id))
        : undefined;

    if (linkedArbitrage?.arbitrageRate) {
        return linkedArbitrage.arbitrageRate;
    }

    if (futureRates.length > 0) {
        const loanDueTime = loanDueDate.getTime();
        const sortedFutureRates = [...futureRates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let rateBefore: { date: string, rate: number } | null = null;
        let rateAfter: { date: string, rate: number } | null = null;
        const spotAsFutureRate = { date: new Date().toISOString().split('T')[0], rate: referenceSpotRate };
        const combinedRates = [...sortedFutureRates, spotAsFutureRate].filter((v, i, a) => a.findIndex(t => (t.date === v.date)) === i).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const rate of combinedRates) {
            if (new Date(rate.date).getTime() <= loanDueTime) { rateBefore = rate; } else { rateAfter = rate; break; }
        }
        if (rateBefore && rateAfter) {
            const beforeTime = new Date(rateBefore.date).getTime();
            const afterTime = new Date(rateAfter.date).getTime();
            const timeDiffTotal = afterTime - beforeTime;
            if (timeDiffTotal > 0) {
                const timeDiffTarget = loanDueTime - beforeTime;
                const rateDiff = rateAfter.rate - rateBefore.rate;
                return rateBefore.rate + (rateDiff * (timeDiffTarget / timeDiffTotal));
            }
            return rateBefore.rate;
        } else if (rateBefore) {
            return rateBefore.rate;
        }
    }
    return referenceSpotRate; // Fallback to origination rate
};


const MaturitiesChart: React.FC<MaturitiesChartProps> = ({ debts, debtTypes, exchangeRates, futureExchangeRates, arbitrageOperations, appSettings }) => {
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    debtTypes.forEach((type, index) => {
      map[type.name] = PALETTE[index % PALETTE.length];
    });
    return map;
  }, [debtTypes]);

  const chartData = useMemo(() => {
    const maturitiesByMonth: Record<string, Record<string, number>> = {};
    const today = getTodayArgentinaDate();

    const activeDebts = debts.filter(d => new Date(d.dueDate) >= today);

    activeDebts.forEach(debt => {
      const financials = calculateFinancialsForDate(debt, new Date(debt.dueDate), appSettings);
      const { totalToRepay } = financials;
      let repaymentUSD: number;
      if (debt.currency === Currency.USD) {
        repaymentUSD = totalToRepay;
      } else {
        const projectedRate = calculateProjectedRate(debt, futureExchangeRates, arbitrageOperations);
        repaymentUSD = totalToRepay / projectedRate;
      }

      const dueDate = new Date(debt.dueDate);
      const monthKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;

      if (!maturitiesByMonth[monthKey]) {
        maturitiesByMonth[monthKey] = {};
      }
      maturitiesByMonth[monthKey][debt.type] = (maturitiesByMonth[monthKey][debt.type] || 0) + repaymentUSD;
    });

    return Object.entries(maturitiesByMonth)
      .map(([month, values]) => ({ month, ...values }))
      .sort((a, b) => a.month.localeCompare(b.month));

  }, [debts, futureExchangeRates, arbitrageOperations, appSettings]);
  
  const formatUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (!chartData || chartData.length === 0) {
    return <div className="flex items-center justify-center h-80 text-gray-500 dark:text-gray-400">No hay vencimientos futuros para mostrar.</div>;
  }
  
  const debtTypesWithMaturities = debtTypes.filter(dt => chartData.some(d => (d[dt.name] || 0) > 0));

  const isDarkMode = appSettings.theme === 'dark';
  const tooltipStyle = {
      backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#ccc'}`,
      color: isDarkMode ? '#f3f4f6' : '#374151',
      borderRadius: '0.5rem'
  };
  const axisColor = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div style={{ width: '100%', height: 350 }}>
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
          <XAxis 
             dataKey="month" 
             tickFormatter={(tick) => {
                 const [year, month] = tick.split('-');
                 return new Date(Number(year), Number(month) - 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
             }}
             tick={{ fill: axisColor }}
          />
          <YAxis tickFormatter={(tick) => `USD ${(tick / 1000000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}MM`} tick={{ fill: axisColor }} />
          <Tooltip 
            labelFormatter={(label) => {
                const [year, month] = label.split('-');
                return new Date(Number(year), Number(month) - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            }}
            formatter={(value: number, name: string) => [formatUSD(value), name]}
            contentStyle={tooltipStyle}
            cursor={{ fill: 'rgba(200, 200, 200, 0.2)' }}
          />
          <Legend wrapperStyle={{ color: axisColor }} />
          {debtTypesWithMaturities.map(type => (
            <Bar 
              key={type.id} 
              dataKey={type.name} 
              stackId="a" 
              fill={colorMap[type.name]} 
              name={type.name}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MaturitiesChart;