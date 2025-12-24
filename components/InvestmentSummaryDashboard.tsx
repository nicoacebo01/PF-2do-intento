import React, { useMemo, useCallback } from 'react';
import type { InvestmentGroup, AppSettings } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const PALETTE = ['#22c55e', '#16a34a', '#84cc16', '#a3e635', '#4ade80', '#10b981', '#059669'];

interface InvestmentSummaryDashboardProps {
  investmentGroups: InvestmentGroup[];
  chartFilter: { type: string; value: string } | null;
  setChartFilter: (filter: { type: 'investmentType'; value: string } | null) => void;
  appSettings: AppSettings;
}

const InvestmentSummaryDashboard: React.FC<InvestmentSummaryDashboardProps> = ({ investmentGroups, chartFilter, setChartFilter, appSettings }) => {

  const pieChartData = useMemo(() => {
    return investmentGroups.map(group => ({
      name: group.groupName,
      value: group.totalMarketValueUSD,
    }));
  }, [investmentGroups]);

  const handlePieClick = useCallback((data: any) => {
    const { name } = data;
    if (chartFilter && chartFilter.type === 'investmentType' && chartFilter.value === name) {
      setChartFilter(null);
    } else {
      setChartFilter({ type: 'investmentType', value: name });
    }
  }, [chartFilter, setChartFilter]);

  const formatUSD = (value: number) => `USD ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (pieChartData.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400"><p>No hay datos de inversión para mostrar.</p></div>;
  }
  
  const isDarkMode = appSettings.theme === 'dark';

  return (
    <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
        <PieChart>
            <Pie
                data={pieChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                onClick={handlePieClick}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                    const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
                    const x = Number(cx) + radius * Math.cos(-midAngle * (Math.PI / 180));
                    const y = Number(cy) + radius * Math.sin(-midAngle * (Math.PI / 180));
                    if (percent < 0.05) return null;
                    return (
                        <text x={x} y={y} fill={isDarkMode ? '#d1d5db' : '#4b5563'} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12">
                            {`${(percent * 100).toFixed(0)}%`}
                        </text>
                    );
                }}
            >
            {pieChartData.map((entry, index) => (
                <Cell 
                    key={`cell-${index}`} 
                    fill={PALETTE[index % PALETTE.length]}
                    opacity={chartFilter && chartFilter.type === 'investmentType' && chartFilter.value !== entry.name ? 0.3 : 1}
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s ease-in-out' }}
                />
            ))}
            </Pie>
            <Tooltip
                formatter={(value: number) => [formatUSD(value), "Valor Mercado"]}
                contentStyle={isDarkMode ? { backgroundColor: 'rgba(31, 41, 55, 0.9)', border: '1px solid #4b5563' } : {}}
                wrapperStyle={{ zIndex: 10 }}
            />
            <Legend iconSize={10} wrapperStyle={{fontSize: '12px'}}/>
        </PieChart>
        </ResponsiveContainer>
    </div>
  );
};

export default InvestmentSummaryDashboard;
