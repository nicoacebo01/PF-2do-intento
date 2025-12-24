import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DebtType } from '../types';
import { useFinancialCalculations } from '../utils/calculations';

type ChartData = { date: string; [key: string]: string | number; };

interface DebtChartProps {
  data: ChartData[];
  debtTypes: DebtType[];
}

// Color palette for dynamic assignment
const PALETTE = ['#047857', '#10b981', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#84cc16', '#0891b2', '#f43f5e', '#64748b'];

const DebtChart: React.FC<DebtChartProps> = ({ data, debtTypes }) => {
  const { appSettings } = useFinancialCalculations();

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    debtTypes.forEach((type, index) => {
      map[type.name] = PALETTE[index % PALETTE.length];
    });
    return map;
  }, [debtTypes]);

  const debtTypesWithHistory = useMemo(() => {
    return debtTypes.filter(dt => data.some(d => (Number(d[dt.name]) || 0) > 0));
  }, [data, debtTypes]);
  
  const isDarkMode = appSettings.theme === 'dark';
  const tooltipStyle = {
      backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#ccc'}`,
      color: isDarkMode ? '#f3f4f6' : '#374151',
      borderRadius: '0.5rem'
  };
  const axisColor = isDarkMode ? '#9ca3af' : '#4b5563';

  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-80 text-gray-500 dark:text-gray-400">No hay datos históricos para mostrar.</div>;
  }

  return (
    <div style={{ width: '100%', height: 350 }}>
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} />
          <XAxis 
            dataKey="date" 
            tickFormatter={(dateStr) => {
              const date = new Date(dateStr + 'T00:00:00Z');
              return date.toLocaleDateString('es-AR', {month: 'short', year: '2-digit', timeZone: 'UTC'});
            }}
            tick={{ fill: axisColor }}
          />
          <YAxis tickFormatter={(value) => `USD ${(value / 1000000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}MM`} tick={{ fill: axisColor }} />
          <Tooltip 
            formatter={(value: number, name: string) => [`USD ${value.toLocaleString('es-AR', {maximumFractionDigits: 0})}`, name]} 
            labelFormatter={(label) => new Date(label + 'T00:00:00Z').toLocaleDateString('es-AR', {timeZone: 'UTC'})}
            contentStyle={tooltipStyle}
          />
          <Legend wrapperStyle={{ color: axisColor }} />
          {debtTypesWithHistory.map(type => (
            <Area
              key={type.id}
              type="monotone"
              dataKey={type.name}
              stackId="1"
              stroke={colorMap[type.name]}
              fill={colorMap[type.name]}
              name={type.name}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DebtChart;