import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Investment } from '../types';
import { Currency } from '../types';
import { daysBetween, getTodayArgentinaDate } from '../utils/financials';
import { useFinancialCalculations } from '../utils/calculations';

interface InvestmentMaturitiesChartProps {
  investments: Investment[];
  currentMarketPrices: Record<string, number>;
}

const PALETTE = ['#22c55e', '#16a34a', '#84cc16', '#a3e635', '#4ade80', '#10b981', '#059669'];

const InvestmentMaturitiesChart: React.FC<InvestmentMaturitiesChartProps> = ({ investments, currentMarketPrices }) => {
  const { investmentTypes, appSettings, latestRate } = useFinancialCalculations();

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    investmentTypes.forEach((type, index) => {
      map[type.name] = PALETTE[index % PALETTE.length];
    });
    return map;
  }, [investmentTypes]);

  const chartData = useMemo(() => {
    const maturitiesByMonth: Record<string, Record<string, number>> = {};
    const today = getTodayArgentinaDate();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const liquidInstrumentQuantities: Record<string, { inv: Investment; quantity: number }> = {};

    // First, separate transactions into maturing vs liquid pools
    investments.forEach(inv => {
        let liquidQuantity = 0;
        inv.transactions.forEach(tx => {
            const quantity = tx.type === 'Compra' ? tx.quantity : -tx.quantity;
            if (tx.dueDate) {
                const dueDate = new Date(tx.dueDate + 'T00:00:00Z');
                if (dueDate < today) return;

                let maturityValueNative = 0;
                if (tx.isFixedRate && tx.tea) {
                    const principal = tx.quantity * tx.price;
                    const termDays = daysBetween(tx.date, tx.dueDate);
                    const interest = principal * (tx.tea / 100 / appSettings.annualRateBasis) * termDays;
                    maturityValueNative = principal + interest;
                } else {
                    maturityValueNative = tx.quantity; // Assume par value for bonds/other non-fixed rate with due date
                }

                const maturityValueUSD = inv.currency === Currency.USD ? maturityValueNative : maturityValueNative / latestRate;
                const monthKey = `${dueDate.getUTCFullYear()}-${String(dueDate.getUTCMonth() + 1).padStart(2, '0')}`;
                const typeName = investmentTypes.find(it => it.id === inv.investmentTypeId)?.name || 'N/D';

                if (!maturitiesByMonth[monthKey]) maturitiesByMonth[monthKey] = {};
                maturitiesByMonth[monthKey][typeName] = (maturitiesByMonth[monthKey][typeName] || 0) + maturityValueUSD;

            } else {
                liquidQuantity += quantity;
            }
        });

        if (liquidQuantity > 0.00001) {
            liquidInstrumentQuantities[inv.id] = { inv, quantity: liquidQuantity };
        }
    });

    // Process remaining quantities as liquid
    if (Object.keys(liquidInstrumentQuantities).length > 0) {
        if (!maturitiesByMonth[currentMonthKey]) {
            maturitiesByMonth[currentMonthKey] = {};
        }
        for (const id in liquidInstrumentQuantities) {
            const { inv, quantity } = liquidInstrumentQuantities[id];
            const typeName = investmentTypes.find(it => it.id === inv.investmentTypeId)?.name || 'N/D';
            const marketPrice = currentMarketPrices[inv.instrumentName.toLowerCase()] || 0;
            const marketValueNative = quantity * marketPrice;
            const valueUSD = inv.currency === Currency.USD ? marketValueNative : marketValueNative / latestRate;
            maturitiesByMonth[currentMonthKey][typeName] = (maturitiesByMonth[currentMonthKey][typeName] || 0) + valueUSD;
        }
    }


    return Object.entries(maturitiesByMonth)
      .map(([month, values]) => ({ month, ...values }))
      .sort((a, b) => a.month.localeCompare(b.month));

  }, [investments, investmentTypes, appSettings, currentMarketPrices, latestRate]);

  const formatUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (!chartData || chartData.length === 0) {
    return <div className="flex items-center justify-center h-80 text-gray-500 dark:text-gray-400">No hay vencimientos de inversiones para mostrar.</div>;
  }
  
  const investmentTypesWithMaturities = investmentTypes.filter(it => chartData.some(d => (d[it.name] || 0) > 0));
  
  const isDarkMode = appSettings.theme === 'dark';
  const tooltipStyle = {
      backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#ccc'}`,
      color: isDarkMode ? '#f3f4f6' : '#374151',
      borderRadius: '0.5rem'
  };
  const axisColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const today = getTodayArgentinaDate();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;


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
                 const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
                 return tick === currentMonthKey ? `Líquido (${label})` : label;
             }}
             tick={{ fill: axisColor }}
          />
          <YAxis tickFormatter={(tick) => `USD ${(tick / 1000000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}MM`} tick={{ fill: axisColor }} />
          <Tooltip 
            labelFormatter={(label) => {
                const [year, month] = label.split('-');
                const formattedDate = new Date(Number(year), Number(month) - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                return label === currentMonthKey ? `Posición Líquida (${formattedDate})` : formattedDate;
            }}
            formatter={(value: number, name: string) => [formatUSD(value), name]}
            contentStyle={tooltipStyle}
            cursor={{ fill: 'rgba(200, 200, 200, 0.2)' }}
          />
          <Legend wrapperStyle={{ color: axisColor }} />
          {investmentTypesWithMaturities.map(type => (
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

export default InvestmentMaturitiesChart;