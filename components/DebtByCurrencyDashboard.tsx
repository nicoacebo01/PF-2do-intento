import React, { useMemo, useCallback } from 'react';
import { Currency } from '../types';
import { useFinancialCalculations, selectActiveAndExpiredDebts } from '../utils/calculations';
import { useAppContext } from '../App';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const PALETTE = ['#047857', '#3b82f6', '#f97316', '#a855f7']; // Green for ARS, Blue for USD

interface DebtByCurrencyDashboardProps {
  chartFilter: { type: string; value: string } | null;
  setChartFilter: (filter: { type: 'currency'; value: string } | null) => void;
}

const DebtByCurrencyDashboard: React.FC<DebtByCurrencyDashboardProps> = ({ chartFilter, setChartFilter }) => {
  const { companyDebts, latestRate, appSettings } = useFinancialCalculations();

  const { activeDebts } = useMemo(() => selectActiveAndExpiredDebts(companyDebts), [companyDebts]);

  const currencyData = useMemo(() => {
    const debtByCurrency: Record<string, number> = {};

    activeDebts.forEach(debt => {
      const principalNative = debt.calculationMode === 'futureValue' ? (debt.netAmountReceived || 0) : debt.amount;
      const totalUSD = debt.currency === Currency.USD ? principalNative : principalNative / latestRate;
      debtByCurrency[debt.currency] = (debtByCurrency[debt.currency] || 0) + totalUSD;
    });

    return Object.entries(debtByCurrency).map(([name, value]) => ({ name, value }));

  }, [activeDebts, latestRate]);
  
  const pieChartData = useMemo(() => {
    return currencyData.map(item => ({
      name: `Deuda en ${item.name}`,
      value: item.value,
    }));
  }, [currencyData]);

  const handlePieClick = useCallback((data: any) => {
    const currency = data.name.split(' ').pop();
    if (chartFilter && chartFilter.type === 'currency' && chartFilter.value === currency) {
        setChartFilter(null);
    } else {
        setChartFilter({ type: 'currency', value: currency });
    }
  }, [chartFilter, setChartFilter]);

  const formatUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (currencyData.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm"><p>No hay deudas para mostrar.</p></div>;
  }
  
  return (
    <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
        <PieChart>
            <Pie
                data={pieChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                labelLine={false}
                onClick={handlePieClick}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                    const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
                    const x = Number(cx) + radius * Math.cos(-midAngle * (Math.PI / 180));
                    const y = Number(cy) + radius * Math.sin(-midAngle * (Math.PI / 180));
                    if (percent < 0.05) return null;
                    return (
                        <text x={x} y={y} fill={appSettings.theme === 'dark' ? '#d1d5db' : '#4b5563'} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12">
                            {`${(percent * 100).toFixed(0)}%`}
                        </text>
                    );
                }}
            >
            {pieChartData.map((entry, index) => {
                const currency = entry.name.split(' ').pop();
                return (
                    <Cell 
                        key={`cell-${index}`} 
                        fill={PALETTE[index % PALETTE.length]}
                        opacity={chartFilter && chartFilter.type === 'currency' && chartFilter.value !== currency ? 0.5 : 1}
                        style={{ cursor: 'pointer', transition: 'opacity 0.2s ease-in-out' }}
                    />
                );
            })}
            </Pie>
            <Tooltip
                formatter={(value: number) => [formatUSD(value), "Deuda"]}
                contentStyle={appSettings.theme === 'dark' ? { backgroundColor: 'rgba(31, 41, 55, 0.9)', border: '1px solid #4b5563' } : {}}
                wrapperStyle={{ zIndex: 10 }}
            />
            <Legend iconSize={10} wrapperStyle={{fontSize: '12px'}}/>
        </PieChart>
        </ResponsiveContainer>
    </div>
  );
};

export default DebtByCurrencyDashboard;