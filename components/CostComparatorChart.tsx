import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Debt } from '../types';
import { Currency } from '../types';
import { useFinancialCalculations } from '../utils/calculations';
import { formatPercentageForDisplay } from '../utils/formatting';

interface CostComparatorChartProps {
  debts: Debt[];
}

const PALETTE = ['#047857', '#10b981', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#84cc16', '#0891b2', '#f43f5e', '#64748b'];

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-2 border border-gray-300 dark:border-gray-600 rounded shadow-lg">
        <p className="font-bold">{label}</p>
        <p className="text-sm text-primary dark:text-accent-dm">{`CFT (USD): ${formatPercentageForDisplay(payload[0].value)}`}</p>
      </div>
    );
  }
  return null;
};

const CostComparatorChart: React.FC<CostComparatorChartProps> = ({ debts }) => {
  const { companyDebtCalculations, debtTypes, appSettings } = useFinancialCalculations();

  const chartData = useMemo(() => {
    const byType: Record<string, { weightedCftNumerator: number; principalUSD: number; }> = {};

    debts.forEach(debt => {
      if (!byType[debt.type]) {
        byType[debt.type] = { weightedCftNumerator: 0, principalUSD: 0 };
      }
      
      const calcs = companyDebtCalculations.get(debt.id);
      if (!calcs) return;

      const { financials, usdAnalysis } = calcs;
      
      const principalUSD = debt.currency === Currency.USD ? debt.amount : debt.amount / debt.exchangeRateAtOrigination;
      let cftInUsd: number | null = null;
      if (debt.currency === Currency.USD) cftInUsd = financials.cft;
      else if (usdAnalysis?.usd_cft) cftInUsd = usdAnalysis.usd_cft;

      if (cftInUsd !== null && isFinite(cftInUsd) && principalUSD > 0) {
        byType[debt.type].weightedCftNumerator += cftInUsd * principalUSD;
        byType[debt.type].principalUSD += principalUSD;
      }
    });

    return debtTypes
      .map(dt => {
        const data = byType[dt.name];
        if (!data || data.principalUSD === 0) return null;
        return {
          name: dt.name,
          cft: data.weightedCftNumerator / data.principalUSD,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.cft - a.cft);

  }, [debts, debtTypes, companyDebtCalculations]);

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">No hay datos para comparar.</div>;
  }
  
  const isDarkMode = appSettings.theme === 'dark';
  const axisColor = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div style={{ width: '100%', height: 250 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisColor }} />
          <YAxis tickFormatter={(value) => `${value.toLocaleString('es-AR', {maximumFractionDigits: 0})}%`} tick={{fill: axisColor}} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(200, 200, 200, 0.2)' }} />
          <Bar dataKey="cft">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CostComparatorChart;